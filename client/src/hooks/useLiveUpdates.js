// Subscribes to the server's websocket push so the dashboard updates without a refresh
// when a transaction arrives from anywhere — the mobile SMS parser, a Setu AA pull, or
// another tab.
//
// Degrades silently on purpose. If the socket never connects (a proxy that blocks
// upgrades, a sleeping Render instance, no network) the dashboard still works; it just
// updates on the user's own actions instead of on a push. Real-time is an enhancement,
// so a failure here must never surface as an error to the user.

import { useEffect, useRef, useState } from 'react';

function websocketUrl() {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  if (!token) return null;

  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  // http -> ws, https -> wss. Getting this wrong silently fails on Vercel, which is https.
  const wsBase = apiBase.replace(/^http/, 'ws');
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

export default function useLiveUpdates(onEvent) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);

  // Keep the latest callback without tearing down the socket on every render.
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket = null;
    let retryTimer = null;
    let attempts = 0;
    let cancelled = false;

    function open() {
      if (cancelled) return;
      const url = websocketUrl();
      if (!url) return;

      try {
        socket = new WebSocket(url);
      } catch {
        return schedule();
      }

      socket.onopen = () => {
        if (cancelled) return;
        attempts = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload?.type === 'connected') return;
        if (handlerRef.current) handlerRef.current(payload);
      };

      socket.onclose = (event) => {
        setConnected(false);
        // 4401 is this server's "unauthorized". Retrying cannot fix a bad token and
        // would reconnect in a tight loop, so stop.
        if (event.code === 4401) return;
        schedule();
      };

      socket.onerror = () => {
        // onclose always follows, which is where the retry is scheduled.
        setConnected(false);
      };
    }

    function schedule() {
      if (cancelled) return;
      attempts += 1;
      if (attempts > 6) return; // give up quietly rather than hammer a dead endpoint
      const delay = Math.min(30000, 1000 * 2 ** (attempts - 1));
      retryTimer = setTimeout(open, delay);
    }

    open();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { connected };
}
