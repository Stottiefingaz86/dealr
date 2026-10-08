import { NextResponse } from "next/server";
import { beyFetch, type BeyLiveKitRoom } from "@/lib/bey/server";

export const runtime = "nodejs";

/**
 * Mint a LiveKit room for the Isla agent (Growth+ plan).
 * Client connects with livekit-client and pipes video into the dealer slot.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string;
    userName?: string;
    tableId?: string;
  };

  const agentId = body.agentId?.trim() || process.env.BEY_AGENT_ID?.trim();
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId — create one via POST /api/bey/agent and set BEY_AGENT_ID" },
      { status: 400 },
    );
  }

  const room = await beyFetch<BeyLiveKitRoom>("/livekit-rooms", {
    method: "POST",
    json: {
      agent_id: agentId,
      user_name: body.userName?.trim() || "Player",
      tags: {
        product: "dealr",
        table: body.tableId?.slice(0, 30) || "demo",
      },
    },
  });

  if (!room.ok) {
    return NextResponse.json(
      {
        error: room.detail,
        hint:
          room.status === 403
            ? "LiveKit room minting needs Growth plan (or use Speech-to-Video + your own LiveKit)."
            : undefined,
      },
      { status: room.status },
    );
  }

  return NextResponse.json({
    conversationId: room.data.id,
    agentId: room.data.agent_id,
    livekitUrl: room.data.livekit_url,
    livekitToken: room.data.livekit_token,
  });
}
