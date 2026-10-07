/** Mixer levels shared by all SFX modules; driven by the Atmosphere sliders. */
export const sfxLevels = {
  table: 0.5,
  social: 0.4,
};

export function setSfxLevels(patch: Partial<typeof sfxLevels>) {
  Object.assign(sfxLevels, patch);
}
