export type GraphicsQuality = "auto" | "ultra" | "high" | "balanced" | "efficiency";
export type MotionPreference = "system" | "reduce" | "full";

export interface AeraPreferences {
  muted: boolean;
  quality: GraphicsQuality;
  motion: MotionPreference;
}

const STORAGE_KEY = "aera.preferences.v1";

export const DEFAULT_PREFERENCES: AeraPreferences = {
  muted: false,
  quality: "auto",
  motion: "system",
};

export function loadPreferences(): AeraPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AeraPreferences>;
    return {
      muted: typeof parsed.muted === "boolean" ? parsed.muted : DEFAULT_PREFERENCES.muted,
      quality: ["auto", "ultra", "high", "balanced", "efficiency"].includes(parsed.quality ?? "")
        ? (parsed.quality as GraphicsQuality)
        : DEFAULT_PREFERENCES.quality,
      motion: ["system", "reduce", "full"].includes(parsed.motion ?? "")
        ? (parsed.motion as MotionPreference)
        : DEFAULT_PREFERENCES.motion,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AeraPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // AERA remains functional when persistent storage is unavailable.
  }
}
