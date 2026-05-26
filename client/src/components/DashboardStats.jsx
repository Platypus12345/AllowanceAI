import { useState, useEffect } from 'react';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { StatCardSkeleton } from './ui/Skeleton';
import { validateAllowance } from '../utils/validation';
import { toast } from '../utils/toastBus';

const AllowanceStatCard = ({ value, onSave }) => {
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
    <div className="card-elevated p-4 rounded-2xl relative overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: '#6c63ff' }}
      />
      <p className="text-xs text-[#8892b0] uppercase tracking-widest mb-2 flex items-center gap-1">
        <span>💰</span>
        Total Allowance
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Edit allowance"
          >
            <span className="material-symbols-outlined text-xs">edit</span>
          </button>
        )}
      </p>
      {isEditing ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="stat-number text-[#6c63ff]">₹</span>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-transparent border-b border-[#6c63ff] focus:outline-none text-2xl stat-number text-white px-1"
            />
            <button type="button" onClick={handleSave} className="text-[#00d4b1]">
              <span className="material-symbols-outlined text-xl">check</span>
            </button>
          </div>
          {error && <p className="text-xs text-[#ff6b8a]">{error}</p>}
        </div>
      ) : (
        <p className="stat-number text-2xl" style={{ color: '#6c63ff' }}>
          ₹{Number(value || 0).toLocaleString('en-IN')}
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

  const statCards = [
    { label: 'Total Allowance', value: stats.totalAllowance, color: '#6c63ff', icon: '💰', editable: true },
    { label: 'Spent', value: stats.spentAmount, color: '#ff6b8a', icon: '📤' },
    { label: 'Remaining', value: stats.remainingBalance, color: '#00d4b1', icon: '💵' },
    { label: 'Daily Limit', value: dailyLimit, color: '#f5a623', icon: '📅' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {statCards.map((stat) =>
        stat.editable ? (
          <AllowanceStatCard
            key={stat.label}
            value={stat.value}
            onSave={handleUpdateAllowance}
          />
        ) : (
          <div key={stat.label} className="card-elevated p-4 rounded-2xl relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ background: stat.color }}
            />
            <p className="text-xs text-[#8892b0] uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>{stat.icon}</span>
              {stat.label}
            </p>
            <p className="stat-number text-2xl" style={{ color: stat.color }}>
              ₹{Number(stat.value || 0).toLocaleString('en-IN')}
            </p>
          </div>
        )
      )}
    </div>
  );
};

export default DashboardStats;
