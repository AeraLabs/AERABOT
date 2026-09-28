import type {
  OrbSizePreference,
  SpatialBehavior,
} from "./preferences";

export const ORB_SIZE_MULTIPLIERS: Record<OrbSizePreference, number> = {
  compact: 0.82,
  standard: 1,
  large: 1.18,
};

export interface SpatialBehaviorProfile {
  cooldownMs: number;
  reactsToGeometry: boolean;
  activeStates: ReadonlySet<string>;
}

export const SPATIAL_BEHAVIOR: Record<
  SpatialBehavior,
  SpatialBehaviorProfile
> = {
  quiet: {
    cooldownMs: 4200,
    reactsToGeometry: false,
    activeStates: new Set(["IDLE", "AMBIENT", "STUDIO", "DND", "SLEEPING"]),
  },
  adaptive: {
    cooldownMs: 1800,
    reactsToGeometry: true,
    activeStates: new Set(["IDLE", "AMBIENT", "STUDIO", "DND", "SLEEPING"]),
  },
  companion: {
    cooldownMs: 750,
    reactsToGeometry: true,
    activeStates: new Set([
      "IDLE",
      "AMBIENT",
      "AWAKE",
      "WAITING",
      "STUDIO",
      "DND",
      "SLEEPING",
    ]),
  },
};
