const Reservation = require('../models/Reservation');

function startQrExpiryCron() {
  setInterval(async () => {
    try {
      const now = new Date();
      const expired = await Reservation.find({
        qrActive: true,
        status: { $ne: 'cancelled' },
      }).populate('service', 'duration');

      let voided = 0;
      for (const res of expired) {
        const resvDate = new Date(res.resvDate);
        const durationMs = (res.service?.duration || 60) * 60 * 1000;
        const resvEnd = new Date(resvDate.getTime() + durationMs);
        if (now > resvEnd) {
          res.qrActive = false;
          await res.save();
          voided++;
        }
      }
      if (voided > 0) {
        console.log(`[cron:qr] Voided ${voided} expired QR code(s)`);
      }
    } catch (err) {
      console.error('[cron:qr] Error voiding expired QR codes:', err.message);
    }
  }, 60 * 60 * 1000); // every hour
}

module.exports = { startQrExpiryCron };
