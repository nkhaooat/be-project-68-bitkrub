const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  reservation: {
    type: mongoose.Schema.ObjectId,
    ref: 'Reservation',
    required: true,
    unique: true, // one review per reservation
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  shop: {
    type: mongoose.Schema.ObjectId,
    ref: 'MassageShop',
    required: true,
  },
  service: {
    type: mongoose.Schema.ObjectId,
    ref: 'MassageService',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    maxlength: 500,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Review', ReviewSchema);
