import type {
  OrbSizePreference,
  PresenceStyle,
  SpatialBehavior,
} from "./preferences";

export type PreferenceIntent =
  | { type: "presence"; value: PresenceStyle; message: string }
  | { type: "size"; value: OrbSizePreference; message: string }
  | { type: "spatial"; value: boolean; message: string }
  | { type: "spatial-behavior"; value: SpatialBehavior; message: string };

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePreferenceIntent(text: string): PreferenceIntent | null {
  const value = normalize(text);
  if (!value) return null;

  if (
    /\b(be|go|get|feel|move)\b.*\b(expressive|lively|alive|animated)\b/.test(value) ||
    /\bmore expressive\b/.test(value)
  ) {
    return {
      type: "presence",
      value: "expressive",
      message: "Expressive presence enabled.",
    };
  }

  if (
    /\b(be|go|get|feel|move|stay)\b.*\b(serene|calm|calmer|subtle)\b/.test(value) ||
    /\bcalm down\b/.test(value)
  ) {
    return {
      type: "presence",
      value: "serene",
      message: "Serene presence enabled.",
    };
  }

  if (/\b(balanced presence|normal presence|default presence)\b/.test(value)) {
    return {
      type: "presence",
      value: "balanced",
      message: "Balanced presence enabled.",
    };
  }

  if (/\b(make|get|be)\b.*\b(smaller|compact|tiny)\b/.test(value)) {
    return {
      type: "size",
      value: "compact",
      message: "Compact orb size enabled.",
    };
  }

  if (/\b(make|get|be)\b.*\b(bigger|larger|large)\b/.test(value)) {
    return {
      type: "size",
      value: "large",
      message: "Large orb size enabled.",
    };
  }

  if (/\b(normal|standard|default)\b.*\b(size|orb)\b/.test(value)) {
    return {
      type: "size",
      value: "standard",
      message: "Standard orb size enabled.",
    };
  }

  if (
    /\b(stay here|stop moving|don'?t move|do not move|stop following)\b/.test(value)
  ) {
    return {
      type: "spatial",
      value: false,
      message: "Spatial movement paused. I’ll stay where you put me.",
    };
  }

  if (
    /\b(follow me|follow my work|follow windows|move with my windows)\b/.test(value)
  ) {
    return {
      type: "spatial",
      value: true,
      message: "Spatial movement enabled.",
    };
  }

  if (/\b(quiet spatial|quiet movement|move less)\b/.test(value)) {
    return {
      type: "spatial-behavior",
      value: "quiet",
      message: "Quiet desktop behavior enabled.",
    };
  }

  if (/\b(companion mode|follow focus|stay with me)\b/.test(value)) {
    return {
      type: "spatial-behavior",
      value: "companion",
      message: "Companion desktop behavior enabled.",
    };
  }

  if (/\b(adaptive movement|adaptive spatial|normal movement)\b/.test(value)) {
    return {
      type: "spatial-behavior",
      value: "adaptive",
      message: "Adaptive desktop behavior enabled.",
    };
  }

  return null;
}
