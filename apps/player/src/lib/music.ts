"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Built-in background music library — lounge / casino cuts by Kevin MacLeod
 * (incompetech.com), licensed CC BY 4.0. Served from /public/music.
 */
export interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  src: string;
  /** seconds */
  duration: number;
  hue: number;
}

export const DEFAULT_TRACK_ID = "lobby-time";

export const MUSIC_LIBRARY: readonly MusicTrack[] = [
  {
    id: "deadly-roulette",
    title: "Deadly Roulette",
    mood: "Casino · Big band",
    src: "/music/deadly-roulette.mp3",
    duration: 159,
    hue: 350,
  },
  {
    id: "lobby-time",
    title: "Lobby Time",
    mood: "Lounge · Vibraphone",
    src: "/music/lobby-time.mp3",
    duration: 193,
    hue: 200,
  },
  {
    id: "bossa-antigua",
    title: "Bossa Antigua",
    mood: "Bossa nova · Smooth",
    src: "/music/bossa-antigua.mp3",
    duration: 283,
    hue: 30,
  },
  {
    id: "night-on-the-docks",
    title: "Night on the Docks",
    mood: "Late night · Sax",
    src: "/music/night-on-the-docks-sax.mp3",
    duration: 174,
    hue: 260,
  },
  {
    id: "backed-vibes",
    title: "Backed Vibes",
    mood: "Jazz · Easy",
    src: "/music/backed-vibes-clean.mp3",
    duration: 228,
    hue: 160,
  },
  {
    id: "hard-boiled",
    title: "Hard Boiled",
    mood: "Noir · Slow burn",
    src: "/music/hard-boiled.mp3",
    duration: 181,
    hue: 15,
  },
  {
    id: "george-street-shuffle",
    title: "George Street Shuffle",
    mood: "Swing · Upbeat",
    src: "/music/george-street-shuffle.mp3",
    duration: 268,
    hue: 45,
  },
  {
    id: "sidewalk-shade",
    title: "Sidewalk Shade",
    mood: "Cool jazz · Brushes",
    src: "/music/sidewalk-shade.mp3",
    duration: 157,
    hue: 220,
  },
];

interface MusicState {
  trackId: string | null;
  playing: boolean;
  position: number;
}

let audio: HTMLAudioElement | null = null;
let state: MusicState = { trackId: null, playing: false, position: 0 };
let volume = 0.2;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<MusicState>) {
  state = { ...state, ...patch };
  emit();
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = false;
    audio.preload = "none";
    audio.volume = volume;
    audio.addEventListener("timeupdate", () => set({ position: audio?.currentTime ?? 0 }));
    audio.addEventListener("ended", () => next());
    audio.addEventListener("pause", () => set({ playing: false }));
    audio.addEventListener("play", () => set({ playing: true }));
  }
  return audio;
}

export function playTrack(id: string) {
  const track = MUSIC_LIBRARY.find((t) => t.id === id);
  if (!track) return;
  const el = ensureAudio();
  if (state.trackId !== id) {
    el.src = track.src;
    set({ trackId: id, position: 0 });
  }
  void el.play().catch(() => set({ playing: false }));
}

export function pauseMusic() {
  audio?.pause();
}

export function toggleTrack(id: string) {
  if (state.trackId === id && state.playing) {
    pauseMusic();
  } else {
    playTrack(id);
  }
}

export function next() {
  const idx = MUSIC_LIBRARY.findIndex((t) => t.id === state.trackId);
  const nextTrack = MUSIC_LIBRARY[(idx + 1) % MUSIC_LIBRARY.length];
  if (nextTrack) playTrack(nextTrack.id);
}

export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const SERVER_STATE: MusicState = { trackId: null, playing: false, position: 0 };

export function useMusic(volumeSetting: number) {
  useEffect(() => {
    setMusicVolume(volumeSetting);
  }, [volumeSetting]);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Browsers block autoplay until a gesture. Call once from the table — tries
 * immediately, then retries on the first pointer/keydown if needed.
 */
let ambienceArmed = false;
export function ensureAmbience(trackId: string = DEFAULT_TRACK_ID) {
  if (ambienceArmed) {
    if (!state.playing && state.trackId) void audio?.play().catch(() => undefined);
    return;
  }
  ambienceArmed = true;
  playTrack(trackId);
  if (state.playing) return;
  const kick = () => {
    playTrack(trackId);
    window.removeEventListener("pointerdown", kick, true);
    window.removeEventListener("keydown", kick, true);
  };
  window.addEventListener("pointerdown", kick, true);
  window.addEventListener("keydown", kick, true);
}
