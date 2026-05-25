const express = require('express');
const router = express.Router();
const SavingsJar = require('../models/SavingsJar');
const User = require('../models/User');
const Expense = require('../models/Expense');
const verifyJWT = require('../middleware/verifyJWT');
const { JAR_CATEGORIES, getJarDefaults } = require('../utils/jarCategories');
const { sendPushToUser } = require('../utils/pushNotify');
const { calculateLevel } = require('./gamification');
const {
  calculateFinancialHealth,
  getMonthBounds,
  sumTodaySpend,
} = require('../utils/financialHealth');

const MILESTONES = [25, 50, 75, 100];
const XP_JAR_COMPLETE = 50;

function formatJar(jar) {
  const percent =
    jar.targetAmount > 0
      ? Math.min(100, Math.round((jar.currentAmount / jar.targetAmount) * 100))
      : 0;
  const remaining = Math.max(0, jar.targetAmount - jar.currentAmount);
  const avgContrib =
    jar.contributions?.length > 0
      ? jar.contributions.reduce((s, c) => s + c.amount, 0) / jar.contributions.length
      : 0;
  const daysToGoal =
    percent >= 100 ? 0 : avgContrib > 0 ? Math.ceil(remaining / avgContrib) : null;

  return {
    ...jar.toObject(),
    percent,
    daysToGoal,
    contributionsCount: jar.contributions?.length || 0,
  };
}

async function awardXp(userId, amount) {
  const user = await User.findById(userId);
  if (!user) return;
  user.xp = (user.xp || 0) + amount;
  const { level, title } = calculateLevel(user.xp);
  user.level = level;
  user.levelTitle = title;
  await user.save();
}

async function checkMilestones(jar, user) {
  const percent = Math.round((jar.currentAmount / jar.targetAmount) * 100);
  for (const m of MILESTONES) {
    if (percent >= m && !jar.milestonesSent.includes(m)) {
      jar.milestonesSent.push(m);
      if (m === 100) continue;
      await sendPushToUser(user, {
        title: 'Savings milestone',
        body: `${m}% toward ${jar.name}! Keep it up`,
        data: { screen: 'jars' },
      });
    }
  }
  await jar.save();
}

async function contributeToJar(jar, amount, note, user) {
  jar.contributions.push({ amount, note: note || 'Contribution', date: new Date() });
  jar.currentAmount += amount;

  let justCompleted = false;
  if (jar.currentAmount >= jar.targetAmount && jar.status !== 'completed') {
    jar.status = 'completed';
    jar.completedAt = new Date();
    jar.currentAmount = jar.targetAmount;
    justCompleted = true;
    await awardXp(jar.userId, XP_JAR_COMPLETE);
    await sendPushToUser(user, {
      title: 'Goal reached',
      body: `${jar.name} is complete! You did it`,
      data: { screen: 'jars' },
    });
  }

  await checkMilestones(jar, user);
  await jar.save();
  return { jar, justCompleted };
}

async function runAutoContribute() {
  console.log('Running jar auto-contribute...');
  const users = await User.find({});
  const { monthStart, daysLeftInMonth, daysElapsed, daysInMonth } = getMonthBounds();

  for (const user of users) {
    try {
      const expenses = await Expense.find({ userId: user._id, date: { $gte: monthStart } });
      const spentToday = sumTodaySpend(expenses);
      const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
      const finance = calculateFinancialHealth({
        allowance: user.allowance || 0,
        totalSpent,
        spentToday,
        daysLeftInMonth,
        daysElapsed,
        daysInMonth,
      });

      if (spentToday >= finance.recommendedDailyLimit) continue;

      const surplus = finance.recommendedDailyLimit - spentToday;
      const jars = await SavingsJar.find({
        userId: user._id,
        status: 'active',
        autoContributeEnabled: true,
        autoContributeAmount: { $gt: 0 },
      });

      for (const jar of jars) {
        const contributeAmount = Math.min(
          jar.autoContributeAmount,
          surplus,
          jar.targetAmount - jar.currentAmount
        );
        if (contributeAmount < 1) continue;

        await contributeToJar(jar, contributeAmount, 'Auto-saved today', user);
        await sendPushToUser(user, {
          title: 'Auto-saved',
          body: `Auto-saved ₹${contributeAmount} to ${jar.name}. You're ${Math.round((jar.currentAmount / jar.targetAmount) * 100)}% there`,
          data: { screen: 'jars' },
        });
      }
    } catch (e) {
      console.error('Auto-contribute user error:', user._id, e.message);
    }
  }
}

router.post('/auto-contribute', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await runAutoContribute();
  res.json({ success: true });
});

router.use(verifyJWT);

router.get('/', async (req, res) => {
  try {
    const jars = await SavingsJar.find({
      userId: req.userId,
      status: { $ne: 'cancelled' },
    }).sort({ status: 1, updatedAt: -1 });
    res.json(jars.map(formatJar));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jars' });
  }
});

router.get('/suggest', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const { daysLeftInMonth } = getMonthBounds();
    const expenses = await Expense.find({
      userId: req.userId,
      date: { $gte: getMonthBounds().monthStart },
    });
    const spentToday = sumTodaySpend(expenses);
    const finance = calculateFinancialHealth({
      allowance: user.allowance || 0,
      totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
      spentToday,
      daysLeftInMonth,
      daysElapsed: getMonthBounds().daysElapsed,
      daysInMonth: getMonthBounds().daysInMonth,
    });

    const jars = await SavingsJar.find({ userId: req.userId, status: 'active' });
    if (!jars.length || spentToday >= finance.recommendedDailyLimit) {
      return res.json({ suggestion: null });
    }

    const surplus = Math.max(0, finance.recommendedDailyLimit - spentToday);
    const closest = jars
      .map((j) => ({
        jar: j,
        percent: (j.currentAmount / j.targetAmount) * 100,
        remaining: j.targetAmount - j.currentAmount,
      }))
      .sort((a, b) => b.percent - a.percent)[0];

    const suggestedAmount = Math.min(
      Math.round(surplus * 0.3),
      closest.remaining,
      closest.jar.autoContributeAmount || Math.round(surplus * 0.3)
    );

    if (suggestedAmount < 10) return res.json({ suggestion: null });

    res.json({
      suggestion: `You saved ₹${Math.round(surplus)} today! Add ₹${suggestedAmount} to your ${closest.jar.name} jar? You're ${Math.round(closest.percent)}% there`,
      jarId: closest.jar._id,
      jarName: closest.jar.name,
      suggestedAmount,
      surplus: Math.round(surplus),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get suggestion' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const jar = await SavingsJar.findOne({ _id: req.params.id, userId: req.userId });
    if (!jar) return res.status(404).json({ message: 'Jar not found' });
    const formatted = formatJar(jar);
    const totalExchanged = (jar.contributions || []).reduce((s, c) => s + Math.abs(c.amount), 0);
    res.json({
      jar: formatted,
      contributions: jar.contributions,
      totalExchanged,
      splitCount: jar.contributions?.length || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jar' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      targetAmount,
      category = 'Other',
      icon,
      color,
      autoContributeEnabled,
      autoContributeAmount,
      linkedWishlistId,
    } = req.body;

    if (!name?.trim() || !targetAmount || targetAmount <= 0) {
      return res.status(400).json({ message: 'Name and positive target amount required' });
    }

    const defaults = getJarDefaults(category);
    const jar = await SavingsJar.create({
      userId: req.userId,
      name: name.trim(),
      targetAmount: Number(targetAmount),
      category: JAR_CATEGORIES.includes(category) ? category : 'Other',
      icon: icon || defaults.icon,
      color: color || defaults.color,
      autoContributeEnabled: !!autoContributeEnabled,
      autoContributeAmount: Number(autoContributeAmount) || 0,
      linkedWishlistId: linkedWishlistId || null,
    });

    res.status(201).json(formatJar(jar));
  } catch (err) {
    res.status(500).json({ message: 'Failed to create jar' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const jar = await SavingsJar.findOne({ _id: req.params.id, userId: req.userId });
    if (!jar) return res.status(404).json({ message: 'Jar not found' });

    const fields = [
      'name',
      'targetAmount',
      'category',
      'icon',
      'color',
      'status',
      'autoContributeEnabled',
      'autoContributeAmount',
      'linkedWishlistId',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) jar[f] = req.body[f];
    });

    if (jar.currentAmount >= jar.targetAmount && jar.status === 'active') {
      jar.status = 'completed';
      jar.completedAt = new Date();
    }

    await jar.save();
    res.json(formatJar(jar));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update jar' });
  }
});

router.post('/:id/contribute', async (req, res) => {
  try {
    const { amount, note } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const jar = await SavingsJar.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: { $in: ['active', 'paused'] },
    });
    if (!jar) return res.status(404).json({ message: 'Jar not found' });

    const user = await User.findById(req.userId);
    const { jar: updated, justCompleted } = await contributeToJar(jar, amt, note, user);

    res.json({ jar: formatJar(updated), justCompleted, xpAwarded: justCompleted ? XP_JAR_COMPLETE : 0 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to contribute' });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    const { toJarId, amount } = req.body;
    const amt = Number(amount);
    if (!amt || amt <= 0) return res.status(400).json({ message: 'Invalid amount' });

    const fromJar = await SavingsJar.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: { $in: ['active', 'paused'] },
    });
    const toJar = await SavingsJar.findOne({
      _id: toJarId,
      userId: req.userId,
      status: { $in: ['active', 'paused'] },
    });

    if (!fromJar || !toJar) return res.status(404).json({ message: 'Jar not found' });
    if (fromJar.currentAmount < amt) {
      return res.status(400).json({ message: 'Insufficient balance in source jar' });
    }

    fromJar.currentAmount -= amt;
    fromJar.contributions.push({
      amount: -amt,
      note: `Transfer to ${toJar.name}`,
      date: new Date(),
    });
    toJar.contributions.push({
      amount: amt,
      note: `Transfer from ${fromJar.name}`,
      date: new Date(),
    });
    toJar.currentAmount += amt;

    await fromJar.save();
    await toJar.save();

    res.json({ fromJar: formatJar(fromJar), toJar: formatJar(toJar) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to transfer' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const jar = await SavingsJar.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!jar) return res.status(404).json({ message: 'Jar not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete jar' });
  }
});

module.exports = router;
module.exports.runAutoContribute = runAutoContribute;
module.exports.contributeToJar = contributeToJar;
module.exports.formatJar = formatJar;
