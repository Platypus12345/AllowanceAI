/**
 * Resolve frontend base URL for redirects (OAuth, password reset).
 * Prefers the first HTTPS production URL in CLIENT_URL when set.
 */
function getClientBaseUrl() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  const urls = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const production = urls.find(
    (u) => u.startsWith('https://') && !u.includes('localhost') && !u.includes('127.0.0.1')
  );

  return (production || urls[0]).replace(/\/$/, '');
}

function getGoogleCallbackUrl() {
  const url =
    process.env.GOOGLE_CALLBACK_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://allowanceai-api.onrender.com/api/auth/google/callback'
      : 'http://localhost:5000/api/auth/google/callback');

  return url.replace(/\/$/, '');
}

module.exports = {
  getClientBaseUrl,
  getGoogleCallbackUrl,
};
