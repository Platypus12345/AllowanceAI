import { useEffect } from 'react';

const AuthCallback = () => {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      localStorage.setItem('authToken', token);
      localStorage.removeItem('token');
      window.location.replace('/dashboard');
    } else {
      window.location.replace('/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-on-surface font-plus">
      Signing you in…
    </div>
  );
};

export default AuthCallback;
