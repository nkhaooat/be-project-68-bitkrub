const { chat, buildVectorStore, resetVectorStore } = require('../utils/chatbot');
const Reservation = require('../models/Reservation');
const jwt = require('jsonwebtoken');

/**
 * POST /api/v1/chat
 * Body: { message: string, history?: { role: string, content: string }[] }
 * Auth: optional Bearer token — if provided, injects user reservation context
 * Returns: { success: true, reply: string }
 */
exports.chatWithBot = async (req, res) => {
  try {
    const { message, history = [], weather = null } = req.body;

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

        // Fetch active reservations for this user
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
          reservations: activeReservations.map(r => ({
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
            resvDate: r.resvDate,
            status: r.status
          }))
        };
      } catch (err) {
        // Invalid/expired token — just treat as guest, don't error
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
      } catch {
        // malformed action — just send reply as-is
      }
    } else if (cancelMatch) {
      try {
        action = { type: 'cancel_reservation', ...JSON.parse(cancelMatch[1]) };
        cleanReply = reply.replace(/\[\[CANCEL:\{[^\]]+\}\]\]\n?/, '').trim();
      } catch {
        // malformed action
      }
    } else if (editMatch) {
      try {
        action = { type: 'edit_reservation', ...JSON.parse(editMatch[1]) };
        cleanReply = reply.replace(/\[\[EDIT:\{[^\]]+\}\]\]\n?/, '').trim();
      } catch {
        // malformed action
      }
    }

    res.json({ success: true, reply: cleanReply, action });
  } catch (err) {
    console.error('[chat] Error:', err);
    res.status(500).json({ success: false, message: 'Chatbot error. Please try again.' });
  }
};

/**
 * POST /api/v1/chat/rebuild
 * Admin endpoint to rebuild the vector store (e.g., after adding new shops).
 */
exports.rebuildIndex = async (req, res) => {
  try {
    resetVectorStore();
    await buildVectorStore();
    res.json({ success: true, message: 'Vector store rebuilt.' });
  } catch (err) {
    console.error('[chat/rebuild] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
