import { NextResponse } from "next/server";
import { islaDealerSystemPrompt } from "@/lib/bey/isla-prompt";
import { beyFetch, type BeyAgent, type BeyAvatar } from "@/lib/bey/server";

export const runtime = "nodejs";

/**
 * Create (or reuse) the Isla managed agent.
 * Body: { avatarId?: string, context?: string }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    avatarId?: string;
    context?: string;
    name?: string;
  };

  let avatarId = body.avatarId?.trim() || process.env.BEY_AVATAR_ID?.trim();
  if (!avatarId) {
    const avatars = await beyFetch<{ data?: BeyAvatar[] } | BeyAvatar[]>("/avatars?limit=20");
    if (!avatars.ok) {
      return NextResponse.json({ error: avatars.detail }, { status: avatars.status });
    }
    const list = Array.isArray(avatars.data) ? avatars.data : (avatars.data.data ?? []);
    avatarId = list[0]?.id;
  }
  if (!avatarId) {
    return NextResponse.json({ error: "No Beyond Presence avatar available" }, { status: 400 });
  }

  const existing = process.env.BEY_AGENT_ID?.trim();
  if (existing && !body.context) {
    const got = await beyFetch<BeyAgent>(`/agents/${existing}`);
    if (got.ok) {
      return NextResponse.json({ agent: got.data, reused: true });
    }
  }

  const created = await beyFetch<BeyAgent>("/agents", {
    method: "POST",
    json: {
      name: body.name?.trim() || "Isla Noir",
      avatar_id: avatarId,
      system_prompt: islaDealerSystemPrompt(body.context),
      language: "en-US",
      greeting: "Welcome to the table. I'm Isla — place your bets when you're ready.",
      max_session_length_minutes: 60,
    },
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.detail }, { status: created.status });
  }

  return NextResponse.json({
    agent: created.data,
    avatarId,
    reused: false,
    hint: "Save agent.id as BEY_AGENT_ID in .env for stable sessions.",
  });
}
