/**
 * Spiffing card deal / flip SFX.
 */

import { sfxLevels } from "./sfx-levels";

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let loading = false;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

async function ensure(name: string, url: string): Promise<AudioBuffer | null> {
  const existing = buffers.get(name);
  if (existing) {
    return existing;
  }
  try {
    const ac = getContext();
    const response = await fetch(url);
    const arrayBuf = await response.arrayBuffer();
    const audioBuf = await ac.decodeAudioData(arrayBuf);
    buffers.set(name, audioBuf);
    return audioBuf;
  } catch {
    return null;
  }
}

function playBuffer(buf: AudioBuffer, volume = 0.4) {
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume();
  }
  const source = ac.createBufferSource();
  source.buffer = buf;
  const gain = ac.createGain();
  gain.gain.value = volume * sfxLevels.table * 2;
  source.connect(gain);
  gain.connect(ac.destination);
  source.start(0);
}

export function playCardDeal() {
  if (!loading) {
    loading = true;
    void ensure("deal", "/sounds/CardDeal.wav").then((buf) => {
      loading = false;
      if (buf) {
        playBuffer(buf, 0.35);
      }
    });
    return;
  }
  const buf = buffers.get("deal");
  if (buf) {
    playBuffer(buf, 0.35);
  }
}

export function playCardFlip() {
  void ensure("flip", "/sounds/CardFlip.wav").then((buf) => {
    if (buf) {
      playBuffer(buf, 0.4);
    }
  });
}
