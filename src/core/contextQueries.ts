import type { KnownAppStatus } from "../platform/apps";
import type { ForegroundWindowSnapshot } from "../platform/bridge";
import type { SpatialBehavior } from "./preferences";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LocalContext {
  foreground: ForegroundWindowSnapshot | null;
  dawStatuses: KnownAppStatus[];
  spatialAwareness: boolean;
  spatialBehavior: SpatialBehavior;
}

export interface ContextAnswer {
  message: string;
  meta: string;
}

export function answerLocalContextQuery(
  input: string,
  context: LocalContext,
): ContextAnswer | null {
  const text = normalize(input);

  if (
    /\b(what|which)\b.*\b(app|application|window)\b.*\b(focused|active|foreground|using|in)\b/.test(
      text,
    ) ||
    /\bwhat am i working in\b/.test(text)
  ) {
    const foreground = context.foreground;
    if (!foreground?.available || foreground.isAera) {
      return {
        message: "I don't have a verified external foreground application right now.",
        meta: "AERA desktop awareness · local",
      };
    }

    return {
      message:
        "The verified foreground app is " +
        (foreground.appName ?? "an unknown application") +
        (foreground.title ? " · “" + foreground.title + "”." : "."),
      meta: "AERA desktop awareness · verified local state",
    };
  }

  if (
    /\b(which|what)\b.*\b(daws?|audio workstations?)\b.*\b(installed|have|detected)\b/.test(
      text,
    ) ||
    /\bwhat daws do i have\b/.test(text)
  ) {
    const installed = context.dawStatuses.filter((status) => status.installed);
    if (installed.length === 0) {
      return {
        message:
          "I haven't detected any of the five core DAWs in their supported install locations.",
        meta: "AERA DAW detection · local",
      };
    }

    return {
      message:
        "I detected " +
        installed.map((status) => status.name).join(", ") +
        ".",
      meta: "AERA DAW detection · verified local state",
    };
  }

  if (
    /\bwhat can you (see|sense|detect|perceive)\b/.test(text) ||
    /\bcan you see my screen\b/.test(text)
  ) {
    const foreground = context.foreground;
    const appText =
      foreground?.available && !foreground.isAera
        ? " I can currently verify that " +
          (foreground.appName ?? "an application") +
          " is foreground."
        : "";

    const geometryText =
      foreground?.permissionRequired && !foreground.permissionGranted
        ? " Window geometry is limited until macOS Accessibility permission is enabled."
        : foreground?.bounds
          ? " I also have verified foreground-window geometry."
          : "";

    return {
      message:
        "I do not have screen-content vision yet. I can sense native desktop state such as the foreground app, supported window geometry, monitors, installed DAWs, and connected Skill state." +
        appText +
        geometryText,
      meta: "AERA awareness boundary · local",
    };
  }

  if (
    /\b(spatial|movement|follow)\b.*\b(status|mode|setting|behavior)\b/.test(text) ||
    /\bare you following my windows\b/.test(text)
  ) {
    return {
      message: context.spatialAwareness
        ? "Spatial movement is enabled in " +
          context.spatialBehavior +
          " mode."
        : "Spatial movement is paused. I'll stay where you place me.",
      meta: "AERA preference · local",
    };
  }

  return null;
}
