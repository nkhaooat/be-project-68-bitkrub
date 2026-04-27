# Testing Guide — Backend

## Prerequisites

- Node.js 18+
- MongoDB running locally or via Docker (`docker compose up mongo -d`)
- Copy `config/config.env` and fill in real values (or use `.env` for Docker)

---

## 1. Unit / Integration Tests (Jest)

```bash
npm test
```

### Test Coverage

| Epic | File | What It Tests |
|------|------|---------------|
| 1 | `epic1-shops.test.js` | Shop CRUD, search, filtering |
| 2 | `epic2-chatbot.test.js` | RAG chatbot, vector store, streaming |
| 3 | `epic3-google-places.test.js` | Google Places API integration, photo proxy |
| 4 | `epic4-promotions.test.js` | Promotion CRUD, validation, expiry, usage limits |
| 5 | `epic5-reviews.test.js` | Review submission, one-per-reservation rule, shop reviews |
| 6 | `epic6-qr-email.test.js` | QR token generation, verification, email sending |
| 6 | `epic6-reservations.test.js` | Booking CRUD, slip upload, status transitions |
| 7 | `epic7-merchant.test.js` | Merchant registration, approve/reject, self-service |

### Run a Single Test

```bash
npx jest __tests__/epic4-promotions.test.js
```

### Run with Coverage

```bash
npx jest --coverage
```

---

## 2. Postman (Integration / Manual)

1. Open Postman → Import
2. Import `testcase/massage-reservation-tests.json`
3. Import `testcase/postman-environment.json`
4. Select the **Dungeon Inn** environment
5. Click **Runner** → select the collection → **Run**

> **Important:** Run the `PREREQ*` requests first — they populate the environment with fresh IDs and tokens that later tests depend on.

### Newman (CLI)

```bash
cd testcase
npx newman run massage-reservation-tests.json \
  -e postman-environment.json \
  --export-environment postman-environment.json \
  --delay-request 100
```

---

## 3. Swagger UI (API Explorer)

Start the server, then open:

```
http://localhost:5000/api-docs
```

You can try every endpoint directly from the browser. Switch between servers:
- **Production:** `https://be-project-68-bitkrub.onrender.com`
- **Local:** `http://localhost:5000`

For authenticated endpoints, click the 🔒 **Authorize** button and paste a JWT token.

---

## 4. Docker Smoke Test

```bash
# Start the full stack (API + MongoDB)
docker compose up -d --build

# Wait for startup, then check
curl http://localhost:5000/api/v1/shops

# Check logs
docker compose logs api

# Tear down
docker compose down
```

---

## 5. Quick Manual Checks

| Endpoint | Method | Expected |
|----------|--------|----------|
| `/api/v1/shops` | GET | `200` + shop list |
| `/api/v1/auth/register` | POST | `201` + token |
| `/api/v1/auth/login` | POST | `200` + token |
| `/api/v1/chat` | POST | `200` + AI response |
| `/api/v1/promotions/validate` | POST | `200` or `404` |
