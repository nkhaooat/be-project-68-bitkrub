const express = require('express');
const { protect, requireMerchant } = require('../middleware/auth');
const {
  getMerchantDashboard,
  updateMerchantShop,
  getMerchantReservations,
  scanQR
} = require('../controllers/merchant');

const router = express.Router();

// All routes require merchant approval
router.use(protect, requireMerchant());

// Dashboard — own shop info
router.get('/dashboard', getMerchantDashboard);

// Update own shop
router.put('/shop', updateMerchantShop);

// View reservations for own shop
router.get('/reservations', getMerchantReservations);

// US 7-6: Scan QR code
router.post('/qr/scan', scanQR);

module.exports = router;
