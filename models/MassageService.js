const mongoose = require('mongoose');

const MassageServiceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true,'Please add a service name'],
        trim: true
    },
    area:{
        type: String,
        required: [true,'Please add massage area (e.g., full body, back, foot)'],
        enum: ['full body', 'back', 'foot', 'head', 'shoulder', 'face', 'other']
    },
    duration:{
        type: Number,
        required: [true,'Please add duration in minutes'],
        min: [15,'Minimum duration is 15 minutes']
    },
    oil:{
        type: String,
        enum: ['none', 'aromatherapy', 'herbal', 'coconut', 'jojoba', 'other'],
        default: 'none'
    },
    price:{
        type: Number,
        required: [true,'Please add price'],
        min: [0,'Price cannot be negative']
    },
    sessions:{
        type: Number,
        default: 1,
        min: [1,'Minimum 1 session']
    },
    description:{
        type: String
    },
    // Thai translations (cached from GPT, used by chatbot vector store)
    nameTh: {
        type: String,
        default: null
    },
    areaTh: {
        type: String,
        default: null
    },
    descriptionTh: {
        type: String,
        default: null
    },
    shop:{
        type: mongoose.Schema.ObjectId,
        ref: 'MassageShop',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports=mongoose.model('MassageService',MassageServiceSchema);