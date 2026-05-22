import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartSkeleton } from './ui/Skeleton';

const COLORS = {
  'Food': '#44e2cd',
  'Transport': '#8083ff',
  'Shopping': '#c0c1ff',
  'Entertainment': '#ffb690',
  'Health': '#03c6b2',
  'Other': '#ec6a06'
};

const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.06)';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length && payload[0].payload.real) {
    return (
      <div className="glass-card p-3 rounded-2xl border border-white/10 shadow-2xl">
        <p className="text-on-surface font-plus font-bold text-sm">{payload[0].name}</p>
        <p className="text-primary font-space text-xs mt-1">₹{payload[0].value.toLocaleString('en-IN')}</p>
      </div>
    );
  }
  return null;
};

const SpendingChart = ({ data, loading }) => {
  if (loading) return <ChartSkeleton />;
  const fullDataKeys = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

  const fullData = fullDataKeys.map(key => {
    // handle both {name, value} and {category, amount} shapes from the API
    const existing = data?.find(
      item => item.name === key || item.category === key
    );
    const value = existing ? (existing.value ?? existing.amount ?? 0) : 0;
    return { name: key, value, real: value > 0 };
  });

  const hasData = fullData.some(d => d.value > 0);

  // When no real data, show 6 equal placeholder slices so the donut is visible
  const chartData = hasData
    ? fullData
    : fullDataKeys.map(key => ({ name: key, value: 1, real: false }));

  return (
    <div className="glass-card rounded-[2rem] p-6 h-full flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-plus font-extrabold text-on-surface">Spending Breakdown</h3>
        <span className="material-symbols-outlined text-outline">pie_chart</span>
      </div>

      <div className="flex-1 flex flex-col md:flex-row items-center gap-6">
        {/* Chart — always renders */}
        <div className="w-full md:w-1/2 relative" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={65}
                outerRadius={95}
                paddingAngle={hasData ? 4 : 2}
                dataKey="value"
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.real ? COLORS[entry.name] : PLACEHOLDER_COLOR}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} cursor={false} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre label overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {hasData ? (
              <>
                <span className="text-xl font-space font-black text-on-surface">
                  ₹{fullData.reduce((s, d) => s + d.value, 0).toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] font-plus font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">
                  Total Spent
                </span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-20">pie_chart</span>
                <p className="text-[9px] font-plus text-on-surface-variant opacity-20 mt-1 uppercase tracking-widest">No data</p>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="w-full md:w-1/2 grid grid-cols-2 gap-y-4 gap-x-3">
          {fullDataKeys.map((key) => {
            const entry = fullData.find(d => d.name === key);
            const active = hasData && (entry?.value ?? 0) > 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors"
                  style={{ backgroundColor: active ? COLORS[key] : 'rgba(255,255,255,0.12)' }}
                />
                <div>
                  <span className={`text-[10px] font-plus font-bold uppercase tracking-wider block ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                    {key}
                  </span>
                  {active && (
                    <span className="text-[11px] font-space font-bold text-on-surface">
                      ₹{entry.value.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpendingChart;
