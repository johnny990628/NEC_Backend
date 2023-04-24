const mongoose = require('mongoose')
const Schema = mongoose.Schema

const cancerSchema = new Schema(
    {
        id: {
            type: String,
            required: true,
        },
        clock: {
            type: Number,
            required: true,
        },
        distance: {
            type: Number,
            required: true,
        },
        size: {
            type: Number,
            required: true,
        },
    },
    { _id: false }
)

const recordSchema = new Schema(
    {
        report: { L: [cancerSchema], R: [cancerSchema] },
        birads: { type: Number },
        id: { type: String },
    },
    { _id: false }
)

const reportSchema = new Schema(
    {
        patientID: { type: String, required: true },
        StudyInstanceUID: { type: String, required: true },
        // procedureCode: { type: String, required: true },
        records: [recordSchema],
        // status: { type: String, required: true },
        // blood: { type: String },
        userID: { type: String },
    },
    { timestamps: true }
)

reportSchema.virtual('patient', {
    ref: 'Patient',
    localField: 'patientID',
    foreignField: 'id',
    justOne: true,
})
reportSchema.virtual('user', {
    ref: 'User',
    localField: 'userID',
    foreignField: '_id',
    justOne: true,
})

reportSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Report', reportSchema)
