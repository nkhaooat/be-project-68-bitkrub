const express = require('express');
const { register, login, getMe, logout, forgotPassword, resetPassword, changePassword } = require('../controllers/auth');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);
router.put('/changepassword', protect, changePassword);

module.exports = router;
