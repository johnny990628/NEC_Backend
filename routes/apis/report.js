const express = require('express')
const router = express.Router()

const REPORT = require('../../models/report')

router
    .route('/')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Reports']
            #swagger.description = '取得報告' 
        */
        try {
            const { search, limit, offset, sort, desc } = req.query

            if (!limit || !offset) return res.status(400).json({ message: 'Need a limit and offset' })

            const searchRe = new RegExp(search)
            const searchQuery = search
                ? {
                      $or: [{ patientID: searchRe }],
                  }
                : {}

            const reports = await REPORT.aggregate([
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
                        from: 'users',
                        let: { pid: '$userID' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', { $toObjectId: '$$pid' }],
                                    },
                                },
                            },
                        ],
                        as: 'user',
                    },
                },
                {
                    $lookup: {
                        from: 'schedules',
                        let: {
                            customerId: '$_id',
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            {
                                                $toObjectId: '$reportID',
                                            },
                                            '$$customerId',
                                        ],
                                    },
                                },
                            },
                        ],
                        as: 'schedule',
                    },
                },
                { $sort: { [sort]: Number(desc) } },
                { $skip: Number(limit) * Number(offset) },
                { $limit: Number(limit) },
                {
                    $addFields: {
                        schedule: { $arrayElemAt: ['$schedule', 0] },
                        patient: { $arrayElemAt: ['$patient', 0] },
                        user: { $arrayElemAt: ['$user', 0] },
                    },
                },
            ])

            const count = await REPORT.find(searchQuery).countDocuments()
            return res.status(200).json({ count, results: reports })
        } catch (e) {
            console.log(e)
            return res.status(500).json({ message: e.message })
        }
    })
    .post(async (req, res) => {
        /* 	
            #swagger.tags = ['Reports']
            #swagger.description = '加入排程' 
        */
        try {
            let report = new REPORT({ ...req.body })
            report = await report.save()
            return res.status(200).json(report)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

router
    .route('/:reportID')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Reports']
            #swagger.description = '取得一則報告' 
        */
        try {
            const { reportID } = req.params
            const report = await REPORT.findOne({ _id: reportID }).populate('patient').populate('user')
            return res.status(200).json(report)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .patch(async (req, res) => {
        /* 	
            #swagger.tags = ['Reports']
            #swagger.description = '修改報告' 
        */
        try {
            const { reportID } = req.params
            const report = await REPORT.findOneAndUpdate(
                { _id: reportID },
                { $push: { records: req.body.report }, $set: { status: req.body.status, userID: req.body.userID } },
                { returnDocument: 'after' }
            )
            return res.status(200).json(report)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        try {
            const { reportID } = req.params
            const report = await REPORT.findOneAndDelete({ _id: reportID })
            if (!report) return res.status(404).json({ message: '找不到報告資料' })
            return res.status(200).json(report)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

// router.route('/:patientID').post(async (req, res) => {
//     try {
//         const { patientID } = req.params
//         const patient = await Patient.findOneAndUpdate(
//             { id: patientID },
//             { $set: { processing: false }, $push: { reports: { records: req.body.report } } },
//             { returnDocument: 'after' }
//         )
//         return res.status(200).json(patient)
//     } catch (e) {
//         return res.status(500).json({ message: e.message })
//     }
// })

// router.route('/:patientID/:reportID').patch(async (req, res) => {
//     try {
//         const { patientID, reportID } = req.params
//         const { _id, ...report } = req.body.report
//         const patient = await Patient.findOneAndUpdate(
//             { id: patientID },
//             { $push: { 'reports.$[report].records': report } },
//             {
//                 arrayFilters: [{ 'report._id': reportID }],
//                 returnDocument: 'after',
//             }
//         )
//         return res.status(200).json(patient)
//     } catch (e) {
//         return res.status(500).json({ message: e.message })
//     }
// })

module.exports = router
