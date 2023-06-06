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
        return {
            ...accumulator,
            [currentValue.keyword]: (d[currentValue.tag]['Value'] && d[currentValue.tag]['Value'][0]) || null,
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
    const { data } = await axios.get(`${pacs.pacsURL}/${pacs.pacsAETitle}/rs/studies/${studyUID}/series`)

    return data
}

const asyncGetInstances = async (pacs, studyUID, seriesUID) => {
    const { data } = await axios.get(
        `${pacs.pacsURL}/${pacs.pacsAETitle}/rs/studies/${studyUID}/series/${seriesUID}/instances`
    )
    return data
}

router.route('/').get(async (req, res) => {
    try {
        const queryParams = parseQueryParams(req)
        let { limit, offset, sort, desc } = queryParams

        delete queryParams.desc
        delete queryParams.status
        delete queryParams.sort
        queryParams.PatientName = decodeURIComponent(queryParams.PatientName || '')

        const pacsSetting = await PACSSETTING.find()

        //獲取所有pacs的study
        const pacsesStudies = await Promise.all(
            pacsSetting.map(async (pacsConfig) => {
                const dicom = await axios.get(`${pacsConfig.pacsURL}/${pacsConfig.pacsAETitle}/rs/studies`)
                const result = dicom.data.map((d) => {
                    return { ...d, pacsConfig }
                })
                return result
            })
        )

        //dicomTag轉換
        const reducedDatas = pacsesStudies.map((item) => {
            return item.map((d) => {
                const patient = reduceData({ header: 'patient', d })
                const study = reduceData({ header: 'study', d })
                const pacsConfig = d.pacsConfig
                return { ...patient, ...study, pacsConfig, dicomTag: d }
            })
        })

        //獲取所有pacs的study的series
        const wholePacsStudies = await Promise.all(
            reducedDatas.map(async (pacs) => {
                const result = await Promise.all(
                    pacs.map(async (study) => {
                        const originalSeries = await asyncGetSeries(study.pacsConfig, study.StudyInstanceUID)
                        const series = originalSeries.map((d) => {
                            const reducedSeries = reduceData({ header: 'series', d })
                            return { dicomTag: d, ...reducedSeries }
                        })
                        return { ...study, series }
                    })
                )
                return result
            })
        )

        //獲取所有pacs的study的series的instances
        const wholePacsStudiesInstances = await Promise.all(
            wholePacsStudies.map(async (pacs) => {
                const result = await Promise.all(
                    pacs.map(async (study) => {
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
                return result
            })
        )

        //將所有pacs合併
        const beforePaginationResults = wholePacsStudiesInstances.reduce((accumulator, currentValue) => {
            currentValue.forEach((item) => {
                const { StudyInstanceUID, pacsConfig } = item
                const existingItem = accumulator.find((accItem) => accItem.StudyInstanceUID === StudyInstanceUID)
                if (existingItem) {
                    // If item with the same name already exists in the accumulator, merge the properties
                    existingItem.pacsOf = [...existingItem.pacsOf, pacsConfig.pacsName]
                } else {
                    // Otherwise, add the item to the accumulator
                    item.pacsOf = [pacsConfig.pacsName]
                    accumulator.push(item)
                }
            })
            return accumulator
        }, [])

        const getArrayWithPaginationData = getArrayWithPagination(beforePaginationResults, limit, offset)

        const results = getArrayWithPaginationData.map((item) => {
            const { pacsConfig } = item
            return {
                ...item,
                imageURL: `${pacsConfig.pacsWadoURL}/${pacsConfig.pacsAETitle}/wado?requestType=WADO&studyUID=${item.StudyInstanceUID}&seriesUID=${item.SeriesInstanceUID}&objectUID=${item.SOPInstanceUID}&contentType=image/jpeg`,
            }
        })

        return res.status(200).json({ results, count: beforePaginationResults.length })
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

router.route('/downloadDCM/:studyUID').get(async (req, res) => {
    try {
        const { studyUID } = req.params
        const params = `/${studyUID}?accept=application/zip&dicomdir=true`
        const response = await GET_DCM4CHEE_downloadDCM(params)
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
