# 📋 Sprint Backlog — Dungeon Inn Backend

> **Project:** Dungeon Inn — REST API (Node.js / Express / MongoDB)
> **Repo:** be-project-68-bitkrub
> **Velocity unit:** man-hours (1 story point ≈ 1 hour for this project)

---

## Sprint 6 — QR Code Reservation Confirmations + Brevo Email Notifications

**Sprint Goal:** Attach a scannable, single-use QR code to every key reservation event (submit / cancel / passed-for-review). The QR is invalidated automatically when a reservation is cancelled or expired. Merchant service accounts can scan the QR to confirm a session.

**Duration:** 2 weeks

---

### 📦 Backlog Items

#### EPIC: Brevo Transactional Emails with QR Code

---

**BE-S6-01 — QR Token generation & storage on Reservation**
- **Type:** Backend / Data model
- **Description:** Add a `qrToken` (UUID/HMAC-signed string) and `qrActive` boolean field to the `Reservation` model. Generate the token when a reservation is created. Auto-set `qrActive = false` when status changes to `cancelled` or the reservation `resvDate` is in the past.
- **Acceptance Criteria:**
  - `Reservation` schema has `qrToken: String`, `qrActive: Boolean` (default `true`)
  - Token is a cryptographically random UUID (or JWT signed with `QR_SECRET`)
  - Token is regenerated on each edit (status revert)
  - `qrActive` flips to `false` on cancel or when `resvDate < now`
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S6-02 — QR invalidation middleware / hook**
- **Type:** Backend / Business logic
- **Description:** Add a Mongoose `pre('save')` hook or a scheduled job that sets `qrActive = false` when the reservation `status` becomes `cancelled` or when `resvDate` has passed.
- **Acceptance Criteria:**
  - Cancellation via `DELETE /api/v1/reservations/:id` sets `qrActive = false` immediately
  - A utility function `invalidateExpiredQRs()` can be called on server start and via a lightweight cron
  - Scanning an inactive token returns `{ success: false, message: "QR code is no longer valid" }`
- **Estimate:** 2 h
- **Assignee:** Backend dev

---

**BE-S6-03 — QR verification endpoint**
- **Type:** Backend / API
- **Description:** `GET /api/v1/reservations/verify-qr/:token` — validates the QR token, checks `qrActive`, confirms it belongs to the calling merchant's shop, and marks the session as confirmed.
- **Acceptance Criteria:**
  - Returns reservation details + user name + service on valid scan
  - Returns 400/403 on invalid, expired, or wrong-shop token
  - Requires `merchant` role (Sprint 7 role; stub with `admin` for now)
  - Sets reservation `status = 'confirmed'` on first valid scan
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S6-04 — Email: Reservation submitted (with QR)**
- **Type:** Backend / Email
- **Description:** When a user creates a reservation via `POST /api/v1/reservations`, send a Brevo transactional email containing a QR code image (PNG data-URI or public URL) embedding the `qrToken`.
- **Acceptance Criteria:**
  - Email sent within 5 s of reservation creation
  - QR image encodes `{token, reservationId}` payload
  - Email contains: shop name, service name, date/time, user name, QR image
  - Uses Brevo template or inline HTML
- **Estimate:** 4 h
- **Assignee:** Backend dev

---

**BE-S6-05 — Email: Reservation cancelled (confirmation)**
- **Type:** Backend / Email
- **Description:** When a user cancels (`DELETE /api/v1/reservations/:id`), send a cancellation confirmation email. No QR included (it is now invalid). Clear messaging that the slot has been freed.
- **Acceptance Criteria:**
  - Email sent immediately on cancel
  - Email body: shop name, service, original date, cancellation timestamp
  - QR NOT attached; brief note that any previously sent QR is now void
- **Estimate:** 2 h
- **Assignee:** Backend dev

---

**BE-S6-06 — Email: Reservation completed — prompt for review**
- **Type:** Backend / Email
- **Description:** When a reservation transitions to `status = 'completed'` (either manually or via the auto-complete job), send a "Thank you — leave a review" email with a direct deep-link to the review page.
- **Acceptance Criteria:**
  - Email contains deep-link: `{FRONTEND_URL}/review/{reservationId}`
  - Sent only once per reservation (guard against duplicates)
  - Works for both auto-complete path and manual admin completion
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S6-07 — QR code generation utility**
- **Type:** Backend / Utility
- **Description:** Create `utils/qrcode.js` that wraps the `qrcode` npm package. Exposes `generateQRDataURI(token)` returning a base64 PNG data-URI for embedding in emails.
- **Acceptance Criteria:**
  - `npm install qrcode` added to dependencies
  - `generateQRDataURI(token)` is async, returns `data:image/png;base64,...`
  - Unit test for happy path
- **Estimate:** 2 h
- **Assignee:** Backend dev

---

**BE-S6-08 — Integration tests for QR + email flows**
- **Type:** Testing
- **Description:** Add `__tests__/qr.test.js` covering: create reservation → QR generated, cancel → QR inactive, verify valid QR, verify invalid QR.
- **Acceptance Criteria:**
  - All 4 test cases pass
  - Email sends mocked via jest mock (no real Brevo calls in CI)
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

### ⏱️ Sprint 6 Estimate Summary

| ID | Story | Est. (h) |
|----|-------|----------|
| BE-S6-01 | QR token & schema | 3 |
| BE-S6-02 | QR invalidation hook | 2 |
| BE-S6-03 | QR verify endpoint | 3 |
| BE-S6-04 | Email: submitted + QR | 4 |
| BE-S6-05 | Email: cancelled | 2 |
| BE-S6-06 | Email: completed + review prompt | 3 |
| BE-S6-07 | QR utility module | 2 |
| BE-S6-08 | Integration tests | 3 |
| **Total** | | **22 h** |

---

---

## Sprint 7 — Merchant Account Type + Admin Verification + Shop Management

**Sprint Goal:** Introduce a `merchant` role. Merchants self-register with proof-of-ownership (via a Linktree-linked form), are approved by an Admin, and then gain access to manage their own shop, services, and reservations. Merchants can scan user QR codes via browser camera to confirm sessions.

**Duration:** 2 weeks

---

### 📦 Backlog Items

#### EPIC: Merchant Role & Admin Approval Flow

---

**BE-S7-01 — Merchant role + linked shop on User model**
- **Type:** Backend / Data model
- **Description:** Extend `User` schema with `role: 'merchant'` enum value, `merchantShop: ObjectId (ref MassageShop)`, `merchantStatus: enum ['pending', 'approved', 'rejected']`, and `merchantProofUrl: String` (link to uploaded proof document).
- **Acceptance Criteria:**
  - `role` enum updated: `['user', 'admin', 'merchant']`
  - `merchantShop` populated on `GET /api/v1/auth/me` for merchant users
  - `merchantStatus` defaults to `'pending'` on registration with `role=merchant`
  - New index: `merchantShop` field for fast lookup
- **Estimate:** 2 h
- **Assignee:** Backend dev

---

**BE-S7-02 — Merchant registration endpoint**
- **Type:** Backend / API
- **Description:** Extend `POST /api/v1/auth/register` (or new `POST /api/v1/auth/register/merchant`) to accept `shopId`, `proofUrl` and set `role = 'merchant'`, `merchantStatus = 'pending'`.
- **Acceptance Criteria:**
  - Request body: `{ name, email, telephone, password, shopId, proofUrl }`
  - `shopId` must exist in DB; returns 404 if not
  - `merchantStatus = 'pending'` — cannot log in to merchant features until approved
  - Sends notification email to admin (`ADMIN_EMAIL` env var)
  - Returns standard auth token (user can still browse public routes)
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S7-03 — Admin: list & approve/reject merchants**
- **Type:** Backend / API (Admin panel)
- **Description:** New admin-only routes for merchant verification.
  - `GET /api/v1/admin/merchants?status=pending` — list pending merchants
  - `PUT /api/v1/admin/merchants/:id/approve` — set `merchantStatus = 'approved'`, send approval email
  - `PUT /api/v1/admin/merchants/:id/reject` — set `merchantStatus = 'rejected'`, send rejection email
- **Acceptance Criteria:**
  - All three endpoints require `admin` role
  - Approval/rejection emails sent via Brevo
  - Approved merchant immediately gains access to merchant routes
- **Estimate:** 4 h
- **Assignee:** Backend dev

---

**BE-S7-04 — Merchant middleware guard**
- **Type:** Backend / Middleware
- **Description:** Create `middleware/merchant.js` — checks `req.user.role === 'merchant'` AND `req.user.merchantStatus === 'approved'`. Returns 403 otherwise.
- **Acceptance Criteria:**
  - Pending merchants get `{ error: "Merchant account pending approval" }` (403)
  - Rejected merchants get `{ error: "Merchant account rejected" }` (403)
  - Used on all merchant-only routes
- **Estimate:** 1 h
- **Assignee:** Backend dev

---

**BE-S7-05 — Merchant: view & edit own shop**
- **Type:** Backend / API
- **Description:** Merchant can GET and PUT their linked shop only.
  - `GET /api/v1/merchant/shop` — returns their shop
  - `PUT /api/v1/merchant/shop` — update name, description, address, openTime, closeTime, etc. (no shopId change allowed)
- **Acceptance Criteria:**
  - Route scoped to `req.user.merchantShop` — cannot edit other shops
  - Returns 403 if `merchantShop` is null/unset
  - Admin still has unrestricted shop edit
- **Estimate:** 2 h
- **Assignee:** Backend dev

---

**BE-S7-06 — Merchant: manage own services**
- **Type:** Backend / API
- **Description:** Merchant can CRUD services under their own shop.
  - `GET /api/v1/merchant/services`
  - `POST /api/v1/merchant/services`
  - `PUT /api/v1/merchant/services/:id`
  - `DELETE /api/v1/merchant/services/:id`
- **Acceptance Criteria:**
  - All routes scoped to `req.user.merchantShop`
  - Attempting to modify a service from another shop returns 403
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S7-07 — Merchant: view reservations for their shop**
- **Type:** Backend / API
- **Description:** `GET /api/v1/merchant/reservations` — returns all reservations for the merchant's shop, with user name/email, service, date, and status.
- **Acceptance Criteria:**
  - Supports `?status=pending|confirmed|completed|cancelled` filter
  - Supports `?date=YYYY-MM-DD` filter
  - Pagination: `?page=1&limit=20`
  - Results include populated `user.name`, `service.name`
- **Estimate:** 3 h
- **Assignee:** Backend dev

---

**BE-S7-08 — Merchant QR scan confirmation (reuse BE-S6-03)**
- **Type:** Backend / API
- **Description:** Update `GET /api/v1/reservations/verify-qr/:token` (from Sprint 6) to accept `merchant` role in addition to `admin`. Verify that the scanned QR belongs to the merchant's own shop.
- **Acceptance Criteria:**
  - Merchant can only confirm reservations for their own `merchantShop`
  - Returns 403 if reservation.shop !== merchant.merchantShop
  - Same success/error responses as Sprint 6
- **Estimate:** 1 h
- **Assignee:** Backend dev

---

**BE-S7-09 — Merchant registration form link strategy (Linktree)**
- **Type:** Documentation / DevOps
- **Description:** Document the merchant self-registration flow: Linktree link → internal registration page → form submits to `POST /api/v1/auth/register/merchant`. No backend work required; write `docs/MERCHANT_ONBOARDING.md`.
- **Acceptance Criteria:**
  - `MERCHANT_ONBOARDING.md` explains the full flow with diagram
  - Linktree URL slot noted in README
- **Estimate:** 1 h
- **Assignee:** Any dev / PM

---

**BE-S7-10 — Tests for merchant role flows**
- **Type:** Testing
- **Description:** `__tests__/merchant.test.js` — register merchant, admin approve, merchant accesses own shop, merchant blocked from other shop.
- **Acceptance Criteria:**
  - 6+ test cases covering happy path + unauthorized paths
  - All pass in CI
- **Estimate:** 4 h
- **Assignee:** Backend dev

---

### ⏱️ Sprint 7 Estimate Summary

| ID | Story | Est. (h) |
|----|-------|----------|
| BE-S7-01 | Merchant role + schema | 2 |
| BE-S7-02 | Merchant registration endpoint | 3 |
| BE-S7-03 | Admin approve/reject routes | 4 |
| BE-S7-04 | Merchant middleware guard | 1 |
| BE-S7-05 | Merchant: edit own shop | 2 |
| BE-S7-06 | Merchant: manage own services | 3 |
| BE-S7-07 | Merchant: view shop reservations | 3 |
| BE-S7-08 | QR verify — merchant role update | 1 |
| BE-S7-09 | Merchant onboarding docs | 1 |
| BE-S7-10 | Merchant tests | 4 |
| **Total** | | **24 h** |

---

## 📊 Combined Velocity Overview

| Sprint | Focus | Total Est. |
|--------|-------|-----------|
| Sprint 6 | QR + Email notifications | 22 h |
| Sprint 7 | Merchant role + Admin panel | 24 h |
| **Grand Total** | | **46 h** |

---

## EPIC 4: Massage Promotion

### US 4-1: Apply Promotion Code Before Payment
| Task | Volunteer 1 | Volunteer 2 | Status |
|------|-------------|-------------|--------|
| Create Promotion model schema | Natthadon Chairuangsirikul | Wachiraphan Tisanthia | ✅ |
| POST /promotions/validate endpoint | Teerapat Sardsud | Atichat Saengmani | ✅ |
| Discount calculation (flat/percentage) | Itthipat Wongnoppawich | Methasit Phanawongwat | ✅ |
| Add promotionCode to Reservation model | Methasit Phanawongwat | Chatchapon Malayapun | ✅ |
| Apply discount on reservation create | Sarana Thanadeecharoenchok | Methasit Phanawongwat | ✅ |
| Promotion code input + Apply button (booking page) | Atichat Saengmani | Anupat Tubsri | ✅ |
| Display discounted price breakdown | Chatchapon Malayapun | Atichat Saengmani | ✅ |
| Display discounted price breakdown | Natthadon Chairuangsirikul | Teerapat Sardsud | ✅ |
| Prevent booking until price confirmed | Methasit Phanawongwat | Natchanon Maidee | ✅ |

### US 4-2: Upload Payment Slip
| Task | Volunteer 1 | Volunteer 2 | Status |
|------|-------------|-------------|--------|
| Configure image upload (multer) | Teerapat Sardsud | Methasit Phanawongwat | ✅ |
| Add slipImageUrl + paymentStatus to Reservation | Itthipat Wongnoppawich | Sarana Thanadeecharoenchok | ✅ |
| POST /reservations/:id/slip endpoint | Anupat Tubsri | Natchanon Maidee | ✅ |
| Slip upload UI on booking detail | Chatchapon Malayapun | Itthipat Wongnoppawich | ✅ |
| Call upload endpoint + update status | Methasit Phanawongwat | Natthadon Chairuangsirikul | ✅ |
| Confirmation after upload in admin UI | Wachiraphan Tisanthia | Itthipat Wongnoppawich | ✅ |

### US 4-3: Admin Create Promotion Codes
| Task | Volunteer 1 | Volunteer 2 | Status |
|------|-------------|-------------|--------|
| POST /promotions (admin create) | Natthadon Chairuangsirikul | Teerapat Sardsud | ✅ |
| DELETE /promotions/:id (admin deactivate) | Sarana Thanadeecharoenchok | Anupat Tubsri | ✅ |
| GET /promotions (admin list) | Teerapat Sardsud | Atichat Saengmani | ✅ |
| GET /promotions (admin list) | Anupat Tubsri | Chatchapon Malayapun | ✅ |
| Create promotion form in admin | Methasit Phanawongwat | Natchanon Maidee | ✅ |
| Delete button per promotion + confirmation | Natthadon Chairuangsirikul | Sarana Thanadeecharoenchok | ✅ |

### US 4-4: Admin Verify Payment Slip
| Task | Volunteer 1 | Volunteer 2 | Status |
|------|-------------|-------------|--------|
| PUT /reservations/:id/verify (approve/reject) | Sarana Thanadeecharoenchok | Teerapat Sardsud | ✅ |
| Pending payment list in admin bookings | Chatchapon Malayapun | Natthadon Chairuangsirikul | ✅ |
| Slip thumbnail + Approve/Reject buttons | Wachiraphan Tisanthia | Anupat Tubsri | ✅ |
| On approval: status → Confirmed in both UIs | Chatchapon Malayapun | Methasit Phanawongwat | ✅ |
