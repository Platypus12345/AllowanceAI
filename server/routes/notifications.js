const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Notification = require('../models/Notification');
const verifyJWT = require('../middleware/verifyJWT');
const { syncSmartNotifications, sortNotifications } = require('../utils/notificationEngine');

router.use(verifyJWT);

router.post('/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    await User.findByIdAndUpdate(req.userId, { expoPushToken: token });
    res.json({ message: 'Token updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update token' });
  }
});

router.get('/', async (req, res) => {
  try {
    await syncSmartNotifications(req.userId);
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const sorted = sortNotifications(notifications);
    const unreadCount = sorted.filter((n) => !n.isRead).length;
    res.json({ notifications: sorted, unreadCount });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.patch('/read/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;
