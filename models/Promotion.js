const mongoose = require('mongoose');

const PromotionSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Please add a promotion code'],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: [30, 'Code cannot be more than 30 characters']
    },
    name: {
        type: String,
        required: [true, 'Please add a promotion name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    discountType: {
        type: String,
        enum: ['flat', 'percentage'],
        required: [true, 'Please specify discount type']
    },
    discountValue: {
        type: Number,
        required: [true, 'Please add a discount value'],
        min: [0, 'Discount value must be positive']
    },
    expiresAt: {
        type: Date,
        required: [true, 'Please add an expiry date']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    usageLimit: {
        type: Number,
        default: null  // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast lookup
PromotionSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model('Promotion', PromotionSchema);
