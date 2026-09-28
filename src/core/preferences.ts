export type GraphicsQuality = "auto" | "ultra" | "high" | "balanced" | "efficiency";
export type MotionPreference = "system" | "reduce" | "full";
export type AiProviderPreference = "auto" | "ollama" | "llamacpp" | "openai_local";
export type TalkBackPreference = "auto" | "text" | "voice";
export type PresenceStyle = "serene" | "balanced" | "expressive";
export type OrbSizePreference = "compact" | "standard" | "large";
export type SpatialBehavior = "quiet" | "adaptive" | "companion";

export interface OrbPalette {
  primary: string;
  secondary: string;
  accent: string;
}

export const DEFAULT_ORB_PALETTE: OrbPalette = {
  primary: "#eefcff",
  secondary: "#7ff0d2",
  accent: "#65aaff",
};

export interface AeraPreferences {
  muted: boolean;
  quality: GraphicsQuality;
  motion: MotionPreference;
  aiProvider: AiProviderPreference;
  aiModel: string;
  talkBack: TalkBackPreference;
  spatialAwareness: boolean;
  presenceStyle: PresenceStyle;
  orbPalette: OrbPalette;
  orbSize: OrbSizePreference;
  spatialBehavior: SpatialBehavior;
  wakeWordEnabled: boolean;
}

const STORAGE_KEY = "aera.preferences.v1";

export const DEFAULT_PREFERENCES: AeraPreferences = {
  muted: false,
  quality: "auto",
  motion: "system",
  aiProvider: "auto",
  aiModel: "",
  talkBack: "auto",
  spatialAwareness: true,
  presenceStyle: "balanced",
  orbPalette: DEFAULT_ORB_PALETTE,
  orbSize: "standard",
  spatialBehavior: "adaptive",
  wakeWordEnabled: false,
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
      aiProvider: ["auto", "ollama", "llamacpp", "openai_local"].includes(parsed.aiProvider ?? "")
        ? (parsed.aiProvider as AiProviderPreference)
        : DEFAULT_PREFERENCES.aiProvider,
      aiModel: typeof parsed.aiModel === "string" ? parsed.aiModel : "",
      talkBack: ["auto", "text", "voice"].includes(parsed.talkBack ?? "")
        ? (parsed.talkBack as TalkBackPreference)
        : DEFAULT_PREFERENCES.talkBack,
      spatialAwareness:
        typeof parsed.spatialAwareness === "boolean"
          ? parsed.spatialAwareness
          : DEFAULT_PREFERENCES.spatialAwareness,
      presenceStyle: ["serene", "balanced", "expressive"].includes(
        parsed.presenceStyle ?? "",
      )
        ? (parsed.presenceStyle as PresenceStyle)
        : DEFAULT_PREFERENCES.presenceStyle,
      orbPalette: sanitizeOrbPalette(parsed.orbPalette),
      orbSize: ["compact", "standard", "large"].includes(parsed.orbSize ?? "")
        ? (parsed.orbSize as OrbSizePreference)
        : DEFAULT_PREFERENCES.orbSize,
      spatialBehavior: ["quiet", "adaptive", "companion"].includes(
        parsed.spatialBehavior ?? "",
      )
        ? (parsed.spatialBehavior as SpatialBehavior)
        : DEFAULT_PREFERENCES.spatialBehavior,
      wakeWordEnabled:
        typeof parsed.wakeWordEnabled === "boolean"
          ? parsed.wakeWordEnabled
          : DEFAULT_PREFERENCES.wakeWordEnabled,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function validHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function sanitizeOrbPalette(value: unknown): OrbPalette {
  if (!value || typeof value !== "object") return DEFAULT_ORB_PALETTE;
  const candidate = value as Partial<OrbPalette>;
  return {
    primary: validHex(candidate.primary)
      ? candidate.primary.toLowerCase()
      : DEFAULT_ORB_PALETTE.primary,
    secondary: validHex(candidate.secondary)
      ? candidate.secondary.toLowerCase()
      : DEFAULT_ORB_PALETTE.secondary,
    accent: validHex(candidate.accent)
      ? candidate.accent.toLowerCase()
      : DEFAULT_ORB_PALETTE.accent,
  };
}

export function savePreferences(preferences: AeraPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // AERA remains functional when persistent storage is unavailable.
  }
}
