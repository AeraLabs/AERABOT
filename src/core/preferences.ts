export type GraphicsQuality = "auto" | "ultra" | "high" | "balanced" | "efficiency";
export type MotionPreference = "system" | "reduce" | "full";
export type AiProviderPreference = "auto" | "ollama" | "llamacpp";
export type TalkBackPreference = "auto" | "text" | "voice";

export interface AeraPreferences {
  muted: boolean;
  quality: GraphicsQuality;
  motion: MotionPreference;
  aiProvider: AiProviderPreference;
  aiModel: string;
  talkBack: TalkBackPreference;
}

const STORAGE_KEY = "aera.preferences.v1";

export const DEFAULT_PREFERENCES: AeraPreferences = {
  muted: false,
  quality: "auto",
  motion: "system",
  aiProvider: "auto",
  aiModel: "",
  talkBack: "auto",
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
      aiProvider: ["auto", "ollama", "llamacpp"].includes(parsed.aiProvider ?? "")
        ? (parsed.aiProvider as AiProviderPreference)
        : DEFAULT_PREFERENCES.aiProvider,
      aiModel: typeof parsed.aiModel === "string" ? parsed.aiModel : "",
      talkBack: ["auto", "text", "voice"].includes(parsed.talkBack ?? "")
        ? (parsed.talkBack as TalkBackPreference)
        : DEFAULT_PREFERENCES.talkBack,
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
