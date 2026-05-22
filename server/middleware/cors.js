function getAllowedOrigins() {
  const fromEnv = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return fromEnv;
}

function isOriginAllowed(origin) {
  if (!origin) return true;

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  if (process.env.NODE_ENV === 'production') {
    if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return true;
    if (origin.endsWith('.onrender.com')) return true;
  }

  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('192.168')
  ) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

module.exports = { corsOptions, getAllowedOrigins, isOriginAllowed };
