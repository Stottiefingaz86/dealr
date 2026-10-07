/**
 * Isla dealer VO — live TTS when the API has Deepgram, else static wavs.
 */

import { sfxLevels } from "./sfx-levels";
import { unlockAudio } from "./chip-sound";
import {
  speakGoodEvening,
  speakPlaceYourBets,
} from "./dealer-voice";

const LINES = {
  goodEvening: "/sounds/dealer/good-evening.wav",
  placeYourBets: "/sounds/dealer/place-your-bets.wav",
} as const;

type Line = keyof typeof LINES;

let greetedSolo = false;
let greetingUntil = 0;
const buffers = new Map<Line, AudioBuffer>();
let loading: Promise<void> | null = null;
let sharedCtx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
let betsTimer: ReturnType<typeof setTimeout> | null = null;

function getContext(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

async function ensureLoaded(): Promise<void> {
  if (buffers.size === Object.keys(LINES).length) return;
  if (loading) return loading;
  loading = (async () => {
    const ac = getContext();
    await Promise.all(
      (Object.entries(LINES) as [Line, string][]).map(async ([name, url]) => {
        if (buffers.has(name)) return;
        try {
          const res = await fetch(url);
          const raw = await res.arrayBuffer();
          buffers.set(name, await ac.decodeAudioData(raw.slice(0)));
        } catch {
          /* missing asset — skip */
        }
      }),
    );
  })();
  return loading;
}

function playBuffer(name: Line): void {
  const buf = buffers.get(name);
  if (!buf) return;
  const ac = getContext();
  try {
    current?.stop();
  } catch {
    /* already stopped */
  }
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  src.buffer = buf;
  gain.gain.value = Math.min(1, Math.max(0.35, sfxLevels.table) * 1.85);
  src.connect(gain);
  gain.connect(ac.destination);
  current = src;
  src.onended = () => {
    if (current === src) current = null;
  };
  src.start();
}

async function resumeAndPlayWav(name: Line): Promise<boolean> {
  unlockAudio();
  await ensureLoaded();
  const ac = getContext();
  if (ac.state === "suspended") {
    try {
      await ac.resume();
    } catch {
      return false;
    }
  }
  if (ac.state === "suspended" || !buffers.has(name)) return false;
  if (name === "goodEvening") greetingUntil = Date.now() + 2200;
  playBuffer(name);
  return true;
}

/**
 * Solo: once per tab unless forced.
 * Pass `name` for live TTS ("Good evening, Alex").
 */
export function playGoodEvening(opts?: { force?: boolean; name?: string }): void {
  if (!opts?.force && greetedSolo) return;
  void (async () => {
    unlockAudio();
    const spoken = await speakGoodEvening(opts?.name);
    if (spoken) {
      greetingUntil = Date.now() + 2400;
      if (!opts?.force) greetedSolo = true;
      return;
    }
    const ok = await resumeAndPlayWav("goodEvening");
    if (ok && !opts?.force) greetedSolo = true;
  })();
}

/** Every time betting opens. */
export function playPlaceYourBets(): void {
  unlockAudio();
  if (betsTimer) clearTimeout(betsTimer);
  const delay = Math.max(0, greetingUntil - Date.now());
  betsTimer = setTimeout(() => {
    betsTimer = null;
    void (async () => {
      const spoken = await speakPlaceYourBets();
      if (spoken) return;
      await resumeAndPlayWav("placeYourBets");
    })();
  }, delay);
}

export function preloadDealerTalk(): void {
  void ensureLoaded();
}
