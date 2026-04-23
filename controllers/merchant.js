const User = require('../models/User');
const MassageShop = require('../models/MassageShop');
const MassageService = require('../models/MassageService');
const Reservation = require('../models/Reservation');

// @desc    Get merchant dashboard (own shop + stats)
// @route   GET /api/v1/merchant/dashboard
// @access  Private (approved merchant)
exports.getMerchantDashboard = async (req, res, next) => {
  try {
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
      data: {
        shop,
        stats: { totalReservations, pendingReservations, todayReservations }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update merchant's own shop
// @route   PUT /api/v1/merchant/shop
// @access  Private (approved merchant)
exports.updateMerchantShop = async (req, res, next) => {
  try {
    const merchant = await User.findById(req.user.id);
    const shopId = merchant.merchantShop;

    // Only allow updating specific fields
    const allowedFields = ['name', 'address', 'telephone', 'openTime', 'closeTime', 'description', 'imageUrl'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    const shop = await MassageShop.findByIdAndUpdate(shopId, updateData, {
      new: true,
      runValidators: true
    });

    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    res.status(200).json({ success: true, data: shop });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get reservations for merchant's own shop
// @route   GET /api/v1/merchant/reservations
// @access  Private (approved merchant)
exports.getMerchantReservations = async (req, res, next) => {
  try {
    const merchant = await User.findById(req.user.id);
    const reservations = await Reservation.find({ shop: merchant.merchantShop })
      .populate('user', 'name email telephone')
      .populate('service', 'name duration price')
      .sort({ resvDate: -1 });

    res.status(200).json({ success: true, count: reservations.length, data: reservations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Scan QR code — verify and confirm reservation
// @route   POST /api/v1/merchant/qr/scan
// @access  Private (approved merchant)
exports.scanQR = async (req, res, next) => {
  try {
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

    // Verify QR belongs to merchant's own shop
    if (reservation.shop._id.toString() !== merchant.merchantShop.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This reservation belongs to a different shop'
      });
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
