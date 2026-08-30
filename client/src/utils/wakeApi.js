/**
 * Ping Render API until it responds (handles cold-start after idle time).
 */
export async function wakeApiServer(maxAttempts = 15, delayMs = 4000) {
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const healthUrl = `${apiBase}/api/health`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return { ok: true, attempt };
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
