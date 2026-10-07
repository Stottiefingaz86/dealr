/**
 * Live dealer TTS via Nest → Deepgram Flux Hannah.
 * Falls back silently when the API / key is unavailable.
 */

import { resolveApiUrl } from "./api";
import { unlockAudio } from "./chip-sound";
import { sfxLevels } from "./sfx-levels";

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty"];

let queue: Promise<void> = Promise.resolve();
let currentAudio: HTMLAudioElement | null = null;
let voiceAvailable: boolean | null = null;

export function numberWords(n: number): string {
  const v = Math.floor(n);
  if (v < 20) return ONES[v] ?? String(v);
  if (v < 40) {
    const ten = TENS[Math.floor(v / 10)] ?? "";
    const one = v % 10;
    return one === 0 ? ten : `${ten} ${ONES[one]}`;
  }
  return String(v);
}

export function handTotalWords(label: string | null | undefined): string | null {
  if (!label) return null;
  if (label === "BJ") return "blackjack";
  if (label === "BUST") return "bust";
  const soft = label.startsWith("S");
  const num = Number(label.replace(/^S/, ""));
  if (!Number.isFinite(num)) return null;
  const words = numberWords(num);
  return soft ? `soft ${words}` : words;
}

async function probeVoice(): Promise<boolean> {
  if (voiceAvailable !== null) return voiceAvailable;
  const api = resolveApiUrl();
  if (!api) {
    voiceAvailable = false;
    return false;
  }
  try {
    const res = await fetch(`${api}/dealer/voice`, { method: "GET" });
    if (!res.ok) {
      voiceAvailable = false;
      return false;
    }
    const data = (await res.json()) as { enabled?: boolean };
    voiceAvailable = Boolean(data.enabled);
    return voiceAvailable;
  } catch {
    voiceAvailable = false;
    return false;
  }
}

async function fetchSpeech(text: string): Promise<Blob | null> {
  const api = resolveApiUrl();
  if (!api) return null;
  if (!(await probeVoice())) return null;
  try {
    const res = await fetch(`${api}/dealer/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    unlockAudio();
    try {
      currentAudio?.pause();
    } catch {
      /* ignore */
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    audio.volume = Math.min(1, Math.max(0.25, sfxLevels.table) * 1.35);
    const done = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = done;
    void audio.play().catch(done);
  });
}

let lastLine = "";
let lastLineAt = 0;

/** Queue a spoken line. Returns false if TTS is offline (caller may use a static wav). */
export function speakDealer(text: string): Promise<boolean> {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return Promise.resolve(false);

  // Drop duplicate lines fired twice in quick succession (join retry, double effects).
  const now = Date.now();
  if (line === lastLine && now - lastLineAt < 2800) {
    return Promise.resolve(true);
  }
  lastLine = line;
  lastLineAt = now;

  const job = queue.then(async () => {
    const blob = await fetchSpeech(line);
    if (!blob) return false;
    await playBlob(blob);
    return true;
  });
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function speakGoodEvening(name?: string): Promise<boolean> {
  const who = name?.trim();
  const line = who
    ? `Good evening, ${who}.`
    : "Good evening, gentlemen.";
  return speakDealer(line);
}

export function speakPlaceYourBets(): Promise<boolean> {
  return speakDealer("Place your bets.");
}

export function speakHandTotal(label: string | null | undefined): Promise<boolean> {
  const words = handTotalWords(label);
  if (!words) return Promise.resolve(false);
  return speakDealer(words);
}

export function speakPlayerCount(count: number): Promise<boolean> {
  if (count <= 0) return Promise.resolve(false);
  if (count === 1) return speakDealer("One player at the table.");
  return speakDealer(`${numberWords(count)} players at the table.`);
}

export function speakRewardCongrats(opts: {
  name?: string;
  missionTitle: string;
  amount: number;
  unlockLabel?: string;
}): Promise<boolean> {
  const who = opts.name?.trim() || "there";
  if (opts.amount > 0) {
    return speakDealer(
      `Nice work, ${who}. You claimed ${opts.missionTitle} for ${numberWords(opts.amount)} dollars.`,
    );
  }
  const unlock = opts.unlockLabel?.trim() || "a new reward";
  return speakDealer(`Congratulations, ${who}. You unlocked ${unlock}.`);
}

export function speakTipThanks(opts: {
  name?: string;
  amount: number;
}): Promise<boolean> {
  const who = opts.name?.trim() || "friend";
  if (opts.amount >= 100) {
    return speakDealer(`Wow, thank you so much, ${who}. That's very generous.`);
  }
  if (opts.amount >= 25) {
    return speakDealer(`Thank you for the tip, ${who}. Appreciate you.`);
  }
  return speakDealer(`Thank you for the tip, ${who}.`);
}
