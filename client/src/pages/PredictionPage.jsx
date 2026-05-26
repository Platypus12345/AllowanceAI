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

function buildChartData(stats, pred) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() || 30;
  const currentDay = now.getDate();
  const finance = stats?.finance || pred?.finance || stats?.health;
  const avgDaily = finance?.avgDailySpend ?? pred?.dailyAverage ?? 0;
  const spentSoFar = stats?.spentAmount ?? pred?.spent ?? 0;
  const chart = [];

  for (let i = 1; i <= daysInMonth; i++) {
    if (i <= currentDay) {
      const simulatedSpend =
        currentDay > 0 ? (spentSoFar / currentDay) * i : 0;
      chart.push({ day: i, actual: simulatedSpend, projected: null });
    } else {
      chart.push({
        day: i,
        actual: null,
        projected: spentSoFar + avgDaily * (i - currentDay),
      });
    }
  }

  return chart;
}

export default function PredictionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchPrediction = async () => {
      try {
        const [statsRes, predRes] = await Promise.all([
          api.get('/budget/stats'),
          api.get('/budget/prediction'),
        ]);

        const stats = statsRes.data;
        const pred = predRes.data;
        const finance = stats?.finance || pred?.finance || stats?.health;
        const chart = buildChartData(stats, pred);

        let aiAnalysis = null;
        try {
          const aiRes = await api.post('/ai/predict', {
            allowance: stats?.totalAllowance || pred?.allowance || 0,
            spent: stats?.spentAmount || pred?.spent || 0,
            remaining: finance?.remainingBalance ?? stats?.remainingBalance ?? pred?.remaining ?? 0,
            dailyAverage: finance?.avgDailySpend ?? pred?.dailyAverage ?? 0,
            daysLeft: finance?.daysLeftInMonth ?? pred?.daysLeft ?? 30,
            topCategories: stats?.chartData ? stats.chartData.map((c) => c.name) : [],
          });
          aiAnalysis = aiRes.data;
        } catch (aiErr) {
          console.error('AI prediction optional fetch failed:', aiErr);
        }

        if (mounted) {
          setData({ stats, pred, finance, chart, aiAnalysis });
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

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <PredictionSkeleton />;

  if (error) {
    return (
      <div className="p-6 text-center max-w-md mx-auto card-elevated p-8 rounded-2xl border border-red-500/20 my-12">
        <p className="text-5xl mb-3">📊</p>
        <p className="text-white font-bold mb-2">Prediction unavailable</p>
        <p className="text-[#8892b0] text-sm">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary px-6 py-2 rounded-xl mt-4 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const pred = data?.pred;
  const finance = data?.finance;
  const chart = data?.chart || [];
  const aiAnalysis = data?.aiAnalysis;
  const aiTips = Array.isArray(aiAnalysis?.tips) ? aiAnalysis.tips : [];

  const projectedBalance =
    finance?.projectedMonthEndBalance ?? pred?.projectedMonthEndBalance ?? 0;
  const willRunOut = projectedBalance < 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 page-enter">
      <div
        className={`glass-card p-8 rounded-[2.5rem] border border-white/10 overflow-hidden relative ${
          willRunOut ? 'border-[#ff6b8a]/30' : 'border-[#00d4b1]/20'
        }`}
      >
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div
            className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-lg ${
              willRunOut ? 'bg-[#ff6b8a]/20' : 'bg-[#00d4b1]/20'
            }`}
          >
            <span
              className={`material-symbols-outlined text-4xl filled ${
                willRunOut ? 'text-[#ff6b8a]' : 'text-[#00d4b1]'
              }`}
            >
              {willRunOut ? 'warning' : 'verified'}
            </span>
          </div>
          <div className="flex-1 text-center md:text-left space-y-2">
            <h3 className="text-2xl font-bold text-white leading-tight">
              {finance?.insights?.mainInsight ||
                (willRunOut ? 'Watch your spending pace' : 'You are on track!')}
            </h3>
            <p className="text-[#8892b0]">
              {finance?.insights?.messages?.[1] ||
                (willRunOut
                  ? `At your current burn rate, projected month-end balance is ${formatRupee(projectedBalance)}.`
                  : 'Your spending pattern looks sustainable for the rest of the month.')}
            </p>
            {finance && (
              <p className="text-sm text-[#00d4b1] stat-number font-bold">
                {finance.daysLeftInMonth} days left · {formatRupee(finance.remainingBalance)} remaining ·{' '}
                {formatRupee(finance.recommendedDailyLimit)}/day safe limit
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 card-elevated p-8 rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-bold text-white">Spending Projection</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6c63ff]" />
                <span className="text-[10px] font-bold text-[#8892b0] uppercase tracking-widest">Actual</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#f5a623]" />
                <span className="text-[10px] font-bold text-[#8892b0] uppercase tracking-widest">Projected</span>
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            {chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="glass-card p-4 border-white/10 shadow-2xl">
                            <p className="text-[10px] font-bold text-[#8892b0] uppercase tracking-widest mb-2">
                              Day {payload[0].payload.day}
                            </p>
                            {payload[0].value != null && (
                              <p className="text-sm stat-number font-bold text-[#6c63ff]">
                                Actual: {formatRupee(payload[0].value)}
                              </p>
                            )}
                            {payload[1]?.value != null && (
                              <p className="text-sm stat-number font-bold text-[#f5a623]">
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
                    stroke="#6c63ff"
                    strokeWidth={4}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    stroke="#f5a623"
                    strokeWidth={4}
                    strokeDasharray="8 8"
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[#8892b0] text-sm text-center pt-24">Not enough data for a chart yet.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="card-elevated p-8 rounded-[2.5rem] h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[#f5a623] filled">lightbulb</span>
              <h4 className="font-bold text-white">AI Insights</h4>
            </div>

            {aiAnalysis?.prediction ? (
              <div className="space-y-6 flex-1">
                <p className="text-sm text-[#8892b0] leading-relaxed">{aiAnalysis.prediction}</p>
                {Array.isArray(finance?.insights?.messages) &&
                  finance.insights.messages.map((msg, idx) => (
                    <p key={idx} className="text-xs text-[#8892b0] leading-relaxed">
                      {msg}
                    </p>
                  ))}

                {aiTips.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold text-[#8892b0] uppercase tracking-widest">
                      Recommended Actions
                    </p>
                    {aiTips.slice(0, 3).map((tip, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-start p-4 rounded-2xl bg-white/5 border border-white/5"
                      >
                        <span className="material-symbols-outlined text-[#f5a623] text-sm mt-0.5">bolt</span>
                        <p className="text-xs text-white font-medium leading-normal">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#8892b0] flex-1">
                Core prediction is ready. AI tips will appear when the AI service is available.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
