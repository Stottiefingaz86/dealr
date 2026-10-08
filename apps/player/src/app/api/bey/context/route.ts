import { NextResponse } from "next/server";
import {
  getTableSnapshot,
  putTableSnapshot,
  type BeyTableSnapshot,
} from "@/lib/bey/table-context-store";

export const runtime = "nodejs";

/** Player client pushes live shoe/chat/clock state here. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | (Partial<BeyTableSnapshot> & { sessionId?: string })
    | null;
  const sessionId = body?.sessionId?.trim();
  if (!sessionId || !body?.summary) {
    return NextResponse.json({ error: "sessionId and summary required" }, { status: 400 });
  }

  const snap: BeyTableSnapshot = {
    updatedAt: new Date().toISOString(),
    phase: body.phase,
    actingSeat: body.actingSeat,
    actingName: body.actingName ?? null,
    dealerTotal: body.dealerTotal,
    dealerCards: body.dealerCards ?? [],
    bettingRemaining: body.bettingRemaining ?? null,
    actionRemaining: body.actionRemaining ?? null,
    localSeat: body.localSeat ?? null,
    localName: body.localName ?? null,
    seats: body.seats ?? [],
    recentChat: body.recentChat ?? [],
    beats: body.beats ?? [],
    summary: body.summary,
  };
  putTableSnapshot(sessionId, snap);
  return NextResponse.json({ ok: true, updatedAt: snap.updatedAt });
}

/** Dealer-agent polls this for live context. */
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const snap = getTableSnapshot(sessionId);
  if (!snap) {
    return NextResponse.json({ error: "No snapshot yet" }, { status: 404 });
  }
  return NextResponse.json(snap);
}
