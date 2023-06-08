const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const url = require('url')
const DICOM = require('../../models/dicom')

router.route('/').get(async (req, res) => {
    try {
        const data = await DICOM.find()
        const results = data.sort((a, b) => a.weights - b.weights)
        return res.status(200).json({ results, count: results.length })
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/').post(async (req, res) => {
    try {
        let dicom = new DICOM(req.body)
        dicom = await dicom.save()
        return res.status(200).json(dicom)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/sort').patch(async (req, res) => {
    try {
        const data = req.body
        for (let i = 0; i < data.length; i++) {
            const dicom = await DICOM.findById(data[i]._id)
            if (!dicom) return res.status(404).json({ message: 'Data not found.' })
            Object.assign(dicom, data[i])
            await dicom.save()
        }

        const dicomDatas = await DICOM.find()
        const results = dicomDatas.sort((a, b) => a.weights - b.weights)
        return res.status(200).json({ results, count: dicomDatas.length })
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/:id').patch(async (req, res) => {
    try {
        const dicom = await DICOM.findById(req.params.id)
        if (!dicom) return res.status(404).json({ message: 'Data not found.' })
        Object.assign(dicom, req.body)
        await dicom.save()
        return res.status(200).json(dicom)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/:id').delete(async (req, res) => {
    try {
        const dicom = await DICOM.findById(req.params.id)
        if (!dicom) return res.status(404).json({ message: 'Data not found.' })
        await dicom.remove()
        return res.status(200).json(dicom)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/:id').get(async (req, res) => {
    try {
        const dicom = await DICOM.findById(req.params.id)
        if (!dicom) return res.status(404).json({ message: 'Data not found.' })
        return res.status(200).json(dicom)
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})

router.route('/test').post(async (req, res) => {
    try {
        const { pacsURL, wadoURL } = req.body

        const pacsURLTest = await axios.get(pacsURL + '/studies')
        const studyInstanceUID = pacsURLTest.data[0]['0020000D']['Value'][0]
        const seriesID = await axios.get(pacsURL + '/studies/' + studyInstanceUID + '/series')
        const seriesInstanceUID = seriesID.data[0]['0020000E']['Value'][0]
        const instances = await axios.get(
            pacsURL + '/studies/' + studyInstanceUID + '/series/' + seriesInstanceUID + '/instances'
        )
        const SOPInstanceUID = instances.data[0]['00080018']['Value'][0]

        const wadoURLTestURL =
            wadoURL +
            '/wado?requestType=WADO&studyUID=' +
            studyInstanceUID +
            '&seriesUID=' +
            seriesInstanceUID +
            '&objectUID=' +
            SOPInstanceUID
        const wadoURLTest = await axios.get(wadoURLTestURL)

        return res.status(200).json({
            pacsURL: pacsURLTest.status === 200 ? true : false,
            wadoURL: wadoURLTest.status === 200 ? true : false,
        })
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
})
module.exports = router
