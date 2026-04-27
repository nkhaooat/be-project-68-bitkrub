# Privacy Policy — Dungeon Inn

**Effective Date:** 27 April 2026

Dungeon Inn ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data when you use our massage reservation platform.

---

## 1. Information We Collect

We collect the following categories of personal data:

- **Account data:** name, email address, hashed password, telephone number, and role
- **Reservation data:** booking dates, selected shop, service, promotion codes used, and reservation status
- **Payment data:** payment slip images uploaded for admin verification (no raw card numbers are stored)
- **Review data:** star ratings and comments you submit for completed reservations
- **Usage data:** IP address, HTTP request logs, and rate-limit counters (retained transiently)

---

## 2. How We Use Your Information

- Create and manage your account and reservations
- Send transactional emails (booking confirmation, QR codes, cancellation notices, password reset) via **Brevo**
- Verify payment slips and approve or reject bookings
- Generate and validate QR codes for check-in at partner shops
- Power the AI chatbot (queries are sent to **OpenAI**; no personally identifiable data is included in chatbot prompts)
- Display shop images retrieved from the **Google Places API**
- Improve service quality through aggregated, anonymised analytics

---

## 3. Third-Party Services

| Service | Purpose |
|---|---|
| **Brevo (Sendinblue)** | Transactional email delivery |
| **OpenAI** | AI chatbot responses (no PII sent) |
| **Google Places API** | Shop images and location data |
| **MongoDB Atlas** | Cloud database hosting |
| **Render** | Backend hosting and infrastructure |
| **Vercel** | Frontend hosting |

Each third party operates under its own privacy policy. We do not sell your data to any party.

---

## 4. Data Retention

- Account data is retained for as long as your account is active
- Completed or cancelled reservation records are kept for a minimum of 1 year for audit purposes
- Payment slip images are kept until the associated reservation is settled
- QR tokens are voided and purged by an automated cron job once expired or cancelled

---

## 5. Data Security

- Passwords are hashed with **bcryptjs** before storage — plain-text passwords are never saved
- Authentication uses short-lived **JWT tokens** delivered via HTTP-only cookies
- All API traffic is served over **HTTPS**
- Rate limiting and security headers (Helmet.js) are applied to all endpoints

---

## 6. Your Rights

You have the right to:

- **Access** the personal data we hold about you
- **Correct** inaccurate data via the profile update endpoint
- **Delete** your account by contacting us (see Section 8)
- **Object** to processing in certain circumstances

---

## 7. Cookies

We use a single HTTP-only session cookie to store your JWT authentication token. No advertising or tracking cookies are used.

---

## 8. Contact Us

For any privacy-related questions or data deletion requests, please contact us at:

- **Email:** 6833080621.student.chula.ac.th
- **Project:** Dungeon Inn — CEDT68 Software Engineering (2110503)

---

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. The effective date at the top of this page will reflect the most recent revision. Continued use of Dungeon Inn after changes constitutes acceptance of the updated policy.
