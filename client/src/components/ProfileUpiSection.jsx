import { useState, useEffect } from 'react';
import api from '../api/axios';
import { isValidUPI } from '../utils/upi';
import { toast } from '../utils/toastBus';

export default function ProfileUpiSection({ user, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [upiName, setUpiName] = useState(user?.upiName || user?.name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUpiId(user?.upiId || '');
    setUpiName(user?.upiName || user?.name || '');
  }, [user]);

  const valid = isValidUPI(upiId);

  const handleSave = async () => {
    if (!valid) {
      toast({ message: 'Enter a valid UPI ID (must contain @)', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/user/upi', { upiId, upiName: upiName.trim() || user?.name });
      toast({ message: 'UPI ID saved!', type: 'success' });
      setEditing(false);
      onUpdated?.(res.data);
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to save UPI ID', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-8 border border-white/5 space-y-6">
      <h3 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500">
        Payment Details
      </h3>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary filled">contactless</span>
          <div>
            <p className="font-plus font-bold text-white">Your UPI ID</p>
            {!editing && user?.upiId && (
              <p className="text-sm text-secondary font-mono">{user.upiId}</p>
            )}
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-plus font-bold text-primary hover:underline"
          >
            {user?.upiId ? 'Edit' : 'Add UPI ID'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@okicici"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoCapitalize="off"
            />
            {upiId && (
              <span
                className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm ${
                  valid ? 'text-secondary' : 'text-error'
                }`}
              >
                {valid ? 'check_circle' : 'error'}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs text-on-surface-variant font-plus block mb-1">
              Display name in UPI apps
            </label>
            <input
              type="text"
              value={upiName}
              onChange={(e) => setUpiName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-plus focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !valid}
              className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-plus font-bold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setUpiId(user?.upiId || '');
                setUpiName(user?.upiName || user?.name || '');
              }}
              className="px-6 py-3 rounded-xl border border-white/10 text-on-surface-variant font-plus font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant font-plus leading-relaxed">
          Your UPI ID is used when friends request money from you via AllowanceAI.
        </p>
      )}
    </div>
  );
}
