const express = require('express');
const { protect, requireMerchant } = require('../middleware/auth');
const {
  getMerchantDashboard,
  updateMerchantShop,
  getMerchantReservations,
  getMerchantServices,
  createMerchantService,
  updateMerchantService,
  deleteMerchantService,
  scanQR
} = require('../controllers/merchantSelfService');

const router = express.Router();

// All routes require merchant approval
router.use(protect, requireMerchant());

// Dashboard — own shop info
router.get('/dashboard', getMerchantDashboard);

// Update own shop
router.put('/shop', updateMerchantShop);

// Manage own services
router.get('/services', getMerchantServices);
router.post('/services', createMerchantService);
router.put('/services/:id', updateMerchantService);
router.delete('/services/:id', deleteMerchantService);

// View reservations for own shop
router.get('/reservations', getMerchantReservations);

// Scan QR code
router.post('/qr/scan', scanQR);

module.exports = router;
