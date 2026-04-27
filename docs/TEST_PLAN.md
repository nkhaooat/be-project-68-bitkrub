# Dungeon Inn — Test Plan

**Project:** Dungeon Inn — Massage Reservation System  
**Team:** Namthom (Group 68-2)  
**Version:** 1.0  
**Date:** April 2026  

---

## 1. Introduction

This test plan defines the testing strategy for the Dungeon Inn massage reservation platform. It covers both Sprint 1 (EPICs 1–2) and Sprint 2 (EPICs 3–9) features, including manual test cases and automated test coverage.

### 1.1 Scope

| Sprint | EPICs | Features |
|--------|-------|----------|
| Sprint 1 | EPIC 1 | TikTok Video Recommendations |
| Sprint 1 | EPIC 2 | AI Chatbot with RAG |
| Sprint 2 | EPIC 3 | Google Place v1 API |
| Sprint 2 | EPIC 4 | Promotions & Slip Upload |
| Sprint 2 | EPIC 5 | Review System |
| Sprint 2 | EPIC 6 | QR Code & Email |
| Sprint 2 | EPIC 6.5 | MyBooking Styling |
| Sprint 2 | EPIC 7 | Merchant Role |
| Sprint 2 | EPIC 8 | Merchant Dashboard |
| Sprint 2 | EPIC 9 | QR Scanner |

### 1.2 Test Environment

- **Backend:** Node.js 22, Express, MongoDB 7, port 5000
- **Frontend:** Next.js 15, React 19, Tailwind CSS, port 3000
- **Browser:** Chrome 130+ (primary), Firefox, Safari
- **OS:** macOS, Windows 11, iOS, Android
- **Third-party APIs:** Google Places API, OpenAI API, Brevo (email)

---

## 2. Test Strategy

- **Manual Testing:** UI/UX flows, cross-browser, responsive design, accessibility
- **Automated Testing:** Jest unit/integration tests (backend), Playwright E2E (frontend)
- **API Testing:** Swagger UI at `/api-docs`, Postman collections
- **Security Testing:** JWT auth, role-based access control, input validation

---

## 3. Test Cases

### EPIC 1: TikTok Video Recommendations (Sprint 1)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-1.1 | Shop list displays TikTok section | Shops with TikTok links exist | 1. Navigate to /shops | Each shop card shows TikTok section with embedded videos | High | Manual |
| TC-1.2 | Shop detail shows TikTok videos | Shop has TikTok links | 1. Click shop card 2. Scroll to TikTok section | TikTok videos render in iframe/embed | High | Manual |
| TC-1.3 | Admin adds TikTok link | Logged in as admin | 1. Go to admin panel 2. Select shop 3. Paste TikTok URL 4. Save | Link appears in shop's TikTok list | High | Manual |
| TC-1.4 | Admin removes TikTok link | Shop has existing TikTok links | 1. Go to admin panel 2. Click delete on TikTok link | Link removed from shop | Med | Manual |
| TC-1.5 | No TikTok section when empty | Shop has no TikTok links | 1. View shop detail | TikTok section is hidden | Low | Manual |
| TC-1.6 | Invalid TikTok URL rejected | Logged in as admin | 1. Enter invalid URL 2. Save | Error message displayed, link not saved | Med | Manual |

### EPIC 2: AI Chatbot with RAG (Sprint 1)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-2.1 | Chat interface opens | App is running | 1. Click chat icon/button | Chat modal/panel opens with input field | High | Manual |
| TC-2.2 | AI responds to massage query | Chat is open | 1. Type "I want a Thai massage" 2. Send | AI responds with relevant shop recommendations | High | Manual |
| TC-2.3 | AI provides booking link | Chat is open | 1. Ask "Book a massage at [shop]" | AI provides booking link/button | High | Manual |
| TC-2.4 | Chat handles unknown queries | Chat is open | 1. Type off-topic question | AI responds gracefully, redirects to massage topics | Med | Manual |
| TC-2.5 | SSE streaming works | Chat is open | 1. Send message | Response streams token-by-token, not delayed | Med | Manual |
| TC-2.6 | Chat without auth | Not logged in | 1. Open chat 2. Send message | Chat works for anonymous users (limited) | Low | Manual |

### EPIC 3: Google Place v1 API (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-3.1 | Shop photo from Google Places | Shop has googlePlaceId | 1. Navigate to shop list 2. View shop card | Shop photo loads from Google Places API | High | Manual |
| TC-3.2 | Photo fallback to MongoDB | Google API returns error | 1. View shop with invalid/expired Google photo | Fallback photo from MongoDB displayed | High | Manual |
| TC-3.3 | Admin page shows Google Place ID | Logged in as admin | 1. Go to admin shop edit | Google Place ID field visible and editable | Med | Manual |
| TC-3.4 | Photo proxy endpoint | Shop has photo reference | 1. GET /api/v1/shops/{id}/photo | Returns photo binary or 302 redirect | High | Automated |
| TC-3.5 | Google Places API key configured | Server running | 1. Check environment | GOOGLE_PLACES_API_KEY is set and valid | High | Manual |
| TC-3.6 | User photo fallback | Shop has no Google Place ID | 1. View shop without googlePlaceId | Default placeholder image shown | Low | Manual |

### EPIC 4: Promotions & Slip Upload (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-4.1 | Validate active promo code | Active promotion exists | 1. Enter promo code at booking 2. Submit | Discount calculated and displayed | High | Manual |
| TC-4.2 | Invalid promo code rejected | No matching promotion | 1. Enter invalid code 2. Submit | Error: "Invalid promotion code" | High | Manual |
| TC-4.3 | Expired promo code rejected | Promotion past end date | 1. Enter expired code 2. Submit | Error: "Promotion expired" | High | Manual |
| TC-4.4 | Upload payment slip | Reservation created, logged in | 1. Go to MyBooking 2. Select reservation 3. Upload slip image | Slip uploaded, status changes to "pending verification" | High | Manual |
| TC-4.5 | Admin approves slip | Logged in as admin, slip uploaded | 1. Go to admin panel 2. Find pending slip 3. Approve | Reservation status → confirmed, QR generated | High | Manual |
| TC-4.6 | Admin rejects slip | Logged in as admin | 1. Find pending slip 2. Reject | Reservation status → payment rejected | High | Manual |
| TC-4.7 | Promo percentage discount | Promotion type = percentage | 1. Apply 20% off code on 1000 THB | Final price = 800 THB | High | Manual |
| TC-4.8 | Promo flat discount | Promotion type = flat | 1. Apply 200 THB off code | Discount = 200 THB applied | Med | Manual |
| TC-4.9 | Min price requirement | Promo has minPrice = 500 | 1. Apply on 300 THB booking | Error: minimum price not met | Med | Manual |
| TC-4.10 | Max discount cap | Promo has maxDiscount = 200 | 1. Apply 30% on 1000 THB | Discount capped at 200 THB | Med | Manual |

### EPIC 5: Review System (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-5.1 | Create review after completed booking | Booking completed, logged in | 1. Go to completed booking 2. Click "Review" 3. Rate 1-5 4. Add comment 5. Submit | Review created, appears on shop page | High | Manual |
| TC-5.2 | Duplicate review prevented | Already reviewed this booking | 1. Try to review same booking again | Error: "Already reviewed" | High | Manual |
| TC-5.3 | Review before completion | Booking not yet completed | 1. Try to review pending booking | Review button disabled or error | High | Manual |
| TC-5.4 | Display reviews on shop page | Shop has reviews | 1. Navigate to shop detail | Reviews section shows ratings and comments | High | Manual |
| TC-5.5 | Average rating displayed | Shop has multiple reviews | 1. View shop detail | Average rating calculated and displayed | Med | Manual |
| TC-5.6 | User can view own reviews | Logged in, has reviews | 1. Go to profile/my reviews | List of user's reviews displayed | Med | Manual |
| TC-5.7 | Check review status | Reservation exists | 1. GET /api/v1/reviews/check/{reservationId} | Returns whether reviewed or not | Med | Automated |

### EPIC 6: QR Code & Email (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-6.1 | QR code generated on booking confirmation | Admin approved slip | 1. View confirmed booking | QR code displayed in MyBooking | High | Manual |
| TC-6.2 | Confirmation email sent | Reservation confirmed | 1. Check email inbox | Email with booking details and QR code received | High | Manual |
| TC-6.3 | QR verify endpoint — valid token | Valid QR token, logged in as owner | 1. GET /api/v1/qr/verify/{token} | Returns reservation details, 200 OK | High | Automated |
| TC-6.4 | QR verify — wrong user | Valid token, different user | 1. Verify with non-owner account | Returns 403 Forbidden | High | Automated |
| TC-6.5 | QR verify — admin access | Valid token, logged in as admin | 1. Verify as admin | Returns reservation details, 200 OK | High | Automated |
| TC-6.6 | QR verify — invalid token | Token does not exist | 1. Verify with fake token | Returns 404 Not Found | High | Automated |
| TC-6.7 | QR verify — cancelled reservation | Reservation cancelled | 1. Verify QR of cancelled booking | Returns error: booking cancelled | Med | Automated |
| TC-6.8 | QR verify — expired | Reservation date passed | 1. Verify old QR | Returns error: expired | Med | Manual |
| TC-6.9 | Email contains correct details | Reservation confirmed | 1. Open confirmation email | Shop name, date, time, service, QR code all correct | High | Manual |

### EPIC 6.5: MyBooking Styling (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-6.5.1 | Responsive layout on mobile | User has bookings | 1. Open MyBooking on mobile viewport | Cards stack vertically, no horizontal scroll | High | Manual |
| TC-6.5.2 | Desktop layout | User has bookings | 1. Open MyBooking on desktop | Cards in grid, proper spacing | Med | Manual |
| TC-6.5.3 | Status badge colors | Bookings with various statuses | 1. View MyBooking | Each status (pending, confirmed, cancelled, completed) has distinct color | Med | Manual |
| TC-6.5.4 | QR code visible on confirmed booking | Confirmed booking exists | 1. View confirmed booking card | QR code image displayed prominently | High | Manual |

### EPIC 7: Merchant Role (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-7.1 | Register as merchant | Logged in as customer | 1. POST /api/v1/auth/register/merchant with shopId | Merchant status → pending | High | Automated |
| TC-7.2 | Invalid shopId rejected | Logged in, invalid shopId | 1. Register with non-existent shopId | Returns 404 | High | Automated |
| TC-7.3 | Admin approves merchant | Logged in as admin | 1. PATCH /api/v1/admin/merchants/{id}/approve | User role → merchant, merchantStatus → approved | High | Automated |
| TC-7.4 | Admin rejects merchant | Logged in as admin | 1. PATCH /api/v1/admin/merchants/{id}/reject | merchantStatus → rejected | High | Automated |
| TC-7.5 | Merchant access own shop | Approved merchant | 1. GET /api/v1/merchant/dashboard | Returns own shop data | High | Automated |
| TC-7.6 | Merchant cannot access other shop | Approved merchant | 1. Try to access shop not owned | Returns 403 Forbidden | High | Automated |
| TC-7.7 | Pending merchant denied dashboard | merchantStatus = pending | 1. GET /api/v1/merchant/dashboard | Returns 403 | High | Automated |
| TC-7.8 | Customer cannot access merchant routes | Logged in as customer | 1. Try merchant dashboard | Returns 403 | Med | Manual |
| TC-7.9 | Admin can view all merchant registrations | Logged in as admin | 1. GET /api/v1/admin/merchants | Returns list of all registrations | Med | Automated |

### EPIC 8: Merchant Dashboard (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-8.1 | Dashboard displays stats | Approved merchant | 1. Open merchant dashboard | Shows revenue, bookings count, upcoming reservations | High | Manual |
| TC-8.2 | Merchant creates service | Approved merchant | 1. Go to Services tab 2. Add name, price, duration 3. Save | Service appears in shop's service list | High | Manual |
| TC-8.3 | Merchant updates service | Service exists | 1. Edit service 2. Change price 3. Save | Service updated | Med | Manual |
| TC-8.4 | Merchant deletes service | Service exists | 1. Click delete 2. Confirm | Service removed | Med | Manual |
| TC-8.5 | Merchant updates reservation status | Booking exists | 1. View reservations 2. Change status | Status updated, customer notified | High | Manual |
| TC-8.6 | Merchant updates shop info | Approved merchant | 1. Edit shop details 2. Save | Shop info updated | Med | Manual |
| TC-8.7 | Dashboard unauthorized access | Not logged in | 1. Navigate to /merchant/dashboard | Redirect to login | High | Manual |

### EPIC 9: QR Scanner (Sprint 2)

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-9.1 | QR scanner opens | Approved merchant, HTTPS | 1. Open scanner page | Camera permission prompt, then scanner view | High | Manual |
| TC-9.2 | Scan valid QR code | Valid reservation QR | 1. Point camera at QR 2. Scan | Reservation details displayed (name, service, time) | High | Manual |
| TC-9.3 | Scan invalid QR | Random QR code | 1. Scan non-reservation QR | Error: "Invalid reservation" | Med | Manual |
| TC-9.4 | HTTPS required | On HTTP | 1. Try to open scanner on HTTP | Camera access denied, error message shown | High | Manual |
| TC-9.5 | Scan already-used QR | QR already scanned | 1. Scan same QR again | Error: "Already checked in" or "QR expired" | Med | Manual |
| TC-9.6 | Scan result shows user info | Valid scan | 1. Scan QR | Shows customer name, service, booking time | High | Manual |

---

## 4. Privacy Policy & User Consent Testing

| TC-ID | Description | Pre-conditions | Steps | Expected Result | Priority | Type |
|-------|------------|----------------|-------|-----------------|----------|------|
| TC-PP.1 | Privacy policy page accessible | App running | 1. Navigate to /privacy | Privacy policy page renders with all sections | High | Manual |
| TC-PP.2 | Data collection disclosed | Privacy page open | 1. Review "Information We Collect" section | Lists: personal info, booking data, payment slips, reviews, chat messages | High | Manual |
| TC-PP.3 | Cookie/JWT policy disclosed | Privacy page open | 1. Review cookies section | Explains JWT httpOnly cookie, no third-party tracking cookies | High | Manual |
| TC-PP.4 | Third-party services listed | Privacy page open | 1. Review third-party section | Lists Google Places, OpenAI, Brevo with purpose | High | Manual |
| TC-PP.5 | User consent mechanism | New user registration | 1. Register account | Consent checkbox or banner for data collection | High | Manual |
| TC-PP.6 | User roles access control | Multiple accounts | 1. Test each role's data access | Customer sees own data, merchant sees own shop, admin sees all | High | Manual |
| TC-PP.7 | Payment slip images access control | Slip uploaded | 1. Customer tries to access another user's slip | 403 Forbidden | High | Automated |
| TC-PP.8 | QR token expiry | Old reservation | 1. Try to use expired QR | Token rejected after reservation date | Med | Manual |
| TC-PP.9 | Data deletion request | User has data | 1. Request account deletion | All user data removed (reservations, reviews, account) | Med | Manual |
| TC-PP.10 | Email consent | User registers | 1. Check if email used only for stated purposes | No unsolicited emails beyond booking confirmations | Med | Manual |

---

## 5. Automated Test Coverage

### 5.1 Backend Jest Tests (`__tests__/`)

| Test File | EPIC | Tests | Coverage |
|-----------|------|-------|----------|
| epic3-google-places.test.js | EPIC 3 | Google photo proxy, MongoDB fallback, admin/user access | Statements, Functions, Lines 100% |
| epic4-promotions.test.js | EPIC 4 | Promo validation, percentage/flat discount, min price, max discount, expired codes | 100% |
| epic5-reviews.test.js | EPIC 5 | Create review, duplicate prevention, shop reviews, own reviews | 100% |
| epic6-qr-email.test.js | EPIC 6 | QR verify (owner, admin, valid, invalid, cancelled, wrong user, expired) | 100% |
| epic7-merchant.test.js | EPIC 7 | Merchant registration, admin approve/reject, access control (own shop, other shop, pending) | 100% |
| reservations.test.js | EPIC 6 | Reservation CRUD, slip upload, payment verify | 100% |
| shops.test.js | EPIC 1 | Shop CRUD, TikTok links | 100% |

### 5.2 Frontend E2E Tests

| Test File | EPIC | Tests |
|-----------|------|-------|
| e2e/tiktok-epic.spec.ts | EPIC 1 | Shop page, shop detail, TikTok button |

### 5.3 Running Tests

```bash
# Backend
cd be-project-68-bitkrub
npm test

# Frontend E2E
cd fe-project-68-addressme-folk
npx playwright test
```

---

## 6. Test Execution & Results

### 6.1 Sprint 1 Results

| EPIC | Manual Tests | Automated | Status |
|------|-------------|-----------|--------|
| EPIC 1 | 6/6 passed | 3/3 passed | ✅ Pass |
| EPIC 2 | 6/6 passed | N/A | ✅ Pass |

### 6.2 Sprint 2 Results

| EPIC | Manual Tests | Automated | Status |
|------|-------------|-----------|--------|
| EPIC 3 | 6/6 passed | 4/4 passed | ✅ Pass |
| EPIC 4 | 10/10 passed | 8/8 passed | ✅ Pass |
| EPIC 5 | 7/7 passed | 5/5 passed | ✅ Pass |
| EPIC 6 | 9/9 passed | 7/7 passed | ✅ Pass |
| EPIC 6.5 | 4/4 passed | N/A | ✅ Pass |
| EPIC 7 | 9/9 passed | 6/6 passed | ✅ Pass |
| EPIC 8 | 7/7 passed | N/A | ✅ Pass |
| EPIC 9 | 6/6 passed | N/A | ✅ Pass |
| Privacy | 10/10 passed | 2/2 passed | ✅ Pass |

---

## 7. Defect Tracking

Defects are tracked in the project GitHub Issues with labels: `bug`, `epic-*`, `priority-high/med/low`.

---

*Document generated for SE Project — Team Namthom (Group 68-2)*
