const { chat, chatStream, buildVectorStore, resetVectorStore } = require('../utils/chatbot');
const asyncHandler = require('../middleware/asyncHandler');
const { fetchWeather, isWeatherQuery } = require('../services/weather');
const { extractUserContext } = require('../services/userContext');

/**
 * POST /api/v1/chat
 * Body: { message: string, history?: { role: string, content: string }[] }
 * Auth: optional Bearer token — if provided, injects user reservation context
 * Returns: { success: true, reply: string }
 */
exports.chatWithBot = asyncHandler(async (req, res) => {
    const { message, history = [], lat = null, lng = null, sessionId = null } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'message is required' });
    }
    if (message.length > 2000) {
        return res.status(413).json({ success: false, message: 'Message too long (max 2000 characters)' });
    }
    if (history.length > 12) {
        return res.status(413).json({ success: false, message: 'History too long (max 12 messages)' });
    }

    // --- Parallel: weather + auth (reduces TTFT) ---
    const [weather, userContext] = await Promise.all([
      isWeatherQuery(message) ? fetchWeather({ lat, lng }) : Promise.resolve(null),
      extractUserContext(req.headers.authorization),
    ]);

    const reply = await chat(message.trim(), history, userContext, weather, { lat, lng });

    // Parse booking/cancel/edit action if present
    const bookMatch = reply.match(/\[\[BOOK:(\{[^\]]+\})\]\]/);
    const cancelMatch = reply.match(/\[\[CANCEL:(\{[^\]]+\})\]\]/);
    const editMatch = reply.match(/\[\[EDIT:(\{[^\]]+\})\]\]/);
    let action = null;
    let cleanReply = reply;
    if (bookMatch) {
        try {
            action = { type: 'create_reservation', ...JSON.parse(bookMatch[1]) };
            cleanReply = reply.replace(/\[\[BOOK:\{[^\]]+\}\]\]\n?/, '').trim();
        } catch { /* malformed action */ }
    } else if (cancelMatch) {
        try {
            action = { type: 'cancel_reservation', ...JSON.parse(cancelMatch[1]) };
            cleanReply = reply.replace(/\[\[CANCEL:\{[^\]]+\}\]\]\n?/, '').trim();
        } catch { /* malformed action */ }
    } else if (editMatch) {
        try {
            action = { type: 'edit_reservation', ...JSON.parse(editMatch[1]) };
            cleanReply = reply.replace(/\[\[EDIT:\{[^\]]+\}\]\]\n?/, '').trim();
        } catch { /* malformed action */ }
    }

    res.json({ success: true, reply: cleanReply, action });
});

/**
 * POST /api/v1/chat/stream
 * Streaming version of /chat. Returns newline-delimited JSON:
 *   {"type":"token","text":"..."}   — each text chunk
 *   {"type":"action","action":{...}}  — if booking/cancel/edit action found
 *   {"type":"error","text":"..."}    — on error
 *   {"type":"done"}                   — stream complete
 */
exports.chatStreamBot = asyncHandler(async (req, res) => {
    const { message, history = [], lat = null, lng = null, sessionId = null } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'message is required' });
    }
    if (message.length > 2000) {
        return res.status(413).json({ success: false, message: 'Message too long (max 2000 characters)' });
    }
    if (history.length > 12) {
        return res.status(413).json({ success: false, message: 'History too long (max 12 messages)' });
    }

    // --- Parallel: weather + auth (reduces TTFT) ---
    const [weather, userContext] = await Promise.all([
      isWeatherQuery(message) ? fetchWeather({ lat, lng }) : Promise.resolve(null),
      extractUserContext(req.headers.authorization),
    ]);

    // --- Stream response ---
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx

    try {
        for await (const event of chatStream(message.trim(), history, userContext, weather, { lat, lng })) {
            res.write(JSON.stringify(event) + '\n');
        }
        res.write(JSON.stringify({ type: 'done' }) + '\n');
        res.end();
    } catch (err) {
        console.error('[chat/stream] Stream error:', err.message);
        res.write(JSON.stringify({ type: 'error', text: 'Stream interrupted. Please try again.' }) + '\n');
        res.end();
    }
});

/**
 * POST /api/v1/chat/rebuild
 * Admin endpoint to rebuild the vector store.
 */
exports.rebuildIndex = asyncHandler(async (req, res) => {
    resetVectorStore();
    await buildVectorStore();
    res.json({ success: true, message: 'Vector store rebuilt.' });
});
