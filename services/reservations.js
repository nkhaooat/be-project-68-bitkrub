const Reservation = require('../models/Reservation');

/**
 * Auto-complete past reservations — marks pending/confirmed reservations
 * whose date has passed as 'completed'. Called as middleware on reservation
 * reads and before review creation.
 */
async function autoCompletePastReservations() {
  const now = new Date();
  const result = await Reservation.updateMany(
    {
      resvDate: { $lt: now },
      status: { $in: ['pending', 'confirmed'] },
    },
    { $set: { status: 'completed' } }
  );
  return result.modifiedCount;
}

/**
 * Express middleware: auto-complete reservations before proceeding.
 * Non-fatal — errors are swallowed so the main request still works.
 */
async function autoCompleteMiddleware(req, res, next) {
  try {
    await autoCompletePastReservations();
  } catch (e) {
    // non-fatal
  }
  next();
}

module.exports = { autoCompletePastReservations, autoCompleteMiddleware };
