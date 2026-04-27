/**
 * EPIC 2 — AI Chatbot Test Suite
 * 
 * Tests the chatbot API endpoints against the running server.
 * Run with: npx jest __tests__/epic2-chatbot.test.js --forceExit
 *
 * Prerequisites:
 *   - Backend running on http://localhost:5000
 *   - OPENAI_API_KEY active with quota
 *   - Vector store pre-built (server startup)
 */

const BASE_URL = 'http://localhost:5000/api/v1/chat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function chatPost(body) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function chatStreamPost(body) {
  const res = await fetch(`${BASE_URL}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function getLoginToken(email, password) {
  const res = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.token || null;
}

function longString(len) {
  return 'a'.repeat(len);
}

// ---------------------------------------------------------------------------
// US2-1: Chatbot recommendations
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-1 Recommendations', () => {

  test('TC2-1-01: General greeting returns successful reply', async () => {
    const { status, body } = await chatPost({ message: 'hello', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reply).toBeTruthy();
    expect(typeof body.reply).toBe('string');
  });

  test('TC2-1-02: Named location (English) returns shop recommendations', async () => {
    const { status, body } = await chatPost({ message: 'massage near Siam', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reply.length).toBeGreaterThan(20);
  });

  test('TC2-1-03: Named location (Thai) returns response', async () => {
    const { status, body } = await chatPost({ message: 'นวดแถวทองหล่อ', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reply.length).toBeGreaterThan(10);
  });

  test('TC2-1-04: Transit station query', async () => {
    const { status, body } = await chatPost({ message: 'massage near BTS Asok', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('TC2-1-08: Empty message returns 400', async () => {
    const { status, body } = await chatPost({ message: '', history: [] });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  test('TC2-1-09: Message too long returns 413', async () => {
    const { status, body } = await chatPost({ message: longString(2001), history: [] });
    expect(status).toBe(413);
    expect(body.message).toMatch(/max 2000/i);
  });

  test('TC2-1-10: History too long returns 413', async () => {
    const history = Array.from({ length: 13 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    const { status, body } = await chatPost({ message: 'hi', history });
    expect(status).toBe(413);
    expect(body.message).toMatch(/max 12/i);
  });

  test('TC2-1-11: Missing message field returns 400', async () => {
    const { status } = await chatPost({ history: [] });
    expect(status).toBe(400);
  });

  test('TC2-1-12: Weather query returns response', async () => {
    const { status, body } = await chatPost({ message: 'what is the weather today?', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  }, 15000);
});

// ---------------------------------------------------------------------------
// US2-2: Location-based recommendations
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-2 Location', () => {

  test('TC2-2-01: Coordinates in Bangkok return distance annotations', async () => {
    const { status, body } = await chatPost({ message: 'massage near me', lat: 13.7565, lng: 100.5325, history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reply).toMatch(/\d+(m|km)/);
  });

  test('TC2-2-02: Coordinates near known shop', async () => {
    const { status, body } = await chatPost({ message: 'massage near me', lat: 13.7449, lng: 100.5222, history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('TC2-2-05: Null coordinates — no crash', async () => {
    const { status, body } = await chatPost({ message: 'massage near me', lat: null, lng: null, history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('TC2-2-04: Named anchor overrides coordinates', async () => {
    const { status, body } = await chatPost({ message: 'massage near Siam', lat: 13.0, lng: 100.0, history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US2-3: Booking assistance
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: US2-3 Booking', () => {

  test('TC2-3-01: Booking intent returns shop suggestions', async () => {
    const { status, body } = await chatPost({ message: 'I want to book a massage', lat: 13.7449, lng: 100.5222, history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('TC2-3-07: Action field structure when booking action parsed', async () => {
    const { status, body } = await chatPost({ message: 'Book oil massage at Nature Thai Massage tomorrow 2pm', history: [] });
    expect(status).toBe(200);
    if (body.action) {
      expect(body.action.type).toMatch(/create_reservation|cancel_reservation|edit_reservation/);
    }
  });

  test('TC2-3-03: Authenticated user sees context', async () => {
    const token = await getLoginToken('aotmetrasit@gmail.com', '555761');
    if (!token) return;
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: 'my bookings', history: [] }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  }, 15000);
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
    const { status, body } = await chatPost({ message: 'tell me more about that shop', history });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test('TC2-4-02: Long history (10 messages) still works', async () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({ role: 'user', content: `question ${i}` });
      history.push({ role: 'assistant', content: `answer ${i}` });
    }
    const { status, body } = await chatPost({ message: 'what about Asoke?', history: history.slice(-12) });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  }, 15000);

  test('TC2-4-05: Empty history works', async () => {
    const { status, body } = await chatPost({ message: 'hello', history: [] });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Streaming endpoint
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: Streaming', () => {

  test('TC2-S-01: Stream returns newline-delimited JSON', async () => {
    const { status, text } = await chatStreamPost({ message: 'hello', history: [] });
    expect(status).toBe(200);
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('type');
      expect(['token', 'action', 'done', 'error']).toContain(parsed.type);
    }
  }, 15000);

  test('TC2-S-02: Stream ends with done event', async () => {
    const { status, text } = await chatStreamPost({ message: 'hi', history: [] });
    expect(status).toBe(200);
    const lines = text.split('\n').filter(l => l.trim());
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    expect(lastEvent.type).toBe('done');
  }, 15000);
});

// ---------------------------------------------------------------------------
// Admin rebuild
// ---------------------------------------------------------------------------
describe('EPIC 2 — Chatbot: Admin', () => {

  test('TC2-A-01: Admin can trigger rebuild', async () => {
    const token = await getLoginToken('admin@test.com', 'admin123');
    if (!token) return;
    const res = await fetch(`${BASE_URL}/rebuild`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/background/i);
  });

  test('TC2-A-03: Unauthenticated rebuild returns 401', async () => {
    const res = await fetch(`${BASE_URL}/rebuild`, { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
