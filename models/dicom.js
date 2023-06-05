const mongoose = require('mongoose')
const Schema = mongoose.Schema

const dicomSchema = new Schema({
    pacsURL: { type: String, required: true },
    pacsName: { type: String, required: true },
    pacsPort: { type: String, required: true },
    pacsAETitle: { type: String, required: true },
    pacsWadoURI: { type: String, required: true },
    pacsWadoPort: { type: String, required: true },
    pacsWadoAETitle: { type: String, required: true },
    pacsWadoURL: { type: String, required: true },
    isOpen: { type: Boolean, required: true },
    weights: { type: Number, required: true },
})

module.exports = mongoose.model('Dicom', dicomSchema)
