const User = require('../models/User');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const Reservation = require('../models/Reservation');
const asyncHandler = require('../middleware/asyncHandler');
const { markVectorStoreStale } = require('../utils/chatbot');

// @desc    Get merchant dashboard (own shop + stats)
// @route   GET /api/v1/merchant/dashboard
// @access  Private (approved merchant)
exports.getMerchantDashboard = asyncHandler(async (req, res, next) => {
    const merchant = await User.findById(req.user.id).populate('merchantShop');
    if (!merchant.merchantShop) {
        return res.status(404).json({ success: false, message: 'No shop assigned' });
    }

    const shop = merchant.merchantShop;
    const [totalReservations, pendingReservations, todayReservations] = await Promise.all([
        Reservation.countDocuments({ shop: shop._id }),
        Reservation.countDocuments({ shop: shop._id, status: 'pending' }),
        Reservation.countDocuments({
            shop: shop._id,
            resvDate: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        })
    ]);

    res.status(200).json({
        success: true,
        data: { shop, stats: { totalReservations, pendingReservations, todayReservations } }
    });
});

// @desc    Update merchant's own shop
// @route   PUT /api/v1/merchant/shop
// @access  Private (approved merchant)
exports.updateMerchantShop = asyncHandler(async (req, res, next) => {
  markVectorStoreStale();
    const merchant = await User.findById(req.user.id);
    const shopId = merchant.merchantShop;

    const allowedFields = ['name', 'address', 'telephone', 'openTime', 'closeTime', 'imageUrl'];
    const updateData = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const shop = await MassageShop.findByIdAndUpdate(shopId, updateData, { new: true, runValidators: true });
    if (!shop) {
        return res.status(404).json({ success: false, message: 'Shop not found' });
    }
    res.status(200).json({ success: true, data: shop });
});

// @desc    Get reservations for merchant's own shop
// @route   GET /api/v1/merchant/reservations
// @access  Private (approved merchant)
exports.getMerchantReservations = asyncHandler(async (req, res, next) => {
    const merchant = await User.findById(req.user.id);
    const reservations = await Reservation.find({ shop: merchant.merchantShop })
        .populate('user', 'name email telephone')
        .populate('service', 'name duration price')
        .sort({ resvDate: -1 });
    res.status(200).json({ success: true, count: reservations.length, data: reservations });
});

// @desc    Get all services for merchant's own shop
// @route   GET /api/v1/merchant/services
// @access  Private (approved merchant)
exports.getMerchantServices = asyncHandler(async (req, res, next) => {
    const merchant = await User.findById(req.user.id);
    const services = await MassageService.find({ shop: merchant.merchantShop }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: services.length, data: services });
});

// @desc    Create a service for merchant's own shop
// @route   POST /api/v1/merchant/services
// @access  Private (approved merchant)
exports.createMerchantService = asyncHandler(async (req, res, next) => {
  markVectorStoreStale();
    const merchant = await User.findById(req.user.id);
    const service = await MassageService.create({ ...req.body, shop: merchant.merchantShop });
    res.status(201).json({ success: true, data: service });
});

// @desc    Update a service in merchant's own shop
// @route   PUT /api/v1/merchant/services/:id
// @access  Private (approved merchant)
exports.updateMerchantService = asyncHandler(async (req, res, next) => {
  markVectorStoreStale();
    const merchant = await User.findById(req.user.id);
    let service = await MassageService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    if (service.shop.toString() !== merchant.merchantShop.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to edit this service' });
    }
    service = await MassageService.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: service });
});

// @desc    Delete a service in merchant's own shop
// @route   DELETE /api/v1/merchant/services/:id
// @access  Private (approved merchant)
exports.deleteMerchantService = asyncHandler(async (req, res, next) => {
  markVectorStoreStale();
    const merchant = await User.findById(req.user.id);
    const service = await MassageService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
    if (service.shop.toString() !== merchant.merchantShop.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this service' });
    }
    await service.deleteOne();
    res.status(200).json({ success: true, data: {} });
});

// @desc    Scan QR code — verify and confirm reservation
// @route   POST /api/v1/merchant/qr/scan
// @access  Private (approved merchant)
exports.scanQR = asyncHandler(async (req, res, next) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ success: false, message: 'QR token is required' });
    }

    const merchant = await User.findById(req.user.id);
    const reservation = await Reservation.findOne({ qrToken: token })
        .populate('shop', 'name')
        .populate('service', 'name duration price')
        .populate('user', 'name email telephone');

    if (!reservation) {
        return res.status(404).json({ success: false, message: 'Invalid QR code — reservation not found' });
    }
    if (reservation.shop._id.toString() !== merchant.merchantShop.toString()) {
        return res.status(403).json({ success: false, message: 'This reservation belongs to a different shop' });
    }
    if (!reservation.qrActive) {
        return res.status(400).json({ success: false, message: 'QR code is no longer valid' });
    }
    if (reservation.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'This reservation has been cancelled' });
    }

    // Auto-confirm on successful scan
    if (reservation.status === 'pending') {
        reservation.status = 'confirmed';
        await reservation.save();
    }

    res.status(200).json({
        success: true,
        message: 'QR code verified successfully',
        data: {
            reservationId: reservation._id,
            status: reservation.status,
            user: reservation.user,
            service: reservation.service,
            resvDate: reservation.resvDate
        }
    });
});

// @desc    Update reservation status (merchant — own shop only)
// @route   PUT /api/v1/merchant/reservations/:id/status
// @access  Private (approved merchant)
exports.updateReservationStatus = asyncHandler(async (req, res, next) => {
    const { status } = req.body;
    const allowedStatuses = ['confirmed', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Allowed: confirmed, completed, cancelled' });
    }

    const merchant = await User.findById(req.user.id);
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
        return res.status(404).json({ success: false, message: 'Reservation not found' });
    }
    if (reservation.shop.toString() !== merchant.merchantShop.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized — reservation belongs to a different shop' });
    }

    reservation.status = status;
    await reservation.save();

    res.status(200).json({ success: true, data: reservation });
});
