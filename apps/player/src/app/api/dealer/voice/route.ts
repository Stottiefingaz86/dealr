import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Probe: TTS is on when DEEPGRAM_API_KEY is set in Vercel. */
export function GET() {
  const enabled = Boolean(process.env.DEEPGRAM_API_KEY?.trim());
  return NextResponse.json({ enabled });
}
