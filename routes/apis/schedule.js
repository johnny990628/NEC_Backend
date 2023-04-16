const express = require('express')
const router = express.Router()

const SCHEDULE = require('../../models/schedule')
const BLOOD = require('../../models/blood')
const REPORT = require('../../models/report')

router
    .route('/')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '取得排程' 
        */
        try {
            const { search, dateFrom, dateTo } = req.query

            const searchRe = new RegExp(search)
            const searchQuery = search
                ? {
                      $or: [{ procedureCode: searchRe }, { patientID: searchRe }],
                  }
                : {}

            const dateConditions =
                dateFrom && dateTo
                    ? {
                          createdAt: {
                              $gte: new Date(dateFrom),
                              $lte: new Date(dateTo),
                          },
                      }
                    : {}

            const schedule = await SCHEDULE.aggregate([
                { $match: dateConditions },
                { $match: searchQuery },
                {
                    $lookup: {
                        from: 'patients',
                        localField: 'patientID',
                        foreignField: 'id',
                        as: 'patient',
                    },
                },
                {
                    $lookup: {
                        from: 'reports',
                        let: { pid: '$reportID' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', { $toObjectId: '$$pid' }],
                                    },
                                },
                            },
                        ],
                        as: 'report',
                    },
                },
                {
                    $addFields: {
                        patient: { $arrayElemAt: ['$patient', 0] },
                        report: { $arrayElemAt: ['$report', 0] },
                    },
                },
            ])

            // const schedule = await SCHEDULE.find(query).populate('patient').populate('report')
            const count = await SCHEDULE.find(searchQuery).countDocuments()

            return res.status(200).json({ results: schedule, count })
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .post(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '新增排程' 
        */
        try {
            let schedule = new SCHEDULE(req.body)
            schedule = await schedule.save()
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .patch(async (req, res) => {
        try {
            const { patientID, scheduleID, status } = req.body
            const schedule = await SCHEDULE.findOneAndUpdate({ _id: scheduleID }, { $set: { status } }, { returnDocument: 'after' })
            // if (patientID) {
            //     await REPORT.findOneAndDelete({ patientID, status: 'pending' })
            //     await BLOOD.findOneAndDelete({ patientID })
            // }

            if (!schedule) return res.status(404).json({ message: '找不到排程資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        try {
            const { patientID } = req.body
            const schedule = await SCHEDULE.findOneAndDelete({ patientID, status: 'wait-examination' })
            await REPORT.findOneAndDelete({ _id: schedule.reportID })
            // await BLOOD.findOneAndDelete({ patientID })
            if (!schedule) return res.status(404).json({ message: '找不到排程資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

router
    .route('/:_id')
    .patch(async (req, res) => {
        /* 	
            #swagger.tags = ['Schedule']
            #swagger.description = '修改排程' 
        */
        try {
            const { _id } = req.params
            const schedule = await SCHEDULE.findOneAndUpdate({ _id: _id }, { $set: { ...req.body } }, { returnDocument: 'after' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        /* 	
        #swagger.tags = ['Schedule']
        #swagger.description = '刪除排程' 
    */
        try {
            const { _id } = req.params
            const schedule = await SCHEDULE.findOneAndDelete({ _id })
            if (!schedule) return res.status(404).json({ message: '找不到報告資料' })
            return res.status(200).json(schedule)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

module.exports = router
