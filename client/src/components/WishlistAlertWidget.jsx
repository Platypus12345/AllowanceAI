import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function WishlistAlertWidget() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get('/wishlist/alerts').then((r) => setAlerts(r.data.alerts || [])).catch(() => {});
  }, []);

  if (dismissed || alerts.length === 0) return null;

  const a = alerts[0];

  return (
    <div className="glass-card rounded-2xl p-4 border border-primary/20 mb-5 flex items-center justify-between gap-4">
      <p className="font-plus font-bold text-white text-sm flex-1">{a.message}</p>
      <button type="button" onClick={() => navigate('/wishlist')} className="text-xs font-plus font-black text-primary shrink-0">View</button>
      <button type="button" onClick={() => setDismissed(true)} className="material-symbols-outlined text-on-surface-variant text-sm">close</button>
    </div>
  );
}
