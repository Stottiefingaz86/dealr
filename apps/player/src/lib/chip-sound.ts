/**
 * Spiffing-style SFX — real chip stack + click samples via Web Audio.
 * Unlock on first gesture (Safari).
 */

import { sfxLevels } from "./sfx-levels";

const SFX = {
  chipStack: "/sounds/chip-stack.wav",
  buttonClick: "/sounds/button-click.mp3",
  stand: "/sounds/stand.wav",
  cardFlip: "/sounds/CardFlip.wav",
  redeem: "/sounds/redeem.wav",
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
  const missing = (Object.keys(SFX) as SfxName[]).filter((name) => !buffers.has(name));
  if (missing.length === 0) {
    loaded = true;
    return;
  }
  if (loading) {
    return;
  }
  loading = true;
  const ac = getContext();
  await Promise.all(
    missing.map(async (name) => {
      try {
        const response = await fetch(SFX[name]);
        if (!response.ok) return;
        const arrayBuf = await response.arrayBuffer();
        const audioBuf = await ac.decodeAudioData(arrayBuf.slice(0));
        buffers.set(name, audioBuf);
      } catch {
        // Non-critical
      }
    }),
  );
  loaded = (Object.keys(SFX) as SfxName[]).every((name) => buffers.has(name));
  loading = false;
}

function play(name: SfxName, volume = 0.5, rate = 1) {
  unlockAudio();
  const buf = buffers.get(name);
  if (!buf) {
    void preloadChipSfx().then(() => {
      if (buffers.has(name)) play(name, volume, rate);
    });
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

/** Spiffing-style action clicks — Hit / Stand / Double / Split. */
export function playActionSfx(action: "hit" | "stand" | "double" | "split") {
  switch (action) {
    case "hit":
      play("cardFlip", 0.5, 1);
      break;
    case "stand":
      play("stand", 0.55, 1);
      break;
    case "double":
      play("chipStack", 0.55, 1.05);
      break;
    case "split":
      play("buttonClick", 0.45, 1.15);
      break;
  }
}

/** Soft lock-in when confirming a bet — chip settle + quiet click. */
export function playBetConfirm() {
  play("chipStack", 0.32, 1.08);
  window.setTimeout(() => {
    play("buttonClick", 0.22, 1.25);
  }, 55);
}

/**
 * Confetti celebrate / reward claim — BOL-shadcn redeem sample.
 * Sample peaks ~-17 dB, so gain sits above BOL's 0.7 HTML volume to land
 * at a clear mid level (debounced — one play per claim).
 */
let lastRedeemAt = 0;

export function preloadRedeemSfx() {
  void preloadChipSfx();
}

export function playRedeemSfx() {
  unlockAudio();
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Claim path used to fire this 2–3× in one click — debounce to one sting.
  if (now - lastRedeemAt < 400) return;
  lastRedeemAt = now;

  const level = Math.max(0.55, Math.max(sfxLevels.table, sfxLevels.social));
  const webGain = 1.65 * level;
  const htmlVol = Math.min(1, 0.85 * level);

  const buf = buffers.get("redeem");
  if (buf) {
    const ac = getContext();
    if (ac.state === "suspended") void ac.resume();
    const source = ac.createBufferSource();
    source.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = webGain;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start(0);
    return;
  }

  void preloadChipSfx().then(() => {
    const ready = buffers.get("redeem");
    if (ready) {
      const ac = getContext();
      const source = ac.createBufferSource();
      source.buffer = ready;
      const gain = ac.createGain();
      gain.gain.value = webGain;
      source.connect(gain);
      gain.connect(ac.destination);
      source.start(0);
      return;
    }
    try {
      const audio = new Audio("/sounds/redeem.wav");
      audio.volume = htmlVol;
      void audio.play().catch(() => undefined);
    } catch {
      // non-critical
    }
  });
}

/** Whoosh when a throwable leaves the hand. */
export function playThrowLaunch() {
  unlockAudio();
  const ac = getContext();
  if (ac.state === "suspended") void ac.resume();
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = Math.max(0.35, sfxLevels.social) * 1.1;
  master.connect(ac.destination);

  const len = Math.floor(ac.sampleRate * 0.18);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.7);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(900, t);
  bp.frequency.exponentialRampToValueAtTime(2800, t + 0.14);
  bp.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.55, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(t);
}

type ThrowImpactKind = "splat" | "confetti" | "petals" | "coins" | "frost" | "boom";

/** Impact thud / splat when a throwable lands. */
export function playThrowImpact(kind: ThrowImpactKind) {
  unlockAudio();
  const ac = getContext();
  if (ac.state === "suspended") void ac.resume();
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = Math.max(0.4, sfxLevels.social) * 1.35;
  master.connect(ac.destination);

  // Body thud — always present
  const thudFreq = kind === "boom" ? 70 : kind === "splat" ? 95 : 110;
  const thud = ac.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(thudFreq, t);
  thud.frequency.exponentialRampToValueAtTime(40, t + 0.16);
  const tg = ac.createGain();
  tg.gain.setValueAtTime(0, t);
  tg.gain.linearRampToValueAtTime(kind === "boom" ? 0.75 : 0.55, t + 0.008);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "boom" ? 0.35 : 0.22));
  thud.connect(tg);
  tg.connect(master);
  thud.start(t);
  thud.stop(t + 0.4);

  // Wet noise splat / texture
  const noiseDur =
    kind === "frost" ? 0.28 : kind === "coins" ? 0.2 : kind === "petals" ? 0.22 : 0.16;
  const len = Math.floor(ac.sampleRate * noiseDur);
  const nbuf = ac.createBuffer(1, len, ac.sampleRate);
  const ndata = nbuf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    ndata[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, kind === "splat" ? 0.9 : 1.4);
  }
  const noise = ac.createBufferSource();
  noise.buffer = nbuf;
  const filter = ac.createBiquadFilter();
  if (kind === "frost") {
    filter.type = "highpass";
    filter.frequency.value = 3200;
  } else if (kind === "coins") {
    filter.type = "bandpass";
    filter.frequency.value = 2400;
    filter.Q.value = 6;
  } else if (kind === "splat") {
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  } else {
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1.5;
  }
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(kind === "splat" ? 0.7 : 0.45, t + 0.01);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur);
  noise.connect(filter);
  filter.connect(ng);
  ng.connect(master);
  noise.start(t);

  if (kind === "coins") {
    [1800, 2400, 3200].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ac.createGain();
      const at = t + 0.02 + i * 0.04;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.22, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(g);
      g.connect(master);
      osc.start(at);
      osc.stop(at + 0.15);
    });
  }

  if (kind === "confetti" || kind === "petals") {
    play("buttonClick", 0.35, kind === "petals" ? 1.5 : 1.3);
  }
}
