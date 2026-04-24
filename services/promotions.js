const Promotion = require('../models/Promotion');

/**
 * Validate and apply a promotion code to a service price.
 * @param {string} code - Promotion code entered by user
 * @param {number} servicePrice - Original price of the service
 * @returns {{ originalPrice, discountAmount, finalPrice, promotionCode }}
 * @throws {Error} If code is invalid, expired, or usage limit reached
 */
async function applyPromotionCode(code, servicePrice) {
  const promotion = await Promotion.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });

  if (!promotion) {
    throw new Error('Invalid promotion code');
  }

  if (promotion.expiresAt && new Date() > promotion.expiresAt) {
    throw new Error('This promotion code has expired');
  }

  if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) {
    throw new Error('This promotion code has reached its usage limit');
  }

  // Calculate discount
  let discountAmount = 0;
  if (promotion.discountType === 'flat') {
    discountAmount = Math.min(promotion.discountValue, servicePrice);
  } else if (promotion.discountType === 'percentage') {
    discountAmount = Math.round((servicePrice * promotion.discountValue / 100) * 100) / 100;
    discountAmount = Math.min(discountAmount, servicePrice);
  }

  const result = {
    originalPrice: servicePrice,
    discountAmount,
    finalPrice: Math.max(0, servicePrice - discountAmount),
    promotionCode: promotion.code,
  };

  // Increment usage count
  promotion.usedCount += 1;
  await promotion.save();

  return result;
}

module.exports = { applyPromotionCode };
