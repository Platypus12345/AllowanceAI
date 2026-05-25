import { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from '../utils/toastBus';

export default function JarSuggestionCard() {
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get('/jars/suggest').then((r) => setData(r.data?.suggestion ? r.data : null)).catch(() => {});
  }, []);

  if (!data?.suggestion || dismissed) return null;

  const contribute = async () => {
    try {
      await api.post(`/jars/${data.jarId}/contribute`, { amount: data.suggestedAmount, note: 'Quick add from home' });
      toast({ message: 'Added to jar', type: 'success' });
      setDismissed(true);
    } catch (e) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5 mb-5">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-400 filled">savings</span>
        <div className="flex-1">
          <p className="font-plus font-bold text-white text-sm">{data.suggestion}</p>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={contribute} className="text-xs font-plus font-black text-secondary uppercase">Add Now</button>
            <button type="button" onClick={() => setDismissed(true)} className="text-xs font-plus font-bold text-on-surface-variant">Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  );
}
