import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="glass-card mb-8 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white shadow-lg">
          {user?.name?.charAt(0) || 'A'}
        </div>
        <div>
          <h2 className="font-bold text-white leading-tight">AllowanceAI</h2>
          <p className="text-xs text-slate-400">Welcome back, {user?.name?.split(' ')[0]}</p>
        </div>
      </div>
      <button 
        onClick={logout} 
        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </nav>
  );
};

export default Navbar;
