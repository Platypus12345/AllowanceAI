const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const prisma = require('../config/prisma');
const { getClientBaseUrl } = require('../config/appUrls');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    _id: user.id,
    email: user.email,
    googleId: user.googleId || null,
    allowance: user.monthlyAllowance != null ? Number(user.monthlyAllowance) : null,
    monthlyAllowance: user.monthlyAllowance != null ? Number(user.monthlyAllowance) : null,
    createdAt: user.createdAt,
  };
}

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
      if (err) {
        console.error('PASSPORT AUTH ERROR:', err.message);
        return res.redirect(`${getClientBaseUrl()}/login?error=auth_failed`);
      }
      if (!user) {
        return res.redirect(`${getClientBaseUrl()}/login?error=no_user`);
      }

      const token = signToken(user.id);
      res.redirect(`${getClientBaseUrl()}/auth/callback?token=${token}`);
    })(req, res, next);
  }
);

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed. Try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user.id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Try again.' });
  }
});

router.get('/me', verifyJWT, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Fetch me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me/allowance', verifyJWT, async (req, res) => {
  try {
    const { allowance } = req.body;
    if (allowance == null || isNaN(Number(allowance)) || Number(allowance) < 0) {
      return res.status(400).json({ error: 'Valid allowance amount is required' });
    }
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { monthlyAllowance: Number(allowance) },
    });
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Update allowance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
