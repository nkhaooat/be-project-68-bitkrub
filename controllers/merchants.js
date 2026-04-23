const User = require('../models/User');
const { BrevoClient } = require('@getbrevo/brevo');

// @desc    List pending merchants
// @route   GET /api/v1/admin/merchants
// @access  Private (admin)
exports.getMerchants = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { role: 'merchant' };
    if (status) filter.merchantStatus = status;

    const merchants = await User.find(filter)
      .populate('merchantShop', 'name address')
      .select('-password -resetPasswordToken -resetPasswordExpire');

    res.status(200).json({ success: true, count: merchants.length, data: merchants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Approve merchant
// @route   PATCH /api/v1/admin/merchants/:id/approve
// @access  Private (admin)
exports.approveMerchant = async (req, res, next) => {
  try {
    const merchant = await User.findOne({ _id: req.params.id, role: 'merchant' });
    if (!merchant) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    merchant.merchantStatus = 'approved';
    await merchant.save();

    // Fire-and-forget: notify merchant
    sendMerchantStatusEmail(merchant, 'approved').catch(e =>
      console.error('[Brevo] merchant approval email error:', e?.message || e)
    );

    res.status(200).json({ success: true, data: merchant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reject merchant
// @route   PATCH /api/v1/admin/merchants/:id/reject
// @access  Private (admin)
exports.rejectMerchant = async (req, res, next) => {
  try {
    const merchant = await User.findOne({ _id: req.params.id, role: 'merchant' });
    if (!merchant) {
      return res.status(404).json({ success: false, message: 'Merchant not found' });
    }

    merchant.merchantStatus = 'rejected';
    await merchant.save();

    // Fire-and-forget: notify merchant
    sendMerchantStatusEmail(merchant, 'rejected').catch(e =>
      console.error('[Brevo] merchant rejection email error:', e?.message || e)
    );

    res.status(200).json({ success: true, data: merchant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Helper: send approval/rejection email
async function sendMerchantStatusEmail(merchant, status) {
  const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  const isApproved = status === 'approved';

  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: merchant.email, name: merchant.name }],
    sender: { email: process.env.BREVO_FROM_EMAIL, name: process.env.BREVO_FROM_NAME || 'Dungeon Inn' },
    subject: isApproved ? '✅ Merchant Account Approved — Dungeon Inn' : '❌ Merchant Account Rejected — Dungeon Inn',
    htmlContent: `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A1A;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
<tr><td style="background:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;"><h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1><p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">Merchant Account</p></td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">${isApproved ? '🎉 Your Account Has Been Approved!' : 'Application Update'}</h2>
<p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
  Greetings, <strong style="color:#D4CFC6;">${merchant.name}</strong>!
</p>
<p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
  ${isApproved
    ? 'Your merchant account has been <strong style="color:#4ade80;">approved</strong>. You can now log in and manage your shop, services, and reservations.'
    : 'Your merchant account application has been <strong style="color:#f87171;">rejected</strong>. If you believe this is an error, please contact the admin team.'}
</p>
${isApproved ? `<table cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:8px 0 32px;">
<a href="${process.env.FRONTEND_URL || 'https://fe-project-68-addressme.vercel.app'}/login"
   style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">
  🏪 Go to Dashboard
</a></td></tr></table>` : ''}
</td></tr>
<tr><td style="background:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;"><p style="margin:0;font-size:12px;color:#5A544E;">© 2026 Dungeon Inn</p></td></tr>
</table></td></tr></table></body></html>`
  });
}
