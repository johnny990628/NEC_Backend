const mongoose = require('mongoose')
const Schema = mongoose.Schema

const cancerFormSchema = new Schema({
    key: { type: String, required: false },
    value: { type: String, required: false },
})

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
        form: [cancerFormSchema],
    },
    { _id: false }
)

const biradsSchema = new Schema({
    value: { type: Number },
})

const recordSchema = new Schema(
    {
        report: { L: [cancerSchema], R: [cancerSchema] },
        birads: { L: { type: Number }, R: { type: Number } },
        id: { type: String },
    },
    { _id: false }
)

const reportSchema = new Schema(
    {
        patientID: { type: String, required: true },
        records: [recordSchema],
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
