import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. Request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-5">
      <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-white/10">
        {done ? (
          <div className="text-center">
            <h2 className="text-2xl font-plus font-bold text-on-surface mb-2">Password updated</h2>
            <p className="text-on-surface-variant font-plus">Redirecting to sign in…</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-plus font-bold text-on-surface mb-2">Set new password</h2>
            <p className="text-on-surface-variant text-sm font-plus mb-6">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-plus">
                  {error}
                </div>
              )}

              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface font-plus focus:outline-none focus:border-secondary"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-on-surface font-plus focus:outline-none focus:border-secondary"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary-container rounded-xl font-plus font-bold text-white disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Update Password'}
              </button>
            </form>

            <p className="text-center mt-4">
              <Link to="/login" className="text-secondary text-sm font-plus hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
