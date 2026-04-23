const crypto = require('crypto');
const User = require('../models/User');
const { BrevoClient } = require('@getbrevo/brevo');

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token
  });
};

//@desc     Register User
//@route    POST /api/v1/auth/register
//@access   Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, telephone, password, role } = req.body;

    //Create user
    const user = await User.create({
      name,
      email,
      telephone,
      password,
      role
    });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    res.status(400).json({ success: false });
    console.log(err.stack);
  }
};

//@desc      Login user
//@route     POST api/v1/auth/login
//@access    Public
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  //Validate email & password
  if (!email || !password) {
    return res.status(400).json({ success: false, msg: 'Please provide an email and password' });
  }

  //Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(400).json({ success: false, msg: 'Invalid credentials' });
  }

  //Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(401).json({ success: false, msg: 'Invalid credentials' });
  }

  sendTokenResponse(user, 200, res);
};

//@desc     Get current logged in user
//@route    GET /api/v1/auth/me
//@access   Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('merchantShop', 'name address');
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

//@desc     Log user out / clear cookie
//@route    GET /api/v1/auth/logout
//@access   Private
exports.logout = async (req, res, next) => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({ success: false });
  }
};

//@desc     Forgot password — send reset email via Brevo
//@route    POST /api/v1/auth/forgotpassword
//@access   Public
exports.forgotPassword = async (req, res, next) => {
  try {
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

    // Use updateOne to avoid triggering pre-save password hash hook
    await User.updateOne({ _id: user._id }, {
      resetPasswordToken: hashedToken,
      resetPasswordExpire: tokenExpire
    });

    const resetUrl = `${process.env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

    let brevoError = null;
    try {
      const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
      const senderEmail = process.env.BREVO_FROM_EMAIL || 'noreply@example.com';
      const senderName = process.env.BREVO_FROM_NAME || 'Dungeon Inn';

      await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: user.email, name: user.name }],
      sender: {
        email: senderEmail,
        name: senderName
      },
      subject: '🔑 Reset Your Dungeon Inn Password',
      htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Password</title>
</head>
<body style="margin:0;padding:0;background-color:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Massage Reservation</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Password Reset Request</h2>
              <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
                Greetings, <strong style="color:#D4CFC6;">${user.name}</strong>! 🗡️
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
                We received a request to reset the password for your Dungeon Inn account.
                Click the button below to choose a new password. This link will expire in
                <strong style="color:#E57A00;">15 minutes</strong>.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">
                      🔑 Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#8A8177;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 32px;font-size:13px;word-break:break-all;">
                <a href="${resetUrl}" style="color:#E57A00;text-decoration:none;">${resetUrl}</a>
              </p>

              <div style="border-top:1px solid #403A36;padding-top:24px;">
                <p style="margin:0;font-size:13px;color:#8A8177;line-height:1.6;">
                  🛡️ If you didn't request a password reset, you can safely ignore this email.
                  Your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;">
              <p style="margin:0;font-size:12px;color:#5A544E;">
                © 2026 Dungeon Inn. All rights reserved. &nbsp;|&nbsp;
                <span style="color:#E57A00;">Happy adventuring!</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
      });
    } catch (brevoErr) {
      brevoError = brevoErr;
      console.error('[Brevo] send error:', JSON.stringify(brevoErr?.body || brevoErr?.message || brevoErr));
    }

    if (brevoError) {
      // Clean up token so it's not orphaned
      await User.updateOne({ _id: user._id }, {
        resetPasswordToken: undefined,
        resetPasswordExpire: undefined
      });
      return res.status(500).json({
        success: false,
        message: 'Email could not be sent',
        detail: brevoError?.body?.message || brevoError?.message || String(brevoError)
      });
    }

    res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent.'
    });
  } catch (err) {
    console.error('forgotPassword error:', err?.message || err);
    res.status(500).json({ success: false, message: 'Email could not be sent', detail: err?.message });
  }
};

//@desc     Reset password using token
//@route    PUT /api/v1/auth/resetpassword
//@access   Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }

    // Hash the token from URL to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Set new password — save() triggers bcrypt pre-save hook
    // Clear token fields atomically BEFORE saving so the link is dead immediately
    await User.updateOne({ _id: user._id }, {
      $unset: { resetPasswordToken: '', resetPasswordExpire: '' }
    });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//@desc     Change password (logged-in user)
//@route    PUT /api/v1/auth/changepassword
//@access   Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//@desc     Register Merchant
//@route    POST /api/v1/auth/register/merchant
//@access   Public
exports.registerMerchant = async (req, res, next) => {
  try {
    const { name, email, telephone, password, shopId } = req.body;

    if (!shopId) {
      return res.status(400).json({ success: false, message: 'Shop ID is required' });
    }

    const MassageShop = require('../models/MassageShop');
    const shop = await MassageShop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    // Check if shop already has a merchant
    const existingMerchant = await User.findOne({ merchantShop: shopId, role: 'merchant' });
    if (existingMerchant) {
      return res.status(400).json({ success: false, message: 'This shop already has a merchant account' });
    }

    const user = await User.create({
      name,
      email,
      telephone,
      password,
      role: 'merchant',
      merchantStatus: 'pending',
      merchantShop: shopId
    });

    // Fire-and-forget: notify admin
    try {
      const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
      await brevo.transactionalEmails.sendTransacEmail({
        to: [{ email: process.env.BREVO_FROM_EMAIL, name: 'Dungeon Inn Admin' }],
        sender: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME || 'Dungeon Inn' },
        subject: '📋 New Merchant Registration Request',
        htmlContent: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
<tr><td style="background:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;"><h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1><p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Merchant Registration</p></td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">New Merchant Request</h2>
<p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Name:</strong> ${name}</p>
<p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Email:</strong> ${email}</p>
<p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Shop:</strong> ${shop.name}</p>
<p style="margin:0 0 24px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Status:</strong> <span style="color:#E57A00;">Pending Approval</span></p>
<p style="margin:0;font-size:13px;color:#8A8177;">Please review this request in the admin dashboard.</p>
</td></tr>
<tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;"><p style="margin:0;font-size:12px;color:#5A544E;">© 2026 Dungeon Inn</p></td></tr>
</table></td></tr></table></body></html>`
      });
    } catch (e) {
      console.error('[Brevo] admin notify error:', e?.message || e);
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error(err.stack);
    res.status(400).json({ success: false, message: err.message || 'Registration failed' });
  }
};
