const Promotion = require('../models/Promotion');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Validate a promotion code (public, does NOT increment usage)
// @route   POST /api/v1/promotions/validate
// @access  Public
exports.validatePromotion = asyncHandler(async (req, res, next) => {
    const { code, originalPrice } = req.body;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Promotion code is required' });
    }
    if (originalPrice === undefined || originalPrice < 0) {
        return res.status(400).json({ success: false, message: 'Valid originalPrice is required' });
    }

    const promotion = await Promotion.findOne({ code: code.toUpperCase().trim() });

    if (!promotion) {
        return res.status(404).json({ success: false, message: 'Invalid promotion code' });
    }
    if (!promotion.isActive) {
        return res.status(400).json({ success: false, message: 'This promotion code has been deactivated' });
    }
    if (promotion.expiresAt && new Date() > promotion.expiresAt) {
        return res.status(400).json({ success: false, message: 'This promotion code has expired' });
    }
    if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) {
        return res.status(400).json({ success: false, message: 'This promotion code has reached its usage limit' });
    }

    // Calculate discount (read-only, does not increment usedCount)
    let discountAmount = 0;
    if (promotion.discountType === 'flat') {
        discountAmount = Math.min(promotion.discountValue, originalPrice);
    } else if (promotion.discountType === 'percentage') {
        discountAmount = Math.round((originalPrice * promotion.discountValue / 100) * 100) / 100;
        discountAmount = Math.min(discountAmount, originalPrice);
    }
    const finalPrice = Math.max(0, originalPrice - discountAmount);

    res.status(200).json({
        success: true,
        data: {
            code: promotion.code,
            name: promotion.name,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            discountAmount,
            originalPrice,
            finalPrice
        }
    });
});

// @desc    Get all promotions (admin)
// @route   GET /api/v1/promotions
// @access  Private/Admin
exports.getPromotions = asyncHandler(async (req, res, next) => {
    const promotions = await Promotion.find().sort('-createdAt');
    res.status(200).json({ success: true, count: promotions.length, data: promotions });
});

// @desc    Create a promotion (admin)
// @route   POST /api/v1/promotions
// @access  Private/Admin
exports.createPromotion = asyncHandler(async (req, res, next) => {
    const { code, name, discountType, discountValue, expiresAt, usageLimit } = req.body;

    if (!code || !name || !discountType || discountValue === undefined || !expiresAt) {
        return res.status(400).json({
            success: false,
            message: 'code, name, discountType, discountValue, and expiresAt are required'
        });
    }
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        return res.status(400).json({
            success: false,
            message: 'Percentage discount must be between 0 and 100'
        });
    }

    try {
        const promotion = await Promotion.create({
            code: code.toUpperCase().trim(),
            name,
            discountType,
            discountValue,
            expiresAt,
            usageLimit: usageLimit || null
        });
        res.status(201).json({ success: true, data: promotion });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Promotion code already exists' });
        }
        throw err; // Let asyncHandler + errorHandler deal with it
    }
});

// @desc    Delete/deactivate a promotion (admin)
// @route   DELETE /api/v1/promotions/:id
// @access  Private/Admin
exports.deletePromotion = asyncHandler(async (req, res, next) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
        return res.status(404).json({ success: false, message: 'Promotion not found' });
    }
    promotion.isActive = false;
    await promotion.save();
    res.status(200).json({ success: true, data: promotion });
});
