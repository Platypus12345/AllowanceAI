import React from 'react';
import { useNavigate } from 'react-router-dom';

const SMSSyncPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface p-6 animate-in fade-in duration-500">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-12">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white"
          >
            <span className="material-symbols-outlined text-3xl">chevron_left</span>
          </button>
          <h1 className="text-headline-md font-plus font-black text-white">SMS Tracking Sync</h1>
        </header>

        <div className="flex flex-col items-center text-center mb-16">
          <div className="relative w-64 h-64 flex items-center justify-center mb-8">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-[80px]" />
            <div className="glass-card w-48 h-48 rounded-full flex items-center justify-center border border-indigo-500/20 relative">
               <span className="material-symbols-outlined text-[100px] text-indigo-400">message</span>
               <div className="absolute bottom-2 right-2 glass-card p-3 rounded-2xl bg-teal-500/20 border border-teal-500/30">
                 <span className="material-symbols-outlined text-teal-400">settings</span>
               </div>
            </div>
          </div>
          <h2 className="text-3xl font-plus font-black text-white mb-4">SMS Tracking Sync</h2>
          <p className="text-slate-400 text-base max-w-md leading-relaxed">
            Automate your hostel budget by letting AI read your transaction alerts in real-time.
          </p>
        </div>

        <div className="glass-card rounded-[2.5rem] p-10 mb-12 border border-white/10 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-plus font-black text-white">Enable SMS Tracking</h3>
            <p className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500">Real-time sync</p>
          </div>
          <div className="w-16 h-10 bg-slate-800 rounded-full p-1 relative cursor-not-allowed opacity-50">
             <div className="w-8 h-8 bg-slate-600 rounded-full" />
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 flex gap-6 mb-12 items-start">
           <span className="material-symbols-outlined text-amber-500 text-3xl">info</span>
           <div className="space-y-2">
             <h4 className="text-amber-500 font-plus font-black text-lg">Available on Android only</h4>
             <p className="text-amber-500/70 text-sm leading-relaxed font-medium">
               Due to browser and iOS security limitations, real-time SMS tracking is only available on our Android mobile application. 
               Please download the app to enable this feature.
             </p>
           </div>
        </div>

        <div className="glass-card rounded-[2.5rem] p-10 border-l-4 border-l-teal-500 bg-teal-500/5 flex gap-6 border-y border-r border-white/5 shadow-2xl">
           <span className="material-symbols-outlined text-teal-400 text-3xl">security</span>
           <div className="space-y-2">
             <h4 className="text-white font-plus font-black text-lg">Privacy Guarantee</h4>
             <p className="text-slate-400 text-sm leading-relaxed font-plus">
               We only read transaction amounts and merchants. Your personal chats and OTPs are safe and never leave your device. 
               End-to-end encryption ensures your data stays yours.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SMSSyncPage;
