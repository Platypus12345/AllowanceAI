const mongoose = require('mongoose');

const DEFAULT_DB_NAME = 'allowanceAI';

/**
 * Fix common Atlas URI mistakes that cause "Invalid namespace: allowanceAI/.users".
 * Strips invalid path segments after the database name (e.g. "/.users", "/users" as extra path).
 */
function sanitizeMongoUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return `mongodb://127.0.0.1:27017/${DEFAULT_DB_NAME}`;
  }

  let cleaned = uri.trim();

  // Remove accidental collection paths (e.g. "/.users", "/users") after the database name
  cleaned = cleaned.replace(
    /(mongodb(?:\+srv)?:\/\/[^/]+\/)([^/?]+)(\/[^?]*)/i,
    (match, prefix, dbName, extraPath) => {
      console.warn(
        `[MongoDB] Removed invalid path "${extraPath}" from MONGO_URI; using database "${dbName}" only`
      );
      return `${prefix}${dbName}`;
    }
  );

  return cleaned;
}

function getDbNameFromUri(uri) {
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^/?]+)/i);
  return match?.[1] || DEFAULT_DB_NAME;
}

async function connectDatabase() {
  const rawUri = process.env.MONGO_URI;
  const uri = sanitizeMongoUri(rawUri);
  const dbName = getDbNameFromUri(uri);

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    dbName,
    maxPoolSize: 10,
  });

  const safeLog = uri.replace(/:([^@/]+)@/, ':***@');
  console.log(`MongoDB connected (database: ${dbName})`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`MongoDB URI: ${safeLog}`);
  }

  return mongoose.connection;
}

module.exports = {
  connectDatabase,
  sanitizeMongoUri,
  DEFAULT_DB_NAME,
};
