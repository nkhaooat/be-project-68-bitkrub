const Promotion = require('../models/Promotion');

// @desc    Validate a promotion code
// @route   POST /api/v1/promotions/validate
// @access  Public
exports.validatePromotion = async (req, res, next) => {
    try {
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

        // Calculate discount
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
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all promotions (admin)
// @route   GET /api/v1/promotions
// @access  Private/Admin
exports.getPromotions = async (req, res, next) => {
    try {
        const promotions = await Promotion.find().sort('-createdAt');

        res.status(200).json({
            success: true,
            count: promotions.length,
            data: promotions
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Create a promotion (admin)
// @route   POST /api/v1/promotions
// @access  Private/Admin
exports.createPromotion = async (req, res, next) => {
    try {
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
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete/deactivate a promotion (admin)
// @route   DELETE /api/v1/promotions/:id
// @access  Private/Admin
exports.deletePromotion = async (req, res, next) => {
    try {
        const promotion = await Promotion.findById(req.params.id);

        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }

        // Soft delete: deactivate instead of removing
        promotion.isActive = false;
        await promotion.save();

        res.status(200).json({ success: true, data: promotion });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
