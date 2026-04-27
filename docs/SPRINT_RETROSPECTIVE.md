# Sprint 2 Retrospective — Team Namthom

**Project:** Dungeon Inn — Massage Reservation System  
**Sprint:** Sprint 2 (April 20–27, 2026)  
**Duration:** 8 days  
**Team:** Namthom (Group 68-2)

---

## Sprint Overview

Sprint 2 focused on expanding the platform with Google Places integration, promotions, reviews, QR check-in, and the merchant system. Seven EPICs (3–9) were targeted across 8 working days.

| EPIC | Feature | Status |
|------|---------|--------|
| EPIC 3 | Google Place v1 API | ✅ Done |
| EPIC 4 | Promotions & Slip Upload | ✅ Done |
| EPIC 5 | Review System | ✅ Done |
| EPIC 6 | QR Code & Email | ✅ Done |
| EPIC 6.5 | MyBooking Styling | ✅ Done |
| EPIC 7 | Merchant Role | ✅ Done |
| EPIC 8 | Merchant Dashboard | ✅ Done |
| EPIC 9 | QR Scanner | ✅ Done |

**Total tasks completed:** 183/183  
**Total estimated effort:** 208 hours  
**Burndown:** Day 1 (20.5h) → Day 8 (12.0h) remaining → all tasks Done

---

## What Went Well 🎉

1. **Google Places API integration was smooth** — Photo proxy with MongoDB fallback worked reliably. Admin pages for managing Google Place IDs were straightforward.

2. **QR code system end-to-end** — From generation (on slip approval) → email delivery (Brevo) → verify endpoint → merchant scanner. The full loop was completed and tested.

3. **Merchant role system with proper access control** — Role-based middleware correctly restricts: customers from merchant routes, merchants to their own shop, pending merchants from dashboard. Admin has full access.

4. **Review system with duplicate prevention** — One review per reservation, only after completion. Shop pages show aggregated ratings.

5. **Promotion system with real discount calculation** — Both percentage and flat discounts, with min price and max discount caps. Validation endpoint catches expired/invalid codes.

6. **Swagger API documentation** — OpenAPI 3.0 spec auto-generated from JSDoc annotations, accessible at `/api-docs`.

7. **Automated test coverage** — Jest tests for EPICs 3–7 with 100% coverage on collected files (statements, functions, lines).

---

## What Could Be Improved 🔧

1. **More automated test coverage** — E2E Playwright tests only cover Sprint 1 (EPIC 1). Sprint 2 features rely mostly on Jest backend tests. Frontend flows for EPICs 3–9 need E2E coverage.

2. **Better error handling for third-party API failures** — Google Places, OpenAI, and Brevo API failures should have graceful degradation with user-friendly messages, retry logic, and circuit breakers.

3. **Earlier integration of merchant dashboard** — EPIC 8 (Merchant Dashboard) was started late in the sprint (Day 5–7). Earlier start would have allowed more polish and testing.

4. **QR scanner HTTPS requirement** — The browser's `getUserMedia()` API requires HTTPS. This should have been documented and planned for earlier — local development needs self-signed certs or tunneling.

5. **Slip upload storage** — Payment slips are stored locally via multer. For production, cloud storage (S3, Cloudinary) would be more reliable and scalable.

6. **Review moderation** — Admin ability to delete inappropriate reviews was added late. Should have been part of the initial EPIC 5 scope.

7. **Email templates** — Brevo emails are functional but basic. HTML email templates with branding would improve the user experience.

---

## Action Items for Next Sprint 📋

| # | Action Item | Priority | Owner |
|---|------------|----------|-------|
| 1 | Increase E2E test coverage with Playwright for Sprint 2 features | High | QA |
| 2 | Migrate file uploads to cloud storage (S3/Cloudinary) | High | Backend |
| 3 | Add WebSocket for real-time booking updates | Med | Full-stack |
| 4 | Implement proper HTML email templates with Brevo | Med | Backend |
| 5 | Add rate limiting per user (not just global) | Med | Backend |
| 6 | Set up CI/CD pipeline with GitHub Actions | Med | DevOps |
| 7 | Add i18n/multi-language support (Thai + English) | Low | Frontend |
| 8 | Performance testing and optimization | Low | Full-stack |
| 9 | Add self-signed HTTPS for local QR scanner testing | Med | DevOps |
| 10 | Admin dashboard analytics (charts, revenue graphs) | Low | Full-stack |

---

## Team Velocity & Participation

- **Sprint 1:** 82.5h estimated, 46 tasks, 2–5 day durations
- **Sprint 2:** 208h estimated, 183 tasks, 2–6 day durations
- **Velocity increase:** ~2.5x from Sprint 1 → Sprint 2 (more EPICs, more parallel work)
- **Peak activity:** Day 4–5 (54–76 tasks active simultaneously)
- **All tasks completed on time** — no carryover

### Participation

- All team members contributed across EPICs
- Pair programming on EPIC 6 (QR system) and EPIC 7 (Merchant role)
- Code reviews conducted via GitHub PRs before merging

---

## Lessons Learned 💡

1. **Start integration EPICs earlier** — Features that depend on multiple components (merchant dashboard, QR scanner) benefit from earlier prototyping.
2. **Document infrastructure requirements upfront** — HTTPS for QR scanner should have been identified during planning.
3. **Automated tests save time** — Jest tests caught regressions during rapid iteration. More coverage = faster development.
4. **Third-party APIs need fallbacks** — Google Places outage during development highlighted the need for MongoDB photo fallback.
5. **Role-based access control should be designed first** — Adding merchant role mid-project required touching many files. Designing all roles upfront would reduce rework.

---

*Sprint 2 Retrospective — Team Namthom (Group 68-2) — April 2026*
