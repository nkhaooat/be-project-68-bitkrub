const Reservation = require('../models/Reservation');

/**
 * Verify a QR code token and return the reservation if valid.
 * @param {string} token - QR token from URL
 * @param {string} userId - Authenticated user's ID
 * @param {string} userRole - Authenticated user's role
 * @returns {Object} The reservation document (populated)
 * @throws {Error} If token is invalid, expired, or unauthorized
 */
async function verifyQRToken(token, userId, userRole) {
  const reservation = await Reservation.findOne({ qrToken: token }).populate([
    { path: 'shop', select: 'name address' },
    { path: 'service', select: 'name duration price' },
    { path: 'user', select: 'name email telephone' },
  ]);

  if (!reservation) {
    throw new Error('Invalid QR code — reservation not found');
  }

  // Check ownership
  if (userRole !== 'admin' && reservation.user._id.toString() !== userId) {
    throw new Error('Not authorized — this QR code belongs to another user');
  }

  if (!reservation.qrActive) {
    throw new Error('QR code is no longer valid');
  }

  if (reservation.status === 'cancelled') {
    throw new Error('This reservation has been cancelled');
  }

  // Check if reservation date has passed
  const now = new Date();
  const resvDate = new Date(reservation.resvDate);
  const durationMs = (reservation.service?.duration || 60) * 60 * 1000;
  const resvEnd = new Date(resvDate.getTime() + durationMs);

  if (now > resvEnd) {
    reservation.qrActive = false;
    await reservation.save();
    throw new Error('QR code is no longer valid — reservation date has passed');
  }

  return reservation;
}

module.exports = { verifyQRToken };
