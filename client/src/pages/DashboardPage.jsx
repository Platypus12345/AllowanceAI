import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import api from '../api/axios';

// Components
import TopAppBar from '../components/TopAppBar';
import Sidebar from '../components/Sidebar';
import DashboardStats from '../components/DashboardStats';
import SpendingChart from '../components/SpendingChart';
import ExpenseList from '../components/ExpenseList';
import ExpenseForm from '../components/ExpenseForm';
import AIChat from '../components/AIChat';
import BudgetGoals from '../components/BudgetGoals';
import SpendPrediction from '../components/SpendPrediction';
import ReportCard from '../components/ReportCard';
import SplitsTab from '../components/SplitsTab';
import ProfileUpiSection from '../components/ProfileUpiSection';
import RecurringExpenses from '../components/RecurringExpenses';
import SavingTips from '../components/SavingTips';
import AnalyticsChart from '../components/AnalyticsChart';
import SurvivalCard from '../components/SurvivalCard';
import { subscribeFinanceUpdated } from '../utils/financeEvents';
import { CalendarDrawerProvider } from '../context/CalendarDrawerContext';
import { NotificationDrawerProvider } from '../context/NotificationDrawerContext';
import FinancialCalendarDrawer from '../components/FinancialCalendarDrawer';
import NotificationDrawer from '../components/NotificationDrawer';
import { ExpenseItemSkeleton } from '../components/ui/Skeleton';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingSplitCount, setPendingSplitCount] = useState(0);

  const showWrappedBanner = (() => {
    const d = new Date();
    return d.getDate() <= 7 || d.getDate() >= 28;
  })();

  const fetchData = useCallback(async () => {
    setStatsLoading(true);
    setExpensesLoading(true);
    try {
      const [statsRes, expensesRes] = await Promise.all([
        api.get('/budget/stats'),
        api.get('/expenses')
      ]);
      setStats(statsRes.data);
      setExpenses(expensesRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setStatsLoading(false);
      setExpensesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    api.get('/splits/pending-count').then((r) => setPendingSplitCount(r.data.count || 0)).catch(() => {});
    return subscribeFinanceUpdated(() => {
      fetchData();
      api.get('/splits/pending-count').then((r) => setPendingSplitCount(r.data.count || 0)).catch(() => {});
    });
  }, [fetchData]);

  return (
    <CalendarDrawerProvider>
    <NotificationDrawerProvider>
    <div className="min-h-screen bg-surface flex flex-col relative text-on-surface page-enter">
      <TopAppBar />
      
      <div className="flex flex-1 pt-16 h-full">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} pendingSplitCount={pendingSplitCount} />
        
        <main className="flex-1 p-5 relative z-10 min-w-0 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-5 page-enter">
              {showWrappedBanner && (
                <button
                  type="button"
                  onClick={() => navigate('/wrapped')}
                  className="w-full glass-card rounded-2xl p-4 flex items-center justify-between border border-primary-container/30 hover:border-primary-container/50 transition-colors"
                >
                  <span className="font-plus font-bold text-on-surface">View {new Date().toLocaleString('default', { month: 'long' })} Wrapped 🎁</span>
                  <span className="material-symbols-outlined text-primary-container">chevron_right</span>
                </button>
              )}
              {/* Greeting Section */}
              <div className="mb-5">
                <h2 className="text-display-lg font-plus font-black tracking-tight leading-tight">
                  Hi, {user?.displayName?.split(' ')[0] || 'Aditya'} 👋
                </h2>
                <p className="text-body-base text-on-surface-variant font-plus">
                  You've spent <span className="font-space font-bold text-error">₹{new Intl.NumberFormat('en-IN').format(stats?.spentToday ?? 0)}</span> today.
                </p>
              </div>

              {!statsLoading && <SurvivalCard finance={stats?.finance || stats?.health} survival={stats?.survival} />}

              {/* Stats Grid */}
              <DashboardStats stats={stats} onUpdate={fetchData} loading={statsLoading} />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Daily Challenge Card */}
                <div className="lg:col-span-4 glass-card rounded-[2rem] p-5 border-l-4 border-l-tertiary card-tilt">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-plus font-bold text-on-surface">Daily Challenge</h4>
                    <div className="w-8 h-8 rounded-full bg-tertiary/20 flex items-center justify-center text-tertiary">
                      <span className="material-symbols-outlined text-sm filled">bolt</span>
                    </div>
                  </div>
                  <p className="text-sm text-on-surface mb-4 leading-relaxed">
                    Don't spend on <span className="font-bold text-tertiary">Snacks</span> today and earn <span className="font-bold text-secondary">50 Exp</span>!
                  </p>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary w-1/3 rounded-full shadow-[0_0_8px_rgba(255,182,144,0.4)]" />
                  </div>
                </div>

                {/* Spending breakdown card */}
                <div className="lg:col-span-8">
                  <SpendingChart data={stats?.chartData} loading={statsLoading} />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-plus font-extrabold text-on-surface">Recent Activity</h4>
                  <button className="text-primary text-sm font-semibold hover:underline">View all</button>
                </div>
                <div className="glass-card rounded-[2rem] overflow-hidden">
                  {expensesLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <ExpenseItemSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <ExpenseList expenses={expenses.slice(0, 5)} onExpenseDeleted={fetchData} />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="flex flex-col gap-5 max-w-4xl mx-auto page-enter">
              <ExpenseForm onExpenseAdded={fetchData} />
              <div className="min-h-[500px]">
                 <ExpenseList expenses={expenses} onExpenseDeleted={fetchData} />
              </div>
            </div>
          )}

          {activeTab === 'ai-assistant' && (
            <div className="h-[calc(100vh-48px)] max-w-4xl mx-auto animate-in fade-in duration-300">
               <AIChat />
            </div>
          )}

          {activeTab === 'goals' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <h2 className="text-2xl font-bold mb-4">Monthly Budget Goals</h2>
               <BudgetGoals />
            </div>
          )}

          {activeTab === 'prediction' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <h2 className="text-2xl font-bold mb-4">Spend Prediction</h2>
               <SpendPrediction />
            </div>
          )}

          {activeTab === 'report' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <ReportCard />
            </div>
          )}

          {activeTab === 'splits' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <SplitsTab />
            </div>
          )}

          {activeTab === 'recurring' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <h2 className="text-2xl font-bold mb-4">Recurring Expenses</h2>
               <RecurringExpenses />
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <SavingTips />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
               <AnalyticsChart />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-4xl mx-auto space-y-5 page-enter">
               <div className="flex items-center gap-6 mb-10">
                 <div className="w-24 h-24 rounded-[2rem] bg-primary flex items-center justify-center text-4xl font-plus font-black text-white shadow-2xl shadow-primary/20">
                   {user?.name?.charAt(0) || 'A'}
                 </div>
                 <div>
                   <h2 className="text-3xl font-plus font-black text-white">{user?.name || 'Aditya'}</h2>
                   <p className="text-on-surface-variant font-plus">Budget Apprentice • Level 5</p>
                 </div>
               </div>

               <ProfileUpiSection
                 user={user}
                 onUpdated={() => {
                   api.get('/auth/me').then((r) => {
                     localStorage.setItem('userData', JSON.stringify(r.data));
                   });
                 }}
               />

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="glass-card rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                   <h3 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500">Account Settings</h3>
                   <div className="space-y-4">
                     <button 
                       onClick={() => navigate('/request-money')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                         <span className="material-symbols-outlined filled">add_card</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">Request Allowance</p>
                         <p className="text-xs text-on-surface-variant">Request money from parents</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>

                     <button 
                       onClick={() => setActiveTab('report')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                         <span className="material-symbols-outlined filled">monitoring</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">Monthly Report</p>
                         <p className="text-xs text-on-surface-variant">View your spending grade</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>

                     <button 
                       onClick={() => navigate('/wrapped')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                         <span className="material-symbols-outlined filled">redeem</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">Past Wrappeds</p>
                         <p className="text-xs text-on-surface-variant">Your monthly financial story</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>
                   </div>
                 </div>

                 <div className="glass-card rounded-[2.5rem] p-8 border border-white/5 space-y-6">
                   <h3 className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500">App Preferences</h3>
                   <div className="space-y-4">
                     <button 
                       onClick={() => navigate('/profile/ai-personality')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                         <span className="material-symbols-outlined filled">psychology</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">AI Personality</p>
                         <p className="text-xs text-on-surface-variant">Change counselor vibe</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>

                     <button 
                       onClick={() => navigate('/profile/sms-sync')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
                         <span className="material-symbols-outlined filled">sms</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">SMS Tracking Sync</p>
                         <p className="text-xs text-on-surface-variant">Automate bank alerts</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>

                     <button 
                       onClick={() => navigate('/help')}
                       className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
                     >
                       <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                         <span className="material-symbols-outlined filled">help</span>
                       </div>
                       <div className="flex-1">
                         <p className="font-plus font-bold text-white">Help & Support</p>
                         <p className="text-xs text-on-surface-variant">Get assistance</p>
                       </div>
                       <span className="material-symbols-outlined text-slate-500 group-hover:text-white transition-colors">chevron_right</span>
                     </button>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
    <FinancialCalendarDrawer />
    <NotificationDrawer />
    </NotificationDrawerProvider>
    </CalendarDrawerProvider>
  );
};

export default DashboardPage;

