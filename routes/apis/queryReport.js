const express = require('express')
const router = express.Router()
const url = require('url')

router.route('/').get(async (req, res) => {
    try {
        const queryParams = req.query
        const SCHEDULE = require('../../models/schedule')

        const schedule = await SCHEDULE.aggregate([
            { $match: queryParams },
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
        ])

        const data = schedule.length > 0 ? schedule[0] : null

        return res.status(200).json(data.report)
    } catch (e) {
        console.log(e)
    }
})

module.exports = router
