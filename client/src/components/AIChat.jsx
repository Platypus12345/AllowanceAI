import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { AITypingIndicator } from './ui/Skeleton';
import { toast } from '../utils/toastBus';

const UNDO_SECONDS = 30;
const CHAT_CACHE_KEY = 'allowanceai_smartToyChats';
const MAX_CACHED_MESSAGES = 50;

const DEFAULT_MESSAGE = {
  id: 1,
  type: 'ai',
  text: 'Hello! I am your AllowanceAI assistant. Ask me anything about your current budget!',
};

function mapSessionMessages(sessionMessages) {
  return sessionMessages.map((m, i) => ({
    id: Date.now() + i,
    type: m.role === 'user' ? 'user' : 'ai',
    text: m.content,
    actionTaken: m.actionTaken
      ? {
          toolName: m.actionTaken.toolName,
          toolParams: m.actionTaken.toolParams,
          result: m.actionTaken.result,
          success: m.actionTaken.success,
          previousValue: m.actionTaken.previousValue,
          plan: m.actionTaken.plan,
          survivalMeta: m.actionTaken.survivalMeta,
          toolData: m.actionTaken.toolData,
        }
      : null,
  }));
}

const AIChat = () => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages?.length) return parsed.messages;
      }
    } catch {
      /* ignore */
    }
    return [DEFAULT_MESSAGE];
  });
  const [sessionId, setSessionId] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_CACHE_KEY);
      if (saved) return JSON.parse(saved).sessionId || null;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [undoState, setUndoState] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const messagesEndRef = useRef(null);
  const hydrated = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(
      CHAT_CACHE_KEY,
      JSON.stringify({
        messages: messages.slice(-MAX_CACHED_MESSAGES),
        sessionId,
      })
    );
  }, [messages, sessionId]);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const loadFromServer = async () => {
      try {
        const { data: sessions } = await api.get('/chat/sessions');
        if (!sessions?.length) return;

        const latestId = sessionId || sessions[0].id;
        const { data: session } = await api.get(`/chat/sessions/${latestId}`);
        if (session?.messages?.length) {
          setMessages(mapSessionMessages(session.messages));
          setSessionId(session._id);
        }
      } catch {
        /* keep localStorage cache */
      }
    };

    loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!undoState) return;
    const t = setInterval(() => {
      setUndoState((prev) => {
        if (!prev || prev.countdown <= 1) {
          clearInterval(t);
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [undoState?.messageId]);

  const handleUndo = useCallback(async (actionTaken, messageId) => {
    const toolData =
      actionTaken.toolData ||
      (actionTaken.previousValue?.expenseId
        ? { _id: actionTaken.previousValue.expenseId }
        : undefined);

    try {
      await api.post('/ai/ask/undo', {
        toolName: actionTaken.toolName,
        toolParams: actionTaken.toolParams,
        toolData,
      });
      dispatchFinanceUpdated();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, text: 'Action undone.', actionTaken: null } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, text: 'Could not undo this action.' } : m
        )
      );
    }
    setUndoState(null);
  }, []);

  const appendAssistant = (answer, actionTaken, resData) => {
    const msgId = Date.now() + 1;
    const aiMessage = {
      id: msgId,
      type: 'ai',
      text: answer || resData?.message || resData?.answer,
      actionTaken: actionTaken || null,
    };
    setMessages((prev) => [...prev, aiMessage]);

    if (actionTaken?.success) {
      dispatchFinanceUpdated();
      if (['add_expense', 'update_budget_goal', 'add_allowance'].includes(actionTaken.toolName)) {
        setUndoState({ messageId: msgId, actionTaken, countdown: UNDO_SECONDS });
      }
    }
  };

  const handleConfirm = async () => {
    if (!pendingConfirm) return;
    setLoading(true);
    try {
      const personalityMode =
        localStorage.getItem('aiPersonality') || 'supportive';
      const res = await api.post('/ai/ask/confirm', {
        toolName: pendingConfirm.name,
        toolParams: pendingConfirm.params,
        sessionId: pendingConfirm.sessionId,
        personalityMode,
      });
      if (res.data.sessionId) setSessionId(res.data.sessionId);
      appendAssistant(res.data.answer, res.data.actionTaken, res.data);
      setPendingConfirm(null);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Could not complete action.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: 'error', text: errorMsg },
      ]);
    }
    setLoading(false);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { id: Date.now(), type: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    const question = input;
    setInput('');
    setLoading(true);
    setPendingConfirm(null);

    try {
      const personalityMode =
        localStorage.getItem('aiPersonality') || 'supportive';
      const res = await api.post('/ai/ask', { question, sessionId, personalityMode });
      if (res.data.sessionId) setSessionId(res.data.sessionId);

      if (res.data.financialSnapshot && !res.data.actionTaken) {
        dispatchFinanceUpdated();
      }

      if (res.data.type === 'confirm_required') {
        setPendingConfirm({
          name: res.data.pendingTool.name,
          params: res.data.pendingTool.params,
          sessionId: res.data.sessionId,
        });
        appendAssistant(
          res.data.answer || 'I can do that — confirm below.',
          null,
          res.data
        );
      } else {
        appendAssistant(
          res.data.answer || res.data.message,
          res.data.actionTaken,
          res.data
        );
      }
    } catch (error) {
      let errorMsg = 'Cannot connect to AI service.';
      if (error.response?.status === 503) {
        errorMsg = 'AI service is offline. Please start FastAPI on port 8000.';
      } else if (error.response?.status === 504) {
        errorMsg = 'Request timed out. Try again.';
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, type: 'error', text: errorMsg },
      ]);
    }
    setLoading(false);
  };

  const formatResultMessage = (actionTaken) => {
    const r = actionTaken?.result;
    if (!r) return '';
    if (typeof r === 'string') return r;
    return r.message || 'Action completed';
  };

  const renderSurvivalPlan = (actionTaken) => {
    const meta = actionTaken?.survivalMeta;
    const plan = actionTaken?.plan;
    if (actionTaken?.toolName !== 'create_survival_plan' || !plan || !meta) return null;
    return (
      <div className="glass-card p-5 rounded-2xl border border-secondary/30 mt-3 max-w-[90%]">
        <h3 className="font-bold text-secondary font-plus mb-1">Smart Survival Plan</h3>
        <p className="text-xs text-on-surface-variant mb-3">
          {meta.daysLeft} days left · ₹{meta.dailyLimit}/day after ₹{meta.reserved} reserved
        </p>
        {Object.entries(plan).map(([cat, limit]) => {
          const pool = meta.afterReserve || Object.values(plan).reduce((a, b) => a + b, 0);
          const pct = pool > 0 ? Math.min(100, Math.round((limit / pool) * 100)) : 0;
          return (
            <div key={cat} className="py-2 border-b border-white/5 last:border-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-on-surface-variant">{cat}</span>
                <span className="font-mono text-on-surface">₹{Number(limit).toLocaleString('en-IN')}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-secondary rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBudgetPlan = (actionTaken) => {
    const plan = actionTaken?.plan;
    if (!plan || actionTaken?.toolName !== 'create_budget_plan') return null;
    return (
      <div className="glass-card p-5 rounded-2xl border border-primary/20 mt-3 max-w-[90%]">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-secondary/10 rounded-lg">
            <span className="text-secondary text-xl">📊</span>
          </div>
          <div>
            <h3 className="font-bold text-white font-plus">New Budget Plan</h3>
            <p className="text-xs text-on-surface-variant">Applied to your account</p>
          </div>
        </div>
        {Object.entries(plan).map(([cat, limit]) => (
          <div
            key={cat}
            className="flex justify-between items-center py-2 border-b border-white/5 last:border-0"
          >
            <span className="text-sm text-on-surface-variant">{cat}</span>
            <span className="font-bold text-secondary font-mono">
              ₹{Number(limit).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card h-full flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10">
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center relative">
            <span className="material-symbols-outlined text-primary text-2xl filled">smart_toy</span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary border-2 border-surface animate-pulse" />
          </div>
          <div>
            <h3 className="font-plus font-extrabold text-on-surface">AI Assistant</h3>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Online</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([DEFAULT_MESSAGE]);
            setSessionId(null);
            setPendingConfirm(null);
            localStorage.removeItem(CHAT_CACHE_KEY);
          }}
          className="text-xs text-outline hover:text-on-surface font-plus"
          title="New chat"
        >
          New chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-white/[0.01]">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`flex gap-4 max-w-[85%] ${msg.type === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                  msg.type === 'user' ? 'bg-primary/20' : 'bg-secondary/20'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl filled ${
                    msg.type === 'user' ? 'text-primary' : 'text-secondary'
                  }`}
                >
                  {msg.type === 'user' ? 'person' : 'smart_toy'}
                </span>
              </div>
              <div
                className={`px-5 py-4 text-sm font-plus leading-relaxed shadow-xl border border-white/10 ${
                  msg.type === 'user'
                    ? 'bg-primary/10 rounded-[1.5rem] rounded-tr-none text-on-surface'
                    : msg.type === 'error'
                    ? 'bg-error/10 border-error/20 rounded-[1.5rem] rounded-tl-none text-error'
                    : 'bg-secondary/10 rounded-[1.5rem] rounded-tl-none text-on-surface'
                }`}
              >
                {msg.text}
              </div>
            </div>

            {msg.actionTaken && (
              <>
                {renderSurvivalPlan(msg.actionTaken)}
                {renderBudgetPlan(msg.actionTaken)}
                {!renderSurvivalPlan(msg.actionTaken) && !renderBudgetPlan(msg.actionTaken) && (
                  <div className="glass-card border-l-4 border-emerald-500 bg-emerald-500/5 p-4 rounded-2xl mx-auto max-w-[90%] mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 text-xl">✅</span>
                      <div>
                        <p className="text-emerald-400 font-bold text-sm">Action completed</p>
                        <p className="text-on-surface-variant text-xs">
                          {formatResultMessage(msg.actionTaken)}
                        </p>
                      </div>
                    </div>
                    {undoState?.messageId === msg.id && (
                      <button
                        type="button"
                        onClick={() => handleUndo(msg.actionTaken, msg.id)}
                        className="text-xs text-slate-400 border border-white/10 px-3 py-1 rounded-lg hover:bg-white/5"
                      >
                        Undo ({undoState.countdown}s)
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {pendingConfirm && (
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 bg-primary-container rounded-xl text-white text-sm font-plus font-bold"
            >
              Confirm action
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirm(null)}
              className="px-4 py-2 border border-white/10 rounded-xl text-on-surface-variant text-sm font-plus"
            >
              Cancel
            </button>
          </div>
        )}

        {loading && <AITypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-8 border-t border-white/5 bg-white/[0.02]">
        <form onSubmit={handleSend} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Try: I spent ₹120 on Swiggy lunch"
            className="w-full glass-card border-none bg-white/[0.05] pl-6 pr-14 py-5 rounded-[1.5rem] text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus font-medium group-hover:bg-white/[0.08]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
          >
            <span className="material-symbols-outlined filled">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChat;
