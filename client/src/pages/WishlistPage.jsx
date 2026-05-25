import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';
import { toast } from '../utils/toastBus';
import { Skeleton } from '../components/ui/Skeleton';

const PLATFORM_COLORS = {
  Amazon: 'bg-amber-500/20 text-amber-400',
  Flipkart: 'bg-blue-500/20 text-blue-400',
  Myntra: 'bg-pink-500/20 text-pink-400',
  Meesho: 'bg-purple-500/20 text-purple-400',
  Nykaa: 'bg-rose-500/20 text-rose-400',
  Ajio: 'bg-indigo-500/20 text-indigo-400',
  Other: 'bg-white/10 text-on-surface-variant',
};

export default function WishlistPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [jars, setJars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ name: '', targetPrice: '', currentPrice: '', category: 'Tech', linkedJarId: '' });

  const load = useCallback(async () => {
    try {
      const [wRes, jRes] = await Promise.all([api.get('/wishlist'), api.get('/jars')]);
      setItems(wRes.data.items || []);
      setDailyLimit(wRes.data.dailyLimit || 0);
      setJars(jRes.data || []);
    } catch {
      toast({ message: 'Failed to load wishlist', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lastUpdated = items[0]?.lastChecked ? new Date(items[0].lastChecked) : null;

  const runPreview = async () => {
    setChecking(true);
    try {
      const res = await api.post('/wishlist/preview', { productUrl: url });
      setPreview(res.data);
      setForm({
        name: res.data.name || '',
        targetPrice: '',
        currentPrice: res.data.currentPrice != null ? String(res.data.currentPrice) : '',
        category: 'Tech',
        linkedJarId: '',
      });
      setStep(2);
    } catch {
      toast({ message: 'Could not preview URL — enter details manually', type: 'warning' });
      setPreview({ name: '', currentPrice: null });
      setStep(2);
    } finally {
      setChecking(false);
    }
  };

  const addItem = async () => {
    try {
      await api.post('/wishlist', {
        productUrl: url,
        name: form.name,
        targetPrice: Number(form.targetPrice),
        currentPrice: form.currentPrice ? Number(form.currentPrice) : undefined,
        category: form.category,
        linkedJarId: form.linkedJarId || undefined,
      });
      toast({ message: 'Added to wishlist', type: 'success' });
      setAddOpen(false);
      setStep(1);
      setUrl('');
      load();
    } catch (e) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const refreshPrices = async () => {
    setChecking(true);
    try {
      for (const item of items) {
        await api.post(`/wishlist/${item._id}/check-one`);
      }
      toast({ message: 'Prices updated', type: 'success' });
      load();
    } catch {
      toast({ message: 'Refresh failed', type: 'error' });
    } finally {
      setChecking(false);
    }
  };

  const budgetDays = form.currentPrice && dailyLimit > 0 ? (Number(form.currentPrice) / dailyLimit).toFixed(1) : null;

  if (loading) return <div className="min-h-screen bg-surface p-8"><Skeleton className="h-64 w-full rounded-3xl" /></div>;

  return (
    <div className="min-h-screen bg-surface p-6 page-enter">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-wrap justify-between gap-4 mb-6">
          <div>
            <button type="button" onClick={() => navigate('/dashboard')} className="text-on-surface-variant font-plus text-sm mb-2">← Back</button>
            <h1 className="text-3xl font-plus font-black text-white">My Wishlist</h1>
            <p className="text-on-surface-variant font-plus text-sm mt-1">Track prices and get notified when you can afford it</p>
          </div>
          <button type="button" onClick={() => { setAddOpen(true); setStep(1); }} className="px-6 py-3 bg-primary text-on-primary rounded-2xl font-plus font-black">Add Item</button>
        </header>

        <div className="glass-card rounded-2xl px-4 py-3 mb-6 flex items-center justify-between border border-white/10">
          <span className="text-xs text-on-surface-variant font-plus">
            {lastUpdated ? `Prices last updated ${Math.round((Date.now() - lastUpdated) / 60000)} min ago` : 'Prices not checked yet'}
          </span>
          <button type="button" onClick={refreshPrices} disabled={checking} className="material-symbols-outlined text-primary">refresh</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item._id} className="glass-card rounded-2xl p-4 border border-white/10">
              <div className="flex gap-4">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-white/5" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-2xl">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <span className={`text-[10px] font-plus font-black px-2 py-0.5 rounded-full ${PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.Other}`}>{item.platform || 'Other'}</span>
                  <p className="font-plus font-bold text-white line-clamp-2 mt-1">{item.name}</p>
                  <p className={`font-space font-black text-xl mt-1 ${item.atTarget ? 'text-secondary' : 'text-white'}`}>
                    {item.currentPrice != null ? formatRupee(item.currentPrice) : '—'}
                  </p>
                  <p className="text-xs text-on-surface-variant">Target: {formatRupee(item.targetPrice)}</p>
                  {item.dropPercent > 0 && <p className="text-xs text-secondary">↓ {item.dropPercent}% from {formatRupee(item.originalPrice)}</p>}
                  {item.affordable && <span className="inline-block mt-1 text-[10px] font-plus font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">Affordable today</span>}
                  {!item.affordable && item.daysOfDailyLimit && <span className="inline-block mt-1 text-[10px] font-plus font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">Need {item.daysOfDailyLimit} days of daily limit</span>}
                  {item.linkedJar && <p className="text-[10px] text-primary mt-1">Jar: {item.linkedJar.name} ({item.linkedJar.percent}%)</p>}
                  {!item.inStock && <p className="text-[10px] text-amber-400 mt-1">Out of stock</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <a href={item.productUrl} target="_blank" rel="noreferrer" className="flex-1 text-center py-2 bg-primary/20 text-primary rounded-xl font-plus font-bold text-sm">Buy Now</a>
                <button type="button" onClick={() => api.post(`/wishlist/${item._id}/ai-insights`).then((r) => toast({ message: r.data.buyTip || 'No tip', type: 'info', duration: 5000 }))} className="px-3 py-2 border border-white/10 rounded-xl text-xs font-plus text-white">AI tip</button>
                <button type="button" onClick={() => api.delete(`/wishlist/${item._id}`).then(load)} className="px-3 py-2 text-error text-xs font-plus">Remove</button>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="glass-card p-16 text-center rounded-3xl border border-dashed border-white/10">
            <span className="material-symbols-outlined text-6xl text-primary/30 mb-4">star</span>
            <p className="font-plus text-on-surface-variant">Your wishlist is empty</p>
            <p className="text-sm mt-2">Add items from Amazon, Flipkart, Myntra and more</p>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAddOpen(false)}>
          <div className="glass-card max-w-lg w-full p-8 rounded-3xl border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {step === 1 && (
              <>
                <h3 className="font-plus font-black text-white mb-4">Paste product URL</h3>
                <input className="w-full mb-4 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-plus" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
                <button type="button" onClick={runPreview} disabled={checking || !url.startsWith('http')} className="w-full py-3 bg-primary text-on-primary rounded-xl font-plus font-black disabled:opacity-50">{checking ? 'Loading...' : 'Preview'}</button>
              </>
            )}
            {step >= 2 && (
              <>
                <h3 className="font-plus font-black text-white mb-4">Confirm details</h3>
                {preview?.imageUrl && <img src={preview.imageUrl} alt="" className="w-full h-32 object-contain rounded-xl mb-3 bg-white/5" />}
                <input className="w-full mb-3 bg-white/5 rounded-xl px-4 py-3 text-white" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input type="number" className="w-full mb-3 bg-white/5 rounded-xl px-4 py-3 text-white font-space" placeholder="Current price" value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} />
                <input type="number" className="w-full mb-2 bg-white/5 rounded-xl px-4 py-3 text-white font-space" placeholder="Target price" value={form.targetPrice} onChange={(e) => setForm({ ...form, targetPrice: e.target.value })} />
                {budgetDays && (
                  <p className={`text-xs font-plus mb-3 ${Number(budgetDays) > 7 ? 'text-error' : Number(budgetDays) > 3 ? 'text-amber-400' : 'text-secondary'}`}>
                    Buying this would use {budgetDays} days of your daily limit (₹{dailyLimit}/day)
                  </p>
                )}
                <select className="w-full mb-3 bg-white/5 text-white rounded-xl p-3" value={form.linkedJarId} onChange={(e) => setForm({ ...form, linkedJarId: e.target.value })}>
                  <option value="">Link to savings jar (optional)</option>
                  {jars.filter((j) => j.status === 'active').map((j) => <option key={j._id} value={j._id}>{j.name}</option>)}
                </select>
                <button type="button" onClick={addItem} className="w-full py-3 bg-primary text-on-primary rounded-xl font-plus font-black">Add to Wishlist</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
