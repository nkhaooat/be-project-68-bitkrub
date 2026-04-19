# 🕯️ Dungeon Inn — Backend API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-5-black?style=for-the-badge&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?style=for-the-badge&logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/OpenAI-GPT-412991?style=for-the-badge&logo=openai" alt="OpenAI">
</p>

<p align="center">
  <em>REST API for Dungeon Inn — a dark-themed massage reservation system with AI chatbot.</em>
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

### Shops & Services
- 🏪 Browse massage shops with TikTok video links
- 💆 View services per shop with pricing
- 🔍 Search by area and shop name

### Reservations
- 📅 Create, edit, cancel bookings (max 3 active per user)
- ⏱️ 1-day cutoff rule for edits/cancellations
- ✅ Auto-complete past reservations

### Reviews
- ⭐ Submit star rating + comment on completed reservations
- 🔒 One review per reservation enforced at DB level
- 📋 View reviews per shop (public)
- 🙋 View own reviews

### AI Chatbot
- 🤖 RAG-based chatbot using OpenAI embeddings + GPT
- 💬 Recommends shops and services from natural language queries
- 📅 Book / edit / cancel reservations via chat
- 🌦️ Weather-aware recommendations
- 🏪 Shop-pinning for accurate service ID resolution
- 🇹🇭 Thai language support

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 22 + Express 5
- **Database:** MongoDB + Mongoose 9
- **Auth:** JWT + bcryptjs
- **AI:** OpenAI (text-embedding-3-small + GPT-4o-mini)
- **Email:** Brevo (Sendinblue) transactional email
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
│   ├── config.env          # Environment variables
│   └── db.js               # MongoDB connection
├── controllers/
│   ├── auth.js             # Auth + password reset
│   ├── shops.js            # Shop CRUD
│   ├── services.js         # Service CRUD
│   ├── reservations.js     # Booking management
│   ├── reviews.js          # Review system
│   └── chat.js             # AI chatbot
├── models/
│   ├── User.js
│   ├── MassageShop.js
│   ├── MassageService.js
│   ├── Reservation.js
│   └── Review.js
├── routes/
│   ├── auth.js
│   ├── shops.js
│   ├── services.js
│   ├── reservations.js
│   ├── reviews.js
│   └── chat.js
├── middleware/
│   └── auth.js             # JWT protect middleware
├── utils/
│   └── chatbot.js          # Vector store + RAG logic
└── server.js
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

### Shops
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/shops` | Public | List all shops |
| GET | `/api/v1/shops/:id` | Public | Get shop detail |
| POST | `/api/v1/shops` | Admin | Create shop |
| PUT | `/api/v1/shops/:id` | Admin | Update shop |
| DELETE | `/api/v1/shops/:id` | Admin | Delete shop |

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

### Reviews
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/reviews` | Private | Submit review |
| GET | `/api/v1/reviews/shop/:shopId` | Public | Reviews for a shop |
| GET | `/api/v1/reviews/my` | Private | Own reviews |
| GET | `/api/v1/reviews/check/:reservationId` | Private | Check if reviewed |

### Chat
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/chat` | Public | Chat with AI |
| POST | `/api/v1/chat/rebuild` | Admin | Rebuild vector store |

---

## 🧪 Testing

### Postman
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

## 📝 License

This project is part of the Software Engineering course (2110423)
and Software Engineering Lab (2110426), Chulalongkorn University.

---

<p align="center">
  <em>Find your sanctuary in the dark. 🕯️</em>
</p>
