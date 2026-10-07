/**
 * "Your turn" notification — a soft two-note chime synthesised with Web Audio
 * (no asset to load, always in tune with the mixer). Rising minor-third with a
 * bell-ish overtone, short attack, ~0.9s tail.
 */

import { sfxLevels } from "./sfx-levels";

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

function note(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  at: number,
  dur: number,
  level: number,
) {
  const partials: Array<[number, number]> = [
    [1, 1],
    [2, 0.35],
    [3, 0.12],
  ];
  for (const [mult, amp] of partials) {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * mult;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * amp, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

export function playTurnChime(): void {
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume().catch(() => undefined);
  }
  const master = ac.createGain();
  master.gain.value = Math.min(1, sfxLevels.table * 1.6);
  master.connect(ac.destination);
  const t = ac.currentTime + 0.01;
  // E5 -> G5
  note(ac, master, 659.25, t, 0.7, 0.5);
  note(ac, master, 783.99, t + 0.16, 0.95, 0.55);
}

/**
 * Countdown tick for the final seconds — a short, dry wood-block click.
 * `step` is seconds remaining (3, 2, 1): the pitch rises as time runs out.
 */
export function playCountdownTick(step: number): void {
  const ac = getContext();
  if (ac.state === "suspended") {
    void ac.resume().catch(() => undefined);
  }
  const t = ac.currentTime + 0.005;
  const master = ac.createGain();
  master.gain.value = Math.min(1, sfxLevels.table * 1.5);
  master.connect(ac.destination);

  const base = step <= 1 ? 1320 : step === 2 ? 1100 : 920;
  // Tonal body
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.07);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + 0.12);

  // Noise transient for the "click"
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2500;
  const ng = ac.createGain();
  ng.gain.value = 0.35;
  src.connect(hp);
  hp.connect(ng);
  ng.connect(master);
  src.start(t);
}
