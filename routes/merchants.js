const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { getMerchants, approveMerchant, rejectMerchant } = require('../controllers/merchantAdmin');

const router = express.Router();

router.use(protect, authorize('admin'));

router.get('/', getMerchants);
router.patch('/:id/approve', approveMerchant);
router.patch('/:id/reject', rejectMerchant);

module.exports = router;
