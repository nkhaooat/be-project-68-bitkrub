const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Review = require('../models/Review');
const asyncHandler = require('../middleware/asyncHandler');
const { autoCompletePastReservations } = require('../services/reservations');

// POST /api/v1/reviews  — create a review for a completed reservation
exports.createReview = asyncHandler(async (req, res) => {
  await autoCompletePastReservations();

  const { reservationId, rating, comment } = req.body;

  if (!reservationId || !rating) {
    return res.status(400).json({ success: false, message: 'reservationId and rating are required' });
  }

  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    return res.status(404).json({ success: false, message: 'Reservation not found' });
  }
  if (reservation.user.toString() !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not your reservation' });
  }
  if (reservation.status !== 'completed') {
    return res.status(400).json({ success: false, message: 'Can only review completed reservations' });
  }

  const existing = await Review.findOne({ reservation: reservationId });
  if (existing) {
    return res.status(400).json({ success: false, message: 'You already reviewed this reservation' });
  }

  const review = await Review.create({
    reservation: reservationId,
    user: req.user.id,
    shop: reservation.shop,
    service: reservation.service,
    rating,
    comment: comment || '',
  });

  res.status(201).json({ success: true, data: review });
});

// GET /api/v1/reviews/shop/:shopId  — public reviews for a shop
exports.getShopReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ shop: req.params.shopId })
    .populate('user', 'name')
    .populate('service', 'name')
    .sort({ createdAt: -1 })
    .limit(50);

  const stats = await Review.aggregate([
    { $match: { shop: new mongoose.Types.ObjectId(req.params.shopId) } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avgRating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  const reviewCount = stats.length > 0 ? stats[0].count : 0;

  res.json({ success: true, count: reviews.length, avgRating, reviewCount, data: reviews });
});

// GET /api/v1/reviews/my  — current user's reviews
exports.getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user.id })
    .populate('shop', 'name')
    .populate('service', 'name')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: reviews });
});

// GET /api/v1/reviews/check/:reservationId  — check if user already reviewed
exports.checkReview = asyncHandler(async (req, res) => {
  const existing = await Review.findOne({
    reservation: req.params.reservationId,
    user: req.user.id,
  });
  res.json({ success: true, reviewed: !!existing, data: existing });
});
