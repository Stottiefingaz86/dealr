/**
 * Resolve where the Nest table API lives.
 *
 * - Localhost/dev → Nest on :4000
 * - Production with a real hosted API URL → that URL
 * - Production with no API (or a leftover localhost URL) → `null` (in-browser / PeerJS)
 *
 * Never return a loopback URL when the page is served from a real host — that
 * breaks guests on Vercel (wallet, media, sockets silently hit the user's machine).
 */
export function resolveApiUrl(): string | null {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim() || null;
  const isLoopbackUrl = (url: string) => /localhost|127\.0\.0\.1/i.test(url);

  if (typeof window === "undefined") {
    // SSR / build: only trust a non-loopback explicit URL.
    if (env && !isLoopbackUrl(env)) return env;
    return null;
  }

  const host = window.location.hostname;
  const onLoopback = host === "localhost" || host === "127.0.0.1";

  if (env && !isLoopbackUrl(env)) {
    return env;
  }

  if (onLoopback) {
    return "http://localhost:4000";
  }

  return null;
}

/** Absolute API origin, or empty when the client should not call Nest. */
export function getApiUrl(): string {
  return resolveApiUrl() ?? "";
}
