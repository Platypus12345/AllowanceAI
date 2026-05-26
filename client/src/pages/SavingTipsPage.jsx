import { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function SavingTipsPage() {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTips();
  }, []);

  const fetchTips = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      // Call existing /api/ai/tips endpoint
      // which calls FastAPI /tips
      const res = await axios.post('/ai/tips');
      setTips(res.data.tips || res.data);
    } catch (err) {
      setError('Could not load tips. Check AI service.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const categoryColors = {
    Food: '#ff6b8a',
    Transport: '#6c63ff',
    Shopping: '#f5a623',
    Entertainment: '#00d4b1',
    Health: '#10b981',
    Other: '#8892b0'
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            💡
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Smart Saving Tips
            </h1>
            <p className="text-xs text-[#8892b0]">
              Personalized based on your spending patterns
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchTips(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>
            ↻
          </span>
          {refreshing ? 'Refreshing...' : 'Refresh AI'}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card-elevated p-5 rounded-2xl space-y-3 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-20"/>
              <div className="h-16 bg-white/5 rounded"/>
              <div className="h-3 bg-white/10 rounded w-32"/>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="card-elevated p-8 rounded-2xl text-center border border-red-500/20">
          <p className="text-5xl mb-3">⚠️</p>
          <p className="text-white font-bold mb-1">
            Could not load tips
          </p>
          <p className="text-[#8892b0] text-sm mb-4">
            {error}
          </p>
          <button onClick={() => fetchTips()} className="btn-primary px-6 py-2 rounded-xl text-sm">
            Try Again
          </button>
        </div>
      )}

      {/* Tips grid — REAL data from API */}
      {!loading && !error && tips.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tips.map((tip, i) => (
            <div key={i} className="card-elevated p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all hover:-translate-y-0.5">
              
              {/* Category + savings badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                  style={{ 
                    color: categoryColors[tip.category] || '#8892b0',
                    background: (categoryColors[tip.category] || '#8892b0') + '15'
                  }}>
                  {tip.category}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-[#00d4b1]">
                  ↓ {tip.estimatedSaving}
                </span>
              </div>

              {/* Tip text */}
              <p className="text-[#eef2ff] text-sm leading-relaxed mb-4">
                "{tip.tip}"
              </p>

              {/* Impact indicator */}
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-[#8892b0] uppercase tracking-widest mb-1">
                  Potential Impact
                </p>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ 
                      width: `${Math.min((parseFloat(String(tip.estimatedSaving).replace(/[^0-9]/g, '')) / 3000) * 100, 100)}%`,
                      background: categoryColors[tip.category] || '#6c63ff'
                    }}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tips.length === 0 && (
        <div className="card-elevated p-12 rounded-2xl text-center">
          <p className="text-5xl mb-3">💡</p>
          <p className="text-white font-bold mb-2">
            No tips yet
          </p>
          <p className="text-[#8892b0] text-sm mb-6">
            Add some expenses first so AI can analyse your spending patterns
          </p>
          <button onClick={() => fetchTips()} className="btn-primary px-6 py-2 rounded-xl">
            Generate Tips
          </button>
        </div>
      )}
    </div>
  );
}
