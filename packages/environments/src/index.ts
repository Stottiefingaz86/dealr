import {
  DEFAULT_ENVIRONMENT_SETTINGS,
  type PlayerEnvironmentSettings,
} from "@live-dealr/shared-types";

export * from "./table-layout";

export interface EnvironmentDefinition {
  id: string;
  name: string;
  description: string;
}

export const ENVIRONMENTS: EnvironmentDefinition[] = [
  { id: "monaco-night", name: "Monaco Night", description: "Harbour light, quiet luxury." },
  { id: "miami-rooftop", name: "Miami Rooftop", description: "Warm air, distant city." },
  { id: "members-club", name: "Private Members Club", description: "Low lamps, close conversation." },
];

export function createEnvironmentSettings(
  overrides: Partial<PlayerEnvironmentSettings> = {},
): PlayerEnvironmentSettings {
  return { ...DEFAULT_ENVIRONMENT_SETTINGS, ...overrides };
}

export const ANIMATION_INTENSITY = {
  off: 0,
  low: 0.28,
  medium: 0.55,
  high: 0.88,
} as const;
