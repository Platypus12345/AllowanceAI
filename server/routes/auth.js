const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../utils/mail');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    allowance: user.allowance,
    xp: user.xp,
    level: user.level,
    levelTitle: user.levelTitle,
  };
}

function clientBaseUrl() {
  return (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
}

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
      if (err) {
        console.error('PASSPORT AUTH ERROR:', err.message);
        return res.redirect(`${clientBaseUrl()}/login?error=auth_failed`);
      }
      if (!user) {
        return res.redirect(`${clientBaseUrl()}/login?error=no_user`);
      }

      const token = signToken(user._id);
      res.redirect(`${clientBaseUrl()}/auth/callback?token=${token}`);
    })(req, res, next);
  }
);

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
    });

    const token = signToken(user._id);
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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Try again.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists for this email, a reset link has been sent.',
      });
    }

    if (!user.passwordHash) {
      return res.status(400).json({
        message: 'This account uses Google sign-in. Please log in with Google.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 3600000);
    await user.save();

    const resetLink = `${clientBaseUrl()}/reset-password/${token}`;

    try {
      const mailResult = await sendPasswordResetEmail(user.email, resetLink);
      const payload = {
        success: true,
        message: 'Password reset link sent to your email.',
      };
      if (!mailResult.sent && mailResult.devLink && process.env.NODE_ENV !== 'production') {
        payload.devResetLink = mailResult.devLink;
        payload.message =
          'Email is not configured on the server. Use the dev link below (also printed in server console).';
      }
      return res.json(payload);
    } catch (mailErr) {
      console.error('Forgot password mail failed:', mailErr);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      return res.status(500).json({
        message: 'Failed to send reset email. Please try again later.',
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Could not process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully. You can sign in now.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Could not reset password' });
  }
});

router.get('/me', verifyJWT, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -resetToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/me/allowance', verifyJWT, async (req, res) => {
  try {
    const { allowance } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { allowance }, { new: true }).select(
      '-passwordHash -resetToken'
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
