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
        return res.status(200).json({ results: data, count: data.length })
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
        return res.status(200).json({ message: 'Data deleted.' })
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
module.exports = router
