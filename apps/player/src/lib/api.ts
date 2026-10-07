/**
 * Resolve where the table lives.
 *
 * - Localhost → Nest API on :4000 (same as `pnpm dev`)
 * - Production (Vercel) with no real API URL → `null` → in-browser demo host
 * - Explicit `NEXT_PUBLIC_API_URL` pointing at a hosted API → that URL
 */
export function resolveApiUrl(): string | null {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (typeof window === "undefined") {
    return env || null;
  }
  const host = window.location.hostname;
  const onLoopback = host === "localhost" || host === "127.0.0.1";
  if (env && !/localhost|127\.0\.0\.1/.test(env)) {
    return env;
  }
  if (onLoopback) {
    return env || "http://localhost:4000";
  }
  // Deployed frontend, no remote API configured — run the table in-process.
  return null;
}

/** @deprecated prefer resolveApiUrl(); kept for any stray imports */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
