const { chat, chatStream, buildVectorStore, resetVectorStore } = require('../utils/chatbot');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * POST /api/v1/chat
 * Body: { message: string, history?: { role: string, content: string }[] }
 * Auth: optional Bearer token — if provided, injects user reservation context
 * Returns: { success: true, reply: string }
 */
exports.chatWithBot = asyncHandler(async (req, res) => {
    const { message, history = [], weather = null, sessionId = null } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'message is required' });
    }

    // --- Optional auth: extract user from Bearer token if present ---
    let userContext = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const activeReservations = await Reservation.find({
                user: userId,
                status: { $in: ['pending', 'confirmed'] },
                resvDate: { $gte: new Date() }
            })
                .populate('shop', 'name location')
                .populate('service', 'name duration price')
                .sort('resvDate')
                .lean();

            userContext = {
                activeCount: activeReservations.length,
                slotsRemaining: 3 - activeReservations.length,
                reservations: activeReservations.map(r => {
                    const resvDate = new Date(r.resvDate);
                    const hoursUntil = (resvDate - new Date()) / (1000 * 60 * 60);
                    const canModify = hoursUntil > 24;
                    return {
                        id: r._id.toString(),
                        shop: r.shop?.name || 'Unknown shop',
                        service: r.service?.name || 'Unknown service',
                        duration: r.service?.duration,
                        price: r.service?.price,
                        date: new Date(r.resvDate).toLocaleString('en-US', {
                            timeZone: 'Asia/Bangkok',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        }),
                        endTime: (() => {
                            const dur = r.service?.duration || 60;
                            const end = new Date(new Date(r.resvDate).getTime() + dur * 60 * 1000);
                            return end.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
                        })(),
                        resvDate: r.resvDate,
                        hoursUntil: Math.round(hoursUntil * 10) / 10,
                        canModify,
                        status: r.status
                    };
                })
            };

            // --- Add user role/merchant context ---
            const userDoc = await User.findById(userId).populate('merchantShop', 'name').lean();
            if (userDoc) {
                userContext.role = userDoc.role;
                userContext.userName = userDoc.name;
                if (userDoc.role === 'merchant') {
                    userContext.merchantStatus = userDoc.merchantStatus;
                    userContext.shopName = userDoc.merchantShop?.name || null;
                    if (userDoc.merchantStatus === 'approved' && userDoc.merchantShop) {
                        // Get merchant's pending reservations count
                        const merchantPending = await Reservation.countDocuments({
                            shop: userDoc.merchantShop._id,
                            status: 'pending'
                        });
                        userContext.merchantPendingReservations = merchantPending;
                    }
                }
            }
        } catch (err) {
            console.warn('[chat] Could not decode token:', err.message);
        }
    }

    const reply = await chat(message.trim(), history, userContext, weather);

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
        } catch { /* malformed action — just send reply as-is */ }
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
    const { message, history = [], weather = null, sessionId = null } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ success: false, message: 'message is required' });
    }

    // --- Same auth extraction as chatWithBot ---
    let userContext = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;

            const activeReservations = await Reservation.find({
                user: userId,
                status: { $in: ['pending', 'confirmed'] },
                resvDate: { $gte: new Date() }
            })
                .populate('shop', 'name location')
                .populate('service', 'name duration price')
                .sort('resvDate')
                .lean();

            userContext = {
                activeCount: activeReservations.length,
                slotsRemaining: 3 - activeReservations.length,
                reservations: activeReservations.map(r => {
                    const resvDate = new Date(r.resvDate);
                    const hoursUntil = (resvDate - new Date()) / (1000 * 60 * 60);
                    const canModify = hoursUntil > 24;
                    return {
                        id: r._id.toString(),
                        shop: r.shop?.name || 'Unknown shop',
                        service: r.service?.name || 'Unknown service',
                        duration: r.service?.duration,
                        price: r.service?.price,
                        date: new Date(r.resvDate).toLocaleString('en-US', {
                            timeZone: 'Asia/Bangkok',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        }),
                        endTime: (() => {
                            const dur = r.service?.duration || 60;
                            const end = new Date(new Date(r.resvDate).getTime() + dur * 60 * 1000);
                            return end.toLocaleString('en-US', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' });
                        })(),
                        resvDate: r.resvDate,
                        hoursUntil: Math.round(hoursUntil * 10) / 10,
                        canModify,
                        status: r.status
                    };
                })
            };

            const userDoc = await User.findById(userId).populate('merchantShop', 'name').lean();
            if (userDoc) {
                userContext.role = userDoc.role;
                userContext.userName = userDoc.name;
                if (userDoc.role === 'merchant') {
                    userContext.merchantStatus = userDoc.merchantStatus;
                    userContext.shopName = userDoc.merchantShop?.name || null;
                    if (userDoc.merchantStatus === 'approved' && userDoc.merchantShop) {
                        const merchantPending = await Reservation.countDocuments({
                            shop: userDoc.merchantShop._id,
                            status: 'pending'
                        });
                        userContext.merchantPendingReservations = merchantPending;
                    }
                }
            }
        } catch (err) {
            console.warn('[chat/stream] Could not decode token:', err.message);
        }
    }

    // --- Stream response ---
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx

    try {
        for await (const event of chatStream(message.trim(), history, userContext, weather)) {
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
