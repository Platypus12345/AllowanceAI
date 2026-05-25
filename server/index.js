require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const { corsOptions } = require('./middleware/cors');

require('./config/passport');
const { connectDatabase } = require('./config/database');
const { getClientBaseUrl, getGoogleCallbackUrl } = require('./config/appUrls');

const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const budgetRoutes = require('./routes/budget');
const aiRoutes = require('./routes/ai');
const splitsRoutes = require('./routes/splits');
const friendsRoutes = require('./routes/friends');
const requestsRoutes = require('./routes/requests');
const allowanceRequestRoutes = require('./routes/allowance-requests');
const recurringRoutes = require('./routes/recurring');
const notificationRoutes = require('./routes/notifications');
const gamificationRoutes = require('./routes/gamification');
const chatSessionRoutes = require('./routes/chatSessions');
const survivalRoutes = require('./routes/survival');
const statsRoutes = require('./routes/stats');
const userRoutes = require('./routes/user');
const analyticsRoutes = require('./routes/analytics');
const jarsRoutes = require('./routes/jars');
const wishlistRoutes = require('./routes/wishlist');
const { runAutoContribute } = require('./routes/jars');
const { runCheckPrices } = require('./routes/wishlist');

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(passport.initialize());

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/splits', splitsRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/allowance', allowanceRequestRoutes);
app.use('/api/allowance-requests', allowanceRequestRoutes); // legacy path
app.use('/api/recurring', recurringRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/chat', chatSessionRoutes);
app.use('/api/survival', survivalRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/jars', jarsRoutes);
app.use('/api/wishlist', wishlistRoutes);

const cron = require('node-cron');
const RecurringExpense = require('./models/RecurringExpense');
const Expense = require('./models/Expense');

// Run daily at 9:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running recurring expenses cron job...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find due active recurring expenses
    const dueExpenses = await RecurringExpense.find({
      isActive: true,
      nextDate: { $lte: today }
    });

    for (const recurring of dueExpenses) {
      // 1. Create the expense
      const expense = new Expense({
        userId: recurring.userId,
        amount: recurring.amount,
        category: recurring.category,
        description: recurring.description + ' (Auto-Recurring)',
        date: new Date()
      });
      await expense.save();

      // 2. Update the nextDate for the recurring expense
      const nextDate = new Date(recurring.nextDate);
      if (recurring.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (recurring.frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      
      recurring.nextDate = nextDate;
      await recurring.save();
      console.log(`Processed recurring expense: ${recurring.description}`);
    }
  } catch (error) {
    console.error('Failed to process recurring expenses:', error);
  }
});

const { Expo } = require('expo-server-sdk');
const expo = new Expo();
const User = require('./models/User');

// Weekly Summary - Every Sunday at 9:00 AM
cron.schedule('0 9 * * 0', async () => {
  console.log('Running weekly summary push notification cron job...');
  try {
    const users = await User.find({ expoPushToken: { $exists: true, $ne: null } });
    
    for (const user of users) {
      // Calculate stats for the last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const expenses = await Expense.find({
        userId: user._id,
        date: { $gte: lastWeek }
      });

      const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      const avgDaily = (totalSpent / 7).toFixed(0);
      
      // Simplified "On track" logic: compare with allowance / 4 (roughly)
      const weeklyBudget = user.allowance / 4;
      const status = totalSpent <= weeklyBudget ? 'On track✅' : 'Over⚠️';

      const messageBody = `📊 Week: Spent ₹${new Intl.NumberFormat('en-IN').format(totalSpent)} | Avg ₹${new Intl.NumberFormat('en-IN').format(avgDaily)}/day | ${status}`;

      if (!Expo.isExpoPushToken(user.expoPushToken)) {
        console.error(`Push token ${user.expoPushToken} is not a valid Expo push token`);
        continue;
      }

      const messages = [{
        to: user.expoPushToken,
        sound: 'default',
        title: 'Weekly Spending Summary',
        body: messageBody,
        data: { screen: 'report' },
      }];

      let chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to send weekly summaries:', error);
  }
});

cron.schedule('0 21 * * *', async () => {
  try {
    await runAutoContribute();
  } catch (error) {
    console.error('Jar auto-contribute cron failed:', error);
  }
});

cron.schedule('0 */6 * * *', async () => {
  try {
    await runCheckPrices();
  } catch (error) {
    console.error('Wishlist price check cron failed:', error);
  }
});

const PORT = process.env.PORT || 5000;

connectDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`CLIENT_URL redirect base: ${getClientBaseUrl()}`);
      console.log(`Google callback: ${getGoogleCallbackUrl()}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });