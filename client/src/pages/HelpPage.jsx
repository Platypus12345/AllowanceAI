import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';

const faqs = [
  {
    q: 'How does AI prediction work?',
    a: 'AllowanceAI analyses your historical spending patterns and uses your daily average burn rate to project how much you will spend by month end. It also pulls AI-generated insights from our language model to give personalised recommendations.',
    icon: '🤖',
  },
  {
    q: 'Is my financial data safe?',
    a: 'All data is stored in your personal MongoDB account and transmitted over HTTPS. We never share your data with third parties. JWT tokens expire and are rotated regularly.',
    icon: '🔒',
  },
  {
    q: 'How does SMS tracking work?',
    a: 'On Android, the app reads bank SMS alerts (e.g. from SBI, HDFC, ICICI) to automatically parse and log expenses. No SMS data ever leaves your device — parsing happens locally.',
    icon: '📱',
  },
  {
    q: 'What is the Wrapped feature?',
    a: 'At the start and end of each month, you can view your Monthly Wrapped — a story-like presentation of your spending highlights, best/worst weeks, and an AI-generated financial verdict.',
    icon: '🎁',
  },
  {
    q: 'How do I request money from parents?',
    a: 'Go to Profile → Request Allowance. This generates a UPI link and a readable summary. Your parent can approve it via any UPI app. The money shows in your allowance once received.',
    icon: '💸',
  },
  {
    q: 'What are Savings Jars?',
    a: 'Jars are virtual saving buckets. Allocate a portion of your balance to a jar (e.g. "Bike Trip ₹2000"). The AI will suggest when you are on track to fill a jar and alert you when withdrawals are needed.',
    icon: '🫙',
  },
  {
    q: 'Can I undo AI actions?',
    a: 'Yes! After any action (add expense, update goal, add allowance) you have a 30-second undo window shown in the chat. Just tap "Undo" before the countdown ends.',
    icon: '↩️',
  },
  {
    q: 'What do the budget grades mean?',
    a: 'A = Excellent (spent <70% allowance), B = Good (70-85%), C = Average (85-95%), D = Poor (95-100%), F = Failed (>100%). Your grade appears on your Monthly Report.',
    icon: '📊',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const filtered = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#070b14' }}>
      <TopAppBar />
      <div className="pt-16 max-w-2xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mt-8 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors text-white"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Help & Support</h1>
            <p className="text-sm" style={{ color: '#8892b0' }}>Find answers or get in touch</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl" style={{ color: '#8892b0' }}>
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for help..."
            className="w-full h-12 rounded-xl pl-12 pr-4 text-sm outline-none"
            style={{
              background: 'rgba(15,22,41,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#eef2ff',
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => navigate('/?tab=ai-assistant')}
            className="p-5 rounded-2xl text-left transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)' }}
          >
            <div className="text-3xl mb-2">🤖</div>
            <p className="font-bold text-white text-sm">Chat with AI</p>
            <p className="text-xs mt-1" style={{ color: '#8892b0' }}>Get instant answers</p>
          </button>
          <a
            href="mailto:support@allowanceai.com"
            className="p-5 rounded-2xl text-left transition-all hover:scale-[1.02] block"
            style={{ background: 'rgba(0,212,177,0.08)', border: '1px solid rgba(0,212,177,0.15)' }}
          >
            <div className="text-3xl mb-2">✉️</div>
            <p className="font-bold text-white text-sm">Email Support</p>
            <p className="text-xs mt-1" style={{ color: '#8892b0' }}>support@allowanceai.com</p>
          </a>
        </div>

        {/* FAQ Accordion */}
        <p className="text-xs uppercase tracking-widest mb-4 font-bold" style={{ color: '#8892b0' }}>
          Frequently Asked Questions
        </p>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">🔍</p>
              <p className="text-white font-bold mb-1">No results found</p>
              <p className="text-sm" style={{ color: '#8892b0' }}>Try a different search term</p>
            </div>
          )}
          {filtered.map((item, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(15,22,41,0.8)',
                border: open === i ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-semibold text-white text-sm">{item.q}</span>
                </div>
                <span
                  className="material-symbols-outlined text-xl flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: '#8892b0',
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  expand_more
                </span>
              </button>
              {open === i && (
                <div
                  className="px-4 pb-4 text-sm leading-relaxed"
                  style={{ color: '#8892b0', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="pt-3">{item.a}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{ background: 'rgba(0,212,177,0.1)', color: '#00d4b1' }}
          >
            NEW
          </div>
          <h3 className="text-white font-bold mb-1">AI Financial Counselor</h3>
          <p className="text-sm mb-4" style={{ color: '#8892b0' }}>
            Get personalised advice for your hostel budget based on your spending patterns.
          </p>
          <button
            onClick={() => navigate('/?tab=ai-assistant')}
            className="btn-primary px-6 py-2 rounded-xl text-sm font-bold"
          >
            Open AI Chat
          </button>
          <p className="text-xs mt-8" style={{ color: '#4a5568' }}>
            AllowanceAI v2.5.0 · Built for Indian Hostel Students
          </p>
        </div>
      </div>
    </div>
  );
}
