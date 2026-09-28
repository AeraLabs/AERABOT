import {
  sanitizeOrbPalette,
  type AeraPreferences,
  type OrbPalette,
  type OrbSizePreference,
  type PresenceStyle,
  type SpatialBehavior,
} from "./preferences";

const STORAGE_KEY = "aera.appearanceProfiles.v1";
const MAX_PROFILES = 6;

export interface AppearanceProfile {
  id: string;
  name: string;
  palette: OrbPalette;
  presenceStyle: PresenceStyle;
  orbSize: OrbSizePreference;
  spatialBehavior: SpatialBehavior;
}

function validPresence(value: unknown): value is PresenceStyle {
  return ["serene", "balanced", "expressive"].includes(String(value));
}

function validSize(value: unknown): value is OrbSizePreference {
  return ["compact", "standard", "large"].includes(String(value));
}

function validBehavior(value: unknown): value is SpatialBehavior {
  return ["quiet", "adaptive", "companion"].includes(String(value));
}

export function normalizeAppearanceProfile(
  value: unknown,
): AppearanceProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppearanceProfile>;
  if (typeof candidate.id !== "string" || candidate.id.length < 1) return null;
  if (typeof candidate.name !== "string" || candidate.name.trim().length < 1) {
    return null;
  }

  return {
    id: candidate.id.slice(0, 80),
    name: candidate.name.trim().slice(0, 32),
    palette: sanitizeOrbPalette(candidate.palette),
    presenceStyle: validPresence(candidate.presenceStyle)
      ? candidate.presenceStyle
      : "balanced",
    orbSize: validSize(candidate.orbSize) ? candidate.orbSize : "standard",
    spatialBehavior: validBehavior(candidate.spatialBehavior)
      ? candidate.spatialBehavior
      : "adaptive",
  };
}

export function captureAppearanceProfile(
  id: string,
  name: string,
  preferences: AeraPreferences,
): AppearanceProfile {
  return {
    id,
    name: name.trim().slice(0, 32) || "AERA Look",
    palette: { ...preferences.orbPalette },
    presenceStyle: preferences.presenceStyle,
    orbSize: preferences.orbSize,
    spatialBehavior: preferences.spatialBehavior,
  };
}

export function loadAppearanceProfiles(): AppearanceProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeAppearanceProfile)
      .filter((profile): profile is AppearanceProfile => Boolean(profile))
      .slice(0, MAX_PROFILES);
  } catch {
    return [];
  }
}

export function saveAppearanceProfiles(profiles: AppearanceProfile[]) {
  const normalized = profiles
    .map(normalizeAppearanceProfile)
    .filter((profile): profile is AppearanceProfile => Boolean(profile))
    .slice(0, MAX_PROFILES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Profiles are optional; AERA remains functional without storage.
  }

  return normalized;
}

export function applyAppearanceProfile(
  preferences: AeraPreferences,
  profile: AppearanceProfile,
): AeraPreferences {
  return {
    ...preferences,
    orbPalette: { ...profile.palette },
    presenceStyle: profile.presenceStyle,
    orbSize: profile.orbSize,
    spatialBehavior: profile.spatialBehavior,
  };
}
