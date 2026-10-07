/**
 * Spiffing-style SFX — real chip stack + click samples via Web Audio.
 * Unlock on first gesture (Safari).
 */

import { sfxLevels } from "./sfx-levels";

const SFX = {
  chipStack: "/sounds/chip-stack.wav",
  buttonClick: "/sounds/button-click.mp3",
} as const;

type SfxName = keyof typeof SFX;

let ctx: AudioContext | null = null;
const buffers = new Map<SfxName, AudioBuffer>();
let loaded = false;
let loading = false;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

export function unlockAudio(): void {
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume().catch(() => undefined);
  }
}

export async function preloadChipSfx(): Promise<void> {
  unlockAudio();
  if (loaded || loading) {
    return;
  }
  loading = true;
  const ac = getContext();
  await Promise.all(
    (Object.entries(SFX) as [SfxName, string][]).map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        const arrayBuf = await response.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(arrayBuf);
        buffers.set(name, audioBuf);
      } catch {
        // Non-critical
      }
    }),
  );
  loaded = true;
  loading = false;
}

function play(name: SfxName, volume = 0.5, rate = 1) {
  unlockAudio();
  void preloadChipSfx();
  const buf = buffers.get(name);
  if (!buf) {
    return;
  }
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume();
  }
  const source = ac.createBufferSource();
  source.buffer = buf;
  source.playbackRate.value = rate;
  const gain = ac.createGain();
  gain.gain.value = volume * sfxLevels.table * 2;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start(0);
}

export function playChipPlace(intensity = 1) {
  play("chipStack", 0.45 + intensity * 0.1, 1);
}

export function playChipSelect() {
  play("buttonClick", 0.35, 1);
}

export function playChipUndo() {
  play("chipStack", 0.4, 0.65);
}

/** Soft pop for emotes / throwables — rides the Social level. */
export function playSocialPop(rate = 1.4) {
  unlockAudio();
  void preloadChipSfx();
  const buf = buffers.get("buttonClick");
  if (!buf) return;
  const ac = getContext();
  const source = ac.createBufferSource();
  source.buffer = buf;
  source.playbackRate.value = rate;
  const gain = ac.createGain();
  gain.gain.value = 0.5 * sfxLevels.social * 2;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start(0);
}
