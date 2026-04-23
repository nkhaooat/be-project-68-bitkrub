const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    resvDate: {
        type: Date,
        required: [true, 'Please add a reservation date']
    },
    status:{
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    shop: {
        type: mongoose.Schema.ObjectId,
        ref: 'MassageShop',
        required: true
    },
    service:{
        type: mongoose.Schema.ObjectId,
        ref: 'MassageService',
        required: true
    },
    promotionCode: {
        type: String,
        default: null
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    originalPrice: {
        type: Number,
        default: null
    },
    finalPrice: {
        type: Number,
        default: null
    },
    slipImageUrl: {
        type: String,
        default: null
    },
    paymentStatus: {
        type: String,
        enum: ['none', 'waiting_verification', 'approved', 'rejected'],
        default: 'none'
    },
    qrToken: {
        type: String,
        default: null
    },
    qrActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);