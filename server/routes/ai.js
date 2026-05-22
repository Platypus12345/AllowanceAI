const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Expense = require('../models/Expense');
const BudgetGoal = require('../models/BudgetGoal');
const ChatSession = require('../models/ChatSession');
const verifyJWT = require('../middleware/verifyJWT');
const { buildActionTaken } = require('../utils/actionTaken');
const { getFinancialContext } = require('../utils/financialContext');
const { getPersonalityPrompt } = require('../utils/personalityPrompts');
const { buildSurvivalPlan } = require('../utils/survivalPlan');

router.use(verifyJWT);

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: "Add a new expense. Use when user says 'I spent', 'log purchase', etc.",
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount in rupees' },
          category: { type: 'string', enum: CATEGORIES },
          description: { type: 'string', description: 'What was purchased' },
        },
        required: ['amount', 'category', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_expense',
      description: 'Delete an expense by ID',
      parameters: {
        type: 'object',
        properties: { expenseId: { type: 'string' } },
        required: ['expenseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_expense',
      description: 'Edit an existing expense',
      parameters: {
        type: 'object',
        properties: {
          expenseId: { type: 'string' },
          amount: { type: 'number' },
          category: { type: 'string', enum: CATEGORIES },
          description: { type: 'string' },
        },
        required: ['expenseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_budget_goal',
      description: 'Update monthly limit for a category',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          newLimit: { type: 'number' },
        },
        required: ['category', 'newLimit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_budget_plan',
      description: 'Set limits for all 6 categories at once',
      parameters: {
        type: 'object',
        properties: {
          foodLimit: { type: 'number' },
          transportLimit: { type: 'number' },
          shoppingLimit: { type: 'number' },
          entertainmentLimit: { type: 'number' },
          healthLimit: { type: 'number' },
          otherLimit: { type: 'number' },
        },
        required: ['foodLimit', 'transportLimit', 'shoppingLimit', 'entertainmentLimit', 'healthLimit', 'otherLimit'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_expenses',
      description: 'Fetch recent expenses',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          category: { type: 'string', enum: CATEGORIES },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_status',
      description: 'Get current budget stats',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_allowance',
      description:
        'Add money TO the user monthly allowance (salary received, parent sent money, credited). Use when user says add/increase/received allowance. NOT for expenses.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Amount to add in rupees' },
          note: { type: 'string', description: 'Source e.g. salary, parent' },
        },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_survival_plan',
      description:
        'Build an adaptive survival budget from REMAINING balance and days left. Use for "plan with rest money", party reserve, month-end survival. Does NOT replace full monthly caps unless applyToGoals is true.',
      parameters: {
        type: 'object',
        properties: {
          partyReserve: { type: 'number', description: 'Amount to set aside for upcoming event' },
          reservedForEvent: { type: 'number' },
          mode: { type: 'string', enum: ['survival', 'balanced', 'party'] },
          applyToGoals: { type: 'boolean', description: 'If true, write plan into category goals' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_allowance',
      description: 'Log a request to ASK parents for money (not received yet). Do not use when money already received.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['amount', 'reason'],
      },
    },
  },
];

// Legacy format for backward compatibility
const AVAILABLE_TOOLS = [
  {
    name: 'add_expense',
    description: 'Add a new expense for the user. Use this when the user says they spent money on something.',
    parameters: {
      amount: 'number - expense amount in rupees',
      category: 'string - one of: Food, Transport, Shopping, Entertainment, Health, Other',
      description: 'string - what was bought',
    },
  },
  {
    name: 'delete_expense',
    description: 'Delete an existing expense by ID. Always confirm before deleting.',
    parameters: {
      expenseId: 'string - the expense _id to delete',
    },
  },
  {
    name: 'edit_expense',
    description: 'Edit an existing expense. Use when user wants to correct a logged expense.',
    parameters: {
      expenseId: 'string',
      amount: 'number - optional new amount',
      category: 'string - optional new category',
      description: 'string - optional new description',
    },
  },
  {
    name: 'update_budget_goal',
    description: 'Update the monthly spending limit for a category.',
    parameters: {
      category: 'string - one of the 6 categories',
      newLimit: 'number - new monthly limit in rupees',
    },
  },
  {
    name: 'create_budget_plan',
    description: 'Set fixed monthly category LIMITS (full month caps). Use only when user wants permanent category budgets, NOT for "rest of month" survival planning.',
    parameters: {
      foodLimit: 'number',
      transportLimit: 'number',
      shoppingLimit: 'number',
      entertainmentLimit: 'number',
      healthLimit: 'number',
      otherLimit: 'number',
      planName: 'string - optional name for this plan',
    },
  },
  {
    name: 'get_recent_expenses',
    description: 'Fetch recent expenses to provide context for answering questions.',
    parameters: {
      limit: 'number - how many to fetch, default 5',
      category: 'string - optional filter by category',
    },
  },
  {
    name: 'get_budget_status',
    description: 'Get current budget stats and remaining balances for all categories.',
    parameters: {},
  },
  {
    name: 'add_allowance',
    description: 'Add amount to user allowance balance (money received).',
    parameters: { amount: 'number', note: 'string optional' },
  },
  {
    name: 'create_survival_plan',
    description: 'Adaptive plan from remaining balance + days left + optional event reserve.',
    parameters: {
      partyReserve: 'number',
      mode: 'survival|balanced|party',
      applyToGoals: 'boolean',
    },
  },
  {
    name: 'request_allowance',
    description: 'Log allowance request to parent (not received yet).',
    parameters: {
      amount: 'number',
      reason: 'string',
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// TOOL EXECUTION
// ─────────────────────────────────────────────────────────────────
async function executeToolCall(userId, toolName, params) {
  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  switch (toolName) {
    case 'add_expense': {
      const expense = new Expense({
        userId,
        amount: params.amount,
        category: params.category,
        description: params.description || '',
        date: new Date(),
      });
      const saved = await expense.save();
      return { success: true, data: saved, message: `Added ₹${params.amount} for ${params.description || params.category}` };
    }

    case 'delete_expense': {
      const deleted = await Expense.findOneAndDelete({ _id: params.expenseId, userId });
      if (!deleted) return { success: false, message: 'Expense not found' };
      return { success: true, data: deleted, message: `Deleted expense: ${deleted.description || deleted.category} ₹${deleted.amount}` };
    }

    case 'edit_expense': {
      const update = {};
      if (params.amount !== undefined) update.amount = params.amount;
      if (params.category) update.category = params.category;
      if (params.description) update.description = params.description;
      const updated = await Expense.findOneAndUpdate(
        { _id: params.expenseId, userId },
        { $set: update },
        { new: true }
      );
      if (!updated) return { success: false, message: 'Expense not found' };
      return { success: true, data: updated, message: `Updated expense to ₹${updated.amount} (${updated.category})` };
    }

    case 'update_budget_goal': {
      // Fetch previous value for undo support
      const existing = await BudgetGoal.findOne({ userId, category: params.category, month, year });
      const previousLimit = existing?.monthlyLimit;

      const goal = await BudgetGoal.findOneAndUpdate(
        { userId, category: params.category, month, year },
        { monthlyLimit: params.newLimit, userId, category: params.category, month, year },
        { upsert: true, new: true }
      );
      return {
        success: true,
        data: goal,
        previousLimit,
        message: `Updated ${params.category} budget to ₹${params.newLimit}`,
      };
    }

    case 'create_budget_plan': {
      const limits = {
        Food: params.foodLimit,
        Transport: params.transportLimit,
        Shopping: params.shoppingLimit,
        Entertainment: params.entertainmentLimit,
        Health: params.healthLimit,
        Other: params.otherLimit,
      };
      const results = await Promise.all(
        Object.entries(limits).map(([category, monthlyLimit]) =>
          BudgetGoal.findOneAndUpdate(
            { userId, category, month, year },
            { monthlyLimit, userId, category, month, year },
            { upsert: true, new: true }
          )
        )
      );
      const plan = {
        Food: params.foodLimit,
        Transport: params.transportLimit,
        Shopping: params.shoppingLimit,
        Entertainment: params.entertainmentLimit,
        Health: params.healthLimit,
        Other: params.otherLimit,
      };
      return {
        success: true,
        data: results,
        plan,
        message: `Budget plan "${params.planName || 'New Plan'}" applied across all categories`,
      };
    }

    case 'get_recent_expenses': {
      const query = { userId };
      if (params.category) query.category = params.category;
      const expenses = await Expense
        .find(query)
        .sort({ date: -1 })
        .limit(params.limit || 5);
      return { success: true, data: expenses };
    }

    case 'get_budget_status': {
      const ctx = await getFinancialContext(userId);
      return {
        success: true,
        data: {
          allowance: ctx.allowance,
          spent: ctx.spent,
          remaining: ctx.remaining,
          daily_limit: ctx.daily_limit,
          days_left: ctx.daysLeft,
          categoryBreakdown: ctx.categoryBreakdown,
        },
      };
    }

    case 'add_allowance': {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };
      const amount = Number(params.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, message: 'Invalid allowance amount' };
      }
      const previousAllowance = user.allowance || 0;
      user.allowance = previousAllowance + amount;
      await user.save();
      const ctx = await getFinancialContext(userId);
      return {
        success: true,
        data: {
          previousAllowance,
          newAllowance: user.allowance,
          amount,
          remaining: ctx.remaining,
        },
        message: `Allowance increased by ₹${amount}. New total: ₹${user.allowance}. Remaining this month: ₹${ctx.remaining}.`,
      };
    }

    case 'create_survival_plan': {
      const ctx = await getFinancialContext(userId);
      const { plan, survivalMeta } = buildSurvivalPlan(ctx, params);
      if (params.applyToGoals) {
        await Promise.all(
          Object.entries(plan).map(([category, monthlyLimit]) =>
            BudgetGoal.findOneAndUpdate(
              { userId, category, month, year },
              { monthlyLimit, userId, category, month, year },
              { upsert: true, new: true }
            )
          )
        );
      }
      return {
        success: true,
        plan,
        survivalMeta,
        message: `Survival plan: ₹${survivalMeta.dailyLimit}/day for ${survivalMeta.daysLeft} days after reserving ₹${survivalMeta.reserved}.`,
      };
    }

    case 'request_allowance': {
      return {
        success: true,
        message: `Allowance request of ₹${params.amount} for "${params.reason}" logged (not added to balance until received).`,
      };
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

// ─────────────────────────────────────────────────────────────────
// CONFIRMATION RULES — returns true if action needs confirmation
// ─────────────────────────────────────────────────────────────────
function requiresConfirmation(toolName, params, context) {
  // Simple commands auto-execute: add_expense, get_*, request_allowance, edit under ₹500
  if (toolName === 'delete_expense') return true;
  if (toolName === 'create_budget_plan') return true;
  if (toolName === 'update_budget_goal') {
    const currentLimit = context.goals?.find((g) => g.category === params.category)?.limit || 0;
    if (currentLimit > 0) {
      const changePct = Math.abs(params.newLimit - currentLimit) / currentLimit;
      if (changePct >= 0.2) return true;
    }
  }
  return false;
}

function formatFinanceFacts(ctx) {
  return `Allowance ₹${ctx.allowance} | Spent ₹${ctx.spent} | Remaining ₹${ctx.remaining} | Daily limit ₹${ctx.daily_limit}/day (${ctx.daysLeft} days left)`;
}

// ─────────────────────────────────────────────────────────────────
// POST /api/ai/ask — Main agent endpoint
// ─────────────────────────────────────────────────────────────────
router.post('/ask', async (req, res) => {
  try {
    const question = req.body.question || req.body.message;
    if (!question?.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    const { sessionId } = req.body;
    const user = await User.findById(req.userId).select('aiPersonality');
    const personalityMode =
      req.body.personalityMode || user?.aiPersonality || 'supportive';
    const personalityInstruction = getPersonalityPrompt(personalityMode);

    let financeCtx = await getFinancialContext(req.userId);
    const {
      allowance,
      spent,
      remaining,
      daily_limit,
      days_left: daysLeft,
      categoryBreakdown,
      top_categories: topCategories,
    } = financeCtx;

    const goals = await BudgetGoal.find({
      userId: req.userId,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    });

    // 2. Load or create session
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, userId: req.userId });
    }
    if (!session) {
      // Auto-create a new session
      const count = await ChatSession.countDocuments({ userId: req.userId });
      if (count >= 5) {
        const oldest = await ChatSession.findOne({ userId: req.userId }).sort({ updatedAt: 1 });
        if (oldest) await ChatSession.deleteOne({ _id: oldest._id });
      }
      session = new ChatSession({ userId: req.userId, personalityMode, messages: [] });
      await session.save();
    }

    // 3. Build conversation history (last 10 messages)
    const conversationHistory = session.messages
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    const aiResponse = await axios.post(
      `${AI_SERVICE_URL}/ask`,
      {
        question,
        allowance,
        spent,
        remaining,
        daily_limit,
        days_left: daysLeft,
        top_categories: topCategories,
        personality_mode: personalityMode,
        personality_instruction: personalityInstruction,
        tools: TOOLS,
        available_tools: AVAILABLE_TOOLS,
        conversation_history: conversationHistory,
        category_breakdown: categoryBreakdown,
      },
      { timeout: 30000 }
    );

    const aiData = aiResponse.data;
    let answer = '';
    let actionTaken = null;
    let actionTakenDb = null;

    // 5. Handle tool call
    if (aiData.type === 'tool_call') {
      const { tool_name, tool_params, pre_message } = aiData;

      // Check if confirmation required
      if (requiresConfirmation(tool_name, tool_params, { goals: goals.map(g => ({ category: g.category, limit: g.monthlyLimit })) })) {
        // Save user message only, return confirm_required
        session.messages.push({ role: 'user', content: question });
        if (session.messages.length <= 1) session.generateTitle();
        await session.save();

        return res.json({
          type: 'confirm_required',
          answer: pre_message || `I need to ${tool_name.replace(/_/g, ' ')}. Shall I proceed?`,
          pendingTool: { name: tool_name, params: tool_params },
          sessionId: session._id,
        });
      }

      const toolResult = await executeToolCall(req.userId, tool_name, tool_params);

      financeCtx = await getFinancialContext(req.userId);

      const followupResponse = await axios.post(
        `${AI_SERVICE_URL}/ask/followup`,
        {
          tool_name,
          tool_result: {
            ...toolResult,
            verified_finances: {
              allowance: financeCtx.allowance,
              spent: financeCtx.spent,
              remaining: financeCtx.remaining,
              daily_limit: financeCtx.daily_limit,
              days_left: financeCtx.daysLeft,
            },
          },
          original_question: question,
          personality_mode: personalityMode,
          allowance: financeCtx.allowance,
          spent: financeCtx.spent,
          remaining: financeCtx.remaining,
          daily_limit: financeCtx.daily_limit,
          financial_context: {
            allowance: financeCtx.allowance,
            spent: financeCtx.spent,
            remaining: financeCtx.remaining,
            daily_limit: financeCtx.daily_limit,
            days_left: financeCtx.daysLeft,
          },
        },
        { timeout: 15000 }
      );

      answer = followupResponse.data.message;
      const facts = formatFinanceFacts(financeCtx);
      if (!answer.includes(String(financeCtx.remaining))) {
        answer = `${answer}\n\n📊 ${facts}`;
      }
      const built = buildActionTaken(tool_name, tool_params, toolResult);
      actionTaken = built.clientPayload;
      actionTakenDb = built.dbRecord;
    } else {
      answer = aiData.message || aiData.answer || 'I could not generate a response.';
    }

    // 7. Save message pair to session (result must be string in MongoDB)
    session.messages.push({ role: 'user', content: question });
    session.messages.push({
      role: 'assistant',
      content: answer,
      actionTaken: actionTakenDb,
    });
    if (session.messages.length <= 2) session.generateTitle();
    session.updatedAt = new Date();
    await session.save();

    const freshSnapshot = await getFinancialContext(req.userId);

    res.json({
      type: actionTaken ? 'action' : 'text',
      answer,
      message: answer,
      actionTaken,
      financialSnapshot: {
        allowance: freshSnapshot.allowance,
        spent: freshSnapshot.spent,
        remaining: freshSnapshot.remaining,
        daily_limit: freshSnapshot.daily_limit,
        daysLeft: freshSnapshot.daysLeft,
        survival: freshSnapshot.survival,
      },
      proactiveSuggestion: aiData.proactive_suggestion || null,
      sessionId: session._id,
      sessionTitle: session.title,
    });
  } catch (error) {
    console.error('AI Agent error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'AI service is offline. Make sure FastAPI is running on port 8000.',
      });
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'AI service timed out. Try again.' });
    }
    if (error.response?.status === 503) {
      return res.status(503).json({ error: error.response.data?.error || 'AI service unavailable' });
    }
    res.status(500).json({ error: `AI service error: ${error.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ai/ask/confirm — Execute a pending confirmed tool call
// ─────────────────────────────────────────────────────────────────
router.post('/ask/confirm', async (req, res) => {
  try {
    const { toolName, toolParams, sessionId } = req.body;
    const user = await User.findById(req.userId).select('aiPersonality');
    const personalityMode =
      req.body.personalityMode || user?.aiPersonality || 'supportive';
    const personalityInstruction = getPersonalityPrompt(personalityMode);

    const toolResult = await executeToolCall(req.userId, toolName, toolParams);
    const financeCtx = await getFinancialContext(req.userId);

    const followupResponse = await axios.post(
      `${AI_SERVICE_URL}/ask/followup`,
      {
        tool_name: toolName,
        tool_result: {
          ...toolResult,
          verified_finances: {
            allowance: financeCtx.allowance,
            spent: financeCtx.spent,
            remaining: financeCtx.remaining,
            daily_limit: financeCtx.daily_limit,
            days_left: financeCtx.daysLeft,
          },
        },
        original_question: `User confirmed: ${toolName}`,
        personality_mode: personalityMode,
        personality_instruction: personalityInstruction,
        allowance: financeCtx.allowance,
        spent: financeCtx.spent,
        remaining: financeCtx.remaining,
        daily_limit: financeCtx.daily_limit,
        financial_context: financeCtx,
      },
      { timeout: 15000 }
    );

    let answer = followupResponse.data.message;
    const facts = formatFinanceFacts(financeCtx);
    if (!answer.includes(String(financeCtx.remaining))) {
      answer = `${answer}\n\n📊 ${facts}`;
    }

    const built = buildActionTaken(toolName, toolParams, toolResult);
    const actionTaken = built.clientPayload;

    if (sessionId) {
      await ChatSession.findOneAndUpdate(
        { _id: sessionId, userId: req.userId },
        {
          $push: { messages: { role: 'assistant', content: answer, actionTaken: built.dbRecord } },
          updatedAt: new Date(),
        }
      );
    }

    const freshSnapshot = financeCtx;
    res.json({
      type: 'action',
      answer,
      message: answer,
      actionTaken,
      financialSnapshot: {
        allowance: freshSnapshot.allowance,
        spent: freshSnapshot.spent,
        remaining: freshSnapshot.remaining,
        daily_limit: freshSnapshot.daily_limit,
        daysLeft: freshSnapshot.daysLeft,
      },
    });
  } catch (error) {
    console.error('AI confirm error:', error.message);
    res.status(500).json({ error: 'Failed to execute confirmed action' });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/ai/ask/undo — Undo a tool action within 30s
// ─────────────────────────────────────────────────────────────────
router.post('/ask/undo', async (req, res) => {
  try {
    const { toolName, toolParams, toolData } = req.body;

    let result;
    switch (toolName) {
      case 'add_expense':
        if (toolData?._id) {
          await Expense.findOneAndDelete({ _id: toolData._id, userId: req.userId });
          result = { message: 'Expense removed — like it never happened!' };
        }
        break;
      case 'update_budget_goal':
        if (toolParams?.category && toolParams?.previousValue !== undefined) {
          await BudgetGoal.findOneAndUpdate(
            { userId: req.userId, category: toolParams.category },
            { monthlyLimit: toolParams.previousValue }
          );
          result = { message: `${toolParams.category} budget restored to ₹${toolParams.previousValue}` };
        }
        break;
      case 'add_allowance': {
        const user = await User.findById(req.userId);
        if (user) {
          if (toolData?.previousAllowance !== undefined) {
            user.allowance = toolData.previousAllowance;
          } else if (toolParams?.amount) {
            user.allowance = Math.max(0, (user.allowance || 0) - Number(toolParams.amount));
          }
          await user.save();
          result = { message: 'Allowance change reversed' };
        }
        break;
      }
      default:
        result = { message: 'This action cannot be undone automatically.' };
    }

    res.json({ ok: true, message: result?.message });
  } catch (error) {
    res.status(500).json({ error: 'Undo failed' });
  }
});

// ─────────────────────────────────────────────────────────────────
// Existing /predict and /tips routes — unchanged
// ─────────────────────────────────────────────────────────────────
router.post('/predict', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/predict`, req.body, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error('AI Predict error:', error.message);
    res.status(500).json({ error: 'Failed to fetch prediction from AI' });
  }
});

router.post('/tips', async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/tips`, req.body, { timeout: 30000 });
    res.json(response.data);
  } catch (error) {
    console.error('AI Tips error:', error.message);
    res.status(500).json({ error: 'Failed to fetch tips from AI' });
  }
});

module.exports = router;
