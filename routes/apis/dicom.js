const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const url = require('url')
const dicomTag = require('../../assets/DICOM-Tags.json')
const { GET_DCM4CHEE_downloadDCM } = require('../../axios/DCM4CHEE')

function parseQueryParams(req) {
    const queryObject = url.parse(req.url, true).query
    return queryObject
}

router.route('/').get(async (req, res) => {
    /* 	
            #swagger.tags = ['Dicom']
            #swagger.description = '取得DICOM JSON Data' 
        */
    try {
        const queryParams = parseQueryParams(req)
        let { limit, offset, sort, desc } = queryParams
        offset = offset * limit

        delete queryParams.desc
        delete queryParams.status
        delete queryParams.sort

        queryParams.PatientName = decodeURIComponent(queryParams.PatientName || '')
        const { data } = await axios.get(process.env.PACS_URL, {
            params: queryParams,
        })

        const { data: count } = await axios.get(process.env.PACS_URL)

        const reduceData = ({ header, d }) => {
            const afterFormSeries = dicomTag[header].reduce((accumulator, currentValue) => {
                return {
                    ...accumulator,
                    [currentValue.keyword]: (d[currentValue.tag]['Value'] && d[currentValue.tag]['Value'][0]) || null,
                }
            }, {})
            return afterFormSeries
        }

        const asyncGetSeries = async (studyUID) => {
            const { data } = await axios.get(process.env.PACS_URL + `/${studyUID}/series`)
            return data
        }

        const asyncGetInstances = async (studyUID, seriesUID) => {
            const { data } = await axios.get(process.env.PACS_URL + `/${studyUID}/series/${seriesUID}/instances`)
            return data
        }

        const result = data.map((d) => {
            const patient = reduceData({ header: 'patient', d })
            const study = reduceData({ header: 'study', d })
            return { ...patient, ...study }
        })

        const asyncRes = await Promise.all(
            result.map(async (i) => {
                const { data } = await axios.get(process.env.PACS_URL + `/${i.StudyInstanceUID}/instances`)
                const instances = data[0]

                const SeriesInstanceUID = instances['0020000E']['Value'][0]
                const SOPInstanceUID = instances['00080018']['Value'][0]

                // search for series of study
                const originalSeries = await asyncGetSeries(i.StudyInstanceUID)
                const series = await Promise.all(
                    originalSeries
                        .map((s) => {
                            return reduceData({ header: 'series', d: s })
                        })
                        .map(async (s) => {
                            const originalInstances = await asyncGetInstances(i.StudyInstanceUID, s.SeriesInstanceUID)
                            return {
                                ...s,
                                StudyInstanceUID: i.StudyInstanceUID,
                                instances: originalInstances.map((i) => reduceData({ header: 'instances', d: i })),
                            }
                        })
                )

                return {
                    ...i,
                    series,
                    imageURL: `${process.env.DICOM_JPEG_URL}?requestType=WADO&studyUID=${i.StudyInstanceUID}&seriesUID=${SeriesInstanceUID}&objectUID=${SOPInstanceUID}&contentType=image/jpeg`,
                }
            })
        )

        return res.status(200).json({ results: asyncRes, count: count.length })
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

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

module.exports = router
