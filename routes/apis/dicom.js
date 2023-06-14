const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const url = require('url')
const dicomTag = require('../../assets/DICOM-Tags.json')
const PACSSETTING = require('../../models/dicom')
const { GET_DCM4CHEE_downloadDCM } = require('../../axios/DCM4CHEE')

function parseQueryParams(req) {
    const queryObject = url.parse(req.url, true).query
    return queryObject
}

const reduceData = ({ header, d }) => {
    const afterFormSeries = dicomTag[header].reduce((accumulator, currentValue) => {
        const value = d[currentValue.tag]?.Value?.[0] // 添加属性存在性的检查
        return {
            ...accumulator,
            [currentValue.keyword]: value || null,
        }
    }, {})

    return afterFormSeries
}

const getArrayWithPagination = (originalArray, limit, offset) => {
    const startIndex = offset * limit
    const endIndex = offset + limit
    const newArray = originalArray.slice(startIndex, endIndex)
    return newArray
}

const asyncGetSeries = async (pacs, studyUID) => {
    const fetchURL = `${pacs.serverURL}${pacs.pacsQidoURL}/studies/${studyUID}/series`
    const { data } = await axios.get(fetchURL)

    return data
}

const asyncGetInstances = async (pacs, studyUID, seriesUID) => {
    const fetchURL = `${pacs.serverURL}${pacs.pacsQidoURL}/studies/${studyUID}/series/${seriesUID}/instances`
    const { data } = await axios.get(fetchURL)
    return data
}

const getPacsesStudies = async (pacsSetting, queryParams) => {
    const pacsesStudies = await Promise.all(
        pacsSetting.map(async (pacsConfig) => {
            const fetchURL = `${pacsConfig.serverURL}${pacsConfig.pacsQidoURL}/studies`

            const { data: dicom } = await axios.get(fetchURL, {
                params: queryParams,
            })

            const result =
                dicom.length > 0
                    ? dicom.map((d) => {
                          return { ...d, pacsConfig }
                      })
                    : []

            return result
        })
    )

    const results = pacsesStudies.map((item) => {
        return item.map((d) => {
            const patient = reduceData({ header: 'patient', d })
            const study = reduceData({ header: 'study', d })
            const pacsConfig = d.pacsConfig
            return { ...patient, ...study, pacsConfig, dicomTag: d }
        })
    })
    return results
}

const getMappingPacs = (pacsesStudies) => {
    const results = pacsesStudies.reduce((accumulator, currentValue) => {
        currentValue.forEach((item) => {
            const { StudyInstanceUID, pacsConfig } = item
            const existingItem = accumulator.find((accItem) => accItem.StudyInstanceUID === StudyInstanceUID)
            if (existingItem) {
                // If item with the same name already exists in the accumulator, merge the properties
                existingItem.pacsOf = [
                    ...existingItem.pacsOf,
                    { pacsName: pacsConfig.pacsName, shorteningPacsName: pacsConfig.shorteningPacsName },
                ]
            } else {
                // Otherwise, add the item to the accumulator
                item.pacsOf = [{ pacsName: pacsConfig.pacsName, shorteningPacsName: pacsConfig.shorteningPacsName }]
                accumulator.push(item)
            }
        })
        return accumulator
    }, [])
    return results
}

const getWolePacsStudies = async (arrayWithPaginationData) => {
    const results = await Promise.all(
        arrayWithPaginationData.map(async (study) => {
            try {
                const originalSeries = await asyncGetSeries(study.pacsConfig, study.StudyInstanceUID)
                const series = originalSeries.map((d) => {
                    const reducedSeries = reduceData({ header: 'series', d })
                    return { dicomTag: d, ...reducedSeries }
                })

                return { ...study, series }
            } catch (error) {
                // 处理错误，例如打印错误消息或抛出自定义错误
                console.error('Error occurred:', error)
                // 抛出自定义错误
                throw new Error('Failed to retrieve series data.')
            }
        })
    )
    return results
}

const getWolePacsStudiesInstances = async (wholePacsStudies) => {
    const results = await Promise.all(
        wholePacsStudies.map(async (study) => {
            var SeriesInstanceUID = null
            var SOPInstanceUID = null
            const result = await Promise.all(
                study.series.map(async (series) => {
                    const originalInstances = await asyncGetInstances(
                        study.pacsConfig,
                        study.StudyInstanceUID,
                        series.SeriesInstanceUID
                    )
                    SeriesInstanceUID = originalInstances[0]['0020000E']['Value'][0]
                    SOPInstanceUID = originalInstances[0]['00080018']['Value'][0]

                    const instances = originalInstances.map((d) => {
                        const reducedInstances = reduceData({ header: 'instances', d })
                        return { dicomTag: d, ...reducedInstances }
                    })
                    return { ...series, instances }
                })
            )
            return { ...study, series: result, SeriesInstanceUID, SOPInstanceUID }
        })
    )
    return results
}

router.route('/').get(async (req, res) => {
    try {
        const queryParams = parseQueryParams(req)
        let { limit, offset, sort, desc } = queryParams

        delete queryParams.desc
        delete queryParams.status
        delete queryParams.sort
        queryParams.PatientName = decodeURIComponent(queryParams.PatientName || '')

        const pacsSetting = await PACSSETTING.find({ isOpen: true })

        //獲取所有pacs的study
        const pacsesStudies = await getPacsesStudies(pacsSetting, queryParams)

        //將所有pacs合併
        const mappingPacs = getMappingPacs(pacsesStudies)

        //分頁
        const arrayWithPaginationData = getArrayWithPagination(mappingPacs, limit, offset)

        //獲取所有pacs的study的series
        const wholePacsStudies = await getWolePacsStudies(arrayWithPaginationData)

        //獲取所有pacs的study的series的instances
        const wholePacsStudiesInstances = await getWolePacsStudiesInstances(wholePacsStudies)

        const results = wholePacsStudiesInstances.map((item) => {
            const { pacsConfig } = item
            return {
                ...item,
                imageURL: `${pacsConfig.serverURL}${pacsConfig.pacsWadoURL}/wado?requestType=WADO&studyUID=${item.StudyInstanceUID}&seriesUID=${item.SeriesInstanceUID}&objectUID=${item.SOPInstanceUID}&contentType=image/jpeg`,
            }
        })

        return res.status(200).json({ results, count: mappingPacs.length })
    } catch (err) {
        return res.status(500).json({ message: err.message })
    }
})

// router.route('/').get(async (req, res) => {
//     /*
//             #swagger.tags = ['Dicom']
//             #swagger.description = '取得DICOM JSON Data'
//         */
//     try {
//         const queryParams = parseQueryParams(req)
//         let { limit, offset, sort, desc } = queryParams
//         offset = offset * limit

//         delete queryParams.desc
//         delete queryParams.status
//         delete queryParams.sort

//         queryParams.PatientName = decodeURIComponent(queryParams.PatientName || '')
//         const { data } = await axios.get(process.env.PACS_URL, {
//             params: queryParams,
//         })

//         const { data: count } = await axios.get(process.env.PACS_URL)

//         const asyncGetSeries = async (studyUID) => {
//             const { data } = await axios.get(process.env.PACS_URL + `/${studyUID}/series`)
//             return data
//         }

//         const asyncGetInstances = async (studyUID, seriesUID) => {
//             const { data } = await axios.get(process.env.PACS_URL + `/${studyUID}/series/${seriesUID}/instances`)
//             return data
//         }

//         const result = data.map((d) => {
//             const patient = reduceData({ header: 'patient', d })
//             const study = reduceData({ header: 'study', d })
//             return { ...patient, ...study, dicomTag: d }
//         })

//         const asyncRes = await Promise.all(
//             result.map(async (i) => {
//                 const { data } = await axios.get(process.env.PACS_URL + `/${i.StudyInstanceUID}/instances`)
//                 const instances = data[0]

//                 const SeriesInstanceUID = instances['0020000E']['Value'][0]
//                 const SOPInstanceUID = instances['00080018']['Value'][0]

//                 // search for series of study
//                 const originalSeries = await asyncGetSeries(i.StudyInstanceUID)
//                 const series = await Promise.all(
//                     originalSeries
//                         .map((s) => {
//                             return { ...reduceData({ header: 'series', d: s }), dicomTag: s }
//                         })
//                         .map(async (s) => {
//                             const originalInstances = await asyncGetInstances(i.StudyInstanceUID, s.SeriesInstanceUID)
//                             return {
//                                 ...s,
//                                 StudyInstanceUID: i.StudyInstanceUID,
//                                 instances: originalInstances.map((i) => {
//                                     return { ...reduceData({ header: 'instances', d: i }), dicomTag: i }
//                                 }),
//                             }
//                         })
//                 )

//                 return {
//                     ...i,
//                     series,
//                     imageURL: `${process.env.DICOM_JPEG_URL}?requestType=WADO&studyUID=${i.StudyInstanceUID}&seriesUID=${SeriesInstanceUID}&objectUID=${SOPInstanceUID}&contentType=image/jpeg`,
//                 }
//             })
//         )

//         return res.status(200).json({ results: asyncRes, count: count.length })
//     } catch (e) {
//         return res.status(500).json({ message: e.message })
//     }
// })

router.route('/downloadDCM').get(async (req, res) => {
    try {
        const queryParams = parseQueryParams(req)
        const { pacsID, studyUID } = queryParams

        const { serverURL, pacsQidoURL } = await PACSSETTING.findOne({ _id: pacsID })

        const paramsPacsURL = `${serverURL}${pacsQidoURL}/studies/${studyUID}?accept=application/zip&dicomdir=true`
        console.log(paramsPacsURL)
        const response = await GET_DCM4CHEE_downloadDCM(paramsPacsURL)
        response.data.pipe(res)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/:id').get(async (req, res) => {
    /* 	
            #swagger.tags = ['Dicom']
            #swagger.description = '取得單一DICOM' 
        */
    try {
        const { id } = req.params

        if (!id) return res.status(404).json({ message: '找不到DICOM' })
        return res.status(200).json(id)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/setting').get(async (req, res) => {
    try {
        const data = ['awd', 'awdawd']
        return res.status(200).json(data)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

module.exports = router
