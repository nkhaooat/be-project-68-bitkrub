# 🕯️ Dungeon Inn — Backend API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-5-black?style=for-the-badge&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?style=for-the-badge&logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/OpenAI-GPT-412991?style=for-the-badge&logo=openai" alt="OpenAI">
</p>

<p align="center">
  <em>REST API for Dungeon Inn — a dark-themed massage reservation system with AI chatbot, QR workflow, promotions, and merchant dashboard.</em>
</p>

---

## 🌐 Live API

| Environment | URL |
|-------------|-----|
| **Backend API** | https://be-project-68-bitkrub.onrender.com |
| **Frontend** | https://fe-project-68-addressme.vercel.app/ |

---

## ✨ Features

### Authentication
- 🔐 Register / Login with JWT
- 🔑 Forgot Password / Reset Password via email (Brevo)
- 🔒 Change Password (authenticated)
- 👤 User profile update

### Shops & Services
- 🏪 Browse massage shops with TikTok video links
- 💆 View services per shop with pricing
- 🔍 Search by area and shop name
- 📸 Google Places v1 API for shop images with MongoDB fallback
- ⭐ Review stats (average rating + count) on shop endpoints

### Reservations
- 📅 Create, edit, cancel bookings (max 3 active per user)
- ⏱️ 1-day cutoff rule for edits/cancellations
- ✅ Auto-complete past reservations
- 🎟️ Promotion code support — flat or percentage discount
- 💳 Payment slip upload (multer) with admin verification (approve/reject)

### Reviews
- ⭐ Submit star rating + comment on completed reservations
- 🔒 One review per reservation enforced at DB level
- 📋 View reviews per shop (public)
- 🙋 View own reviews

### QR Code Workflow
- 🔲 QR token generated on reservation creation
- ✅ QR verify endpoint — owner or admin can verify
- 🏪 Merchant QR scan — verifies shop ownership, confirms booking
- ❌ QR expiry cron — auto-voids expired/cancelled QR codes
- 📧 Brevo email with hosted QR link on booking creation
- 📧 Cancellation confirmation email + QR void

### Promotions
- 🎟️ Create promotion codes (admin) — discount type, value, expiry, usage limit
- ✅ Validate promotion code — checks validity, expiry, usage
- 🗑️ Delete/deactivate promotions (admin)
- 📋 List all promotions with usage stats (admin)

### Merchant System
- 🏪 Merchant registration — request service account for a shop
- ✅ Admin approve/reject merchant accounts
- 🔒 Merchant middleware — route protection for approved merchants only
- 📊 Merchant self-service — CRUD own services, view own reservations
- 🔄 Merchant reservation status update (confirm/complete/cancel)

### AI Chatbot
- 🤖 RAG-based chatbot using OpenAI embeddings + GPT
- 💬 Recommends shops and services from natural language queries
- 📅 Book / edit / cancel reservations via chat
- 🌦️ Weather-aware recommendations
- 🏪 Shop-pinning for accurate service ID resolution
- 🇹🇭 Thai language support with translation service
- ⚡ Streaming chat endpoint for real-time token display

### Security & Infrastructure
- 🛡️ Helmet security headers
- ⏱️ Rate limiting (express-rate-limit)
- 🔄 Async handler + centralized error handler middleware
- ⏰ Cron jobs — QR expiry check, embedding rebuild at midnight

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 22 + Express 5
- **Database:** MongoDB + Mongoose 9
- **Auth:** JWT + bcryptjs
- **AI:** OpenAI (text-embedding-3-small + GPT-4o-mini)
- **Email:** Brevo (Sendinblue) transactional email
- **Upload:** Multer (payment slip images)
- **Security:** Helmet, express-rate-limit, CORS
- **Hosting:** Render

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB URI

### Installation

```bash
git clone https://github.com/2110503-CEDT68/se-project-be-68-2-namthom.git
cd se-project-be-68-2-namthom
npm install
```

### Configuration

Create `config/config.env`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
OPENAI_API_KEY=your_openai_key
BREVO_API_KEY=your_brevo_key
BREVO_FROM_EMAIL=your_verified_sender@email.com
BREVO_FROM_NAME=Dungeon Inn
FRONTEND_URL=http://localhost:3000
GOOGLE_PLACES_API_KEY=your_google_places_key
```

### Run

```bash
npm run dev     # development (nodemon)
npm start       # production
```

---

## 📁 Project Structure

```
├── config/
│   ├── config.env              # Environment variables
│   └── db.js                   # MongoDB connection
├── controllers/
│   ├── auth.js                 # Auth + password reset + profile
│   ├── chat.js                 # AI chatbot (streaming + standard)
│   ├── merchantAdmin.js        # Admin approve/reject merchants
│   ├── merchantSelfService.js  # Merchant self-service CRUD
│   ├── promotions.js           # Promotion CRUD + validate
│   ├── reservations.js         # Booking + slip upload + verify
│   ├── reviews.js              # Review system
│   ├── services.js             # Service CRUD
│   └── shops.js                # Shop CRUD + Google Places
├── cron/
│   ├── embeddingRebuild.js     # Midnight embedding rebuild
│   └── qrExpiry.js             # QR expiry auto-void
├── middleware/
│   ├── asyncHandler.js         # Async error wrapper
│   ├── auth.js                 # JWT protect + role check
│   ├── errorHandler.js        # Centralized error handler
│   ├── rateLimit.js            # API rate limiting
│   └── upload.js               # Multer config for slip images
├── models/
│   ├── MassageService.js
│   ├── MassageShop.js
│   ├── Promotion.js
│   ├── Reservation.js
│   ├── Review.js
│   └── User.js                 # Includes merchant role + status
├── routes/
│   ├── auth.js
│   ├── chat.js
│   ├── merchant.js             # Merchant self-service routes
│   ├── merchants.js            # Admin merchant management
│   ├── promotions.js           # Promotion CRUD + validate
│   ├── qr.js                   # QR verify + scan
│   ├── reservations.js
│   ├── reviews.js
│   ├── services.js
│   └── shops.js
├── services/
│   ├── email/index.js          # Brevo email service
│   ├── promotions.js           # Promotion logic
│   ├── qr.js                   # QR token service
│   ├── reservations.js         # Reservation logic
│   ├── translation.js          # Thai translation service
│   ├── userContext.js          # Chat user context
│   └── weather.js              # Weather API service
├── utils/
│   ├── chatbot.js              # Vector store + RAG logic
│   ├── geo/chatbotGeo.js       # Bangkok transit geo anchors
│   ├── google/places.js        # Google Places v1 API
│   └── prompts/chatbot-system.js  # System prompt templates
├── __tests__/
│   ├── epic1-shops.test.js
│   ├── epic2-chatbot.test.js
│   ├── epic3-google-places.test.js
│   ├── epic4-promotions.test.js
│   ├── epic5-reviews.test.js
│   ├── epic6-qr-email.test.js
│   ├── epic6-reservations.test.js
│   └── epic7-merchant.test.js
├── scripts/                     # Utility scripts
├── testcase/                    # Postman collections
├── docs/                        # Sprint backlog
└── server.js                    # Express entry point
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/auth/register` | Public | Register |
| POST | `/api/v1/auth/login` | Public | Login |
| GET | `/api/v1/auth/me` | Private | Get current user |
| GET | `/api/v1/auth/logout` | Private | Logout |
| POST | `/api/v1/auth/forgotpassword` | Public | Send reset email |
| PUT | `/api/v1/auth/resetpassword` | Public | Reset password (token) |
| PUT | `/api/v1/auth/changepassword` | Private | Change password |
| PUT | `/api/v1/auth/profile` | Private | Update profile |

### Shops
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/shops` | Public | List all shops |
| GET | `/api/v1/shops/:id` | Public | Get shop detail |
| POST | `/api/v1/shops` | Admin | Create shop |
| PUT | `/api/v1/shops/:id` | Admin | Update shop |
| DELETE | `/api/v1/shops/:id` | Admin | Delete shop |
| GET | `/api/v1/shops/photo-proxy` | Public | Google Places photo proxy |

### Services
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/services` | Public | List all services |
| GET | `/api/v1/shops/:shopId/services` | Public | Services by shop |
| POST | `/api/v1/shops/:shopId/services` | Admin | Create service |
| PUT | `/api/v1/services/:id` | Admin | Update service |
| DELETE | `/api/v1/services/:id` | Admin | Delete service |

### Reservations
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/reservations` | Private | Get own reservations |
| GET | `/api/v1/reservations` | Admin | Get all reservations |
| POST | `/api/v1/reservations` | Private | Create booking |
| PUT | `/api/v1/reservations/:id` | Private | Edit booking |
| DELETE | `/api/v1/reservations/:id` | Private | Cancel booking |
| POST | `/api/v1/reservations/:id/slip` | Private | Upload payment slip |
| PUT | `/api/v1/reservations/:id/verify` | Admin | Approve/reject slip |

### Reviews
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/reviews` | Private | Submit review |
| GET | `/api/v1/reviews/shop/:shopId` | Public | Reviews for a shop |
| GET | `/api/v1/reviews/my` | Private | Own reviews |
| GET | `/api/v1/reviews/check/:reservationId` | Private | Check if reviewed |

### Promotions
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/promotions/validate` | Private | Validate promotion code |
| POST | `/api/v1/promotions` | Admin | Create promotion |
| GET | `/api/v1/promotions` | Admin | List all promotions |
| DELETE | `/api/v1/promotions/:id` | Admin | Delete promotion |

### QR Code
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/qr/verify/:token` | Private | Verify QR token |
| POST | `/api/v1/qr/scan` | Merchant | Scan + verify QR (shop owner) |

### Merchant
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/merchants/register` | Private | Register as merchant |
| GET | `/api/v1/merchants` | Admin | List pending merchants |
| PUT | `/api/v1/merchants/:id/approve` | Admin | Approve merchant |
| PUT | `/api/v1/merchants/:id/reject` | Admin | Reject merchant |
| GET | `/api/v1/merchant/services` | Merchant | List own services |
| POST | `/api/v1/merchant/services` | Merchant | Create own service |
| PUT | `/api/v1/merchant/services/:id` | Merchant | Update own service |
| DELETE | `/api/v1/merchant/services/:id` | Merchant | Delete own service |
| GET | `/api/v1/merchant/reservations` | Merchant | List own reservations |
| PUT | `/api/v1/merchant/reservations/:id/status` | Merchant | Update reservation status |
| PUT | `/api/v1/merchant/shop` | Merchant | Update own shop |

### Chat
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/chat` | Public | Chat with AI |
| POST | `/api/v1/chat/stream` | Public | Stream chat with AI |
| POST | `/api/v1/chat/rebuild` | Admin | Rebuild vector store |

---

## 🧪 Testing

### Jest (Unit Tests)
```bash
npm test
```

Covers: shops, chatbot/RAG, Google Places integration, promotions, reviews, QR/email workflow, reservations, merchant registration.

### Postman (Integration)
1. Import `testcase/massage-reservation-tests.json`
2. Import `testcase/postman-environment.json`
3. Select the environment
4. Click **Runner** → **Run Collection**

> **Note:** Run `PREREQ*` test cases first to populate the environment file with fresh IDs and tokens.

### Newman (CLI)
```bash
cd testcase
npx newman run massage-reservation-tests.json \
  -e postman-environment.json \
  --export-environment postman-environment.json \
  --delay-request 100
```

---

## 👥 Contributors

| GitHub | Name |
|--------|------|
| [@nkhaooat](https://github.com/nkhaooat) | Methasit Phanawongwat |
| [@anupatcu111](https://github.com/anupatcu111) | Anupat Tubsri |
| [@TeerapatSardsud](https://github.com/TeerapatSardsud) | Teerapat Sardsud |
| [@wachiraphantisanthia](https://github.com/wachiraphantisanthia) | Wachiraphan Tisanthia |
| [@UpDowLR](https://github.com/UpDowLR) | Chatchapon Malayapun |
| [@wanderer5090](https://github.com/wanderer5090) | Natthadon Chairuangsirikul |
| [@Dziiit](https://github.com/Dziiit) | Itthipat Wongnoppawich |
| [@cppccpcp](https://github.com/cppccpcp) | Sarana Thanadeecharoenchok |
| [@DeoTTo883xd](https://github.com/DeoTTo883xd) | Atichat Saengmani |
| [@Zouyauwu](https://github.com/Zouyauwu) | Natchanon Maidee |

---

## 🔒 Privacy Policy

**Effective Date:** 27 April 2026

Dungeon Inn ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights regarding that data when you use our massage reservation platform.

### 1. Information We Collect

- **Account data:** name, email address, hashed password, telephone number, and role
- **Reservation data:** booking dates, selected shop, service, promotion codes used, and reservation status
- **Payment data:** payment slip images uploaded for admin verification (no raw card numbers are stored)
- **Review data:** star ratings and comments you submit for completed reservations
- **Usage data:** IP address, HTTP request logs, and rate-limit counters (retained transiently)

### 2. How We Use Your Information

- Create and manage your account and reservations
- Send transactional emails (booking confirmation, QR codes, cancellation notices, password reset) via **Brevo**
- Verify payment slips and approve or reject bookings
- Generate and validate QR codes for check-in at partner shops
- Power the AI chatbot (queries are sent to **OpenAI**; no personally identifiable data is included in chatbot prompts)
- Display shop images retrieved from the **Google Places API**
- Improve service quality through aggregated, anonymised analytics

### 3. Third-Party Services

| Service | Purpose |
|---|---|
| **Brevo (Sendinblue)** | Transactional email delivery |
| **OpenAI** | AI chatbot responses (no PII sent) |
| **Google Places API** | Shop images and location data |
| **MongoDB Atlas** | Cloud database hosting |
| **Render** | Backend hosting and infrastructure |
| **Vercel** | Frontend hosting |

Each third party operates under its own privacy policy. We do not sell your data to any party.

### 4. Data Retention

- Account data is retained for as long as your account is active
- Completed or cancelled reservation records are kept for a minimum of 1 year for audit purposes
- Payment slip images are kept until the associated reservation is settled
- QR tokens are voided and purged by an automated cron job once expired or cancelled

### 5. Data Security

- Passwords are hashed with **bcryptjs** before storage — plain-text passwords are never saved
- Authentication uses short-lived **JWT tokens** delivered via HTTP-only cookies
- All API traffic is served over **HTTPS**
- Rate limiting and security headers (Helmet.js) are applied to all endpoints

### 6. Your Rights

You have the right to:

- **Access** the personal data we hold about you
- **Correct** inaccurate data via the profile update endpoint
- **Delete** your account by contacting us (see Section 8)
- **Object** to processing in certain circumstances

### 7. Cookies

We use a single HTTP-only session cookie to store your JWT authentication token. No advertising or tracking cookies are used.

### 8. Contact Us

For any privacy-related questions or data deletion requests, please contact us at:

- **Email:** aotmetrasit@gmail.com
- **Project:** Dungeon Inn — CEDT68 Software Engineering (2110503)

### 9. Changes to This Policy

We may update this Privacy Policy from time to time. The effective date at the top of this section will reflect the most recent revision. Continued use of Dungeon Inn after changes constitutes acceptance of the updated policy.

---

## 📧 Contact

For questions or data deletion requests: **aotmetrasit@gmail.com**

---

## 📝 License

This project is part of the Software Engineering course (2110423)
and Software Engineering Lab (2110426), Chulalongkorn University.

---

<p align="center">
  <em>Find your sanctuary in the dark. 🕯️</em>
</p>
