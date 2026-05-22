import { useState } from 'react';
import { ProgressRing } from './ui/ProgressRing';

const STATUS_STYLES = {
  SAFE: {
    badge: 'bg-secondary/20 text-secondary border-secondary/30',
    ring: '#44e2cd',
    emoji: '✅',
  },
  MODERATE: {
    badge: 'bg-primary-container/20 text-primary-container border-primary-container/30',
    ring: '#8083ff',
    emoji: '⚖️',
  },
  WARNING: {
    badge: 'bg-tertiary/20 text-tertiary border-tertiary/30',
    ring: '#ffb690',
    emoji: '⚠️',
  },
  DANGER: {
    badge: 'bg-error/20 text-error border-error/30',
    ring: '#ffb4ab',
    emoji: '🔴',
  },
};

const TREND_STYLES = {
  safe: 'text-secondary',
  balanced: 'text-primary-container',
  warning: 'text-tertiary',
};

const SurvivalCard = ({ survival, finance }) => {
  const data = finance || survival;
  const [showWhy, setShowWhy] = useState(false);

  if (!data) return null;

  const status = data.spendingStatus || data.badgeLabel || 'SAFE';
  const style = STATUS_STYLES[status] || STATUS_STYLES.SAFE;
  const score = data.monthHealthScore ?? data.safetyScore ?? 0;
  const trend = data.trend || { label: '→ Balanced', tone: 'balanced' };
  const insights = data.insights || {};
  const explainability = data.explainability;

  return (
    <div className="glass-card rounded-[2.5rem] p-8 border border-white/20 relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-teal-500/10 glow-primary">
      <div className="flex flex-col lg:flex-row gap-8 relative z-10">
        <div className="flex-1 space-y-5">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${style.badge}`}
          >
            <span className="text-[10px] font-plus font-black uppercase tracking-widest">
              {status} {style.emoji}
            </span>
          </div>

          <div>
            <h3 className="text-headline-md font-plus font-extrabold leading-tight text-on-surface">
              {insights.mainInsight || data.message}
            </h3>
            {insights.dailyGuidance && (
              <p className="text-sm text-secondary font-plus font-semibold mt-2">
                {insights.dailyGuidance}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Days left
              </p>
              <p className="text-xl font-space font-black text-on-surface">
                {data.daysLeftInMonth ?? data.daysLeft ?? 0}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Remaining
              </p>
              <p className="text-xl font-space font-black text-secondary">
                ₹{new Intl.NumberFormat('en-IN').format(data.remainingBalance ?? 0)}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Safe daily limit
              </p>
              <p className="text-xl font-space font-black text-on-surface">
                ₹{new Intl.NumberFormat('en-IN').format(data.recommendedDailyLimit ?? data.dailyLimit ?? 0)}
                <span className="text-xs text-on-surface-variant">/day</span>
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                Avg. spend
              </p>
              <p className="text-xl font-space font-black text-tertiary">
                ₹{new Intl.NumberFormat('en-IN').format(data.burnRate ?? data.avgDailySpend ?? data.dailyAverage ?? 0)}
                <span className="text-xs text-on-surface-variant">/day</span>
              </p>
            </div>
          </div>

          <p className={`text-sm font-plus font-bold ${TREND_STYLES[trend.tone] || TREND_STYLES.balanced}`}>
            {trend.label}
          </p>

          {explainability && (
            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowWhy((v) => !v)}
                className="text-xs font-plus font-bold text-primary-container hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">
                  {showWhy ? 'expand_less' : 'help'}
                </span>
                {explainability.title}
              </button>
              {showWhy && (
                <div className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-on-surface-variant space-y-2 animate-in fade-in duration-200">
                  <p className="font-plus font-semibold text-on-surface">{explainability.formula}</p>
                  <p className="font-space text-secondary">{explainability.calculation}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 mx-auto lg:mx-0">
          <ProgressRing
            percentage={score}
            size={144}
            strokeWidth={10}
            color={data.ringColor || style.ring}
          >
            <span className="text-xl font-space font-black">{score}%</span>
            <span className="text-[9px] text-slate-500 uppercase font-bold">Financial safety</span>
          </ProgressRing>
        </div>
      </div>
    </div>
  );
};

export default SurvivalCard;
