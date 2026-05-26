import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';

const faqs = [
  {
    id: 1,
    question: 'How does AI prediction work?',
    answer:
      'AllowanceAI analyzes your spending patterns from the current month. It calculates your daily average spend, then projects forward to predict if you will run out before month end. The prediction updates every time you add an expense.',
  },
  {
    id: 2,
    question: 'Security & Privacy',
    answer:
      'Your data is stored securely in MongoDB with JWT authentication. SMS messages are only read for transaction amounts and merchant names — your personal chats and OTPs are never accessed. Raw SMS content is never stored on our servers.',
  },
  {
    id: 3,
    question: 'How does SMS tracking work?',
    answer:
      'On Android, AllowanceAI polls your SMS inbox every 45 seconds while the app is open, and every 5 minutes in the background. It looks for messages from bank sender IDs like HDFCBK, SBIINB, ICICIB etc. and extracts only the transaction amount and merchant name.',
  },
  {
    id: 4,
    question: 'How do I set my monthly allowance?',
    answer:
      'Go to your Dashboard and click the edit icon next to "Total Allowance". You can update it any time. Your daily limit will automatically recalculate based on remaining balance and days left in the month.',
  },
  {
    id: 5,
    question: 'What is the Daily Limit?',
    answer:
      'Daily Limit = Remaining Balance ÷ Days left in month. This is the key number AllowanceAI uses — not your total balance. If a purchase exceeds your daily limit, the AI will warn you even if you technically have money remaining.',
  },
  {
    id: 6,
    question: 'How do Savings Jars work?',
    answer:
      'Create a jar with a name and target amount (e.g. "Goa Trip - ₹5000"). Add money to it manually or enable auto-save which contributes automatically on days you spend under your daily limit.',
  },
  {
    id: 7,
    question: 'How does price tracking work?',
    answer:
      "Paste any Amazon, Flipkart, Myntra, Meesho, Nykaa or Ajio product URL. AllowanceAI checks the price every 6 hours. You get notified separately when the price hits your target AND when you can afford it with today's daily limit.",
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const filtered = faqs.filter(
    (f) =>
      !searchQuery ||
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070b14]">
      <TopAppBar />
      <div className="pt-16 max-w-2xl mx-auto px-4 pb-16">
        <div className="flex items-center gap-3 mt-8 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/5 transition-colors text-white"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">How can we help?</h1>
            <p className="text-[#8892b0] text-sm">Find answers or contact support</p>
          </div>
        </div>

        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8892b0]">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for help..."
            className="w-full bg-[#0f1629] border border-white/10 rounded-2xl py-4 pl-11 pr-4 text-white placeholder:text-[#4a5568] focus:outline-none focus:border-[#6c63ff] transition-colors"
          />
        </div>

        <div className="space-y-2 mb-8">
          <p className="text-xs font-bold text-[#8892b0] uppercase tracking-widest mb-3">
            {searchQuery ? 'Search Results' : 'FAQ'}
          </p>

          {filtered.length === 0 && (
            <p className="text-[#8892b0] text-sm py-4">No results for &ldquo;{searchQuery}&rdquo;</p>
          )}

          {filtered.map((faq) => (
            <div key={faq.id} className="card-elevated rounded-2xl overflow-hidden border border-white/5">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="font-medium text-white text-sm">{faq.question}</span>
                <span
                  className={`text-[#6c63ff] transition-transform ${
                    expandedFaq === faq.id ? 'rotate-180' : ''
                  }`}
                >
                  ▾
                </span>
              </button>

              {expandedFaq === faq.id && (
                <div className="px-4 pb-4 text-sm text-[#8892b0] leading-relaxed border-t border-white/5 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs font-bold text-[#8892b0] uppercase tracking-widest mb-3">Contact Support</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/?tab=ai-assistant')}
            className="card-elevated p-5 rounded-2xl flex flex-col items-center gap-2 hover:border-[#6c63ff]/30 border border-white/5 transition-all hover:-translate-y-0.5"
          >
            <span className="text-3xl">🤖</span>
            <span className="text-sm font-bold text-white">Chat with AI</span>
            <span className="text-xs text-[#8892b0]">Instant answers</span>
          </button>

          <a
            href="mailto:support@allowanceai.com"
            className="card-elevated p-5 rounded-2xl flex flex-col items-center gap-2 hover:border-[#00d4b1]/30 border border-white/5 transition-all hover:-translate-y-0.5 no-underline"
          >
            <span className="text-3xl">📧</span>
            <span className="text-sm font-bold text-white">Email Us</span>
            <span className="text-xs text-[#8892b0]">support@allowanceai.com</span>
          </a>
        </div>

        <p className="text-center text-xs text-[#4a5568]">
          AllowanceAI v1.0.0 • Made for hostel students 🎓
        </p>
      </div>
    </div>
  );
}
