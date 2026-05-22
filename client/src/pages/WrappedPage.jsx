import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { ChartSkeleton } from '../components/ui/Skeleton';
import TopAppBar from '../components/TopAppBar';

const GRADE_COLORS = { A: '#44e2cd', B: '#8083ff', C: '#ffb690', D: '#ffb4ab', F: '#ff6b6b' };

function WrappedPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState(0);
  const [splurgeVote, setSplurgeVote] = useState(null);

  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const fetchWrapped = useCallback(async () => {
    try {
      const res = await api.get('/analytics/wrapped', { params: { month, year } });
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchWrapped();
  }, [fetchWrapped]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setCard((c) => Math.min(6, c + 1));
      if (e.key === 'ArrowLeft') setCard((c) => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (card < 6) {
      const t = setTimeout(() => setCard((c) => c + 1), 5000);
      return () => clearTimeout(t);
    }
  }, [card]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface page-enter p-6">
        <ChartSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-on-surface-variant">
        Could not load wrapped data.
      </div>
    );
  }

  const cards = [
    <div key="intro" className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="text-6xl font-space font-black text-primary-container">{data.year}</p>
      <h1 className="text-display-lg font-plus font-black mt-4">{data.monthName} Wrapped</h1>
      <p className="text-on-surface-variant mt-2">Your financial story</p>
      <div className="mt-12 text-4xl animate-pulse">₹ ✨ ₹</div>
    </div>,
    <div key="spent" className="flex flex-col items-center justify-center h-full px-8 text-center">
      <p className="text-sm uppercase tracking-widest text-slate-500 mb-4">You spent</p>
      <p className="text-6xl font-space font-black text-error">
        <AnimatedNumber value={data.totalSpent} duration={1200} />
      </p>
      <p className="text-on-surface-variant mt-4">
        out of <span className="text-on-surface font-bold">₹{data.totalAllowance.toLocaleString('en-IN')}</span> allowance
      </p>
      <p className="text-secondary font-bold mt-6">
        Saved ₹{data.savedAmount.toLocaleString('en-IN')} ({data.savingsPercent}%)
      </p>
      <div
        className="mt-8 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black border-4"
        style={{ borderColor: GRADE_COLORS[data.grade], color: GRADE_COLORS[data.grade] }}
      >
        {data.grade}
      </div>
    </div>,
    <div key="category" className="flex flex-col items-center justify-center h-full px-8">
      <p className="text-sm uppercase tracking-widest text-tertiary mb-2">Your biggest weakness</p>
      <h2 className="text-5xl font-plus font-black">{data.topCategory.name}</h2>
      <p className="text-2xl font-space font-bold text-tertiary mt-4">
        ₹{data.topCategory.amount.toLocaleString('en-IN')}
      </p>
      <p className="text-on-surface-variant mt-2">{data.topCategory.percent}% of total spending</p>
      <div className="w-full max-w-xs h-3 bg-white/10 rounded-full mt-8 overflow-hidden">
        <div
          className="h-full bg-tertiary rounded-full transition-all duration-1000"
          style={{ width: `${data.topCategory.percent}%` }}
        />
      </div>
      <p className="text-sm text-secondary mt-6 italic">{data.topCategory.comment}</p>
    </div>,
    <div key="splurge" className="flex flex-col items-center justify-center h-full px-8 text-center">
      {data.biggestSplurge ? (
        <>
          <p className="text-sm uppercase tracking-widest text-slate-500">Biggest splurge</p>
          <h2 className="text-3xl font-plus font-black mt-4">{data.biggestSplurge.description}</h2>
          <p className="text-4xl font-space font-black text-error mt-4">
            ₹{data.biggestSplurge.amount.toLocaleString('en-IN')}
          </p>
          <p className="text-on-surface-variant text-sm mt-2">
            {data.biggestSplurge.category} · {new Date(data.biggestSplurge.date).toLocaleDateString('en-IN')}
          </p>
          <p className="mt-8 text-on-surface">Was it worth it?</p>
          <div className="flex gap-4 mt-4">
            <button type="button" onClick={() => setSplurgeVote('yes')} className="btn-primary px-8">Yes</button>
            <button type="button" onClick={() => setSplurgeVote('no')} className="glass-card px-8 py-3 rounded-xl">No</button>
          </div>
          {splurgeVote && <p className="text-secondary mt-4 text-sm">Noted 😄</p>}
        </>
      ) : (
        <p className="text-on-surface-variant">No splurges this month — impressive!</p>
      )}
    </div>,
    <div key="weeks" className="grid grid-cols-2 gap-4 h-full p-6">
      <div className="glass-card rounded-3xl p-6 flex flex-col justify-center border-l-4 border-secondary">
        <p className="text-xs uppercase text-secondary font-bold">Best week</p>
        <p className="text-3xl font-space font-black mt-2">Week {data.bestWeek.weekNumber}</p>
        <p className="text-on-surface mt-2">₹{data.bestWeek.amount.toLocaleString('en-IN')}</p>
        <p className="text-xs text-on-surface-variant mt-4">You were a genius this week</p>
      </div>
      <div className="glass-card rounded-3xl p-6 flex flex-col justify-center border-l-4 border-error">
        <p className="text-xs uppercase text-error font-bold">Worst week</p>
        <p className="text-3xl font-space font-black mt-2">Week {data.worstWeek.weekNumber}</p>
        <p className="text-on-surface mt-2">₹{data.worstWeek.amount.toLocaleString('en-IN')}</p>
        <p className="text-xs text-on-surface-variant mt-4">We don&apos;t talk about this</p>
      </div>
    </div>,
    <div key="achievements" className="flex flex-col items-center justify-center h-full px-8">
      <p className="text-sm uppercase tracking-widest mb-6">Achievements</p>
      <p className="text-on-surface mb-4">
        <span className="font-space font-bold text-secondary">{data.streakAchieved}</span> day streak ·{' '}
        <span className="font-space font-bold">{data.totalTransactions}</span> transactions
      </p>
      <div className="flex flex-wrap gap-3 justify-center max-w-md">
        {(data.badgesEarned?.length ? data.badgesEarned : ['Budget Rookie']).map((b, i) => (
          <div
            key={b}
            className="glass-card px-4 py-3 rounded-2xl text-sm font-bold animate-in fade-in"
            style={{ animationDelay: `${i * 0.2}s` }}
          >
            🏆 {b}
          </div>
        ))}
      </div>
    </div>,
    <div key="verdict" className="flex flex-col items-center justify-center h-full px-8 text-center relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute text-2xl animate-bounce"
            style={{
              left: `${10 + i * 7}%`,
              top: `${20 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          >
            ✨
          </span>
        ))}
      </div>
      <p className="text-sm uppercase tracking-widest text-primary-container mb-4 relative z-10">AI Verdict</p>
      <p className="text-lg font-plus leading-relaxed text-on-surface max-w-lg relative z-10">{data.aiNarrative}</p>
      <div className="flex gap-4 mt-10 relative z-10">
        <button type="button" className="glass-card px-6 py-3 rounded-xl text-sm" onClick={() => navigator.clipboard?.writeText(data.aiNarrative)}>
          Share text
        </button>
        <button type="button" className="btn-primary" onClick={() => navigate('/')}>
          See full report
        </button>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col page-enter">
      <TopAppBar />
      <div className="flex-1 pt-16 relative">
        <div className="absolute top-20 left-0 right-0 flex justify-center gap-2 z-20 px-4">
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCard(i)}
              className={`h-1.5 rounded-full transition-all ${i === card ? 'w-8 bg-primary-container' : 'w-2 bg-white/20'}`}
            />
          ))}
        </div>
        <button type="button" onClick={() => navigate('/')} className="absolute top-20 left-4 z-20 text-slate-400 text-sm">
          ← Back
        </button>
        <div
          className="h-[calc(100vh-4rem)] cursor-pointer"
          onClick={() => setCard((c) => (c < 6 ? c + 1 : c))}
          role="presentation"
        >
          <div className="h-full bg-gradient-to-br from-indigo-500/10 to-teal-500/5">{cards[card]}</div>
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-between px-8 pointer-events-none">
          <span className="text-xs text-slate-500">{card > 0 ? '← prev' : ''}</span>
          <span className="text-xs text-slate-500">{card < 6 ? 'tap / → next' : ''}</span>
        </div>
      </div>
    </div>
  );
}

export default WrappedPage;
