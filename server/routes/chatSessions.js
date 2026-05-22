const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const ChatSession = require('../models/ChatSession');

router.use(verifyJWT);

const MAX_SESSIONS = 5;

// GET /api/chat/sessions — last 5 sessions summary
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession
      .find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(MAX_SESSIONS)
      .select('_id title messages updatedAt personalityMode');

    const summary = sessions.map(s => {
      const last = s.messages[s.messages.length - 1];
      return {
        id: s._id,
        title: s.title,
        lastMessage: last ? last.content.slice(0, 80) : '',
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
        personalityMode: s.personalityMode,
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/sessions/:id — full session with messages
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/sessions — create new session
router.post('/sessions', async (req, res) => {
  try {
    // Delete oldest if already at limit
    const count = await ChatSession.countDocuments({ userId: req.userId });
    if (count >= MAX_SESSIONS) {
      const oldest = await ChatSession
        .findOne({ userId: req.userId })
        .sort({ updatedAt: 1 });
      if (oldest) await ChatSession.deleteOne({ _id: oldest._id });
    }

    const session = new ChatSession({
      userId: req.userId,
      title: req.body.title || 'New Conversation',
      personalityMode: req.body.personalityMode || 'supportive',
      messages: [],
    });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/sessions/:id/messages — append messages + update title
router.put('/sessions/:id/messages', async (req, res) => {
  try {
    const { userMessage, assistantMessage } = req.body;
    const session = await ChatSession.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (userMessage) session.messages.push({ role: 'user', content: userMessage.content });
    if (assistantMessage) {
      session.messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        actionTaken: assistantMessage.actionTaken,
      });
    }

    // Auto-title from first user message
    if (session.messages.length <= 2) session.generateTitle();

    session.updatedAt = new Date();
    await session.save();
    res.json({ ok: true, title: session.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chat/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    await ChatSession.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
