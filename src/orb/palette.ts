import type { OrbPalette, PresenceStyle } from "../core/preferences";

export interface PresenceProfile {
  motion: number;
  hover: number;
  bloom: number;
  orbit: number;
  particles: number;
}

export const PRESENCE_PROFILES: Record<PresenceStyle, PresenceProfile> = {
  serene: {
    motion: 0.55,
    hover: 0.6,
    bloom: 0.7,
    orbit: 0.65,
    particles: 0.58,
  },
  balanced: {
    motion: 1,
    hover: 1,
    bloom: 1,
    orbit: 1,
    particles: 1,
  },
  expressive: {
    motion: 1.42,
    hover: 1.35,
    bloom: 1.38,
    orbit: 1.3,
    particles: 1.25,
  },
};

export function paletteCssVariables(palette: OrbPalette) {
  return {
    "--aera-primary": palette.primary,
    "--aera-secondary": palette.secondary,
    "--aera-accent": palette.accent,
  } as Record<string, string>;
}
