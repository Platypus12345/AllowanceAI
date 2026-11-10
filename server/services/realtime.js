// Websocket push, so a transaction arriving from anywhere (the mobile SMS parser, a
// Setu AA pull, another browser tab) updates an open dashboard without a refresh.
//
// Chose `ws` over socket.io: this is one-way server->client notification of "something
// changed, refetch", and socket.io's protocol, rooms and client bundle buy nothing here.
// The reconnect behaviour socket.io is usually kept for lives in the client instead,
// which matters more on Render free instances that sleep and drop connections.
//
// Fail-open like the Redis cache: if the socket never connects the dashboard still works,
// it just refetches on its own actions rather than on a push. Real-time is an enhancement,
// never a requirement for the page to function.

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

// userId -> Set<WebSocket>. A user may legitimately have several (phone + laptop).
const clients = new Map();

let wss = null;

function addClient(userId, socket) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(socket);
}

function removeClient(userId, socket) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) clients.delete(userId);
}

/**
 * Notify every open socket belonging to one user.
 * Never throws: a broken socket must not fail the HTTP request that triggered this.
 */
function publishToUser(userId, payload) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return 0;

  const message = JSON.stringify(payload);
  let delivered = 0;
  for (const socket of set) {
    try {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
        delivered += 1;
      }
    } catch {
      /* a dead socket is cleaned up by its own close handler */
    }
  }
  return delivered;
}

/** Number of live sockets for a user. Test/diagnostic helper. */
function connectionCount(userId) {
  return clients.get(userId)?.size || 0;
}

function attach(httpServer, { path = '/ws' } = {}) {
  wss = new WebSocketServer({ server: httpServer, path });

  wss.on('connection', (socket, req) => {
    // The browser WebSocket API cannot set an Authorization header, so the JWT comes
    // in the query string. Same secret and same claim as verifyJWT — an unauthenticated
    // socket is closed immediately rather than left open and silent.
    let userId = null;
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('no token');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch {
      socket.close(4401, 'unauthorized');
      return;
    }

    addClient(userId, socket);
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('close', () => removeClient(userId, socket));
    socket.on('error', () => removeClient(userId, socket));

    try {
      socket.send(JSON.stringify({ type: 'connected' }));
    } catch {
      /* ignore */
    }
  });

  // Render free instances and intermediate proxies drop idle connections silently —
  // the socket looks open but nothing arrives. Ping periodically and reap the dead,
  // otherwise `clients` grows forever with sockets that will never deliver.
  const heartbeat = setInterval(() => {
    if (!wss) return;
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30000);
  heartbeat.unref();

  return wss;
}

async function close() {
  const server = wss;
  wss = null;
  clients.clear();
  if (!server) return;
  for (const socket of server.clients) {
    try {
      socket.terminate();
    } catch {
      /* ignore */
    }
  }
  await new Promise((resolve) => server.close(resolve));
}

module.exports = { attach, publishToUser, connectionCount, close };
