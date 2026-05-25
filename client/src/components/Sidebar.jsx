import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Receipt, Bot, FileText, Target, Lightbulb, Layers } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

const Sidebar = ({ activeTab, setActiveTab, pendingSplitCount = 0 }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'grid_view' },
    { id: 'expenses', label: 'Spend', icon: 'account_balance_wallet' },
    { id: 'ai-assistant', label: 'Ask AI', icon: 'smart_toy' },
    { id: 'goals', label: 'Goals', icon: 'track_changes' },
    { id: 'profile', label: 'Profile', icon: 'person' },
    { id: 'prediction', label: 'Prediction', icon: 'psychology' },
    { id: 'report', label: 'Monthly Report', icon: 'monitoring' },
    { id: 'splits', label: 'Split Expenses', icon: 'groups' },
    { id: 'jars-nav', label: 'Savings Jars', icon: 'savings', path: '/jars' },
    { id: 'wishlist-nav', label: 'Wishlist', icon: 'star', path: '/wishlist' },
    { id: 'recurring', label: 'Recurring', icon: 'event_repeat' },
    { id: 'tips', label: 'Saving Tips', icon: 'lightbulb' },
    { id: 'analytics', label: 'Analytics', icon: 'layers' },
  ];

  return (
    <aside className="w-64 glass-card m-6 flex flex-col justify-between h-[calc(100vh-48px)] sticky top-6 overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.path ? navigate(item.path) : setActiveTab(item.id))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-plus font-medium transition-all group ${
                activeTab === item.id 
                  ? 'bg-primary-container/10 text-primary border border-primary/20 shadow-sm shadow-primary/10' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${activeTab === item.id ? 'filled text-primary' : 'text-outline'} group-hover:text-primary transition-colors`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'splits' && pendingSplitCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-error text-white text-[10px] font-plus font-black flex items-center justify-center">
                  {pendingSplitCount > 9 ? '9+' : pendingSplitCount}
                </span>
              )}
              {activeTab === item.id && (
                <div className="w-1.5 h-1.5 bg-secondary rounded-full shadow-[0_0_8px_rgba(68,226,205,0.6)]" />
              )}
            </button>
          ))}
        </nav>

        {/* User Profile & Logout at Bottom */}
        <div className="p-4 bg-surface-container-low border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full border-2 border-primary-container overflow-hidden bg-surface-container-highest">
               <div className="w-full h-full flex items-center justify-center text-on-surface font-bold text-sm">
                 {user?.name?.charAt(0) || 'A'}
               </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-on-surface font-plus font-bold text-sm truncate">{user?.name || 'User'}</p>
              <p className="text-on-surface-variant text-[10px] font-label-caps uppercase tracking-wider">Budget Apprentice</p>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error hover:bg-error/10 transition-colors font-plus font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
