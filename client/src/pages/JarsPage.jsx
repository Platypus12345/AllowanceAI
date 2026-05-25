import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';
import { toast } from '../utils/toastBus';
import { Skeleton } from '../components/ui/Skeleton';

const CATEGORIES = ['Travel', 'Tech', 'Health', 'Emergency', 'Fun', 'Other'];
const COLORS = ['#8083ff', '#44e2cd', '#fbbf24', '#fb7185', '#a78bfa', '#34d399'];
const EMOJIS = ['🎯', '✈️', '💻', '🏥', '🚨', '🎉', '📦', '🏖️', '🎧', '👟', '📱', '🎮', '💰', '🛍️', '🍕', '☕', '🚗', '🏠', '💡', '🌟'];

export default function JarsPage() {
  const navigate = useNavigate();
  const [jars, setJars] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', targetAmount: '', category: 'Fun', icon: '🎯', color: '#8083ff', autoContributeEnabled: false, autoContributeAmount: '' });
  const [contrib, setContrib] = useState({ jarId: null, amount: '', note: '' });
  const [transfer, setTransfer] = useState({ fromId: '', toId: '', amount: '' });
  const [historyJar, setHistoryJar] = useState(null);

  const load = useCallback(async () => {
    try {
      const [jRes, sRes] = await Promise.all([api.get('/jars'), api.get('/budget/stats')]);
      setJars(jRes.data);
      setStats(sRes.data);
    } catch {
      toast({ message: 'Failed to load jars', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalSaved = jars.reduce((s, j) => s + (j.currentAmount || 0), 0);
  const active = jars.filter((j) => j.status === 'active' || j.status === 'paused');
  const completed = jars.filter((j) => j.status === 'completed');
  const dailyLimit = stats?.dailyLimit || 0;

  const saveJar = async () => {
    try {
      if (modal?.id) {
        await api.put(`/jars/${modal.id}`, { ...form, targetAmount: Number(form.targetAmount), autoContributeAmount: Number(form.autoContributeAmount) || 0 });
        toast({ message: 'Jar updated', type: 'success' });
      } else {
        await api.post('/jars', { ...form, targetAmount: Number(form.targetAmount), autoContributeAmount: Number(form.autoContributeAmount) || 0 });
        toast({ message: 'Jar created', type: 'success' });
      }
      setModal(null);
      load();
    } catch (e) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const addMoney = async () => {
    try {
      const res = await api.post(`/jars/${contrib.jarId}/contribute`, { amount: Number(contrib.amount), note: contrib.note });
      if (res.data.justCompleted) toast({ message: 'Goal reached! +50 XP', type: 'success' });
      else toast({ message: 'Added to jar', type: 'success' });
      setContrib({ jarId: null, amount: '', note: '' });
      load();
    } catch (e) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const doTransfer = async () => {
    try {
      await api.post(`/jars/${transfer.fromId}/transfer`, { toJarId: transfer.toId, amount: Number(transfer.amount) });
      toast({ message: 'Transfer complete', type: 'success' });
      setTransfer({ fromId: '', toId: '', amount: '' });
      load();
    } catch (e) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const shareJar = (jar) => {
    const text = `I'm saving for ${jar.name} on AllowanceAI — ${jar.percent}% done (${formatRupee(jar.currentAmount)} / ${formatRupee(jar.targetAmount)})`;
    if (navigator.share) navigator.share({ title: jar.name, text });
    else navigator.clipboard.writeText(text);
    toast({ message: 'Copied share text', type: 'success' });
  };

  if (loading) return <div className="min-h-screen bg-surface p-8"><Skeleton className="h-64 w-full rounded-3xl" /></div>;

  return (
    <div className="min-h-screen bg-surface p-6 page-enter">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <button type="button" onClick={() => navigate('/dashboard')} className="text-on-surface-variant font-plus text-sm mb-2">← Back</button>
            <h1 className="text-3xl font-plus font-black text-white">My Savings Jars</h1>
            <p className="text-secondary font-plus mt-1">{formatRupee(totalSaved)} saved across {active.length} jars</p>
          </div>
          <button type="button" onClick={() => { setForm({ name: '', targetAmount: '', category: 'Fun', icon: '🎯', color: '#8083ff', autoContributeEnabled: false, autoContributeAmount: '' }); setModal({}); }} className="px-6 py-3 bg-primary text-on-primary rounded-2xl font-plus font-black">New Jar</button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {active.map((jar) => (
            <div key={jar._id} className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex justify-between items-start mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${jar.color}22` }}>{jar.icon}</div>
                <span className="text-[10px] font-plus font-black uppercase tracking-widest text-on-surface-variant">{jar.status}</span>
              </div>
              <h3 className="font-plus font-black text-white text-lg">{jar.name}</h3>
              <p className="font-space font-bold text-white mt-1">{formatRupee(jar.currentAmount)} <span className="text-on-surface-variant font-normal">/ {formatRupee(jar.targetAmount)}</span></p>
              <p className="text-secondary text-sm font-plus">{jar.percent}%</p>
              <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${jar.percent}%`, backgroundColor: jar.color }} />
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                {jar.percent >= 100 ? 'Goal reached!' : jar.daysToGoal ? `~${jar.daysToGoal} days at current pace` : 'Add contributions to estimate timeline'}
              </p>
              {jar.autoContributeEnabled && <span className="inline-block mt-2 text-[10px] font-plus font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-full">Auto ₹{jar.autoContributeAmount}/day</span>}
              <div className="flex flex-wrap gap-2 mt-4">
                <button type="button" onClick={() => setContrib({ jarId: jar._id, amount: '', note: '' })} className="text-xs font-plus font-black text-primary">Add Money</button>
                <button type="button" onClick={() => setHistoryJar(jar._id)} className="text-xs font-plus font-black text-on-surface-variant">History</button>
                <button type="button" onClick={() => shareJar(jar)} className="text-xs font-plus font-black text-on-surface-variant">Share</button>
                <button type="button" onClick={() => { setForm({ ...jar, targetAmount: jar.targetAmount }); setModal({ id: jar._id }); }} className="text-xs font-plus font-black text-on-surface-variant">Edit</button>
                {jar.status === 'active' && <button type="button" onClick={() => api.put(`/jars/${jar._id}`, { status: 'paused' }).then(load)} className="text-xs font-plus font-black text-amber-400">Pause</button>}
                <button type="button" onClick={() => setTransfer({ fromId: jar._id, toId: '', amount: '' })} className="text-xs font-plus font-black text-on-surface-variant">Transfer</button>
              </div>
            </div>
          ))}
        </div>

        {active.length === 0 && (
          <div className="glass-card p-16 text-center rounded-3xl border border-dashed border-white/10 mb-10">
            <span className="material-symbols-outlined text-6xl text-primary/30 mb-4">savings</span>
            <p className="font-plus text-on-surface-variant">No savings jars yet</p>
            <p className="text-sm text-on-surface-variant mt-2">Create your first goal to start saving</p>
          </div>
        )}

        {completed.length > 0 && (
          <>
            <h2 className="font-plus font-black text-amber-400 uppercase tracking-widest text-xs mb-4">Completed Goals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completed.map((jar) => (
                <div key={jar._id} className="glass-card p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                  <p className="font-plus font-bold text-white">{jar.icon} {jar.name}</p>
                  <p className="text-xs text-on-surface-variant">{jar.completedAt ? new Date(jar.completedAt).toLocaleDateString() : 'Complete'}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setModal(null)}>
          <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-plus font-black text-white mb-4">{modal.id ? 'Edit Jar' : 'Create Jar'}</h3>
            <input className="w-full mb-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-plus" placeholder="e.g. Trip to Goa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="number" className="w-full mb-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-space" placeholder="Target ₹" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
            {form.targetAmount && dailyLimit > 0 && (
              <p className={`text-xs font-plus mb-3 ${Number(form.targetAmount) / dailyLimit > 7 ? 'text-error' : Number(form.targetAmount) / dailyLimit > 3 ? 'text-amber-400' : 'text-secondary'}`}>
                This is {(Number(form.targetAmount) / dailyLimit).toFixed(1)} days of your daily limit (₹{dailyLimit}/day)
              </p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">{CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setForm({ ...form, category: c })} className={`px-3 py-1 rounded-full text-xs font-plus font-bold ${form.category === c ? 'bg-primary/20 text-primary' : 'bg-white/5 text-on-surface-variant'}`}>{c}</button>)}</div>
            <div className="flex flex-wrap gap-2 mb-3">{EMOJIS.slice(0, 12).map((e) => <button key={e} type="button" onClick={() => setForm({ ...form, icon: e })} className={`text-xl p-2 rounded-lg ${form.icon === e ? 'ring-2 ring-primary' : ''}`}>{e}</button>)}</div>
            <div className="flex gap-2 mb-4">{COLORS.map((c) => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent' }} />)}</div>
            <label className="flex items-center gap-2 text-sm text-on-surface-variant font-plus mb-2">
              <input type="checkbox" checked={form.autoContributeEnabled} onChange={(e) => setForm({ ...form, autoContributeEnabled: e.target.checked })} />
              Auto-contribute when under daily limit
            </label>
            {form.autoContributeEnabled && <input type="number" className="w-full mb-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="₹ per day" value={form.autoContributeAmount} onChange={(e) => setForm({ ...form, autoContributeAmount: e.target.value })} />}
            <button type="button" onClick={saveJar} className="w-full py-3 bg-primary text-on-primary rounded-xl font-plus font-black">{modal.id ? 'Save Changes' : 'Create Jar'}</button>
          </div>
        </div>
      )}

      {contrib.jarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setContrib({ jarId: null, amount: '', note: '' })}>
          <div className="glass-card max-w-sm w-full p-8 rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-plus font-black text-white mb-4">Add to jar</h3>
            <input type="number" className="w-full mb-3 bg-white/5 rounded-xl px-4 py-3 text-white font-space" value={contrib.amount} onChange={(e) => setContrib({ ...contrib, amount: e.target.value })} />
            <div className="flex gap-2 mb-3">{[50, 100, 200, 500].map((a) => <button key={a} type="button" onClick={() => setContrib({ ...contrib, amount: String(a) })} className="flex-1 py-2 bg-white/5 rounded-lg text-sm font-space text-white">₹{a}</button>)}</div>
            {stats && stats.dailyLimit > (stats.spentToday || 0) && (
              <button type="button" onClick={() => setContrib({ ...contrib, amount: String(Math.round(stats.dailyLimit - stats.spentToday)) })} className="w-full mb-3 text-xs font-plus font-bold text-secondary">Add all surplus today</button>
            )}
            <input className="w-full mb-4 bg-white/5 rounded-xl px-4 py-3 text-white font-plus" placeholder="Note (optional)" value={contrib.note} onChange={(e) => setContrib({ ...contrib, note: e.target.value })} />
            <button type="button" onClick={addMoney} className="w-full py-3 bg-primary text-on-primary rounded-xl font-plus font-black">Add to Jar</button>
          </div>
        </div>
      )}

      {transfer.fromId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setTransfer({ fromId: '', toId: '', amount: '' })}>
          <div className="glass-card max-w-sm w-full p-8 rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-plus font-black text-white mb-4">Transfer between jars</h3>
            <select className="w-full mb-3 bg-white/5 text-white rounded-xl p-3" value={transfer.toId} onChange={(e) => setTransfer({ ...transfer, toId: e.target.value })}>
              <option value="">Destination jar</option>
              {jars.filter((j) => j._id !== transfer.fromId && j.status !== 'completed').map((j) => <option key={j._id} value={j._id}>{j.name}</option>)}
            </select>
            <input type="number" className="w-full mb-4 bg-white/5 rounded-xl px-4 py-3 text-white" value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value })} />
            <button type="button" onClick={doTransfer} className="w-full py-3 bg-secondary text-white rounded-xl font-plus font-black">Transfer</button>
          </div>
        </div>
      )}

      {historyJar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setHistoryJar(null)}>
          <div className="glass-card max-w-md w-full p-8 rounded-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <HistoryPanel jarId={historyJar} onClose={() => setHistoryJar(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ jarId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/jars/${jarId}`).then((r) => setData(r.data)).catch(() => {});
  }, [jarId]);
  if (!data) return <p className="text-on-surface-variant">Loading...</p>;
  return (
    <>
      <h3 className="font-plus font-black text-white mb-2">{data.jar?.name} — contribution history</h3>
      <p className="text-sm text-on-surface-variant mb-4">{data.splitCount} entries · {formatRupee(data.totalExchanged)} total</p>
      {(data.contributions || []).slice().reverse().map((c, i) => (
        <div key={i} className="flex justify-between py-2 border-b border-white/5 text-sm">
          <span className="text-on-surface-variant">{c.note} · {new Date(c.date).toLocaleDateString()}</span>
          <span className={`font-space ${c.amount < 0 ? 'text-error' : 'text-secondary'}`}>{formatRupee(c.amount)}</span>
        </div>
      ))}
      <button type="button" onClick={onClose} className="mt-4 w-full py-2 border border-white/10 rounded-xl text-white font-plus">Close</button>
    </>
  );
}
