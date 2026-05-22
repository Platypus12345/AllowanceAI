import { useState, useEffect } from 'react';
import api from '../api/axios';

const SavingTips = () => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTips = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/budget/stats');
      const stats = statsRes.data;

      const topCategories = stats.chartData.map(c => c.name);

      const res = await api.post('/ai/tips', {
        allowance: stats.totalAllowance,
        spent: stats.spentAmount,
        remaining: stats.remainingBalance,
        topCategories
      });
      
      setTips(res.data.tips || []);
    } catch (err) {
      console.error('Failed to fetch tips', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTips();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <span className="material-symbols-outlined text-6xl text-tertiary/20 mb-4 filled">lightbulb</span>
        <p className="text-on-surface-variant font-plus italic">AI is crafting custom saving strategies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-tertiary filled">tips_and_updates</span>
          <h3 className="text-display-sm font-plus font-black text-on-surface">Smart Saving Tips</h3>
        </div>
        <button 
          onClick={fetchTips}
          className="btn-primary-container text-xs flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          <span>Refresh AI</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tips.map((tipObj, idx) => (
          <div key={idx} className="glass-card p-8 rounded-[2.5rem] border border-white/10 hover:border-tertiary/30 transition-all hover:scale-[1.02] relative overflow-hidden group glow-tertiary-hover">
            {/* Corner Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-tertiary/5 rounded-bl-[4rem] group-hover:bg-tertiary/10 transition-colors" />
            
            <div className="flex justify-between items-center mb-6">
              <span className="px-4 py-1.5 bg-white/5 border border-white/5 rounded-full text-[10px] font-plus font-black text-on-surface-variant tracking-widest uppercase">
                {tipObj.category}
              </span>
              <div className="flex items-center text-secondary text-sm font-space font-bold bg-secondary/10 px-3 py-1 rounded-xl border border-secondary/20">
                <span className="material-symbols-outlined text-sm mr-1">trending_down</span>
                {tipObj.estimatedSaving}
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-tertiary/20 flex items-center justify-center text-tertiary shrink-0 mt-1">
                <span className="material-symbols-outlined text-xl">bolt</span>
              </div>
              <p className="text-on-surface text-base font-plus font-medium leading-relaxed italic line-clamp-4">
                "{tipObj.tip}"
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between">
               <p className="text-[10px] font-plus font-black text-outline uppercase tracking-widest">Potential Impact</p>
               <div className="flex gap-1">
                 <div className="w-1 h-1 rounded-full bg-secondary" />
                 <div className="w-1 h-1 rounded-full bg-secondary" />
                 <div className="w-1 h-1 rounded-full bg-secondary" />
                 <div className="w-1 h-1 rounded-full bg-outline opacity-30" />
                 <div className="w-1 h-1 rounded-full bg-outline opacity-30" />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavingTips;
