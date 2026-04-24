const Reservation = require('../models/Reservation');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const { applyPromotionCode } = require('../services/promotions');
const { verifyQRToken } = require('../services/qr');
const { sendConfirmationEmail, sendCancellationEmail, sendReviewRequestEmail } = require('../services/email');

// Reusable populate chain for reservation queries
const POPULATE_FULL = [
  { path: 'shop', select: 'name address location tel openTime closeTime' },
  { path: 'service', select: 'name area duration oil price sessions' },
  { path: 'user', select: 'name email telephone' }
];

const POPULATE_LIST = [
  { path: 'shop', select: 'name address location tel' },
  { path: 'service', select: 'name area duration oil price' },
  { path: 'user', select: 'name email telephone' }
];

// @desc    Get all reservations (admin) or user's reservations
// @route   GET /api/v1/reservations
// @access  Private
exports.getReservations = asyncHandler(async (req, res, next) => {
  let query;
  const myBookingsOnly = req.query.myBookings === 'true';

  if (req.user.role === 'admin' && !myBookingsOnly) {
    let reqQuery = { ...req.query };
    const removeFields = ['select', 'sort', 'page', 'limit', 'myBookings'];
    removeFields.forEach(param => delete reqQuery[param]);

    if (req.query.startDate || req.query.endDate) {
      reqQuery.resvDate = {};
      if (req.query.startDate) reqQuery.resvDate.$gte = new Date(req.query.startDate);
      if (req.query.endDate) reqQuery.resvDate.$lte = new Date(req.query.endDate);
      delete reqQuery.startDate;
      delete reqQuery.endDate;
    }

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    query = Reservation.find(JSON.parse(queryStr));
  } else {
    query = Reservation.find({ user: req.user.id });
  }

  query = query.populate(POPULATE_LIST);

  if (req.query.sort) {
    query = query.sort(req.query.sort.split(',').join(' '));
  } else {
    query = query.sort('-resvDate');
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const total = await Reservation.countDocuments(req.user.role === 'admin' ? {} : { user: req.user.id });

  query = query.skip(startIndex).limit(limit);
  const reservations = await query;

  res.status(200).json({
    success: true,
    count: reservations.length,
    pagination: { total, page, pages: Math.ceil(total / limit), limit },
    data: reservations
  });
});

// @desc    Get single reservation
// @route   GET /api/v1/reservations/:id
// @access  Private
exports.getReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id).populate(POPULATE_FULL);

  if (!reservation) {
    return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
  }
  if (reservation.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to access this reservation' });
  }

  res.status(200).json({ success: true, data: reservation });
});

// @desc    Create new reservation
// @route   POST /api/v1/reservations
// @access  Private
exports.createReservation = asyncHandler(async (req, res, next) => {
  const activeReservations = await Reservation.countDocuments({
    user: req.user.id,
    status: { $in: ['pending', 'confirmed'] },
    resvDate: { $gte: new Date() }
  });

  if (activeReservations >= 3) {
    return res.status(400).json({
      success: false,
      message: 'You can only have up to 3 active reservations. Please cancel an existing reservation first.'
    });
  }

  const shop = await MassageShop.findById(req.body.shop);
  if (!shop) {
    return res.status(404).json({ success: false, message: `Shop not found with id of ${req.body.shop}` });
  }

  const service = await MassageService.findById(req.body.service);
  if (!service) {
    return res.status(404).json({ success: false, message: `Service not found with id of ${req.body.service}` });
  }
  if (service.shop.toString() !== req.body.shop) {
    return res.status(400).json({ success: false, message: 'Service does not belong to the selected shop' });
  }

  // Check for time-overlap
  const newStart = new Date(req.body.resvDate);
  const newEnd = new Date(newStart.getTime() + service.duration * 60 * 1000);

  const existingReservations = await Reservation.find({
    user: req.user.id,
    status: { $in: ['pending', 'confirmed'] }
  }).populate('service', 'duration');

  for (const existing of existingReservations) {
    const existingStart = new Date(existing.resvDate);
    const existingDuration = existing.service?.duration || 60;
    const existingEnd = new Date(existingStart.getTime() + existingDuration * 60 * 1000);

    if (newStart < existingEnd && newEnd > existingStart) {
      return res.status(400).json({
        success: false,
        message: `Time conflict: you already have a reservation from ${existingStart.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} to ${existingEnd.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} on ${existingStart.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}. Please choose a different time.`
      });
    }
  }

  req.body.user = req.user.id;

  // Apply promotion code if provided
  if (req.body.promotionCode) {
    try {
      const promo = await applyPromotionCode(req.body.promotionCode, service.price);
      req.body.originalPrice = promo.originalPrice;
      req.body.discountAmount = promo.discountAmount;
      req.body.finalPrice = promo.finalPrice;
      req.body.promotionCode = promo.promotionCode;
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  } else {
    req.body.originalPrice = service.price;
    req.body.finalPrice = service.price;
    req.body.discountAmount = 0;
  }

  req.body.qrToken = crypto.randomBytes(16).toString('hex');
  req.body.qrActive = true;

  const reservation = await Reservation.create(req.body);

  if (process.env.BREVO_API_KEY) {
    sendConfirmationEmail(reservation).catch(err =>
      console.error('[email] Failed to send confirmation:', err.message)
    );
  }

  res.status(201).json({
    success: true,
    message: `Reservation created successfully. You now have ${activeReservations + 1} of 3 active reservations.`,
    data: reservation
  });
});

// @desc    Update reservation
// @route   PUT /api/v1/reservations/:id
// @access  Private
exports.updateReservation = asyncHandler(async (req, res, next) => {
  let reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
  }

  if (req.user.role !== 'admin') {
    if (reservation.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this reservation' });
    }
    const now = new Date();
    const oneDayBefore = new Date(reservation.resvDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    if (now > oneDayBefore) {
      return res.status(400).json({
        success: false,
        message: 'You can only edit reservations at least 1 day before the reservation date'
      });
    }
  }

  reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate(POPULATE_FULL);

  if (req.body.status === 'completed' && reservation.status === 'completed' && process.env.BREVO_API_KEY) {
    sendReviewRequestEmail(reservation).catch(err =>
      console.error('[email] Failed to send review request:', err.message)
    );
  }

  res.status(200).json({ success: true, data: reservation });
});

// @desc    Cancel reservation (soft delete)
// @route   DELETE /api/v1/reservations/:id
// @access  Private
exports.deleteReservation = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, message: `Reservation not found with id of ${req.params.id}` });
  }

  if (req.user.role !== 'admin') {
    if (reservation.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this reservation' });
    }
    const now = new Date();
    const oneDayBefore = new Date(reservation.resvDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    if (now > oneDayBefore) {
      return res.status(400).json({
        success: false,
        message: 'You can only cancel reservations at least 1 day before the reservation date'
      });
    }
  }

  reservation.status = 'cancelled';
  reservation.qrActive = false;
  await reservation.save();

  if (process.env.BREVO_API_KEY) {
    sendCancellationEmail(reservation).catch(err =>
      console.error('[email] Failed to send cancellation:', err.message)
    );
  }

  res.status(200).json({
    success: true,
    message: 'Reservation cancelled successfully. A cancellation confirmation has been sent to your email. Your QR code is now void.',
    data: reservation
  });
});

// @desc    Upload payment slip
// @route   POST /api/v1/reservations/:id/slip
// @access  Private
exports.uploadSlip = asyncHandler(async (req, res, next) => {
  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, message: 'Reservation not found' });
  }
  if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  reservation.slipImageUrl = `/uploads/slips/${req.file.filename}`;
  reservation.paymentStatus = 'waiting_verification';
  await reservation.save();

  const updated = await Reservation.findById(reservation._id).populate(POPULATE_FULL);
  res.status(200).json({ success: true, data: updated });
});

// @desc    Verify payment slip (admin)
// @route   PUT /api/v1/reservations/:id/verify
// @access  Private/Admin
exports.verifySlip = asyncHandler(async (req, res, next) => {
  const { action } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
  }

  const reservation = await Reservation.findById(req.params.id);

  if (!reservation) {
    return res.status(404).json({ success: false, message: 'Reservation not found' });
  }
  if (reservation.paymentStatus !== 'waiting_verification') {
    return res.status(400).json({ success: false, message: 'Reservation is not waiting for verification' });
  }

  if (action === 'approve') {
    reservation.paymentStatus = 'approved';
    reservation.status = 'confirmed';
  } else {
    reservation.paymentStatus = 'rejected';
  }

  await reservation.save();

  const updated = await Reservation.findById(reservation._id).populate(POPULATE_FULL);
  res.status(200).json({ success: true, data: updated });
});

// @desc    Verify QR code token
// @route   GET /api/v1/qr/verify/:token
// @access  Private/Admin
exports.verifyQR = asyncHandler(async (req, res, next) => {
  try {
    const reservation = await verifyQRToken(req.params.token, req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      reservationId: reservation._id,
      data: reservation,
      message: 'QR code verified successfully'
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404
      : err.message.includes('authorized') ? 403 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
});

// Export for use by other modules
module.exports.sendReviewRequestEmail = sendReviewRequestEmail;
