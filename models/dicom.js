const mongoose = require('mongoose')
const Schema = mongoose.Schema

const dicomSchema = new Schema({
    shorteningPacsName: { type: String, required: true },
    pacsURL: { type: String, required: true },
    pacsName: { type: String, required: true },
    pacsWadoURL: { type: String, required: true },
    isOpen: { type: Boolean, required: true },
    weights: { type: Number, required: true },
})

module.exports = mongoose.model('Dicom', dicomSchema)
