/**
 * Beyond Presence REST helpers (server-only).
 * Docs: https://docs.bey.dev
 */

const BEY_API = "https://api.bey.dev/v1";

export function beyApiKey(): string | null {
  const key = process.env.BEY_API_KEY?.trim();
  return key || null;
}

export function beyEnabled(): boolean {
  return Boolean(beyApiKey()) && process.env.BEY_DEALER_ENABLED !== "0";
}

export async function beyFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ ok: true; data: T; status: number } | { ok: false; status: number; detail: string }> {
  const key = beyApiKey();
  if (!key) {
    return { ok: false, status: 503, detail: "BEY_API_KEY is not set" };
  }

  const headers = new Headers(init?.headers);
  headers.set("x-api-key", key);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${BEY_API}${path}`, { ...init, headers, body });
  if (res.status === 204) {
    return { ok: true, data: undefined as T, status: 204 };
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { detail: text };
  }

  if (!res.ok) {
    const detail =
      typeof parsed === "object" &&
      parsed &&
      "detail" in parsed &&
      typeof (parsed as { detail: unknown }).detail === "string"
        ? (parsed as { detail: string }).detail
        : text.slice(0, 280) || res.statusText;
    return { ok: false, status: res.status, detail };
  }

  return { ok: true, data: parsed as T, status: res.status };
}

export type BeyAvatar = {
  id: string;
  name?: string;
  display_name?: string;
};

export type BeyAgent = {
  id: string;
  name?: string;
  avatar_id?: string;
};

export type BeyLiveKitRoom = {
  id: string;
  agent_id: string;
  livekit_url: string;
  livekit_token: string;
  status?: { type?: string };
};
