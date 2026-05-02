const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendPasswordResetEmail, sendMerchantNotifyAdminEmail } = require('../services/email');

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true
  };
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }
  res.status(statusCode).cookie('token', token, options).json({ success: true, token });
};

//@desc     Register User
//@route    POST /api/v1/auth/register
//@access   Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, telephone, password, role, pdpaConsent } = req.body;
  const user = await User.create({ name, email, telephone, password, role, pdpaConsent, pdpaConsentedAt: pdpaConsent ? Date.now() : null });
  sendTokenResponse(user, 200, res);
});

//@desc      Login user
//@route     POST api/v1/auth/login
//@access    Public
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, msg: 'Please provide an email and password' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials' });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, msg: 'Invalid credentials' });
  }

  sendTokenResponse(user, 200, res);
};

//@desc     Get current logged in user
//@route    GET /api/v1/auth/me
//@access   Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('merchantShop', 'name address');
  res.status(200).json({ success: true, data: user });
});

//@desc     Log user out / clear cookie
//@route    GET /api/v1/auth/logout
//@access   Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ success: true, data: {} });
});

//@desc     Forgot password — send reset email
//@route    POST /api/v1/auth/forgotpassword
//@access   Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    // Still respond success to avoid email enumeration
    return res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent.'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const tokenExpire = Date.now() + 15 * 60 * 1000;

  await User.updateOne({ _id: user._id }, {
    resetPasswordToken: hashedToken,
    resetPasswordExpire: tokenExpire
  });

  const resetUrl = `${process.env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

  try {
    await sendPasswordResetEmail(user, resetUrl);
  } catch (brevoErr) {
    console.error('[Brevo] send error:', JSON.stringify(brevoErr?.body || brevoErr?.message || brevoErr));
    // Clean up token so it's not orphaned
    await User.updateOne({ _id: user._id }, {
      resetPasswordToken: undefined,
      resetPasswordExpire: undefined
    });
    return res.status(500).json({
      success: false,
      message: 'Email could not be sent',
      detail: brevoErr?.body?.message || brevoErr?.message || String(brevoErr)
    });
  }

  res.status(200).json({
    success: true,
    message: 'If that email exists, a reset link has been sent.'
  });
});

//@desc     Reset password using token
//@route    PUT /api/v1/auth/resetpassword
//@access   Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
  }

  // Clear token fields atomically BEFORE saving so the link is dead immediately
  await User.updateOne({ _id: user._id }, {
    $unset: { resetPasswordToken: '', resetPasswordExpire: '' }
  });

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.status(200).json({ success: true, message: 'Password has been reset successfully' });
});

//@desc     Change password (logged-in user)
//@route    PUT /api/v1/auth/changepassword
//@access   Private
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required' });
  }

  const user = await User.findById(req.user.id).select('+password');
  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

// @desc    Update PDPA consent
// @route   PUT /api/v1/auth/pdpa-consent
// @access  Private
exports.updatePdpaConsent = asyncHandler(async (req, res, next) => {
  const { personalData, bookingEmails, aiChatbot, publicReviews } = req.body;

  // personalData and bookingEmails are required for the app to function
  if (!personalData || !bookingEmails) {
    return res.status(400).json({
      success: false,
      message: 'Personal data and booking email consents are required'
    });
  }

  const user = await User.findByIdAndUpdate(req.user.id, {
    pdpaConsent: { personalData, bookingEmails, aiChatbot, publicReviews },
    pdpaConsentedAt: Date.now()
  }, { new: true });

  res.status(200).json({ success: true, data: user });
});

// @desc    Update profile (name, email, telephone)
// @route   PUT /api/v1/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const allowedFields = ['name', 'email', 'telephone'];
  const updateData = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid fields to update' });
  }

  // If email is changing, check uniqueness
  if (updateData.email) {
    const existing = await User.findOne({ email: updateData.email, _id: { $ne: req.user.id } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email is already in use' });
    }
  }

  const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true, runValidators: true });
  res.status(200).json({ success: true, data: user });
});

//@desc     Register Merchant
//@route    POST /api/v1/auth/register/merchant
//@access   Public
exports.registerMerchant = asyncHandler(async (req, res, next) => {
  const { name, email, telephone, password, shopId } = req.body;

  if (!shopId) {
    return res.status(400).json({ success: false, message: 'Shop ID is required' });
  }

  const MassageShop = require('../models/MassageShop');
  const shop = await MassageShop.findById(shopId);
  if (!shop) {
    return res.status(404).json({ success: false, message: 'Shop not found' });
  }

  const existingMerchant = await User.findOne({ merchantShop: shopId, role: 'merchant' });
  if (existingMerchant) {
    return res.status(400).json({ success: false, message: 'This shop already has a merchant account' });
  }

  const user = await User.create({
    name, email, telephone, password,
    role: 'merchant',
    merchantStatus: 'pending',
    merchantShop: shopId
  });

  // Fire-and-forget: notify admin
  if (process.env.BREVO_API_KEY) {
    sendMerchantNotifyAdminEmail(name, email, shop.name).catch(e =>
      console.error('[Brevo] admin notify error:', e?.message || e)
    );
  }

  sendTokenResponse(user, 200, res);
});
