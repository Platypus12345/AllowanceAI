import { useState, useEffect } from 'react';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { StatCardSkeleton } from './ui/Skeleton';
import { validateAllowance } from '../utils/validation';
import { toast } from '../utils/toastBus';

const StatCard = ({ title, value, colorClass, editable, onSave, animate = true }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditing) setEditValue(value);
  }, [value, isEditing]);

  const handleSave = async () => {
    const err = validateAllowance(Number(editValue));
    if (err) {
      setError(err);
      toast({ message: err, type: 'warning' });
      return;
    }
    setError('');
    await onSave(Number(editValue));
    setIsEditing(false);
    toast({ message: 'Allowance updated', type: 'success' });
  };

  return (
    <div className="glass-card p-4 rounded-2xl relative overflow-hidden group card-tilt">
      <div className="flex flex-col h-full justify-between relative z-10">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
          {title}
          {editable && !isEditing && (
            <button type="button" onClick={() => setIsEditing(true)} className="hover:text-primary transition-colors cursor-pointer opacity-40 group-hover:opacity-100">
              <span className="material-symbols-outlined text-xs">edit</span>
            </button>
          )}
        </h3>

        {isEditing ? (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-1">
              <span className="font-space font-bold text-slate-400">₹</span>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-transparent border-b border-primary focus:outline-none text-xl font-space font-bold text-on-surface px-1"
              />
              <button type="button" onClick={handleSave} className="text-secondary">
                <span className="material-symbols-outlined text-xl">check</span>
              </button>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        ) : (
          <p className={`text-xl font-space font-bold ${colorClass}`}>
            {animate ? <AnimatedNumber value={value} /> : <>₹{new Intl.NumberFormat('en-IN').format(value)}</>}
          </p>
        )}
      </div>
    </div>
  );
};

const DashboardStats = ({ stats, onUpdate, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const handleUpdateAllowance = async (newAllowance) => {
    try {
      await api.put('/budget/allowance', { allowance: newAllowance });
      if (onUpdate) onUpdate();
      dispatchFinanceUpdated();
    } catch (error) {
      console.error('Failed to update allowance:', error);
      toast({ message: 'Failed to update allowance', type: 'error' });
    }
  };

  const dailyLimit =
    (stats.finance?.recommendedDailyLimit ?? stats.dailyLimit) > 0
      ? stats.finance?.recommendedDailyLimit ?? stats.dailyLimit
      : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
      <StatCard title="Total Allowance" value={stats.totalAllowance} colorClass="text-primary" editable onSave={handleUpdateAllowance} />
      <StatCard title="Spent Amount" value={stats.spentAmount} colorClass="text-error" />
      <StatCard title="Remaining Balance" value={stats.remainingBalance} colorClass="text-secondary" />
      <StatCard title="Daily Limit left" value={dailyLimit} colorClass="text-on-surface" />
    </div>
  );
};

export default DashboardStats;
