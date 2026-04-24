const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendMerchantStatusEmail } = require('../services/email');

// @desc    List pending merchants
// @route   GET /api/v1/admin/merchants
// @access  Private (admin)
exports.getMerchants = asyncHandler(async (req, res, next) => {
    const { status } = req.query;
    const filter = { role: 'merchant' };
    if (status) filter.merchantStatus = status;

    const merchants = await User.find(filter)
        .populate('merchantShop', 'name address')
        .select('-password -resetPasswordToken -resetPasswordExpire');

    res.status(200).json({ success: true, count: merchants.length, data: merchants });
});

// @desc    Approve merchant
// @route   PATCH /api/v1/admin/merchants/:id/approve
// @access  Private (admin)
exports.approveMerchant = asyncHandler(async (req, res, next) => {
    const merchant = await User.findOne({ _id: req.params.id, role: 'merchant' });
    if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    merchant.merchantStatus = 'approved';
    await merchant.save();

    // Fire-and-forget: notify merchant
    if (process.env.BREVO_API_KEY) {
        sendMerchantStatusEmail(merchant, 'approved').catch(e =>
            console.error('[email] merchant approval error:', e?.message || e)
        );
    }

    res.status(200).json({ success: true, data: merchant });
});

// @desc    Reject merchant
// @route   PATCH /api/v1/admin/merchants/:id/reject
// @access  Private (admin)
exports.rejectMerchant = asyncHandler(async (req, res, next) => {
    const merchant = await User.findOne({ _id: req.params.id, role: 'merchant' });
    if (!merchant) {
        return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    merchant.merchantStatus = 'rejected';
    await merchant.save();

    // Fire-and-forget: notify merchant
    if (process.env.BREVO_API_KEY) {
        sendMerchantStatusEmail(merchant, 'rejected').catch(e =>
            console.error('[email] merchant rejection error:', e?.message || e)
        );
    }

    res.status(200).json({ success: true, data: merchant });
});
