import { useState, useEffect } from 'react';
import api from '../api/axios';
import { subscribeFinanceUpdated, dispatchFinanceUpdated } from '../utils/financeEvents';
import { formatRupee } from '../utils/formatters';
import { GoalCardSkeleton } from './ui/Skeleton';
import { ProgressRing } from './ui/ProgressRing';
import { validateBudgetGoal } from '../utils/validation';
import { toast } from '../utils/toastBus';

const ICONS = {
  'Food': 'restaurant',
  'Transport': 'directions_bus',
  'Shopping': 'shopping_bag',
  'Entertainment': 'movie',
  'Health': 'medical_services',
  'Other': 'more_horiz',
};

const BudgetGoals = () => {
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editLimit, setEditLimit] = useState('');

  const fetchProgress = async () => {
    try {
      const res = await api.get('/budget/goals/progress');
      setProgressData(res.data.progress);
    } catch (error) {
      console.error('Failed to fetch budget goals progress', error);
      toast({ message: 'Failed to load goals', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
    return subscribeFinanceUpdated(fetchProgress);
  }, []);

  const handleSave = async (category) => {
    const numLimit = parseFloat(editLimit);
    const item = progressData.find((p) => p.category === category);
    const err = validateBudgetGoal(numLimit, item?.spent ?? 0);
    if (err) {
      toast({ message: err, type: 'warning' });
      return;
    }
    try {
      await api.post('/budget/goals', { category, monthlyLimit: numLimit });
      setEditingCategory(null);
      fetchProgress();
      dispatchFinanceUpdated();
      toast({ message: 'Budget goal updated', type: 'success' });
    } catch (error) {
      console.error('Failed to save budget goal', error);
      toast({ message: 'Failed to save goal', type: 'error' });
    }
  };

  const startEditing = (category, currentLimit) => {
    setEditingCategory(category);
    setEditLimit(currentLimit ? currentLimit.toString() : '');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <GoalCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {progressData.length === 0 ? (
        <div className="col-span-full text-on-surface-variant font-plus text-center py-12 italic opacity-50">
          <span className="material-symbols-outlined text-4xl mb-2">target</span>
          <p>Setting up your goals...</p>
        </div>
      ) : (
        progressData.map((item) => {
          const icon = ICONS[item.category] || 'more_horiz';
          const isEditing = editingCategory === item.category;
          const hasLimit = item.limit !== null;
          
          let colorClass = 'primary';
          let glowClass = 'glow-primary';
          if (item.status === 'warning') { colorClass = 'tertiary'; glowClass = 'glow-tertiary'; }
          else if (item.status === 'danger') { colorClass = 'error'; glowClass = 'glow-error'; }

          return (
            <div key={item.category} className={`glass-card p-6 rounded-[2rem] border border-white/10 group transition-all duration-300 hover:scale-[1.02] ${glowClass}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-${colorClass}/20 flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-${colorClass} text-2xl filled`}>{icon}</span>
                  </div>
                  <div>
                    <h3 className="font-plus font-extrabold text-on-surface">{item.category}</h3>
                    {hasLimit && (
                      <span className={`text-[10px] font-bold text-${colorClass} uppercase tracking-widest`}>
                        {item.status || 'safe'}
                      </span>
                    )}
                  </div>
                </div>
                
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="font-space font-bold text-outline text-xs">₹</span>
                    <input
                      type="number"
                      value={editLimit}
                      onChange={(e) => setEditLimit(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(item.category)}
                      className="w-16 bg-transparent border-b border-primary text-on-surface font-space font-bold focus:outline-none px-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleSave(item.category)} className="text-secondary">
                      <span className="material-symbols-outlined text-base">check</span>
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => startEditing(item.category, item.limit)}
                    className="p-2 rounded-xl hover:bg-white/5 text-outline opacity-40 group-hover:opacity-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider">Spent</p>
                    <p className="font-space font-bold text-on-surface">{formatRupee(item.spent)}</p>
                  </div>
                  {hasLimit && (
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider">Limit</p>
                      <p className="font-space font-bold text-on-surface">{formatRupee(item.limit)}</p>
                    </div>
                  )}
                </div>
                
                {hasLimit ? (
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      percentage={Math.min(100, item.percentage || 0)}
                      size={56}
                      strokeWidth={6}
                      color={colorClass === 'error' ? '#ffb4ab' : colorClass === 'tertiary' ? '#ffb690' : '#44e2cd'}
                    >
                      <span className={`text-[10px] font-space font-black text-${colorClass}`}>{item.percentage}%</span>
                    </ProgressRing>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 bg-${colorClass}`}
                        style={{ width: `${Math.min(100, item.percentage || 0)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-2 w-full border border-dashed border-white/20 rounded-full" />
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default BudgetGoals;
