const express = require('express')
const router = express.Router()
const url = require('url')
const REPORT = require('../../models/report')
const fs = require('fs')

router.route('/').get(async (req, res) => {
    try {
        const { patientID, accessionNumber, createdAt, contentType } = req.query

        if (!patientID || !accessionNumber) {
            return res.status(400).json({ error: 'Missing patientID or accessionNumber' })
        }
        const originalReport = await REPORT.findOne(req.query, {
            records: { $slice: -1 },
        })

        const count = await REPORT.find(req.query).countDocuments()
        if (count === 0) {
            return res.status(404).json({ error: 'Report not found' })
        }

        const report = { ...originalReport.toObject(), records: originalReport.records.pop().toObject() }

        switch (contentType) {
            case 'text':
                const reportText = formatReport(report)
                return res.status(200).send(reportText)
            case 'json':
                return res.status(200).json({ results: report, count })
            case 'txtFile':
                const filename = `${report.patientID}-${report.accessionNumber}.txt`
                const fileContent = formatReport(report)
                fs.writeFile(filename, fileContent, (err) => {
                    if (err) {
                        console.error(err)
                        return res.status(500).json({ error: 'Failed to generate report file.' })
                    }

                    res.setHeader('Content-Type', 'text/plain')
                    res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
                    res.download(filename, () => {
                        // 删除生成的文件
                        fs.unlink(filename, (err) => {
                            if (err) console.error(err)
                        })
                    })
                })
                break
            default:
                return res.status(200).json({ results: report, count })
        }
    } catch (e) {
        console.log(e)
    }
})

function formatReport(item) {
    let formattedReport = ''

    formattedReport += `patientID: ${item.patientID}\n`
    formattedReport += `reportID: ${item.id}\n`
    formattedReport += `accessionNumber: ${item.accessionNumber}\n`
    formattedReport += `StudyInstanceUID: ${item.StudyInstanceUID}\n`
    formattedReport += `birads: ${JSON.stringify(item.records.birads)}\n`

    const responseTxt = ['L', 'R'].map((side) => {
        return item.records.report[side].map((entry, index) => {
            return {
                TumorID: side + (parseInt(index) + 1),
                clock: entry.clock,
                distance: entry.distance,
                size: entry.size,
                symptom: entry.form.map((symptom) => `${symptom.key}-${symptom.value}`).join('、'),
            }
        })
    })

    const Tumor = [...responseTxt[0], ...responseTxt[1]]

    Tumor.map((Tumor) => {
        formattedReport += `TumorID: ${Tumor.TumorID}\n`
        formattedReport += `clock: ${Tumor.clock}\n`
        formattedReport += `distance: ${Tumor.distance}\n`
        formattedReport += `size: ${Tumor.size}\n`
        formattedReport += `symptom: ${Tumor.symptom}\n`
        formattedReport += '\n'
    })

    return formattedReport
}

module.exports = router
