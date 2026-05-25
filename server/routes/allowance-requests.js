const express = require('express');
const router = express.Router();
const AllowanceRequest = require('../models/AllowanceRequest');
const verifyJWT = require('../middleware/verifyJWT');

router.use(verifyJWT);

router.get('/linked-parents', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).populate(
      'linkedAccounts',
      'name email picture'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    const parents = (user.linkedAccounts || []).map((p) => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      picture: p.picture,
      phone: p.phone || null,
    }));
    res.json(parents);
  } catch (error) {
    console.error('linked-parents', error);
    res.status(500).json({ error: 'Failed to fetch linked parents' });
  }
});

// Create a new allowance request
router.post('/', async (req, res) => {
  try {
    const { amount, reason, parentPhone } = req.body;
    
    if (!amount || !reason || !parentPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const request = new AllowanceRequest({
      userId: req.userId,
      amount,
      reason,
      parentPhone
    });

    await request.save();
    
    // Here we would typically integrate with Twilio to actually send an SMS to the parent
    // console.log(`Sending SMS to ${parentPhone}: "Allowance Request: ₹${amount} for ${reason}"`);
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create allowance request' });
  }
});

// Get all requests for user
router.get('/', async (req, res) => {
  try {
    const requests = await AllowanceRequest.find({ userId: req.userId }).sort({ date: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch allowance requests' });
  }
});

// Update status (e.g. approved/rejected)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = await AllowanceRequest.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status },
      { new: true }
    );
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    // If approved, we would typically also update the User's allowance or create an income record here.
    
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

module.exports = router;
