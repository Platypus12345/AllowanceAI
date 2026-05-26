import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import TopAppBar from '../components/TopAppBar';

const GRADE_COLORS = {
  A: '#00d4b1',
  B: '#6c63ff',
  C: '#f5a623',
  D: '#ff6b8a',
  F: '#ef4444',
};

function WrappedPage() {
  const navigate = useNavigate();
  const [wrappedData, setWrappedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentCard, setCurrentCard] = useState(0);
  const [error, setError] = useState(null);

  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const fetchWrapped = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analytics/wrapped', { params: { month, year } });
      setWrappedData(res.data);
    } catch (err) {
      console.error(err);
      setError('Could not load wrapped data');
      setWrappedData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchWrapped();
  }, [fetchWrapped]);

  const monthName =
    wrappedData?.monthName ||
    new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🎁</div>
          <p className="text-white font-bold">Loading your Wrapped...</p>
        </div>
      </div>
    );
  }

  if (error || !wrappedData) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col">
        <TopAppBar />
        <div className="flex-1 flex items-center justify-center p-6 pt-20">
          <div className="text-center max-w-sm">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-white font-bold text-xl mb-2">No Wrapped Yet</p>
            <p className="text-[#8892b0] mb-6">
              Wrapped is generated after your first full month of tracking. Keep using AllowanceAI
              and check back next month!
            </p>
            <button type="button" onClick={() => navigate(-1)} className="btn-primary px-6 py-3 rounded-xl">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const savingsAmount = wrappedData.savingsAmount ?? wrappedData.savedAmount ?? 0;
  const topCategory = wrappedData.topCategory || { name: 'Other', amount: 0, percent: 0 };
  const biggestExpense = wrappedData.biggestExpense || wrappedData.biggestSplurge;

  const cards = [
    {
      bg: 'from-[#6c63ff] to-[#4f46e5]',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-white/70 text-sm uppercase tracking-widest mb-2">Your</p>
          <h1 className="text-6xl font-black text-white mb-1">{monthName}</h1>
          <p className="text-4xl font-black text-white mb-6">Wrapped</p>
          <p className="text-white/70">Your financial story this month</p>
          <div className="mt-8 animate-bounce text-2xl">👇 Tap Next to explore</div>
        </div>
      ),
    },
    {
      bg: 'from-[#0f1629] to-[#161f35]',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-[#8892b0] text-sm uppercase tracking-widest mb-4">You spent</p>
          <p className="stat-number text-6xl font-black text-[#ff6b8a] mb-2">
            ₹{(wrappedData.totalSpent || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-white text-lg mb-2">
            out of ₹{(wrappedData.totalAllowance || 0).toLocaleString('en-IN')} allowance
          </p>
          {savingsAmount > 0 && (
            <div className="mt-4 bg-[#00d4b1]/10 border border-[#00d4b1]/20 rounded-2xl px-6 py-3">
              <p className="text-[#00d4b1] font-bold">
                You saved ₹{savingsAmount.toLocaleString('en-IN')} 🎉
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      bg: 'from-[#0f1629] to-[#161f35]',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-[#8892b0] text-sm uppercase tracking-widest mb-6">Your grade</p>
          <div
            className="w-40 h-40 rounded-full flex items-center justify-center mb-6 border-4"
            style={{
              borderColor: GRADE_COLORS[wrappedData.grade] || '#6c63ff',
              boxShadow: `0 0 40px ${GRADE_COLORS[wrappedData.grade] || '#6c63ff'}40`,
            }}
          >
            <span
              className="text-8xl font-black"
              style={{ color: GRADE_COLORS[wrappedData.grade] || '#6c63ff' }}
            >
              {wrappedData.grade || 'C'}
            </span>
          </div>
          <p className="text-white text-lg font-bold">
            {wrappedData.grade === 'A' && 'Financial genius! 🏆'}
            {wrappedData.grade === 'B' && 'Solid performance! 💪'}
            {wrappedData.grade === 'C' && 'Room to improve 📈'}
            {wrappedData.grade === 'D' && 'Tight month 😅'}
            {wrappedData.grade === 'F' && 'Over budget this time 😬'}
            {!['A', 'B', 'C', 'D', 'F'].includes(wrappedData.grade) && 'Keep tracking!'}
          </p>
        </div>
      ),
    },
    {
      bg: 'from-[#0f1629] to-[#161f35]',
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-[#8892b0] text-sm uppercase tracking-widest mb-4">Your biggest spend</p>
          <div className="text-6xl mb-4">
            {topCategory.name === 'Food' && '🍕'}
            {topCategory.name === 'Transport' && '🚗'}
            {topCategory.name === 'Shopping' && '🛍️'}
            {topCategory.name === 'Entertainment' && '🎬'}
            {topCategory.name === 'Health' && '💊'}
            {topCategory.name === 'Other' && '📦'}
          </div>
          <p className="text-3xl font-black text-white mb-2">{topCategory.name}</p>
          <p className="text-[#ff6b8a] font-bold text-xl">
            ₹{(topCategory.amount || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-[#8892b0] mt-2">{topCategory.percent || 0}% of your total spending</p>
        </div>
      ),
    },
    {
      bg: 'from-[#0f1629] to-[#161f35]',
      content: (
        <div className="flex flex-col justify-center h-full p-8">
          <p className="text-[#8892b0] text-sm uppercase tracking-widest mb-6 text-center">By the numbers</p>
          <div className="space-y-4">
            {[
              {
                label: 'Daily average',
                value: `₹${(wrappedData.dailyAverage || wrappedData.dailyAverageSpend || 0).toLocaleString('en-IN')}`,
              },
              { label: 'Days over limit', value: String(wrappedData.daysOverLimit ?? '0') },
              {
                label: 'Biggest single expense',
                value: `₹${(biggestExpense?.amount || 0).toLocaleString('en-IN')}`,
              },
              { label: 'Total transactions', value: String(wrappedData.totalTransactions || '0') },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between items-center py-3 border-b border-white/5">
                <span className="text-[#8892b0] text-sm">{stat.label}</span>
                <span className="text-white font-bold stat-number">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col">
      <TopAppBar />
      <div className="flex-1 flex flex-col items-center justify-center p-4 pt-20">
        <div className="w-full max-w-sm">
          <div className="flex gap-1.5 justify-center mb-4">
            {cards.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentCard(i)}
                className={`h-1 rounded-full transition-all ${
                  i === currentCard ? 'w-6 bg-[#6c63ff]' : 'w-1.5 bg-white/20'
                }`}
                aria-label={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          <div
            className={`h-[520px] rounded-3xl bg-gradient-to-br ${cards[currentCard].bg} border border-white/10 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]`}
          >
            {cards[currentCard].content}
          </div>

          <div className="flex gap-3 mt-4">
            {currentCard > 0 && (
              <button
                type="button"
                onClick={() => setCurrentCard((c) => c - 1)}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold"
              >
                ← Back
              </button>
            )}
            {currentCard < cards.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentCard((c) => c + 1)}
                className="flex-1 py-3 btn-primary rounded-2xl text-white font-bold"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 btn-primary rounded-2xl text-white font-bold"
              >
                Done 🎉
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WrappedPage;
