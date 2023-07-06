const mongoose = require('mongoose')
const Schema = mongoose.Schema

const loggerSchema = new Schema({
    remoteAddr: { type: String, required: true },
    method: { type: String, required: true },
    url: { type: String, required: true },
    status: { type: String, required: true },
    contentLength: { type: String, required: false },
    responseTime: { type: String, required: false },
    date: { type: Date, required: true },
    requestData: { type: Object, required: false },
})

module.exports = mongoose.model('logger', loggerSchema)
