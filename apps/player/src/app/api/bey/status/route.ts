import { NextResponse } from "next/server";
import { beyApiKey, beyEnabled, beyFetch, type BeyAvatar } from "@/lib/bey/server";

export const runtime = "nodejs";

/** Verify Bey key + list avatars (for setup / health). */
export async function GET() {
  if (!beyApiKey()) {
    return NextResponse.json(
      { enabled: false, detail: "Set BEY_API_KEY in .env (rotate if it was pasted in chat)." },
      { status: 503 },
    );
  }

  const verify = await beyFetch<undefined>("/auth/verify", { method: "GET" });
  if (!verify.ok) {
    return NextResponse.json(
      { enabled: false, detail: verify.detail },
      { status: verify.status },
    );
  }

  const avatars = await beyFetch<{ data?: BeyAvatar[] } | BeyAvatar[]>("/avatars?limit=50");
  const list = avatars.ok
    ? Array.isArray(avatars.data)
      ? avatars.data
      : (avatars.data.data ?? [])
    : [];

  return NextResponse.json({
    enabled: beyEnabled(),
    verified: true,
    agentId: process.env.BEY_AGENT_ID ?? null,
    avatarId: process.env.BEY_AVATAR_ID ?? null,
    avatars: list.map((a) => ({
      id: a.id,
      name: a.name ?? a.display_name ?? a.id,
    })),
  });
}
