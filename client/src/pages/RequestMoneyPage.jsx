import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const quickAmounts = [200, 500, 1000, 2000];
const quickReasons = ["Mess Food", "Chai", "Printouts", "Auto Rickshaw", "Medical", "Books"];

const RequestMoneyPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('parents');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [selectedParent, setSelectedParent] = useState(0);
  const [method, setMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendParent = async () => {
    if (!amount || !reason) return;
    setSending(true);
    try {
      const parentPhone = "919876543210";
      await api.post('/allowance-requests', { amount: Number(amount), reason, parentPhone });
      
      const message = encodeURIComponent(`Hi, I need ₹${amount} for ${reason}. - via AllowanceAI`);
      window.open(`https://wa.me/${parentPhone}?text=${message}`, '_blank');
      
      alert('Request sent successfully!');
      navigate(-1);
    } catch (error) {
      console.error(error);
      alert('Failed to send request.');
    } finally {
      setSending(false);
    }
  };

  const handleSendFriend = async () => {
    if (!amount || !reason) return;
    if (method === 'upi') {
      if (!upiId.includes('@')) {
        alert('Please enter a valid UPI ID');
        return;
      }
      await api.post('/splits/request', { amount: Number(amount), reason, method: 'upi' });
      const url = `upi://collect?pa=${upiId}&pn=Friend&am=${amount}&tn=${encodeURIComponent(reason + ' via AllowanceAI')}`;
      window.location.href = url;
    } else {
      await api.post('/splits/request', { amount: Number(amount), reason, method: 'whatsapp' });
      const message = encodeURIComponent(`Hey! You owe me ₹${amount} for ${reason}. Please send it when you can 🙏 — via AllowanceAI`);
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }

    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-surface p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <h1 className="text-headline-md font-plus font-black text-white">Request Money</h1>
        </header>

        {/* Tab Selector */}
        <div className="flex bg-white/5 rounded-3xl p-1.5 mb-10">
          <button 
            onClick={() => setTab('parents')}
            className={`flex-1 h-12 rounded-2xl font-plus font-black text-sm transition-all ${tab === 'parents' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
          >
            From Parents 👨👩👦
          </button>
          <button 
            onClick={() => setTab('friends')}
            className={`flex-1 h-12 rounded-2xl font-plus font-black text-sm transition-all ${tab === 'friends' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:text-white'}`}
          >
            From Friends 💸
          </button>
        </div>

        {/* Amount Input Card */}
        <div className="glass-card p-10 rounded-[3rem] flex flex-col items-center mb-10 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
          <span className="text-[10px] font-plus font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Enter Amount</span>
          <div className="flex items-baseline gap-4 mb-8">
            <span className="text-4xl font-plus font-black text-white/40">₹</span>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-48 bg-transparent text-display-lg font-space font-bold text-white text-center outline-none"
            />
          </div>
          <div className="w-full h-px bg-white/5 mb-8" />
          <div className="grid grid-cols-4 gap-4 w-full">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setAmount(amt.toString())}
                className={`h-12 rounded-2xl font-space font-bold transition-all border ${amount === amt.toString() ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-transparent text-on-surface-variant hover:bg-white/10'}`}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        {tab === 'parents' ? (
          <div className="space-y-10">
            <section>
              <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Send Request To</h2>
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                {['Mom', 'Dad', 'Guardian'].map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedParent(idx)}
                    className={`flex flex-col items-center gap-3 transition-all ${selectedParent === idx ? 'scale-110' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  >
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-plus font-black text-white border-2 ${selectedParent === idx ? 'border-secondary bg-secondary/10 shadow-[0_0_15px_rgba(68,226,205,0.4)]' : 'border-white/10 bg-white/5'}`}>
                      {name[0]}
                    </div>
                    <span className="text-xs font-plus font-bold text-white">{name}</span>
                  </button>
                ))}
                <button className="flex flex-col items-center gap-3 opacity-40 hover:opacity-100">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">add</span>
                  </div>
                  <span className="text-xs font-plus font-bold text-white">Add</span>
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Reason</h2>
              <div className="glass-card rounded-[2rem] p-6 mb-4 border border-white/5">
                <textarea
                  placeholder="e.g., Hostel fees, Mess bill..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-transparent h-24 outline-none text-white font-plus resize-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {quickReasons.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-on-surface-variant text-xs font-plus font-bold hover:bg-white/10 hover:text-white transition-all"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>

            <div className="glass-card rounded-3xl p-6 border-l-4 border-l-tertiary bg-tertiary/5 flex gap-4">
              <span className="material-symbols-outlined text-tertiary filled">auto_awesome</span>
              <p className="text-sm text-on-surface leading-relaxed font-plus">
                Requests for 'Mess Food' have a 92% approval rate from Dad. Smart choice!
              </p>
            </div>

            <button
              onClick={handleSendParent}
              disabled={sending}
              className="w-full h-16 bg-gradient-to-r from-indigo-500 to-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-[1.5rem] text-white font-plus font-black text-lg shadow-xl shadow-indigo-500/20 flex items-center justify-center"
            >
              {sending ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Send Request via WhatsApp"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Who owes you?</h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {[
                  { name: 'Rahul', amount: 450 },
                  { name: 'Sneha', amount: 120 },
                  { name: 'Amit', amount: 300 }
                ].map((friend, idx) => (
                  <div key={idx} className="glass-card min-w-[140px] p-6 rounded-[2rem] flex flex-col items-center border border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-plus font-black text-white mb-4">
                      {friend.name[0]}
                    </div>
                    <span className="text-white font-plus font-bold mb-1">{friend.name}</span>
                    <span className="text-secondary font-space font-bold">₹{friend.amount}</span>
                    <span className="text-[8px] font-plus font-black uppercase tracking-widest text-tertiary mt-2">Unsettled</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={() => setMethod('upi')}
                  className={`flex-1 h-12 rounded-2xl font-plus font-black text-xs transition-all ${method === 'upi' ? 'bg-white/10 border border-white/20 text-white' : 'text-on-surface-variant hover:text-white'}`}
                >
                  Via UPI ID 📱
                </button>
                <button 
                  onClick={() => setMethod('whatsapp')}
                  className={`flex-1 h-12 rounded-2xl font-plus font-black text-xs transition-all ${method === 'whatsapp' ? 'bg-white/10 border border-white/20 text-white' : 'text-on-surface-variant hover:text-white'}`}
                >
                  Via WhatsApp 💬
                </button>
              </div>

              {method === 'upi' ? (
                <div className="glass-card p-2 rounded-[2rem] border border-white/5 flex items-center pr-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter UPI ID (e.g. name@upi)"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-white font-plus px-4"
                  />
                </div>
              ) : (
                <div className="glass-card p-6 rounded-[2rem] bg-green-500/5 border border-green-500/20 flex gap-4">
                  <span className="material-symbols-outlined text-green-400">message</span>
                  <p className="text-sm text-on-surface leading-relaxed font-plus italic">
                    "Hey! You owe me ₹{amount || '0'} for {reason || '...'}. Please send it when you can 🙏 — via AllowanceAI"
                  </p>
                </div>
              )}
            </section>

            <button
              onClick={handleSendFriend}
              className={`w-full h-16 rounded-[1.5rem] text-white font-plus font-black text-lg shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${method === 'upi' ? 'bg-gradient-to-r from-secondary/80 to-teal-600 shadow-secondary/20' : 'bg-green-600 shadow-green-600/20'}`}
            >
              <span className="material-symbols-outlined filled">{method === 'upi' ? 'contactless' : 'send'}</span>
              {method === 'upi' ? 'Send UPI Collect Request' : 'Send via WhatsApp'}
            </button>
          </div>
        )}

        <section className="mt-16 mb-10">
           <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Pending Requests (3)</h2>
           <div className="space-y-3">
             {[
               { name: 'Rahul', amount: 450, reason: 'Dinner', status: 'pending', color: 'amber' },
               { name: 'Sneha', amount: 120, reason: 'Auto', status: 'paid', color: 'emerald' },
               { name: 'Amit', amount: 300, reason: 'Coffee', status: 'ignored', color: 'slate' }
             ].map((req, idx) => (
               <div key={idx} className="glass-card p-4 rounded-3xl flex items-center justify-between border border-white/5">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-plus font-black text-white">
                     {req.name[0]}
                   </div>
                   <div>
                     <p className="text-sm font-plus font-bold text-white">{req.name} • ₹{req.amount}</p>
                     <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{req.reason}</p>
                   </div>
                 </div>
                 <span className={`text-[8px] font-plus font-black px-3 py-1 rounded-full border ${
                   req.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                   req.status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                   'bg-slate-500/10 border-slate-500/20 text-slate-500'
                 }`}>
                   {req.status === 'pending' ? 'PENDING' : req.status === 'paid' ? 'RECEIVED ✓' : 'NO RESPONSE'}
                 </span>
               </div>
             ))}
           </div>
        </section>
      </div>
    </div>
  );
};

export default RequestMoneyPage;
