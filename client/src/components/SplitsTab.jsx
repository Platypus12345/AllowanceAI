import { useState, useEffect } from 'react';
import api from '../api/axios';
import { formatRupee } from '../utils/formatters';

const SplitsTab = () => {
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ friendName: '', amount: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchSplits = async () => {
    try {
      const res = await api.get('/splits');
      setSplits(res.data);
    } catch (err) {
      console.error('Failed to fetch splits', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSplits();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.friendName || !form.amount || !form.description) return;
    
    setSubmitting(true);
    try {
      await api.post('/splits', {
        friendName: form.friendName,
        amount: Number(form.amount),
        description: form.description
      });
      setForm({ friendName: '', amount: '', description: '' });
      fetchSplits();
    } catch (err) {
      console.error('Failed to create split', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettle = async (id) => {
    try {
      await api.put(`/splits/${id}/settle`);
      fetchSplits();
    } catch (err) {
      console.error('Failed to settle split', err);
    }
  };

  const pendingSplits = splits.filter(s => s.status === 'pending');
  const settledSplits = splits.filter(s => s.status === 'settled');
  
  const totalPending = pendingSplits.reduce((acc, curr) => acc + curr.amount, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <span className="material-symbols-outlined text-6xl text-primary/20 mb-4 filled">groups</span>
        <p className="text-on-surface-variant font-plus italic">Loading your shared expenses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form and Total */}
        <div className="lg:col-span-4 space-y-8">
          {/* Total Pending Card */}
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/10 bg-secondary/5 glow-secondary relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-[4rem]" />
             <p className="text-[10px] font-plus font-black text-secondary uppercase tracking-widest mb-2 relative z-10">Pending Receivables</p>
             <p className="text-display-md font-space font-black text-on-surface relative z-10">{formatRupee(totalPending)}</p>
             <div className="flex items-center gap-2 mt-4 relative z-10">
               <span className="material-symbols-outlined text-secondary text-sm filled">schedule</span>
               <p className="text-xs font-plus font-bold text-on-surface-variant">{pendingSplits.length} people owe you</p>
             </div>
          </div>

          {/* New Split Form */}
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/10">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-primary filled">person_add</span>
              <h3 className="text-headline-sm font-plus font-black text-on-surface">New Split</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Friend's Name</label>
                <input
                  type="text"
                  value={form.friendName}
                  onChange={(e) => setForm({...form, friendName: e.target.value})}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus"
                  placeholder="e.g. Rahul"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-plus font-black text-on-surface-variant uppercase tracking-widest ml-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-plus"
                  placeholder="e.g. Dinner at CCD"
                  required
                />
              </div>

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

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-primary text-on-primary rounded-2xl font-plus font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Lists */}
        <div className="lg:col-span-8 space-y-8">
          {/* Pending List */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-4">
                <h4 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs opacity-50">Active Splits</h4>
                <span className="bg-secondary/20 text-secondary px-3 py-1 rounded-full text-[10px] font-black tracking-widest">PENDING</span>
             </div>
             
             {pendingSplits.length === 0 ? (
                <div className="glass-card p-12 text-center text-on-surface-variant rounded-[2.5rem] border border-dashed border-white/10">
                   <p className="font-plus italic opacity-40">No pending splits right now.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {pendingSplits.map(split => (
                      <div key={split._id} className="glass-card p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group hover:bg-white/[0.02] transition-all">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center font-plus font-black text-primary shadow-lg shadow-primary/5">
                               {split.friendName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                               <p className="text-on-surface font-plus font-extrabold">{split.friendName}</p>
                               <p className="text-on-surface-variant text-[10px] uppercase font-plus font-bold tracking-wider">{split.description}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-on-surface font-space font-black text-lg">{formatRupee(split.amount)}</p>
                            <button 
                               onClick={() => handleSettle(split._id)}
                               className="mt-2 text-[10px] font-plus font-black text-secondary uppercase tracking-widest hover:bg-secondary/10 px-3 py-1.5 rounded-lg border border-secondary/20 transition-all"
                            >
                               Settle
                            </button>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>

          {/* Settled List */}
          {settledSplits.length > 0 && (
            <div className="space-y-4 opacity-60">
               <div className="flex items-center justify-between px-4">
                  <h4 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs opacity-50">Recently Settled</h4>
               </div>
               <div className="glass-card rounded-[2.5rem] border border-white/5 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {settledSplits.map(split => (
                      <div key={split._id} className="p-4 px-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-plus font-bold text-outline text-xs">
                            {split.friendName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-on-surface-variant text-sm font-plus font-medium">{split.friendName} • <span className="opacity-50">{split.description}</span></span>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="material-symbols-outlined text-secondary text-sm filled">check_circle</span>
                           <span className="text-on-surface font-space font-bold">{formatRupee(split.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitsTab;
