# Sprint Backlog - Dungeon Inn Backend

> **Project:** Dungeon Inn - REST API (Node.js / Express / MongoDB)
> **Repo:** be-project-68-bitkrub
> **Velocity unit:** man-hours (1 story point ~ 1 hour)

---

## Sprint 1 - Core Features + AI Chatbot + Password Reset

**Sprint Goal:** Deliver the core user-facing features: TikTok video recommendations, AI chatbot with RAG, and password management.

**Duration:** 2 weeks

### EPIC 1 - Massage Video Recommendation System

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US1-1 | As a customer, I want to view massage-related videos from TikTok on the shop detail page | Done | 5 |
| US1-2 | As an admin, I want to add TikTok video links about massage services | Done | 3 |
| US1-3 | As an admin, I want to update TikTok video information | Done | 3 |
| US1-4 | As an admin, I want to delete inappropriate or outdated videos | Done | 2 |

**Acceptance Criteria:**
- US1-1: Shop detail page displays TikTok thumbnails/links; clicking opens in new tab
- US1-2: Admin enters TikTok URL for a shop; saved to shop record; visible to customers
- US1-3: Admin edits/replaces a video link; updated video displayed on shop page
- US1-4: Admin removes a video link; deleted video no longer appears

### EPIC 2 - AI Chatbot Massage Recommendation

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US2-1 | As a customer, I want to ask the AI chatbot about massage shops and services | Done | 13 |
| US2-2 | As a customer, I want the chatbot to recommend shops and allow bookings | Done | 8 |
| US2-3 | As an admin, I want the chatbot knowledge base to stay up to date | Done (rebuild endpoint Todo) | 8 |
| US2-4 | As an admin, I want the chatbot to only use accurate shop/service data | Done (Thai in Test) | 5 |

**Acceptance Criteria:**
- US2-1: Chatbot receives customer question with shop context; suggests suitable massage types
- US2-2: Chatbot creates real reservation via booking API; shows success with link to My Bookings
- US2-3: Admin triggers knowledge base rebuild; re-indexes all shop/service data into vector store
- US2-4: Only IDs belonging to selected shop used; serviceId validated against shop's service list

### EPIC 2.5 - Password Forgot/Reset/Change

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US2.5-1 | As a customer, I can request a password reset from the Forgot Password page | Done | 5 |
| US2.5-2 | As a customer with a valid token, I can set a new password | Done | 5 |
| US2.5-3 | As a signed-in user, I can change my password | Done | 3 |

**Acceptance Criteria:**
- US2.5-1: Confirmation message shown without revealing account existence; email sent with reset link
- US2.5-2: One-time token; link valid 15 mins; password must be >6 characters
- US2.5-3: User provides currentPassword + newPassword; can login with new password after

---

## Sprint 2 - Google Places + Promotions + Reviews + QR + Email + Merchant + Scanner

**Sprint Goal:** Deliver promotions, reviews, QR/email workflow, merchant role, and merchant QR scanner.

**Duration:** 2 weeks

### EPIC 3 - Google Place v1 API

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US3-1 | As a customer, I want to always view shop pictures | Done | 5 |
| US3-2 | As an admin, I want to always see shop images in admin edit | Done | 3 |

**Acceptance Criteria:**
- US3-1: Images load from Google Places API; fallback to "photo" schema in MongoDB when API down
- US3-2: Same fallback behavior in admin panel

### EPIC 4 - Massage Promotion

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US4-1 | As a customer, I want to apply a promotion code before payment | Done | 5 |
| US4-2 | As a customer, I want to upload my payment slip | Done | 5 |
| US4-3 | As an admin, I want to create new promotion codes | Done | 3 |
| US4-4 | As an admin, I want to verify the uploaded slip | Done | 5 |

**Acceptance Criteria:**
- US4-1: Valid code applies discount; invalid/expired shows error and keeps original price
- US4-2: Slip uploaded and saved; status changes to "Waiting for Verification"
- US4-3: Admin creates codes with name/discount/expiry; list shows all codes with usage
- US4-4: Admin approves (Confirmed) or rejects (notify customer to re-upload)

### EPIC 5 - Massage Review

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US5-1 | As a customer, I want to rate and comment on my experience | Done | 5 |
| US5-2 | As a customer, I want one review per booking limit | Done | 3 |
| US5-3 | As an admin, I want to see all customer reviews | Done | 3 |
| US5-4 | As an admin, I want to delete inappropriate reviews | Done | 2 |

**Acceptance Criteria:**
- US5-1: Completed bookings allow star ratings + comments; non-completed hide review button
- US5-2: One review per booking; no editing after submission
- US5-3: Admin dashboard shows rating, comment, booking ID; reviews visible on shop detail
- US5-4: Admin deletes inappropriate review; removed from all views

### EPIC 6 - QR Code Reservation Confirmations + Brevo Email Notifications

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US6-1 | As an admin, I want a QR code endpoint for shop verification | Done | 3 |
| US6-2 | As an admin, I want QR code integration workflow on booking | Done | 3 |
| US6-3 | As a customer, I want QR code display in /mybookings | Done | 2 |
| US6-4 | As a customer, I should receive confirmation email with QR code | Done | 4 |
| US6-5 | As an admin, when booking is completed, email requests review | Done | 3 |
| US6-6 | As an admin, when booking is cancelled, email sent and QR voided | Done | 2 |
| US6-7 | As an admin, I want integration tests for QR workflow | Done | 3 |
| US6-8 | As an admin, I want to invalidate all expired QR codes | Done | 2 |

**Acceptance Criteria:**
- US6-1: Valid booking QR usable; cancelled booking QR invalid
- US6-2: Success modal shows QR + "Check your email"; Download QR as PNG
- US6-3: "Show QR" button on active bookings; inactive/expired state displayed
- US6-4: Email sent within 5s with reservation details + QR image encoding {token, reservationId}
- US6-5: "Thank you - leave a review" email with deep-link to /review/{reservationId}; no duplicates
- US6-6: Cancellation toast/alert; auto-dismiss after 5s; QR voided
- US6-7: Integration tests pass for create/cancel/verify valid/verify invalid QR
- US6-8: Cancelled/expired reservations have qrActive=false; invalid QR returns error

### EPIC 6.5 - /mybooking Styling

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US6.5 | As a customer, I want status tags and search bar for easy navigation | Done | 1 |

### EPIC 7 - Merchant Role & Admin Approval Flow

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US7-1 | As a merchant, I want a service account to edit my shop and check reservations | Done | 2 |
| US7-2 | As a merchant, I want to know the status of my service account request | Done | 3 |
| US7-3 | As an admin, I want to validate service account requests | Done | 4 |
| US7-4 | As an admin, merchant can only login if approved | Done | 1 |
| US7-5 | As a merchant, I want CRUD for my shop and service | Done | 8 |
| US7-6 | As a merchant, I want to scan QR from my customer | Done | 1 |
| US7-7 | As an admin, I want users to click a link for requesting service account | Done | 1 |
| US7-8 | As an admin, I want to verify all QR workflow runs successfully | Done | 4 |

### EPIC 8 - Merchant Dashboard

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US8-1 | As a merchant, I want a panel to manage shop and services | Done | 5 |
| US8-2 | As a merchant, I want to validate and check my own shop page | Done | 3 |
| US8-3 | As a merchant, I want to validate and check my own service page | Done | 5 |
| US8-4 | As a merchant, I want to check reservations for my shop | Done | 8 |

### EPIC 9 - QR Scanner (Browser Camera)

| ID | User Story | Status | Points |
|----|-----------|--------|--------|
| US9-1 | As a merchant, I want browser camera access for real-time QR detection | Done | 8 |
| US9-2 | As an admin, I need to request merchant user to allow camera access | Done | 3 |
| US9-3 | As a merchant, when I scan QR, I want to see reservation and service data | Done | 5 |

---

## Product Backlog (Full)

### EPIC 1 - Massage Video Recommendation System (13 pts)
- US1-1: Customer views TikTok videos on shop page (5 pts)
- US1-2: Admin adds TikTok video links (3 pts)
- US1-3: Admin updates TikTok video info (3 pts)
- US1-4: Admin deletes inappropriate/outdated videos (2 pts)

### EPIC 2 - AI Chatbot Massage Recommendation (34 pts)
- US2-1: Customer asks chatbot about massage shops (13 pts)
- US2-2: Chatbot recommends shops and allows bookings (8 pts)
- US2-3: Admin keeps knowledge base current (8 pts)
- US2-4: Chatbot uses accurate shop/service IDs (5 pts)

### EPIC 2.5 - Password Forgot/Reset/Change (13 pts)
- US2.5-1: Customer requests password reset (5 pts)
- US2.5-2: Customer sets new password with valid token (5 pts)
- US2.5-3: Signed-in user changes password (3 pts)

### EPIC 3 - Google Place v1 API (8 pts)
- US3-1: Customer always sees shop pictures (5 pts)
- US3-2: Admin always sees shop images (3 pts)

### EPIC 4 - Massage Promotion (18 pts)
- US4-1: Customer applies promotion code (5 pts)
- US4-2: Customer uploads payment slip (5 pts)
- US4-3: Admin creates promotion codes (3 pts)
- US4-4: Admin verifies uploaded slip (5 pts)

### EPIC 5 - Massage Review (13 pts)
- US5-1: Customer rates and comments (5 pts)
- US5-2: One review per booking (3 pts)
- US5-3: Admin sees all reviews (3 pts)
- US5-4: Admin deletes inappropriate reviews (2 pts)

### EPIC 6 - QR Code + Brevo Email (22 pts)
- US6-1: QR code endpoint (3 pts)
- US6-2: QR integration workflow (3 pts)
- US6-3: QR display in /mybookings (2 pts)
- US6-4: Confirmation email with QR (4 pts)
- US6-5: Completion email requests review (3 pts)
- US6-6: Cancellation email + QR void (2 pts)
- US6-7: Integration tests (3 pts)
- US6-8: Invalidate expired QR codes (2 pts)

### EPIC 6.5 - /mybooking Styling (1 pt)
- US6.5: Status tags and search bar (1 pt)

### EPIC 7 - Merchant Role & Admin Approval (24 pts)
- US7-1: Merchant service account (2 pts)
- US7-2: Merchant status of request (3 pts)
- US7-3: Admin validates requests (4 pts)
- US7-4: Merchant login only if approved (1 pt)
- US7-5: Merchant CRUD for shop/service (8 pts)
- US7-6: Merchant scans QR (1 pt)
- US7-7: Link for requesting service account (1 pt)
- US7-8: Verify QR workflow tests (4 pts)

### EPIC 8 - Merchant Dashboard (21 pts)
- US8-1: Merchant panel to manage shop/services (5 pts)
- US8-2: Merchant edit own shop page (3 pts)
- US8-3: Merchant manage own services (5 pts)
- US8-4: Merchant view reservations (8 pts)

### EPIC 9 - QR Scanner Browser Camera (16 pts)
- US9-1: Browser camera real-time QR detection (8 pts)
- US9-2: HTTPS/camera access documentation (3 pts)
- US9-3: Scan shows reservation data (5 pts)

**Total: 183 story points**
