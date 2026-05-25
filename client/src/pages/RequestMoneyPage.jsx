import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from '../utils/toastBus';
import { isValidUPI, openUpiLink } from '../utils/upi';
import { formatRupee } from '../utils/formatters';
import { Skeleton } from '../components/ui/Skeleton';

const quickAmounts = [200, 500, 1000, 2000];
const quickReasons = ['Mess Food', 'Chai', 'Printouts', 'Auto Rickshaw', 'Medical', 'Books'];

const statusLabel = {
  pending: { text: 'PENDING', className: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
  received: { text: 'RECEIVED', className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' },
  no_response: { text: 'NO RESPONSE', className: 'bg-slate-500/10 border-slate-500/20 text-slate-500' },
};

export default function RequestMoneyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('parents');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('upi');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [parents, setParents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [selectedParentIdx, setSelectedParentIdx] = useState(0);

  const load = useCallback(async () => {
    try {
      const [profRes, friendsRes, parentsRes, reqRes] = await Promise.all([
        api.get('/user/profile'),
        api.get('/friends'),
        api.get('/allowance/linked-parents'),
        api.get('/requests'),
      ]);
      setProfile(profRes.data.user);
      setFriends(friendsRes.data);
      setParents(parentsRes.data);
      setRequests(reqRes.data);
      const owing = friendsRes.data.filter((f) => f.totalOwed > 0);
      if (owing[0]) setSelectedFriendId(owing[0]._id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const friendsWhoOwe = friends.filter((f) => f.totalOwed > 0);
  const selectedFriend = friends.find((f) => f._id === selectedFriendId);
  const yourUpi = profile?.upiId;

  const handleSendParent = async () => {
    if (!amount || !note) {
      toast({ message: 'Enter amount and reason', type: 'warning' });
      return;
    }
    if (parents.length === 0) {
      toast({ message: 'Link a parent account first', type: 'warning' });
      return;
    }
    const parent = parents[selectedParentIdx];
    setSending(true);
    try {
      const phone = parent.phone?.replace(/\D/g, '') || '';
      await api.post('/allowance-requests', {
        amount: Number(amount),
        reason: note,
        parentPhone: phone || '919876543210',
      });
      const message = encodeURIComponent(`Hi, I need ₹${amount} for ${note}. - via AllowanceAI`);
      const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
      window.open(url, '_blank');
      toast({ message: 'Request sent', type: 'success' });
      navigate(-1);
    } catch (error) {
      toast({ message: error.response?.data?.error || 'Failed to send request', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendFriend = async () => {
    if (!yourUpi || !isValidUPI(yourUpi)) {
      toast({ message: 'Set your UPI ID in Profile first', type: 'warning' });
      navigate('/dashboard');
      return;
    }
    if (!selectedFriendId || !amount || !note) {
      toast({ message: 'Select friend, amount, and note', type: 'warning' });
      return;
    }
    const amt = Number(amount);
    if (amt <= 0 || amt > 100000) {
      toast({ message: 'Invalid amount', type: 'warning' });
      return;
    }

    setSending(true);
    try {
      if (method === 'upi') {
        const res = await api.post('/requests/upi-collect', {
          friendId: selectedFriendId,
          amount: amt,
          note,
          senderUpiId: yourUpi,
        });
        const result = openUpiLink(res.data.deepLink);
        if (!result.opened) toast({ message: result.message, type: 'info' });
        else toast({ message: 'UPI collect request sent!', type: 'success' });
      } else {
        const res = await api.post('/requests/whatsapp', {
          friendId: selectedFriendId,
          amount: amt,
          note,
          senderUpiId: yourUpi,
        });
        window.open(res.data.deepLink, '_blank');
        toast({ message: 'WhatsApp opened', type: 'success' });
      }
      load();
    } catch (error) {
      toast({ message: error.response?.data?.message || 'Failed to send request', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const whatsappPreview = selectedFriend && yourUpi
    ? `Hey ${selectedFriend.name}! You owe me ₹${amount || '0'} for ${note || 'expenses'}. Please send it to ${yourUpi}. — via AllowanceAI`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface p-6">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-48 w-full max-w-2xl mx-auto rounded-[3rem]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full text-white">
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <h1 className="text-headline-md font-plus font-black text-white">Request Money</h1>
        </header>

        <div className="flex bg-white/5 rounded-3xl p-1.5 mb-10">
          <button
            type="button"
            onClick={() => setTab('parents')}
            className={`flex-1 h-12 rounded-2xl font-plus font-black text-sm ${tab === 'parents' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant'}`}
          >
            From Parents
          </button>
          <button
            type="button"
            onClick={() => setTab('friends')}
            className={`flex-1 h-12 rounded-2xl font-plus font-black text-sm ${tab === 'friends' ? 'bg-primary-container text-on-primary-container shadow-lg' : 'text-on-surface-variant'}`}
          >
            From Friends
          </button>
        </div>

        <div className="glass-card p-10 rounded-[3rem] flex flex-col items-center mb-10 border border-white/10">
          <span className="text-[10px] font-plus font-black uppercase tracking-[0.2em] text-indigo-400 mb-6">Enter Amount</span>
          <div className="flex items-baseline gap-4 mb-8">
            <span className="text-4xl font-plus font-black text-white/40">₹</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-48 bg-transparent text-display-lg font-space font-bold text-white text-center outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-4 w-full">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(amt))}
                className={`h-12 rounded-2xl font-space font-bold border ${amount === String(amt) ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' : 'bg-white/5 border-transparent text-on-surface-variant'}`}
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
              {parents.length === 0 ? (
                <div className="glass-card p-8 rounded-[2rem] text-center border border-dashed border-white/10">
                  <p className="font-plus text-on-surface-variant mb-2">Link a parent account first</p>
                  <p className="text-xs text-on-surface-variant">Ask your parent to link their account in AllowanceAI settings.</p>
                </div>
              ) : (
                <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                  {parents.map((p, idx) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => setSelectedParentIdx(idx)}
                      className={`flex flex-col items-center gap-3 ${selectedParentIdx === idx ? 'scale-110' : 'opacity-40'}`}
                    >
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-plus font-black text-white border-2 ${selectedParentIdx === idx ? 'border-secondary bg-secondary/10' : 'border-white/10 bg-white/5'}`}>
                        {p.name?.charAt(0)}
                      </div>
                      <span className="text-xs font-plus font-bold text-white">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Reason</h2>
              <textarea
                placeholder="e.g., Hostel fees, Mess bill..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full glass-card rounded-[2rem] p-6 mb-4 border border-white/5 bg-transparent h-24 outline-none text-white font-plus resize-none"
              />
              <div className="flex flex-wrap gap-2">
                {quickReasons.map((r) => (
                  <button key={r} type="button" onClick={() => setNote(r)} className="px-4 py-2 rounded-xl bg-white/5 text-on-surface-variant text-xs font-plus font-bold hover:bg-white/10">
                    {r}
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={handleSendParent}
              disabled={sending || parents.length === 0}
              className="w-full h-16 bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-[1.5rem] text-white font-plus font-black text-lg disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Request via WhatsApp'}
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {!yourUpi && (
              <div className="glass-card p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                <p className="font-plus font-bold text-amber-400 mb-2">Set your UPI ID first to request money</p>
                <button type="button" onClick={() => navigate('/dashboard')} className="text-sm font-plus font-bold text-primary">
                  Go to Profile
                </button>
              </div>
            )}

            {yourUpi && (
              <div className="glass-card p-4 rounded-2xl flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary filled">contactless</span>
                  <div>
                    <p className="text-xs text-on-surface-variant font-plus">Receive on</p>
                    <p className="font-mono text-secondary font-bold">{yourUpi}</p>
                  </div>
                </div>
                <button type="button" onClick={() => navigate('/dashboard')} className="material-symbols-outlined text-on-surface-variant">edit</button>
              </div>
            )}

            <section>
              <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">Who owes you</h2>
              {friendsWhoOwe.length === 0 ? (
                <p className="text-on-surface-variant font-plus ml-2">Nobody owes you right now</p>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {friendsWhoOwe.map((friend) => (
                    <button
                      key={friend._id}
                      type="button"
                      onClick={() => setSelectedFriendId(friend._id)}
                      className={`glass-card min-w-[140px] p-6 rounded-[2rem] flex flex-col items-center border ${selectedFriendId === friend._id ? 'border-secondary' : 'border-white/5'}`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-plus font-black text-white mb-2">
                        {friend.name[0]}
                      </div>
                      <span className="text-white font-plus font-bold">{friend.name}</span>
                      <span className="text-secondary font-space font-bold">{formatRupee(friend.totalOwed)}</span>
                      <span className="text-[8px] font-plus font-black uppercase tracking-widest text-tertiary mt-2">Unsettled</span>
                    </button>
                  ))}
                </div>
              )}
              {friends.length < 5 && (
                <button type="button" onClick={() => navigate('/dashboard')} className="mt-4 ml-2 text-sm font-plus font-bold text-primary">
                  + Add Friend (in Split Expenses)
                </button>
              )}
            </section>

            <section>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this for?"
                className="w-full glass-card rounded-2xl px-6 py-4 mb-4 border border-white/5 bg-transparent text-white font-plus outline-none"
              />
              <div className="flex gap-4 mb-6">
                <button type="button" onClick={() => setMethod('upi')} className={`flex-1 h-12 rounded-2xl font-plus font-black text-xs ${method === 'upi' ? 'bg-white/10 border border-white/20 text-white' : 'text-on-surface-variant'}`}>
                  Via UPI ID
                </button>
                <button type="button" onClick={() => setMethod('whatsapp')} className={`flex-1 h-12 rounded-2xl font-plus font-black text-xs ${method === 'whatsapp' ? 'bg-white/10 border border-white/20 text-white' : 'text-on-surface-variant'}`}>
                  Via WhatsApp
                </button>
              </div>
              {method === 'whatsapp' && whatsappPreview && (
                <p className="text-sm text-on-surface-variant font-plus italic mb-4 px-2">{whatsappPreview}</p>
              )}
              <p className="text-xs text-on-surface-variant mb-4 px-2 hidden md:block">
                UPI links only work on mobile. Use WhatsApp on desktop.
              </p>
            </section>

            <button
              type="button"
              onClick={handleSendFriend}
              disabled={sending || !selectedFriendId}
              className={`w-full h-16 rounded-[1.5rem] text-white font-plus font-black text-lg flex items-center justify-center gap-3 disabled:opacity-50 ${method === 'upi' ? 'bg-gradient-to-r from-secondary/80 to-teal-600' : 'bg-green-600'}`}
            >
              {method === 'upi' ? 'Send UPI Collect Request' : 'Send via WhatsApp'}
            </button>
          </div>
        )}

        <section className="mt-16 mb-10">
          <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-6 ml-2">
            Pending Requests ({requests.filter((r) => r.status === 'pending').length})
          </h2>
          {requests.length === 0 ? (
            <p className="text-on-surface-variant font-plus ml-2">No money requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, 10).map((req) => {
                const st = statusLabel[req.status] || statusLabel.pending;
                return (
                  <div key={req._id} className="glass-card p-4 rounded-3xl flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sm font-plus font-black text-white">
                        {req.friendName?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-plus font-bold text-white">{req.friendName} · {formatRupee(req.amount)}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase">{req.note || '—'}</p>
                      </div>
                    </div>
                    <span className={`text-[8px] font-plus font-black px-3 py-1 rounded-full border ${st.className}`}>{st.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
