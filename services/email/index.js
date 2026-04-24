const { BrevoClient } = require('@getbrevo/brevo');

/**
 * Shared Brevo client factory — avoids repeating apiKey setup everywhere.
 */
function getBrevoClient() {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
}

function getSenderInfo() {
  return {
    email: process.env.BREVO_FROM_EMAIL,
    name: process.env.BREVO_FROM_NAME || 'Dungeon Inn',
  };
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://fe-project-68-addressme.vercel.app';
}

// ---------------------------------------------------------------------------
// Email template helpers (return HTML strings)
// ---------------------------------------------------------------------------

function dungeonHeader(subtitle = 'Massage Reservation') {
  return `
    <tr><td style="background-color:#2C1E18;padding:32px 40px;text-align:center;border-bottom:2px solid #E57A00;">
      <h1 style="margin:0;font-size:28px;font-weight:800;color:#E57A00;letter-spacing:1px;">⚔️ DUNGEON INN</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#8A8177;letter-spacing:2px;text-transform:uppercase;">${subtitle}</p>
    </td></tr>`;
}

function dungeonFooter() {
  return `
    <tr><td style="background-color:#1A1A1A;padding:20px 40px;text-align:center;border-top:1px solid #403A36;">
      <p style="margin:0;font-size:12px;color:#5A544E;">
        © 2026 Dungeon Inn. All rights reserved. &nbsp;|&nbsp;
        <span style="color:#E57A00;">Happy adventuring!</span>
      </p>
    </td></tr>`;
}

function emailWrap(body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#2B2B2B;border:1px solid #403A36;border-radius:12px;overflow:hidden;">
        ${body}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Confirmation email
// ---------------------------------------------------------------------------

async function sendConfirmationEmail(reservation) {
  if (!reservation.populated?.('shop')) {
    await reservation.populate([
      { path: 'shop', select: 'name address' },
      { path: 'service', select: 'name duration price' },
      { path: 'user', select: 'name email' },
    ]);
  }
  const { shop, service, user } = reservation;
  const date = new Date(reservation.resvDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = new Date(reservation.resvDate).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
  const qrPageUrl = `${getFrontendUrl()}/qr/${reservation.qrToken}`;

  const html = emailWrap(`
    ${dungeonHeader()}
    <tr><td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Booking Confirmed! 🎉</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
        Greetings, <strong style="color:#D4CFC6;">${user.name}</strong>! Your reservation has been created.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;width:120px;">🏪 Shop</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${shop?.name || 'N/A'}</td></tr>
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">💆 Service</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${service?.name || 'N/A'}</td></tr>
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">📅 Date</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${date}</td></tr>
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">🕐 Time</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${time}</td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding:24px 0 8px;">
          <a href="${qrPageUrl}" style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">📱 View QR Code</a>
        </td></tr>
      </table>
      <p style="margin:8px 0 0;font-size:13px;color:#8A8177;line-height:1.6;">Show the QR code at the shop to verify your booking.</p>
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: user.email, name: user.name }],
    sender: getSenderInfo(),
    subject: '🎉 Booking Confirmed — Dungeon Inn',
    htmlContent: html,
  });
  console.log(`[email] Confirmation sent to ${user.email}`);
}

// ---------------------------------------------------------------------------
// Cancellation email
// ---------------------------------------------------------------------------

async function sendCancellationEmail(reservation) {
  if (!reservation.populated?.('shop')) {
    await reservation.populate([
      { path: 'shop', select: 'name address' },
      { path: 'service', select: 'name duration price' },
      { path: 'user', select: 'name email' },
    ]);
  }
  const { user, shop, service } = reservation;
  const date = new Date(reservation.resvDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = emailWrap(`
    ${dungeonHeader()}
    <tr><td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Booking Cancelled</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
        Hi <strong style="color:#D4CFC6;">${user.name}</strong>, your reservation has been cancelled.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border-radius:8px;margin:16px 0;">
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;width:120px;">🏪 Shop</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${shop?.name || 'N/A'}</td></tr>
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">💆 Service</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${service?.name || 'N/A'}</td></tr>
        <tr><td style="padding:12px 16px;color:#8A8177;font-size:13px;">📅 Date</td><td style="padding:12px 16px;color:#D4CFC6;font-size:15px;">${date}</td></tr>
      </table>
      <div style="background-color:#3B1A1A;border:1px solid #7F1D1D;border-radius:8px;padding:16px;margin:24px 0;">
        <p style="margin:0;font-size:14px;color:#FCA5A5;line-height:1.6;">⛔ Your QR code is now <strong>void</strong> and cannot be used at the shop.</p>
      </div>
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: user.email, name: user.name }],
    sender: getSenderInfo(),
    subject: '❌ Booking Cancelled — Dungeon Inn',
    htmlContent: html,
  });
  console.log(`[email] Cancellation sent to ${user.email}`);
}

// ---------------------------------------------------------------------------
// Review request email
// ---------------------------------------------------------------------------

async function sendReviewRequestEmail(reservation) {
  if (!reservation.populated?.('shop')) {
    await reservation.populate([
      { path: 'shop', select: 'name' },
      { path: 'service', select: 'name' },
      { path: 'user', select: 'name email' },
    ]);
  }
  const { user, shop } = reservation;
  const reviewUrl = `${getFrontendUrl()}/mybookings`;

  const html = emailWrap(`
    ${dungeonHeader()}
    <tr><td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">How was your visit? ⭐</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
        Hi <strong style="color:#D4CFC6;">${user.name}</strong>, your appointment at <strong style="color:#D4CFC6;">${shop?.name || 'the shop'}</strong> has been completed.
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
        We'd love to hear your feedback! Leave a review to help others find great massage services.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding:8px 0 32px;">
          <a href="${reviewUrl}" style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">⭐ Leave a Review</a>
        </td></tr>
      </table>
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: user.email, name: user.name }],
    sender: getSenderInfo(),
    subject: '⭐ How was your visit? — Dungeon Inn',
    htmlContent: html,
  });
  console.log(`[email] Review request sent to ${user.email}`);
}

// ---------------------------------------------------------------------------
// Password reset email
// ---------------------------------------------------------------------------

async function sendPasswordResetEmail(user, resetUrl) {
  const html = emailWrap(`
    ${dungeonHeader()}
    <tr><td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">Password Reset Request</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
        Greetings, <strong style="color:#D4CFC6;">${user.name}</strong>! 🗡️
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
        We received a request to reset the password for your Dungeon Inn account.
        Click the button below to choose a new password. This link will expire in
        <strong style="color:#E57A00;">15 minutes</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding:8px 0 32px;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">🔑 Reset My Password</a>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:#8A8177;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0 0 32px;font-size:13px;word-break:break-all;">
        <a href="${resetUrl}" style="color:#E57A00;text-decoration:none;">${resetUrl}</a>
      </p>
      <div style="border-top:1px solid #403A36;padding-top:24px;">
        <p style="margin:0;font-size:13px;color:#8A8177;line-height:1.6;">
          🛡️ If you didn't request a password reset, you can safely ignore this email.
          Your password will remain unchanged.
        </p>
      </div>
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: user.email, name: user.name }],
    sender: getSenderInfo(),
    subject: '🔑 Reset Your Dungeon Inn Password',
    htmlContent: html,
  });
}

// ---------------------------------------------------------------------------
// Merchant registration admin notification
// ---------------------------------------------------------------------------

async function sendMerchantNotifyAdminEmail(name, email, shopName) {
  const html = emailWrap(`
    ${dungeonHeader('Merchant Registration')}
    <tr><td style="padding:40px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">New Merchant Request</h2>
      <p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Name:</strong> ${name}</p>
      <p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Email:</strong> ${email}</p>
      <p style="margin:0 0 8px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Shop:</strong> ${shopName}</p>
      <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;"><strong style="color:#D4CFC6;">Status:</strong> <span style="color:#E57A00;">Pending Approval</span></p>
      <p style="margin:0;font-size:13px;color:#8A8177;">Please review this request in the admin dashboard.</p>
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: process.env.BREVO_FROM_EMAIL, name: 'Dungeon Inn Admin' }],
    sender: getSenderInfo(),
    subject: '📋 New Merchant Registration Request',
    htmlContent: html,
  });
// ---------------------------------------------------------------------------
// Merchant status email (approved/rejected)
// ---------------------------------------------------------------------------

async function sendMerchantStatusEmail(merchant, status) {
  const isApproved = status === 'approved';
  const dashboardUrl = `${getFrontendUrl()}/login`;

  const html = emailWrap(`
    ${dungeonHeader('Merchant Account')}
    <tr><td style="padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;font-size:22px;color:#F0E5D8;">${isApproved ? '🎉 Your Account Has Been Approved!' : 'Application Update'}</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#A88C6B;line-height:1.6;">
        Greetings, <strong style="color:#D4CFC6;">${merchant.name}</strong>!
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#A88C6B;line-height:1.6;">
        ${isApproved
          ? 'Your merchant account has been <strong style="color:#4ade80;">approved</strong>. You can now log in and manage your shop, services, and reservations.'
          : 'Your merchant account application has been <strong style="color:#f87171;">rejected</strong>. If you believe this is an error, please contact the admin team.'}
      </p>
      ${isApproved ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding:8px 0 32px;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:14px 36px;background-color:#E57A00;color:#1A110A;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">🏪 Go to Dashboard</a>
        </td></tr>
      </table>` : ''}
    </td></tr>
    ${dungeonFooter()}
  `);

  const brevo = getBrevoClient();
  await brevo.transactionalEmails.sendTransacEmail({
    to: [{ email: merchant.email, name: merchant.name }],
    sender: getSenderInfo(),
    subject: isApproved ? '✅ Merchant Account Approved — Dungeon Inn' : '❌ Merchant Account Rejected — Dungeon Inn',
    htmlContent: html,
  });
  console.log(`[email] Merchant ${status} email sent to ${merchant.email}`);
}

}

module.exports = {
  getBrevoClient,
  getSenderInfo,
  getFrontendUrl,
  sendConfirmationEmail,
  sendCancellationEmail,
  sendReviewRequestEmail,
  sendPasswordResetEmail,
  sendMerchantNotifyAdminEmail,
};
