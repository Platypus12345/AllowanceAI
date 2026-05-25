const express = require('express');
const router = express.Router();
const WishlistItem = require('../models/WishlistItem');
const SavingsJar = require('../models/SavingsJar');
const User = require('../models/User');
const Expense = require('../models/Expense');
const verifyJWT = require('../middleware/verifyJWT');
const { scrapePrice, detectPlatform } = require('../services/priceScraper');
const { sendPushToUser } = require('../utils/pushNotify');
const {
  calculateFinancialHealth,
  getMonthBounds,
  sumTodaySpend,
} = require('../utils/financialHealth');
const axios = require('axios');

function formatItem(item, dailyLimit = 0) {
  const obj = item.toObject();
  const dropPct =
    obj.originalPrice && obj.currentPrice && obj.originalPrice > obj.currentPrice
      ? Math.round(((obj.originalPrice - obj.currentPrice) / obj.originalPrice) * 100)
      : 0;
  const affordable = obj.currentPrice != null && dailyLimit > 0 && obj.currentPrice <= dailyLimit;
  const daysOfLimit =
    obj.currentPrice && dailyLimit > 0 ? (obj.currentPrice / dailyLimit).toFixed(1) : null;

  return {
    ...obj,
    dropPercent: dropPct,
    affordable,
    daysOfDailyLimit: daysOfLimit,
    atTarget: obj.currentPrice != null && obj.currentPrice <= obj.targetPrice,
  };
}

async function getUserDailyLimit(userId) {
  const user = await User.findById(userId);
  const expenses = await Expense.find({
    userId,
    date: { $gte: getMonthBounds().monthStart },
  });
  const finance = calculateFinancialHealth({
    allowance: user?.allowance || 0,
    totalSpent: expenses.reduce((s, e) => s + e.amount, 0),
    spentToday: sumTodaySpend(expenses),
    daysLeftInMonth: getMonthBounds().daysLeftInMonth,
    daysElapsed: getMonthBounds().daysElapsed,
    daysInMonth: getMonthBounds().daysInMonth,
  });
  return finance.recommendedDailyLimit;
}

async function runCheckPrices() {
  console.log('Checking wishlist prices...');
  const items = await WishlistItem.find({ status: 'tracking' });

  for (const item of items) {
    try {
      const user = await User.findById(item.userId);
      if (!user) continue;

      const dailyLimit = await getUserDailyLimit(item.userId);
      const scraped = await scrapePrice(item.productUrl);
      const prevPrice = item.currentPrice;

      if (scraped.price != null) {
        if (prevPrice != null && Math.abs(prevPrice - scraped.price) > 1) {
          item.priceAlertSent = false;
          item.affordabilityAlertSent = false;
          item.dropAlertSent = false;
        }
        item.currentPrice = scraped.price;
        item.inStock = scraped.inStock !== false;
        if (!item.originalPrice) item.originalPrice = scraped.price;
      } else if (item.currentPrice != null && scraped.inStock === false) {
        item.inStock = false;
        await sendPushToUser(user, {
          title: 'Out of stock',
          body: `${item.name} is out of stock — act fast when it returns`,
          data: { screen: 'wishlist' },
        });
      }

      item.lastChecked = new Date();

      if (
        item.currentPrice != null &&
        item.originalPrice &&
        item.currentPrice <= item.originalPrice * 0.9
      ) {
        if (!item.dropAlertSent) {
          const pct = Math.round(((item.originalPrice - item.currentPrice) / item.originalPrice) * 100);
          await sendPushToUser(user, {
            title: 'Price drop',
            body: `${item.name} dropped ${pct}%! Now ₹${item.currentPrice} (was ₹${item.originalPrice})`,
            data: { screen: 'wishlist' },
          });
          item.dropAlertSent = true;
        }
      }

      if (item.currentPrice != null && item.currentPrice <= item.targetPrice && !item.priceAlertSent) {
        await sendPushToUser(user, {
          title: 'Price alert',
          body: `${item.name} is now ₹${item.currentPrice} — your target!`,
          data: { screen: 'wishlist' },
        });
        item.priceAlertSent = true;
      }

      if (item.currentPrice != null && item.currentPrice <= dailyLimit && !item.affordabilityAlertSent) {
        await sendPushToUser(user, {
          title: 'Affordable today',
          body: `You can afford ${item.name} today! Daily limit ₹${dailyLimit}, item ₹${item.currentPrice}`,
          data: { screen: 'wishlist' },
        });
        item.affordabilityAlertSent = true;
      }

      if (
        prevPrice != null &&
        item.currentPrice != null &&
        item.currentPrice > item.targetPrice &&
        item.currentPrice > prevPrice &&
        !item.priceUpAlertSent
      ) {
        await sendPushToUser(user, {
          title: 'Price went up',
          body: `${item.name} is now ₹${item.currentPrice}. Target was ₹${item.targetPrice}`,
          data: { screen: 'wishlist' },
        });
        item.priceUpAlertSent = true;
      }

      await item.save();
    } catch (e) {
      console.error('Wishlist check error:', item._id, e.message);
    }
  }
}

router.post('/check-prices', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await runCheckPrices();
  res.json({ success: true });
});

router.use(verifyJWT);

router.get('/', async (req, res) => {
  try {
    const dailyLimit = await getUserDailyLimit(req.userId);
    const items = await WishlistItem.find({ userId: req.userId, status: 'tracking' }).sort({
      updatedAt: -1,
    });

    const jars = await SavingsJar.find({ userId: req.userId, status: { $ne: 'cancelled' } });
    const jarMap = Object.fromEntries(jars.map((j) => [j._id.toString(), j]));

    const formatted = items.map((item) => {
      const f = formatItem(item, dailyLimit);
      if (item.linkedJarId && jarMap[item.linkedJarId.toString()]) {
        const j = jarMap[item.linkedJarId.toString()];
        f.linkedJar = {
          _id: j._id,
          name: j.name,
          percent: Math.min(100, Math.round((j.currentAmount / j.targetAmount) * 100)),
        };
      }
      return f;
    });

    formatted.sort((a, b) => {
      const dropA = a.dropPercent || 0;
      const dropB = b.dropPercent || 0;
      return dropB - dropA;
    });

    res.json({ items: formatted, dailyLimit, lastChecked: items[0]?.lastChecked || null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const dailyLimit = await getUserDailyLimit(req.userId);
    const items = await WishlistItem.find({ userId: req.userId, status: 'tracking' });
    const alerts = [];

    for (const item of items) {
      if (item.currentPrice == null) continue;
      if (item.currentPrice <= item.targetPrice) {
        alerts.push({ type: 'price', message: `${item.name} reached your target — ₹${item.currentPrice}`, itemId: item._id });
      } else if (item.affordableAlertSent === false && item.currentPrice <= dailyLimit) {
        alerts.push({ type: 'afford', message: `You can afford ${item.name} today (₹${item.currentPrice})`, itemId: item._id });
      } else if (
        item.originalPrice &&
        item.currentPrice &&
        item.currentPrice <= item.originalPrice * 0.9
      ) {
        const pct = Math.round(((item.originalPrice - item.currentPrice) / item.originalPrice) * 100);
        alerts.push({ type: 'drop', message: `${item.name} dropped ${pct}%`, itemId: item._id });
      }
    }

    res.json({ alerts: alerts.slice(0, 3) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { productUrl } = req.body;
    if (!productUrl?.startsWith('http')) {
      return res.status(400).json({ message: 'Valid URL required' });
    }
    const scraped = await scrapePrice(productUrl);
    res.json({
      name: scraped.name,
      currentPrice: scraped.price,
      imageUrl: scraped.imageUrl,
      platform: scraped.platform || detectPlatform(productUrl),
      inStock: scraped.inStock,
    });
  } catch (err) {
    res.status(500).json({ message: 'Preview failed' });
  }
});

router.post('/', async (req, res) => {
  try {
    let { name, productUrl, targetPrice, category, currentPrice, linkedJarId } = req.body;

    if (!productUrl?.startsWith('http') || !targetPrice) {
      return res.status(400).json({ message: 'URL and target price required' });
    }

    const scraped = await scrapePrice(productUrl);
    name = name?.trim() || scraped.name || 'Wishlist item';
    const price = currentPrice != null ? Number(currentPrice) : scraped.price;

    const item = await WishlistItem.create({
      userId: req.userId,
      name,
      productUrl,
      targetPrice: Number(targetPrice),
      currentPrice: price,
      originalPrice: price,
      imageUrl: scraped.imageUrl,
      platform: scraped.platform || detectPlatform(productUrl),
      category: category || 'Other',
      inStock: scraped.inStock !== false,
      linkedJarId: linkedJarId || null,
      lastChecked: new Date(),
    });

    if (linkedJarId) {
      await SavingsJar.findByIdAndUpdate(linkedJarId, { linkedWishlistId: item._id });
    }

    const dailyLimit = await getUserDailyLimit(req.userId);
    res.status(201).json(formatItem(item, dailyLimit));
  } catch (err) {
    res.status(500).json({ message: 'Failed to add item' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const item = await WishlistItem.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const fields = ['name', 'targetPrice', 'category', 'status', 'linkedJarId', 'currentPrice'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    if (req.body.targetPrice && item.currentPrice > req.body.targetPrice) {
      item.priceAlertSent = false;
    }

    await item.save();

    if (item.linkedJarId) {
      await SavingsJar.findByIdAndUpdate(item.linkedJarId, { linkedWishlistId: item._id });
    }

    const dailyLimit = await getUserDailyLimit(req.userId);
    res.json(formatItem(item, dailyLimit));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await WishlistItem.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ message: 'Item not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

router.post('/:id/check-one', async (req, res) => {
  try {
    const item = await WishlistItem.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Not found' });
    const scraped = await scrapePrice(item.productUrl);
    if (scraped.price != null) {
      item.currentPrice = scraped.price;
      item.inStock = scraped.inStock !== false;
      if (!item.originalPrice) item.originalPrice = scraped.price;
    } else if (item.currentPrice != null) {
      item.inStock = false;
    }
    item.lastChecked = new Date();
    await item.save();
    const dailyLimit = await getUserDailyLimit(req.userId);
    res.json(formatItem(item, dailyLimit));
  } catch (err) {
    res.status(500).json({ message: 'Check failed' });
  }
});

router.post('/:id/ai-insights', async (req, res) => {
  try {
    const item = await WishlistItem.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ message: 'Not found' });

    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    try {
      const { data } = await axios.post(`${aiUrl}/wishlist-insights`, {
        name: item.name,
        platform: item.platform,
        currentPrice: item.currentPrice,
        targetPrice: item.targetPrice,
        originalPrice: item.originalPrice,
      });
      item.aiBuyTip = data.buyTip || null;
      item.aiAlternative = data.alternative || null;
      await item.save();
      res.json(data);
    } catch {
      res.json({
        buyTip: 'Prices often dip during sales at month-end on major platforms.',
        alternative: null,
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'AI insights failed' });
  }
});

module.exports = router;
module.exports.runCheckPrices = runCheckPrices;
