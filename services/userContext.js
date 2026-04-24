const Reservation = require('../models/Reservation');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * Extract user context from Bearer token.
 * Runs all DB queries in parallel for minimum TTFT.
 * @param {string|undefined} authHeader
 * @returns {Promise<object|null>}
 */
async function extractUserContext(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Run reservation query + user query in parallel
    const [activeReservations, userDoc] = await Promise.all([
      Reservation.find({
        user: userId,
        status: { $in: ['pending', 'confirmed'] },
        resvDate: { $gte: new Date() }
      })
        .populate('shop', 'name location')
        .populate('service', 'name duration price')
        .sort('resvDate')
        .lean(),
      User.findById(userId).populate('merchantShop', 'name').lean(),
    ]);

    const userContext = {
      activeCount: activeReservations.length,
      slotsRemaining: 3 - activeReservations.length,
      reservations: activeReservations.map(r => {
        const resvDate = new Date(r.resvDate);
        const hoursUntil = (resvDate - new Date()) / (1000 * 60 * 60);
        const canModify = hoursUntil > 24;
        return {
          id: r._id.toString(),
          shop: r.shop?.name || 'Unknown shop',
          service: r.service?.name || 'Unknown service',
          duration: r.service?.duration,
          price: r.service?.price,
          date: new Date(r.resvDate).toLocaleString('en-US', {
            timeZone: 'Asia/Bangkok',
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          endTime: (() => {
            const dur = r.service?.duration || 60;
            const end = new Date(new Date(r.resvDate).getTime() + dur * 60 * 1000);
            return end.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
          })(),
          resvDate: r.resvDate,
          hoursUntil: Math.round(hoursUntil * 10) / 10,
          canModify,
          status: r.status
        };
      })
    };

    // Add role/merchant context from userDoc
    if (userDoc) {
      userContext.role = userDoc.role;
      userContext.userName = userDoc.name;
      if (userDoc.role === 'merchant') {
        userContext.merchantStatus = userDoc.merchantStatus;
        userContext.shopName = userDoc.merchantShop?.name || null;
        if (userDoc.merchantStatus === 'approved' && userDoc.merchantShop) {
          const merchantPending = await Reservation.countDocuments({
            shop: userDoc.merchantShop._id,
            status: 'pending'
          });
          userContext.merchantPendingReservations = merchantPending;
        }
      }
    }

    return userContext;
  } catch (err) {
    console.warn('[auth] Could not decode token:', err.message);
    return null;
  }
}

module.exports = { extractUserContext };
