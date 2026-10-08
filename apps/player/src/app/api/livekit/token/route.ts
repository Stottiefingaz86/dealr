import { NextResponse } from "next/server";
import {
  AccessToken,
  AgentDispatchClient,
  type AgentDispatch,
} from "livekit-server-sdk";

export const runtime = "nodejs";

const DEALER_AGENT_NAME = "dealr-isla";

/** Serialize dispatches so warm + table don't spawn two agents. */
const dispatchLocks = new Map<string, Promise<unknown>>();
/** Cooldown so force-retries cannot burn Bey credits in a loop. */
const lastDispatchAt = new Map<string, number>();
const DISPATCH_COOLDOWN_MS = 45_000;

function livekitCreds() {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

function jobIsRunning(job: { state?: { status?: unknown; endedAt?: unknown } }): boolean {
  const status = String(job.state?.status ?? "");
  const ended = job.state?.endedAt;
  const endedNum = typeof ended === "string" || typeof ended === "number" ? Number(ended) : 0;
  if (endedNum > 0) return false;
  return status.includes("RUNNING") || status === "2";
}

function dispatchIsRunning(d: AgentDispatch): boolean {
  if (d.agentName !== DEALER_AGENT_NAME) return false;
  return (d.state?.jobs ?? []).some((j) => jobIsRunning(j));
}

/**
 * Ensure a live dealr-isla job. Finished/zombie dispatches are deleted first —
 * otherwise LiveKit can look "busy" while no worker is actually in the room.
 */
async function ensureDealerDispatch(room: string, force = false) {
  const prev = dispatchLocks.get(room) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  dispatchLocks.set(
    room,
    prev.then(() => gate).catch(() => gate),
  );
  await prev.catch(() => undefined);

  try {
    const creds = livekitCreds();
    if (!creds) return { ok: false as const, reason: "missing creds" };
    const client = new AgentDispatchClient(creds.url, creds.apiKey, creds.apiSecret);

    let existing: AgentDispatch[] = [];
    try {
      existing = await client.listDispatch(room);
    } catch {
      existing = [];
    }

    const running = existing.filter(dispatchIsRunning);
    const recent = Date.now() - (lastDispatchAt.get(room) ?? 0) < DISPATCH_COOLDOWN_MS;

    // Never kill a live job on force during cooldown — that was the freeze storm.
    if (running.length > 0 && (!force || recent)) {
      const keep = running[0]!;
      for (const d of existing) {
        if (d.agentName !== DEALER_AGENT_NAME) continue;
        if (d.id === keep.id) continue;
        try {
          await client.deleteDispatch(d.id, room);
        } catch {
          /* ignore */
        }
      }
      return { ok: true as const, reused: true, id: keep.id };
    }

    for (const d of existing) {
      if (d.agentName !== DEALER_AGENT_NAME) continue;
      try {
        await client.deleteDispatch(d.id, room);
      } catch {
        /* ignore */
      }
    }

    try {
      const dispatch = await client.createDispatch(room, DEALER_AGENT_NAME);
      lastDispatchAt.set(room, Date.now());
      return { ok: true as const, reused: false, id: dispatch.id };
    } catch (err) {
      return {
        ok: false as const,
        reason: err instanceof Error ? err.message : "dispatch failed",
      };
    }
  } finally {
    release();
  }
}

/**
 * Mint a LiveKit viewer token and ensure Isla is dispatched into the room.
 */
export async function POST(req: Request) {
  const creds = livekitCreds();
  if (!creds) {
    return NextResponse.json(
      {
        error: "LiveKit not configured",
        hint: "Add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET from cloud.livekit.io (free tier works).",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    room?: string;
    identity?: string;
    name?: string;
    /** When true, only dispatch the agent (no token). */
    dispatchOnly?: boolean;
    /** Delete any existing dispatch and create a fresh job. */
    force?: boolean;
  };
  const room = (body.room || "dealr-table").slice(0, 64);

  const dispatch = await ensureDealerDispatch(room, Boolean(body.force));
  if (body.dispatchOnly) {
    return NextResponse.json({ room, dispatch });
  }

  const identity = (body.identity || `player-${Date.now()}`).slice(0, 64);
  const name = (body.name || "Player").slice(0, 64);

  const at = new AccessToken(creds.apiKey, creds.apiSecret, { identity, name });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: false,
    canSubscribe: true,
    canPublishData: true,
  });
  // Explicit AgentDispatchClient above is the source of truth — avoid double jobs
  // from roomConfig agent auto-dispatch.
  const token = await at.toJwt();

  return NextResponse.json({
    url: creds.url,
    token,
    room,
    dispatch,
  });
}

export async function GET() {
  const livekit = Boolean(livekitCreds());
  const bey = Boolean(process.env.BEY_API_KEY?.trim() && process.env.BEY_AVATAR_ID?.trim());
  return NextResponse.json({
    ready: livekit,
    livekit,
    bey,
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    url: process.env.LIVEKIT_URL ? "[set]" : null,
    avatarId: process.env.BEY_AVATAR_ID ?? null,
  });
}
