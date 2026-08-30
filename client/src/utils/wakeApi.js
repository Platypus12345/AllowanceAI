/**
 * Ping Render API until it responds with real JSON health (handles cold-start).
 * Ignores HTML loading pages that can return HTTP 200 while the app is still spinning up.
 */
export async function wakeApiServer(maxAttempts = 20, delayMs = 3000) {
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const healthUrl = `${apiBase}/api/health`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeout);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          // Prefer dbReady when present (new API); accept legacy { status: 'ok' } too
          if (data?.status === 'ok' && data.dbReady !== false) {
            return { ok: true, attempt };
          }
        }
      }
    } catch {
      // Render may still be waking — retry
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { ok: false, attempt: maxAttempts };
}
