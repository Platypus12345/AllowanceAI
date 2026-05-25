import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { validateRegistration } from '../utils/validation';
import { toast } from '../utils/toastBus';

export default function LoginPage() {
  const { user, loginWithGoogle, refreshAuth } = useAuth();
  const [view, setView] = useState('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState('');

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const finishAuth = async (token, userData) => {
    localStorage.setItem('authToken', token);
    localStorage.removeItem('token');
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    if (refreshAuth) await refreshAuth();
    navigate('/dashboard', { replace: true });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    const { isValid, errors } = validateRegistration(signupData);
    if (!isValid) {
      const first = Object.values(errors)[0];
      setError(first);
      toast({ message: first, type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: signupData.name,
        email: signupData.email,
        password: signupData.password,
      });
      await finishAuth(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: loginData.email,
        password: loginData.password,
      });
      await finishAuth(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setDevResetLink('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      if (res.data.devResetLink) {
        setDevResetLink(res.data.devResetLink);
      }
      setForgotSent(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to send reset email. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-secondary transition-colors font-plus';

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="fixed -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="fixed top-[40%] -right-[15%] w-[50%] h-[50%] bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-white/5 border border-white/10">
              <span className="material-symbols-outlined text-4xl text-primary filled">account_balance_wallet</span>
            </div>
            <h1 className="text-5xl font-plus font-extrabold bg-gradient-to-r from-indigo-400 to-teal-400 bg-clip-text text-transparent">
              AllowanceAI
            </h1>
            <p className="text-on-surface-variant mt-2 font-plus">Your AI money mentor</p>
          </div>

          <div className="glass-card rounded-[32px] p-6 mb-6 space-y-4 border border-white/10">
            {[
              { icon: 'sms', title: 'Track expenses automatically', sub: 'Synced via SMS notifications' },
              { icon: 'psychology', title: 'AI budget advice', sub: 'Personalized to your hostel life' },
              { icon: 'flag', title: 'Survive till month end', sub: 'Smart warnings every month' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary">{item.icon}</span>
                </div>
                <div>
                  <p className="font-plus font-bold text-on-surface">{item.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full h-14 bg-white text-slate-900 rounded-2xl flex items-center justify-center gap-3 font-plus font-bold text-base active:scale-95 transition-all"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => {
                setView('signup');
                setError('');
              }}
              className="w-full h-14 bg-primary-container text-white rounded-2xl font-plus font-bold text-base active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
            >
              Create Account
            </button>

            <button
              type="button"
              onClick={() => {
                setView('login');
                setError('');
              }}
              className="w-full text-center text-on-surface-variant py-3 hover:text-on-surface transition-colors font-plus font-bold"
            >
              Sign in with Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="fixed -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="w-full max-w-md z-10">
          <button
            type="button"
            onClick={() => {
              setView('landing');
              setError('');
            }}
            className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface transition-colors font-plus"
          >
            ← Back
          </button>

          <h2 className="text-3xl font-plus font-bold text-on-surface mb-2">Create your account</h2>
          <p className="text-on-surface-variant mb-6 font-plus">Join thousands of hostel students saving smarter</p>

          <form onSubmit={handleSignup} className="glass-card rounded-3xl p-6 space-y-4 border border-white/10">
            {error && (
              <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-plus">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Aditya Singh"
                value={signupData.name}
                onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Email
              </label>
              <input
                type="email"
                placeholder="aditya@example.com"
                value={signupData.email}
                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Password
              </label>
              <input
                type="password"
                placeholder="Min 8 characters"
                value={signupData.password}
                onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                required
                className={inputClass}
              />
              {signupData.password && (
                <div className="mt-2">
                  <div className="h-1 rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        signupData.password.length < 8
                          ? 'w-1/3 bg-error'
                          : signupData.password.length < 12
                            ? 'w-2/3 bg-tertiary'
                            : 'w-full bg-secondary'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Confirm Password
              </label>
              <input
                type="password"
                placeholder="Repeat password"
                value={signupData.confirmPassword}
                onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-container rounded-2xl font-plus font-bold text-white active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30"
            >
              {loading ? 'Creating account...' : 'Get Started'}
            </button>
          </form>

          <p className="text-center text-on-surface-variant mt-4 font-plus">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setView('login');
                setError('');
              }}
              className="text-secondary font-bold hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="fixed -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="w-full max-w-md z-10">
          <button
            type="button"
            onClick={() => {
              setView('landing');
              setError('');
            }}
            className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface transition-colors font-plus"
          >
            ← Back
          </button>

          <h2 className="text-3xl font-plus font-bold text-on-surface mb-2">Welcome back</h2>
          <p className="text-on-surface-variant mb-6 font-plus">Sign in to your AllowanceAI account</p>

          <form onSubmit={handleLogin} className="glass-card rounded-3xl p-6 space-y-4 border border-white/10">
            {error && (
              <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-plus">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Email
              </label>
              <input
                type="email"
                placeholder="aditya@example.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                Password
              </label>
              <input
                type="password"
                placeholder="Your password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  setView('forgot');
                  setError('');
                }}
                className="text-xs text-secondary mt-1 hover:underline float-right font-plus"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-container rounded-2xl font-plus font-bold text-white active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-on-surface-variant mt-4 font-plus">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setView('signup');
                setError('');
              }}
              className="text-secondary font-bold hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-5 relative overflow-hidden">
        <div className="w-full max-w-md z-10">
          <button
            type="button"
            onClick={() => {
              setView('login');
              setError('');
            }}
            className="flex items-center gap-2 text-on-surface-variant mb-6 hover:text-on-surface transition-colors font-plus"
          >
            ← Back
          </button>

          <h2 className="text-3xl font-plus font-bold text-on-surface mb-2">Reset password</h2>
          <p className="text-on-surface-variant mb-6 font-plus">Enter your email to receive a reset link</p>

          {forgotSent ? (
            <div className="glass-card border-l-4 border-l-secondary rounded-3xl p-8 text-center">
              <div className="text-5xl mb-4">📧</div>
              <h3 className="text-on-surface font-plus font-bold text-xl mb-2">Reset link sent!</h3>
              <p className="text-on-surface-variant text-sm font-plus">
                Check your email (and spam folder) for the password reset link. It expires in 1 hour.
              </p>
              {devResetLink && (
                <p className="text-xs text-secondary mt-4 break-all font-mono">
                  Dev link: {devResetLink}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setView('login');
                  setForgotSent(false);
                }}
                className="mt-6 text-secondary font-plus font-bold hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="glass-card rounded-3xl p-6 space-y-4 border border-white/10">
              {error && (
                <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-plus">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs text-on-surface-variant uppercase tracking-wide mb-1 block font-plus font-bold">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="aditya@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-primary-container rounded-2xl font-plus font-bold text-white active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return null;
}
