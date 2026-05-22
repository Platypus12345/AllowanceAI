import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import FinancialCalendarButton from './FinancialCalendarButton';
import NotificationBell from './NotificationBell';

const TopAppBar = () => {
  const { user } = useAuth();
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const loadLevel = async () => {
      try {
        const res = await api.get('/gamification/stats');
        setLevel(res.data.level ?? 1);
      } catch {
        setLevel(1);
      }
    };
    if (user) loadLevel();
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-[#0f172a]/20 backdrop-blur-xl border-b border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.1)] px-container-padding flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-primary-container overflow-hidden bg-surface-container-highest">
             <div className="w-full h-full flex items-center justify-center text-on-surface font-bold">
               {user?.name?.charAt(0) || 'A'}
             </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-tertiary-container text-on-tertiary-container text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-background">
            Lvl {level}
          </div>
        </div>
        <h1 className="font-plus font-black tracking-tight text-xl bg-gradient-to-r from-indigo-500 to-teal-400 bg-clip-text text-transparent">
          AllowanceAI
        </h1>
      </div>

      <div className="flex items-center gap-1">
        <FinancialCalendarButton />
        <NotificationBell />
      </div>
    </header>
  );
};

export default TopAppBar;
