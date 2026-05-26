import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';

function PredictionSkeleton() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-pulse">
      <div className="h-32 bg-white/5 rounded-3xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 h-80 bg-white/5 rounded-3xl" />
        <div className="lg:col-span-4 h-80 bg-white/5 rounded-3xl" />
      </div>
    </div>
  );
}

export default function PredictionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchPrediction = async () => {
      try {
        const statsRes = await api.get('/budget/stats');
        const predRes = await api.get('/budget/prediction');
        const stats = statsRes.data;
        const pred = predRes.data;
        const finance = stats?.finance || pred?.finance || stats?.health;

        const chart = [];
        const daysInMonth = (stats?.daysLeftInMonth || 0) + (new Date().getDate() - 1);
        const currentDay = new Date().getDate();
        const avgDaily = finance?.avgDailySpend ?? pred?.dailyAverage ?? 0;

        for (let i = 1; i <= daysInMonth; i++) {
          if (i <= currentDay) {
            const simulatedSpend = stats?.spentAmount ? (stats.spentAmount / currentDay) * i : 0;
            chart.push({ day: i, actual: simulatedSpend, projected: null });
          } else {
            chart.push({
              day: i,
              actual: null,
              projected: (stats?.spentAmount || 0) + avgDaily * (i - currentDay),
            });
          }
        }

        const aiRes = await api.post('/ai/predict', {
          allowance: stats?.totalAllowance || 0,
          spent: stats?.spentAmount || 0,
          remaining: finance?.remainingBalance ?? stats?.remainingBalance ?? 0,
          dailyAverage: avgDaily,
          daysLeft: finance?.daysLeftInMonth ?? pred?.daysLeft ?? 30,
          topCategories: stats?.chartData ? stats.chartData.map((c) => c.name) : [],
        });

        if (mounted) {
          setData({ stats, pred, finance, chart, aiAnalysis: aiRes.data });
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error('Prediction error:', err);
          setError('Could not load prediction data');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    fetchPrediction();
    
    // Cleanup prevents setState on unmounted component
    return () => { mounted = false; };
  }, []);

  if (loading) return <PredictionSkeleton />;
  
  if (error) return (
    <div className="p-6 text-center max-w-md mx-auto card-elevated p-8 rounded-2xl border border-red-500/20 my-12">
      <p className="text-5xl mb-3">📊</p>
      <p className="text-white font-bold mb-2">
        Prediction unavailable
      </p>
      <p className="text-[#8892b0] text-sm">{error}</p>
      <button 
        onClick={() => window.location.reload()}
        className="btn-primary px-6 py-2 rounded-xl mt-4 text-sm"
      >
        Retry
      </button>
    </div>
  );

  const pred = data?.pred;
  const finance = data?.finance;
  const chart = data?.chart || [];
  const aiAnalysis = data?.aiAnalysis;

  const willRunOut = (finance?.projectedMonthEndBalance ?? pred?.projectedMonthEndBalance ?? 0) < 0;
  const statusColor = willRunOut ? 'error' : 'secondary';
  const glowClass = willRunOut ? 'glow-error' : 'glow-secondary';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`glass-card p-8 rounded-[2.5rem] border border-white/10 overflow-hidden relative ${glowClass}`}>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className={`w-20 h-20 rounded-[2rem] bg-${statusColor}/20 flex items-center justify-center shadow-lg`}>
            <span className={`material-symbols-outlined text-${statusColor} text-4xl filled`}>
              {willRunOut ? 'warning' : 'verified'}
            </span>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h3 className="text-display-sm font-plus font-black text-on-surface leading-tight">
              {finance?.insights?.mainInsight ||
                (willRunOut ? 'Watch your spending pace' : 'You are on track!')}
            </h3>
            <p className="text-body-base text-on-surface-variant font-plus">
              {finance?.insights?.messages?.[1] ||
                (willRunOut
                  ? `At your current burn rate, projected month-end balance is ${formatRupee(finance?.projectedMonthEndBalance ?? 0)}.`
                  : finance?.insights?.messages?.[2] ||
                    'Your spending pattern looks sustainable for the rest of the month.')}
            </p>
            {finance && (
              <p className="text-sm text-secondary font-space font-bold">
                {finance.daysLeftInMonth} days left · {formatRupee(finance.remainingBalance)} remaining ·{' '}
                {formatRupee(finance.recommendedDailyLimit)}/day safe limit
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-card p-8 rounded-[2.5rem] border border-white/10">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-plus font-extrabold text-on-surface">Spending Projection</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-tertiary" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Projected</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.2)"
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'Space Grotesk' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="glass-card p-4 border-white/10 shadow-2xl">
                          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                            Day {payload[0].payload.day}
                          </p>
                          {payload[0].value !== null && (
                            <p className="text-sm font-space font-bold text-primary">
                              Actual: {formatRupee(payload[0].value)}
                            </p>
                          )}
                          {payload[1]?.value !== null && (
                            <p className="text-sm font-space font-bold text-tertiary">
                              Projected: {formatRupee(payload[1].value)}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--color-primary)"
                  strokeWidth={4}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-primary)' }}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--color-tertiary)"
                  strokeWidth={4}
                  strokeDasharray="8 8"
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-tertiary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 glow-tertiary h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-tertiary filled">lightbulb</span>
              <h4 className="font-plus font-extrabold text-on-surface">AI Insights</h4>
            </div>

            {aiAnalysis ? (
              <div className="space-y-6 flex-1">
                <p className="text-sm text-on-surface-variant leading-relaxed font-plus">
                  {aiAnalysis.prediction}
                </p>
                {finance?.insights?.messages?.map((msg, idx) => (
                  <p key={idx} className="text-xs text-on-surface-variant font-plus leading-relaxed">
                    {msg}
                  </p>
                ))}

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    Recommended Actions
                  </p>
                  {aiAnalysis.tips?.slice(0, 3).map((tip, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 items-start p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-tertiary/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-tertiary text-sm mt-0.5">bolt</span>
                      <p className="text-xs text-on-surface font-plus font-medium leading-normal">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce mx-1" />
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce mx-1 delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce mx-1 delay-300" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
