import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';
import { isValidUPI, openUpiLink, SPLIT_CATEGORIES } from '../utils/upi';
import { toast } from '../utils/toastBus';
import { Skeleton } from './ui/Skeleton';

function AddFriendModal({ open, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = isValidUPI(upiId);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !valid) return;
    setSaving(true);
    try {
      const res = await api.post('/friends', { name: name.trim(), upiId, phone: phone || undefined });
      toast({ message: 'Friend saved', type: 'success' });
      onSaved(res.data);
      onClose();
      setName('');
      setUpiId('');
      setPhone('');
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to save friend', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="glass-card w-full max-w-md rounded-[2rem] p-8 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-plus font-black text-white mb-6">Add New Friend</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's name"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-plus"
          />
          <div className="relative">
            <input
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="name@okicici or 9876543210@paytm"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-mono"
            />
            {upiId && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined ${valid ? 'text-secondary' : 'text-error'}`}>
                {valid ? 'check_circle' : 'error'}
              </span>
            )}
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional, for WhatsApp)"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-plus"
          />
          <button
            type="submit"
            disabled={saving || !valid}
            className="w-full py-4 bg-primary text-on-primary rounded-2xl font-plus font-black disabled:opacity-50"
          >
            Save Friend
          </button>
        </form>
      </div>
    </div>
  );
}

function FriendHistoryModal({ friendId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/friends/${friendId}/history`).then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [friendId]);

  if (!friendId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="glass-card w-full max-w-lg rounded-[2rem] p-8 border border-white/10 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : data ? (
          <>
            <h3 className="text-xl font-plus font-black text-white mb-2">Split history — {data.friend.name}</h3>
            <p className="text-sm text-on-surface-variant mb-4">
              {data.splitCount} splits · {formatRupee(data.totalExchanged)} total exchanged
            </p>
            <div className="space-y-2">
              {data.splits.map((s) => (
                <div key={s._id} className="flex justify-between py-2 border-b border-white/5 text-sm">
                  <span className="text-on-surface-variant">{s.description}</span>
                  <span className="font-space font-bold text-white">{formatRupee(s.friendShare)}</span>
                </div>
              ))}
              {data.splits.length === 0 && (
                <p className="text-on-surface-variant italic">No splits yet with this friend.</p>
              )}
            </div>
          </>
        ) : null}
        <button type="button" onClick={onClose} className="mt-6 w-full py-3 border border-white/10 rounded-xl font-plus font-bold text-white">
          Close
        </button>
      </div>
    </div>
  );
}

const SplitsTab = () => {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [splitData, setSplitData] = useState({ pending: [], settled: [], totalOwedToYou: 0, totalYouOwe: 0, peopleOweYou: 0 });
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [historyFriendId, setHistoryFriendId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [remindedIds, setRemindedIds] = useState({});

  const [form, setForm] = useState({
    friendId: '',
    description: '',
    totalAmount: '',
    splitType: 'equal',
    yourShare: '',
    friendShare: '',
    category: 'Other',
  });

  const load = useCallback(async () => {
    try {
      const [friendsRes, splitsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/splits'),
      ]);
      setFriends(friendsRes.data);
      setSplitData(splitsRes.data);
    } catch (err) {
      toast({ message: 'Failed to load splits', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = Number(form.totalAmount) || 0;
  const equalShare = total > 0 ? Math.round((total / 2) * 100) / 100 : 0;
  const displayYourShare = form.splitType === 'equal' ? total - equalShare : Number(form.yourShare) || 0;
  const displayFriendShare = form.splitType === 'equal' ? equalShare : Number(form.friendShare) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.friendId || !form.description || !total) return;
    setSubmitting(true);
    try {
      await api.post('/splits', {
        friendId: form.friendId,
        description: form.description,
        totalAmount: total,
        splitType: form.splitType,
        yourShare: displayYourShare,
        friendShare: displayFriendShare,
        category: form.category,
      });
      toast({ message: 'Split created', type: 'success' });
      setForm({ friendId: '', description: '', totalAmount: '', splitType: 'equal', yourShare: '', friendShare: '', category: 'Other' });
      load();
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to create split', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (split) => {
    const ok = window.confirm(`Mark ${formatRupee(split.friendShare)} from ${split.friendName} as settled?`);
    if (!ok) return;
    try {
      const res = await api.put(`/splits/${split._id}/settle`);
      toast({ message: 'Split settled', type: 'success' });
      if (res.data.upiPayLink) {
        const openPay = window.confirm('Open UPI to pay this friend now?');
        if (openPay) {
          const result = openUpiLink(res.data.upiPayLink);
          if (!result.opened) toast({ message: result.message, type: 'info' });
        }
      }
      load();
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to settle', type: 'error' });
    }
  };

  const handleRemind = async (split) => {
    try {
      const res = await api.post(`/splits/${split._id}/remind`);
      setRemindedIds((prev) => ({ ...prev, [split._id]: true }));
      window.open(res.data.whatsappLink, '_blank');
      toast({ message: 'Reminder sent via WhatsApp', type: 'success' });
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Could not send reminder', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this pending split?')) return;
    try {
      await api.delete(`/splits/${id}`);
      toast({ message: 'Split removed', type: 'success' });
      load();
    } catch (err) {
      toast({ message: err.response?.data?.message || 'Failed to delete', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Skeleton className="h-96 lg:col-span-4 rounded-[2.5rem]" />
        <Skeleton className="h-96 lg:col-span-8 rounded-[2.5rem]" />
      </div>
    );
  }

  const { pending, settled, totalOwedToYou, totalYouOwe, peopleOweYou } = splitData;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <AddFriendModal open={showAddFriend} onClose={() => setShowAddFriend(false)} onSaved={(f) => { setFriends((prev) => [...prev, f]); setForm((p) => ({ ...p, friendId: f._id })); }} />
      <FriendHistoryModal friendId={historyFriendId} onClose={() => setHistoryFriendId(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-headline-sm font-plus font-black text-on-surface">Split an Expense</h3>
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Friend</label>
                <select
                  value={form.friendId}
                  onChange={(e) => {
                    if (e.target.value === '__add__') setShowAddFriend(true);
                    else setForm({ ...form, friendId: e.target.value });
                  }}
                  required
                  className="w-full mt-2 bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 text-on-surface font-plus"
                >
                  <option value="">Select a friend</option>
                  {friends.map((f) => (
                    <option key={f._id} value={f._id}>{f.name} ({f.upiId})</option>
                  ))}
                  <option value="__add__">+ Add New Friend</option>
                </select>
              </div>

              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Dinner at CCD"
                className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3 text-on-surface font-plus"
              />

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline font-space font-bold">₹</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  required
                  value={form.totalAmount}
                  onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-on-surface font-space font-bold"
                />
              </div>

              <div className="flex gap-2">
                {['equal', 'custom'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, splitType: t })}
                    className={`flex-1 py-2 rounded-xl font-plus font-bold text-sm capitalize ${form.splitType === t ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-on-surface-variant'}`}
                  >
                    {t === 'equal' ? 'Equal Split' : 'Custom Split'}
                  </button>
                ))}
              </div>

              {form.splitType === 'equal' ? (
                <p className="text-sm text-on-surface-variant font-plus">
                  Your share: {formatRupee(displayYourShare)} · Friend&apos;s share: {formatRupee(displayFriendShare)}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Your share"
                    value={form.yourShare}
                    onChange={(e) => setForm({ ...form, yourShare: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-space"
                  />
                  <input
                    type="number"
                    placeholder="Friend's share"
                    value={form.friendShare}
                    onChange={(e) => setForm({ ...form, friendShare: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white font-space"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {SPLIT_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={`px-3 py-1.5 rounded-full text-xs font-plus font-bold ${form.category === c ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'bg-white/5 text-on-surface-variant'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={submitting || friends.length === 0}
                className="w-full py-4 bg-primary text-on-primary rounded-2xl font-plus font-black disabled:opacity-50"
              >
                Create Split Request
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-6 rounded-2xl border border-secondary/20">
              <p className="text-[10px] font-plus font-black text-secondary uppercase tracking-widest">Owed to you</p>
              <p className="text-2xl font-space font-black text-secondary mt-1">{formatRupee(totalOwedToYou)}</p>
              <p className="text-xs text-on-surface-variant mt-1">{peopleOweYou} {peopleOweYou === 1 ? 'person owes' : 'people owe'} you</p>
            </div>
            <div className="glass-card p-6 rounded-2xl border border-error/20">
              <p className="text-[10px] font-plus font-black text-error uppercase tracking-widest">You owe</p>
              <p className="text-2xl font-space font-black text-error mt-1">{formatRupee(totalYouOwe)}</p>
            </div>
          </div>

          <div>
            <h4 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs opacity-50 mb-4 px-2">Pending</h4>
            {pending.length === 0 ? (
              <div className="glass-card p-10 text-center rounded-[2rem] border border-dashed border-white/10">
                <p className="font-plus text-on-surface-variant">No pending splits. All settled up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((split) => (
                  <div key={split._id} className="glass-card p-5 rounded-[1.5rem] border border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center font-plus font-black text-primary shrink-0">
                        {split.friendName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-plus font-extrabold text-on-surface truncate">{split.friendName}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase">{split.description}</p>
                        <button type="button" onClick={() => setHistoryFriendId(split.friendId)} className="text-[10px] text-primary font-plus font-bold mt-1">History</button>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <p className="font-space font-black text-lg">{formatRupee(split.friendShare)}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleRemind(split)} disabled={remindedIds[split._id]} className="text-[10px] font-plus font-black text-on-surface-variant uppercase px-2 py-1 border border-white/10 rounded-lg">
                          {remindedIds[split._id] ? 'Reminded' : 'Remind'}
                        </button>
                        <button type="button" onClick={() => handleSettle(split)} className="text-[10px] font-plus font-black text-secondary uppercase px-3 py-1 border border-secondary/30 rounded-lg">Settle</button>
                        <button type="button" onClick={() => handleDelete(split._id)} className="text-[10px] text-error font-plus">Del</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs opacity-50 mb-4 px-2">Recently Settled</h4>
            {settled.length === 0 ? (
              <p className="text-on-surface-variant font-plus italic px-2">No settlement history yet.</p>
            ) : (
              <div className="glass-card rounded-[2rem] border border-white/5 divide-y divide-white/5">
                {settled.map((split) => (
                  <div key={split._id} className="p-4 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-plus font-bold text-outline text-xs">
                        {split.friendName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-plus text-on-surface">{split.friendName}</span>
                        <span className="text-on-surface-variant text-xs ml-2">{split.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-sm filled">check_circle</span>
                      <span className="font-space font-bold">{formatRupee(split.friendShare)}</span>
                      {split.settledAt && (
                        <span className="text-[10px] text-on-surface-variant">
                          {new Date(split.settledAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplitsTab;
