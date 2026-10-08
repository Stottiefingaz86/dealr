export type BackgroundEffectId =
  | "none"
  | "studio"
  | "flames"
  | "embers"
  | "aurora"
  | "smoke"
  | "nebula"
  | "ink"
  | "plasma";

export type TableEffectId = "dust" | "aurora" | "grid" | "nebula" | "ripple" | "plasma";

export interface PlayerEnvironmentSettings {
  dealerVolume: number;
  tableVolume: number;
  ambientVolume: number;
  socialVolume: number;
  /** 0–360, Philips Hue style colour wash */
  lightingHue: number;
  /** 0–1 room brightness */
  lightingBrightness: number;
  /** Soft pulse of the Hue lamps */
  lightingPulse: boolean;
  /** Full-screen atmospheric FX behind / around the dealer */
  backgroundEffect: BackgroundEffectId;
  /** Living surface rendered on the virtual table slab */
  tableEffect: TableEffectId;
  animationIntensity: "off" | "low" | "medium" | "high";
  reducedMotion: boolean;
  environmentId: string;
}

export const DEFAULT_ENVIRONMENT_SETTINGS: PlayerEnvironmentSettings = {
  dealerVolume: 0.8,
  tableVolume: 0.5,
  ambientVolume: 0.2,
  socialVolume: 0.4,
  lightingHue: 265,
  lightingBrightness: 0.72,
  lightingPulse: true,
  backgroundEffect: "aurora",
  tableEffect: "dust",
  animationIntensity: "medium",
  reducedMotion: false,
  environmentId: "monaco-night",
};

export const HUE_PRESETS = [
  { id: "sunset", label: "Sunset", hue: 28 },
  { id: "rose", label: "Rose", hue: 340 },
  { id: "violet", label: "Violet", hue: 265 },
  { id: "ocean", label: "Ocean", hue: 198 },
  { id: "forest", label: "Forest", hue: 145 },
  { id: "arctic", label: "Arctic", hue: 205 },
] as const;

export const BACKGROUND_EFFECTS = [
  { id: "none", label: "None", hint: "Clean void" },
  { id: "studio", label: "Hue Room", hint: "Smart light bars washing a dark wall" },
  { id: "flames", label: "Flames", hint: "Real fire, tinted to your light" },
  { id: "embers", label: "Embers", hint: "Sparks drifting through the dark" },
  { id: "aurora", label: "Aurora", hint: "Curtains of light over a starry sky" },
  { id: "smoke", label: "Smoke", hint: "Slow dark liquid smoke" },
  { id: "nebula", label: "Nebula", hint: "Deep-space gas clouds & stars" },
  { id: "ink", label: "Ink", hint: "Liquid marble with gold veins" },
  { id: "plasma", label: "Plasma", hint: "Slow raymarched glow" },
] as const satisfies ReadonlyArray<{
  id: BackgroundEffectId;
  label: string;
  hint: string;
}>;

export const TABLE_EFFECTS = [
  { id: "dust", label: "Dust & Aura", hint: "Soft glow, drifting motes" },
  { id: "aurora", label: "Aurora", hint: "Soft light under glass" },
  { id: "grid", label: "Grid", hint: "Neon horizon lines" },
  { id: "nebula", label: "Nebula", hint: "Deep space dust" },
  { id: "ripple", label: "Ripple", hint: "Slow pulses from the shoe" },
  { id: "plasma", label: "Plasma", hint: "Shifting colour" },
] as const satisfies ReadonlyArray<{
  id: TableEffectId;
  label: string;
  hint: string;
}>;
