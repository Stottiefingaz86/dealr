import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SPEAK_URL = "https://api.deepgram.com/v2/speak";
const MODEL = "flux-hannah-en";
const MAX_CHARS = 220;

/** Tiny in-memory cache across warm invocations. */
const cache = new Map<string, ArrayBuffer>();
const CACHE_MAX = 40;

export async function POST(req: Request) {
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY not configured" }, { status: 503 });
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = String(body.text ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_CHARS);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const cacheKey = createHash("sha1").update(`${MODEL}|${text}`).digest("hex");
  const hit = cache.get(cacheKey);
  if (hit) {
    return new NextResponse(hit, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const url = new URL(SPEAK_URL);
  url.searchParams.set("model", MODEL);
  url.searchParams.set("speed", "1");
  url.searchParams.set("expressivity", "-2");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(`[dealer/speak] Deepgram ${res.status}: ${detail.slice(0, 200)}`);
    return NextResponse.json({ error: "Dealer voice unavailable" }, { status: 503 });
  }

  const buf = await res.arrayBuffer();
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(cacheKey, buf);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
