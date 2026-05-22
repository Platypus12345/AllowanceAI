import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const personalities = [
  { id: 'strict', emoji: '😤', name: 'Strict', description: 'Will roast you for every extra chai.', preview: "You spent ₹250 on snacks today? That's 5 cups of chai you could have had at the mess for free. Think, Aditya, think!" },
  { id: 'supportive', emoji: '😊', name: 'Supportive', description: 'Kind reminders and positive vibes.', preview: "Hey! You're doing great with your budget. Just a small reminder that you've used 40% of your snack allowance. Keep it up! ✨" },
  { id: 'savage', emoji: '😂', name: 'Savage', description: 'No mercy for your Zomato habits.', preview: "Another Zomato order? Your wallet is crying harder than you during the end-sems. Maybe try the mess food for once? It won't kill you." },
  { id: 'zen', emoji: '🧘', name: 'Zen', description: 'Calm, data-driven insights.', preview: "Observe your spending patterns. A small adjustment in non-essential expenses today will lead to financial tranquility by month-end." },
];

const AIPersonalityPage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('supportive');
  const [currentMood, setCurrentMood] = useState('supportive');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/user/personality');
        if (res.data?.success && res.data.personality) {
          setSelected(res.data.personality);
          setCurrentMood(res.data.personality);
          localStorage.setItem('aiPersonality', res.data.personality);
        }
      } catch {
        const saved = localStorage.getItem('aiPersonality');
        if (saved) {
          setSelected(saved);
          setCurrentMood(saved);
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/user/personality', { personality: selected });

      if (res.data?.success) {
        const personality = res.data.personality || selected;
        localStorage.setItem('aiPersonality', personality);
        setCurrentMood(personality);
        navigate(-1);
      } else {
        setError(res.data?.message || 'Failed to save preferences.');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          'Failed to save preferences. Check that you are logged in.'
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedData = personalities.find((p) => p.id === selected) || personalities[1];

  return (
    <div className="min-h-screen bg-surface p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-start gap-4 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="mt-1 p-2 hover:bg-white/5 rounded-full transition-colors text-on-surface"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <div>
            <h1 className="text-headline-md font-plus font-black text-primary">AI Counselor</h1>
            <p className="text-on-surface-variant font-plus text-sm mt-1 max-w-md">
              Choose how you want your financial AI to interact with your hostel spending habits.
            </p>
            {currentMood && (
              <p className="text-xs text-secondary mt-2 font-plus">
                Active: {currentMood.charAt(0).toUpperCase() + currentMood.slice(1)}
              </p>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {personalities.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`glass-card rounded-[2rem] p-6 flex flex-col items-center text-center cursor-pointer transition-all duration-300 border-2 ${
                selected === item.id
                  ? 'border-secondary bg-secondary/10 shadow-[0_0_20px_rgba(68,226,205,0.2)]'
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              <span className="text-5xl mb-4">{item.emoji}</span>
              <h3 className="font-plus font-black text-on-surface uppercase tracking-widest text-xs mb-2">
                {item.name}
              </h3>
              <p className="text-[11px] text-on-surface-variant leading-tight max-w-[120px]">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden mb-8">
          <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[140px] text-secondary opacity-10 pointer-events-none">
            format_quote
          </span>
          <div className="flex items-center gap-2 mb-6 text-secondary relative z-10">
            <span className="material-symbols-outlined filled">psychology</span>
            <span className="text-[10px] font-plus font-black uppercase tracking-widest">
              Current Mood Preview
            </span>
          </div>
          <p className="text-xl font-space font-bold text-on-surface italic leading-relaxed relative z-10">
            &ldquo;{selectedData.preview}&rdquo;
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-error/10 border border-error/30 text-error text-sm font-plus">
            {error}
          </div>
        )}

        <div className="border border-secondary/20 rounded-3xl bg-secondary/5 p-6 flex gap-4 mb-10">
          <span className="material-symbols-outlined text-secondary">tips_and_updates</span>
          <p className="text-sm text-secondary leading-relaxed font-plus">
            <span className="font-black">Pro Tip:</span> Changing personality affects Ask AI chat style immediately.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-16 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] transition-all rounded-[1.5rem] flex items-center justify-center gap-3 text-white font-plus font-black shadow-[0_10px_25px_rgba(99,102,241,0.4)] disabled:opacity-60"
        >
          {saving ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="material-symbols-outlined filled">bolt</span>
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AIPersonalityPage;
