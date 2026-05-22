import { useState, useEffect } from 'react';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

const RecurringExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ description: '', amount: '', category: 'Other', frequency: 'monthly', nextDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/recurring');
      setExpenses(res.data);
    } catch (err) {
      console.error('Failed to fetch recurring expenses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.nextDate) return;
    
    setSubmitting(true);
    try {
      await api.post('/recurring', {
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        frequency: form.frequency,
        nextDate: form.nextDate
      });
      setForm({ description: '', amount: '', category: 'Other', frequency: 'monthly', nextDate: '' });
      fetchExpenses();
    } catch (err) {
      console.error('Failed to create recurring expense', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/recurring/${id}`);
      fetchExpenses();
    } catch (err) {
      console.error('Failed to delete recurring expense', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <span className="material-symbols-outlined text-6xl text-primary/20 mb-4 filled">event_repeat</span>
        <p className="text-on-surface-variant font-plus italic">Loading your subscriptions...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Create Form */}
      <div className="glass-card p-8 w-full xl:w-[400px] h-fit rounded-[2.5rem] border border-white/10 glow-primary">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl filled">add_circle</span>
          </div>
          <h3 className="text-headline-sm font-plus font-black text-on-surface">Add Recurring</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">What is it for?</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({...form, description: e.target.value})}
              className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus"
              placeholder="e.g. Netflix Subscription"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline font-space font-bold">₹</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl pl-8 pr-4 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-space font-bold"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({...form, category: e.target.value})}
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({...form, frequency: e.target.value})}
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-4 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Next Payment</label>
              <input
                type="date"
                value={form.nextDate}
                onChange={(e) => setForm({...form, nextDate: e.target.value})}
                className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-3.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus text-xs"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-5 bg-primary text-on-primary rounded-2xl font-plus font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-3"
          >
            {submitting ? 'Creating...' : <><span className="material-symbols-outlined filled">add_task</span> Create Subscription</>}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between px-4 mb-2">
           <h4 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs opacity-50">Active Subscriptions</h4>
           <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-black tracking-widest">{expenses.length} TOTAL</span>
        </div>
        
        {expenses.length === 0 ? (
          <div className="glass-card p-20 flex flex-col items-center justify-center text-on-surface-variant rounded-[3rem] border border-dashed border-white/10">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-10">event_repeat</span>
            <p className="font-plus italic opacity-40">No recurring expenses set up yet.</p>
          </div>
        ) : (
          expenses.map(expense => (
            <div key={expense._id} className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between rounded-[2rem] border border-white/5 group hover:bg-white/[0.03] transition-all hover:scale-[1.01]">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shadow-lg shadow-secondary/5 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-3xl filled">calendar_today</span>
                </div>
                <div>
                  <h4 className="text-on-surface font-plus font-extrabold text-lg">{expense.description}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="bg-secondary/20 text-secondary px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest uppercase">{expense.frequency}</span>
                    <p className="text-on-surface-variant text-xs font-plus">Next due: <span className="font-space font-bold text-on-surface">{new Date(expense.nextDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8 mt-6 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <p className="text-on-surface font-space font-black text-2xl">{formatRupee(expense.amount)}</p>
                  <p className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest">{expense.category}</p>
                </div>
                <button 
                  onClick={() => handleDelete(expense._id)}
                  className="w-12 h-12 flex items-center justify-center text-outline hover:text-error hover:bg-error/10 rounded-2xl transition-all"
                  title="Remove"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default RecurringExpenses;
