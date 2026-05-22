import React from 'react';
import { useNavigate } from 'react-router-dom';

const HelpPage = () => {
  const navigate = useNavigate();

  const topics = [
    { icon: 'psychology', color: 'text-indigo-400', bg: 'bg-indigo-400/10', text: 'How does AI prediction work?' },
    { icon: 'security', color: 'text-secondary', bg: 'bg-secondary/10', text: 'Security & Privacy' },
    { icon: 'sms', color: 'text-tertiary', bg: 'bg-tertiary/10', text: 'How does SMS tracking work?' },
  ];

  return (
    <div className="min-h-screen bg-surface p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-10">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <h1 className="text-headline-md font-plus font-black text-white">How can we help?</h1>
        </header>

        <div className="relative mb-12">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            placeholder="Search for help..."
            className="w-full h-16 bg-surface-container-high/50 rounded-3xl pl-16 pr-6 text-on-surface font-plus border border-white/5 focus:border-secondary transition-all outline-none"
          />
        </div>

        <section className="mb-12">
          <h2 className="text-[10px] font-plus font-black uppercase tracking-widest text-on-surface-variant mb-6 ml-2">
            Recommended Topics
          </h2>
          <div className="space-y-4">
            {topics.map((topic, idx) => (
              <div 
                key={idx}
                className="glass-card p-6 rounded-[2rem] flex items-center justify-between cursor-pointer group hover:bg-white/5 transition-all border border-white/5"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl ${topic.bg} flex items-center justify-center ${topic.color}`}>
                    <span className="material-symbols-outlined filled text-2xl">{topic.icon}</span>
                  </div>
                  <span className="text-white font-plus font-bold">{topic.text}</span>
                </div>
                <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">
                  chevron_right
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-6 mb-12">
          <button 
            onClick={() => navigate('/ai-assistant')} // Assuming ai-assistant tab mapping
            className="bg-primary-container p-10 rounded-[3rem] flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all text-on-primary-container"
          >
            <span className="material-symbols-outlined text-5xl filled">smart_toy</span>
            <span className="text-xs font-plus font-black uppercase tracking-widest">Chat with AI</span>
          </button>

          <a 
            href="mailto:support@allowanceai.com"
            className="glass-card p-10 rounded-[3rem] flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all border border-white/10"
          >
            <span className="material-symbols-outlined text-5xl text-secondary">mail</span>
            <span className="text-xs font-plus font-black uppercase tracking-widest text-white">Email us</span>
          </a>
        </div>

        <div className="glass-card rounded-[3rem] p-10 relative overflow-hidden mb-16 min-h-[200px] flex flex-col justify-center border border-white/10">
          {/* Blobs */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <span className="inline-block bg-secondary/20 text-secondary text-[10px] font-plus font-black px-3 py-1 rounded-lg mb-6">
              NEW
            </span>
            <h3 className="text-2xl font-plus font-black text-white mb-2">AI Financial Counselor</h3>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Get personalized advice for your hostel budget based on your spending patterns.
            </p>
          </div>
        </div>

        <footer className="text-center pb-10">
          <p className="text-slate-500 font-plus text-xs">v2.4.0 (Stable Release)</p>
          <p className="text-slate-600 font-plus font-black text-[10px] uppercase tracking-widest mt-1">
            Designed for Hostel Life in India
          </p>
        </footer>
      </div>
    </div>
  );
};

export default HelpPage;
