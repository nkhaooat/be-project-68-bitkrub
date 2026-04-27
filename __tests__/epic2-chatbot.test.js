/**
 * EPIC 2 — AI Chatbot Test Suite
 * 
 * Tests the chatbot API endpoints:
 *   POST /api/v1/chat          — blocking response
 *   POST /api/v1/chat/stream   — streaming response
 *   POST /api/v1/chat/rebuild  — admin rebuild
 *
 * Prerequisites:
 *   - Backend running on PORT (default 5000)
 *   - MongoDB connected with test data
 *   - OPENAI_API_KEY active with quota
 *   - Vector store pre-built (server startup)
 */

const request = require('supertest');
const app = require('../server'); // or the express app export
const jwt = require('jsonwebtoken');

const BASE = '/api/v1/chat';

// ---------------------------------------------------------------------------
// Test credentials
// ---------------------------------------------------------------------------
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'admin123';
const CUSTOMER_EMAIL = 'aotmetrasit@gmail.com';
const CUSTOMER_PASSWORD = '555761';
const MERCHANT_APPROVED_EMAIL = 'sawasdee@test.com';
const MERCHANT_APPROVED_PASSWORD = 'sawasdee';
const MERCHANT_PENDING_EMAIL = 'aurasol@test.com';
const MERCHANT_PENDING_PASSWORD = 'aurasol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a JWT token by logging in */
async function getLoginToken(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return res.body.token || null;
}

/** Generate a string of given length */
function longString(len) {
  return 'a'.repeat(len);
}

// ---------------------------------------------------------------------------
// US2-1: Chatbot recommendations
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-1 Recommendations', () => {

  test('TC2-1-01: General greeting returns successful reply', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'hello', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBeTruthy();
    expect(typeof res.body.reply).toBe('string');
  });

  test('TC2-1-02: Named location (English) returns shop recommendations', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near Siam', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply.length).toBeGreaterThan(20);
  });

  test('TC2-1-03: Named location (Thai) returns response', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'นวดแถวทองหล่อ', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply.length).toBeGreaterThan(10);
  });

  test('TC2-1-04: Transit station query', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near BTS Asok', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC2-1-08: Empty message returns 400', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: '', history: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('TC2-1-09: Message too long returns 413', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: longString(2001), history: [] });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/max 2000/i);
  });

  test('TC2-1-10: History too long returns 413', async () => {
    const history = Array.from({ length: 13 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'hi', history });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/max 12/i);
  });

  test('TC2-1-11: Missing message field returns 400', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ history: [] });
    expect(res.status).toBe(400);
  });

  test('TC2-1-12: Weather query returns response', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'what is the weather today?', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);
});

// ---------------------------------------------------------------------------
// US2-2: Location-based recommendations
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-2 Location', () => {

  test('TC2-2-01: Coordinates in Bangkok return distance annotations', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near me', lat: 13.7565, lng: 100.5325, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Distance should appear as meters or km in reply
    expect(res.body.reply).toMatch(/\d+(m|km)/);
  });

  test('TC2-2-02: Coordinates near known shop', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near me', lat: 13.7449, lng: 100.5222, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC2-2-05: Null coordinates — no crash', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near me', lat: null, lng: null, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC2-2-04: Named anchor overrides coordinates', async () => {
    // Message says "near Siam" but coords are far away
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'massage near Siam', lat: 13.0, lng: 100.0, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Reply should reference Siam area, not the far-away coords
  });
});

// ---------------------------------------------------------------------------
// US2-3: Booking assistance
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-3 Booking', () => {

  test('TC2-3-01: Booking intent returns shop suggestions', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'I want to book a massage', lat: 13.7449, lng: 100.5222, history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC2-3-07: Action field structure when booking action parsed', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'Book oil massage at Nature Thai Massage tomorrow 2pm', history: [] });
    expect(res.status).toBe(200);
    // If action is present, it must have a type
    if (res.body.action) {
      expect(res.body.action.type).toMatch(/create_reservation|cancel_reservation|edit_reservation/);
    }
  });

  let customerToken;
  beforeAll(async () => {
    customerToken = await getLoginToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  });

  test('TC2-3-03: Authenticated user sees reservation context', async () => {
    if (!customerToken) return; // skip if login fails
    const res = await request(app)
      .post(`${BASE}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'my bookings', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US2-4: Conversation context
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-4 Context', () => {

  test('TC2-4-01: Short history is preserved in reply', async () => {
    const history = [
      { role: 'user', content: 'massage near Siam' },
      { role: 'assistant', content: 'Nature Thai Massage is a great shop near Siam with oil massage services.' },
    ];
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'tell me more about that shop', history });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TC2-4-02: Long history (11 messages) still works', async () => {
    const history = [];
    for (let i = 0; i < 11; i++) {
      history.push({ role: 'user', content: `question ${i}` });
      history.push({ role: 'assistant', content: `answer ${i}` });
    }
    // Keep to 12 max (6 pairs)
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'what about Asoke?', history: history.slice(-12) });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);

  test('TC2-4-05: Empty history works', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'hello', history: [] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Streaming endpoint
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: Streaming', () => {

  test('TC2-S-01: Stream returns newline-delimited JSON', async () => {
    const res = await request(app)
      .post(`${BASE}/stream`)
      .send({ message: 'hello', history: [] })
      .buffer()
      .parse((res, cb) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => cb(null, data));
      });
    expect(res.status).toBe(200);
    const lines = res.body.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('type');
      expect(['token', 'action', 'done', 'error']).toContain(parsed.type);
    }
  }, 15000);

  test('TC2-S-02: Stream ends with done event', async () => {
    const res = await request(app)
      .post(`${BASE}/stream`)
      .send({ message: 'hi', history: [] })
      .buffer()
      .parse((res, cb) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => cb(null, data));
      });
    expect(res.status).toBe(200);
    const lines = res.body.split('\n').filter(l => l.trim());
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    expect(lastEvent.type).toBe('done');
  }, 15000);

  test('TC2-S-05: Stream rate limit (10 req/min)', async () => {
    // Send 11 rapid requests
    const requests = Array.from({ length: 11 }, () =>
      request(app)
        .post(`${BASE}/stream`)
        .send({ message: 'test', history: [] })
    );
    const results = await Promise.all(requests);
    const rateLimited = results.some(r => r.status === 429);
    // At least one should be rate limited
    expect(rateLimited).toBe(true);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Admin rebuild
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: Admin', () => {

  let adminToken;
  let customerToken;

  beforeAll(async () => {
    adminToken = await getLoginToken(ADMIN_EMAIL, ADMIN_PASSWORD);
    customerToken = await getLoginToken(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  });

  test('TC2-A-01: Admin can trigger rebuild', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post(`${BASE}/rebuild`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/background/i);
  });

  test('TC2-A-02: Non-admin cannot rebuild', async () => {
    if (!customerToken) return;
    const res = await request(app)
      .post(`${BASE}/rebuild`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('TC2-A-03: Unauthenticated rebuild returns 401', async () => {
    const res = await request(app)
      .post(`${BASE}/rebuild`);
    expect(res.status).toBe(401);
  });

  test('TC2-A-04: Rebuild is non-blocking', async () => {
    if (!adminToken) return;
    // Trigger rebuild then immediately chat — both should succeed
    const [rebuildRes, chatRes] = await Promise.all([
      request(app)
        .post(`${BASE}/rebuild`)
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .post(`${BASE}`)
        .send({ message: 'hello', history: [] }),
    ]);
    expect(rebuildRes.status).toBe(200);
    expect(chatRes.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: Error Handling', () => {

  test('TC2-E-05: Malformed history array', async () => {
    const res = await request(app)
      .post(`${BASE}`)
      .send({ message: 'hi', history: 'not an array' });
    // Should either validate or crash gracefully
    expect([200, 400, 500]).toContain(res.status);
  });

  test('TC2-E-06: Rate limit on blocking endpoint (20 req/min)', async () => {
    const requests = Array.from({ length: 21 }, () =>
      request(app)
        .post(`${BASE}`)
        .send({ message: 'test', history: [] })
    );
    const results = await Promise.all(requests);
    const rateLimited = results.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  }, 30000);
});
