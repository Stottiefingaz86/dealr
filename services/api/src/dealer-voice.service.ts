import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";

const SPEAK_URL = "https://api.deepgram.com/v2/speak";
const MODEL = "flux-hannah-en";
const MAX_CHARS = 220;
const CACHE_MAX = 80;

@Injectable()
export class DealerVoiceService {
  private readonly log = new Logger(DealerVoiceService.name);
  private readonly cache = new Map<string, Buffer>();

  enabled(): boolean {
    return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
  }

  async synthesize(raw: string): Promise<Buffer> {
    const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
    if (!text) {
      throw new ServiceUnavailableException("Empty speech text");
    }
    const key = process.env.DEEPGRAM_API_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException("DEEPGRAM_API_KEY is not configured");
    }

    const cacheKey = createHash("sha1").update(`${MODEL}|${text}`).digest("hex");
    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

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
      this.log.warn(`Deepgram speak failed ${res.status}: ${detail.slice(0, 200)}`);
      throw new ServiceUnavailableException("Dealer voice unavailable");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (this.cache.size >= CACHE_MAX) {
      const first = this.cache.keys().next().value;
      if (first) this.cache.delete(first);
    }
    this.cache.set(cacheKey, buf);
    return buf;
  }
}
