const { chat, buildVectorStore, resetVectorStore } = require('../utils/chatbot');

/**
 * POST /api/v1/chat
 * Body: { message: string, history?: { role: string, content: string }[] }
 * Returns: { success: true, reply: string }
 */
exports.chatWithBot = async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    const reply = await chat(message.trim(), history);

    res.json({ success: true, reply });
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
