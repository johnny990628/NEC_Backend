const express = require('express')
const router = express.Router()

const PATIENT = require('../../models/patient')
const REPORT = require('../../models/report')
const BLOOD = require('../../models/blood')
const SCHEDULE = require('../../models/schedule')

router
    .route('/')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Patients']
            #swagger.description = '取得病人' 
        */
        try {
            const { limit, offset, search, sort, desc, dateRange, status } = req.query
            const { from, to } = JSON.parse(dateRange)

            if (!limit || !offset) return res.status(400).json({ message: 'Need a limit and offset' })

            const searchRe = new RegExp(search)
            const searchQuery = search
                ? {
                      $or: [{ id: searchRe }, { name: searchRe }],
                  }
                : {}

            const dateConditions = {
                createdAt: {
                    $gte: new Date(from),
                    $lte: new Date(to),
                },
            }

            const patients = await PATIENT.aggregate([
                { $match: searchQuery },
                { $match: dateConditions },
                {
                    $lookup: {
                        from: 'schedules',
                        localField: 'id',
                        foreignField: 'patientID',
                        as: 'schedule',
                    },
                },
                {
                    $lookup: {
                        from: 'reports',
                        localField: 'id',
                        foreignField: 'patientID',
                        as: 'report',
                    },
                },

                { $sort: { [sort]: Number(desc) } },
                { $skip: Number(limit) * Number(offset) },
                { $limit: Number(limit) },
                {
                    $addFields: {
                        schedule: '$schedule',
                        creator: { $arrayElemAt: ['$creator', 0] },
                    },
                },
                {
                    $project: {
                        'creator.password': 0,
                    },
                },
            ])

            const count = await PATIENT.find(searchQuery).countDocuments()

            // const patients = await PATIENT.find(searchQuery)
            //     .sort({ [sort]: desc })
            //     .limit(limit)
            //     .skip(limit * offset)
            //     .populate('schedule')
            //     .populate('blood')
            //     .populate('report')
            return res.status(200).json({ count, results: patients })
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .post(async (req, res) => {
        /* 	
            #swagger.tags = ['Patients']
            #swagger.description = '新增病人' 
        */
        try {
            let patient = new PATIENT(req.body)
            patient = await patient.save()
            return res.status(200).json(patient)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        try {
            const { patientID } = req.body
            const patient = await PATIENT.findOneAndDelete({ id: patientID })
            await REPORT.findOneAndDelete({ patientID, status: 'pending' })
            await SCHEDULE.findOneAndDelete({ patientID })
            // await BLOOD.findOneAndDelete({ patientID })
            return res.status(200).json(patient)
        } catch (err) {
            console.log(err)
            return res.status(500).json({ message: e.message })
        }
    })

router
    .route('/:patientID')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Patients']
            #swagger.description = '取得一個病人' 
        */
        try {
            const { patientID } = req.params
            const patient = await PATIENT.findOne({ id: patientID })
            return res.status(200).json(patient)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .patch(async (req, res) => {
        /* 	
            #swagger.tags = ['Patients']
            #swagger.description = '修改病人' 
        */
        try {
            const { patientID } = req.params
            const patient = await PATIENT.findOneAndUpdate(
                { id: patientID },
                { $set: { ...req.body } },
                { returnDocument: 'after' }
            )
            return res.status(200).json(patient)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        /* 	
            #swagger.tags = ['Patients']
            #swagger.description = '刪除病人' 
        */
        try {
            const { patientID } = req.params
            const patient = await PATIENT.findOneAndDelete({ id: patientID })
            return res.status(200).json(patient)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

module.exports = router
