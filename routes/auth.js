const express = require('express');
const { register, registerMerchant, login, getMe, logout, forgotPassword, resetPassword, changePassword, updateProfile } = require('../controllers/auth');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & user management
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new customer
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "John Doe" }
 *               email: { type: string, example: "john@example.com" }
 *               password: { type: string, example: "password123" }
 *     responses:
 *       200: { description: User registered, JWT cookie set }
 *       400: { description: Validation error or duplicate email }
 */

/**
 * @swagger
 * /api/v1/auth/register/merchant:
 *   post:
 *     summary: Register as merchant (requires auth)
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopId]
 *             properties:
 *               shopId: { type: string }
 *     responses:
 *       200: { description: Merchant registration pending }
 *       401: { description: Not authenticated }
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "john@example.com" }
 *               password: { type: string, example: "password123" }
 *     responses:
 *       200: { description: Login successful, JWT cookie set }
 *       401: { description: Invalid credentials }
 */

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Current user data }
 *       401: { description: Not authenticated }
 */

/**
 * @swagger
 * /api/v1/auth/logout:
 *   get:
 *     summary: Logout (clear JWT cookie)
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 */

/**
 * @swagger
 * /api/v1/auth/forgotpassword:
 *   post:
 *     summary: Request password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: Reset email sent }
 */

/**
 * @swagger
 * /api/v1/auth/resetpassword:
 *   put:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resetToken, password]
 *             properties:
 *               resetToken: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid token }
 */

/**
 * @swagger
 * /api/v1/auth/changepassword:
 *   put:
 *     summary: Change password (authenticated)
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password incorrect }
 */

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *     responses:
 *       200: { description: Profile updated }
 */

const router = express.Router();

const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/register/merchant', registerMerchant);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword', resetPassword);
router.put('/changepassword', protect, changePassword);
router.put('/profile', protect, updateProfile);

module.exports = router;
