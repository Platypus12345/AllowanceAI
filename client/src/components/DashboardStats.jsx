import { useState, useEffect } from 'react';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { StatCardSkeleton } from './ui/Skeleton';
import { validateAllowance } from '../utils/validation';
import { toast } from '../utils/toastBus';

const StatCard = ({ label, value, color, icon, editable, onSave }) => {
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
    <div className="card-elevated p-4 rounded-2xl relative overflow-hidden group">
      {/* Colored top accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: color }}
      />
      
      <p className="text-xs text-[#8892b0] uppercase tracking-widest mb-2 flex items-center gap-1">
        <span>{icon}</span>
        {label}
        {editable && !isEditing && (
          <button 
            type="button" 
            onClick={() => setIsEditing(true)} 
            className="hover:text-[#6c63ff] transition-colors cursor-pointer opacity-40 group-hover:opacity-100 ml-1"
          >
            <span className="material-symbols-outlined text-xs">edit</span>
          </button>
        )}
      </p>

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
              className="w-full bg-transparent border-b border-[#6c63ff] focus:outline-none text-xl font-space font-bold text-on-surface px-1"
              style={{ color }}
            />
            <button type="button" onClick={handleSave} className="text-accent-teal">
              <span className="material-symbols-outlined text-xl">check</span>
            </button>
          </div>
          {error && <p className="text-xs text-accent-rose">{error}</p>}
        </div>
      ) : (
        <p className="stat-number text-2xl font-space font-bold" style={{ color }}>
          ₹{value?.toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
};

const DashboardStats = ({ stats, onUpdate, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

  const items = [
    { label: 'Total Allowance', value: stats.totalAllowance ?? stats.allowance, color: '#6c63ff', icon: '💰', editable: true },
    { label: 'Spent', value: stats.spentAmount ?? stats.spent, color: '#ff6b8a', icon: '📤' },
    { label: 'Remaining', value: stats.remainingBalance ?? stats.remaining, color: '#00d4b1', icon: '💵' },
    { label: 'Daily Limit', value: dailyLimit, color: '#f5a623', icon: '📅' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(stat => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          color={stat.color}
          icon={stat.icon}
          editable={stat.editable}
          onSave={handleUpdateAllowance}
        />
      ))}
    </div>
  );
};

export default DashboardStats;
