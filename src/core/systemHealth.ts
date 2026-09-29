import type { LocalProviderStatus } from "../ai/local";
import type { SpeechStatus } from "../audio/localSpeech";
import type { KnownAppStatus } from "../platform/apps";
import type { ForegroundWindowSnapshot } from "../platform/bridge";
import type { DawBridgeStatus } from "../platform/dawBridge";
import type { ReaperBridgeStatus } from "../platform/reaperState";
import type { WakeWordStatus } from "../platform/wakeword";

export const DAW_PARITY_CAPABILITIES = [
  "transport.play",
  "transport.stop",
  "transport.record.toggle",
  "track.select",
  "track.mute.set",
  "track.solo.set",
  "track.arm.set",
  "track.volume.set",
  "track.pan.set",
  "project.inspect",
  "track.fx.inspect",
  "parameter.set",
] as const;

export type DawParityCapability = (typeof DAW_PARITY_CAPABILITIES)[number];

export interface SkillSummary {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}

export interface DawHealth {
  id: string;
  name: string;
  installed: boolean;
  bridgeReady: boolean;
  capabilities: string[];
  missingParityCapabilities: DawParityCapability[];
  parityPercent: number;
}

export interface SystemHealthSnapshot {
  coreReady: number;
  coreTotal: number;
  aiReady: boolean;
  hearingReady: boolean;
  voiceReady: boolean;
  wakeReady: boolean;
  desktopReady: boolean;
  daws: DawHealth[];
  issues: string[];
}

interface BuildHealthInput {
  providers: LocalProviderStatus[];
  speech: SpeechStatus | null;
  wakeWord: WakeWordStatus | null;
  foreground: ForegroundWindowSnapshot | null;
  daws: KnownAppStatus[];
  skills: SkillSummary[];
  reaperBridge: ReaperBridgeStatus | null;
  flStudioBridge: DawBridgeStatus | null;
  abletonBridge: DawBridgeStatus | null;
  logicBridge: DawBridgeStatus | null;
  proToolsBridge: DawBridgeStatus | null;
  wavrBridge: DawBridgeStatus | null;
}

function readyBridge(value: { available: boolean; stale: boolean } | null) {
  return Boolean(value?.available && !value.stale);
}

function percent(capabilities: string[]) {
  const supported = DAW_PARITY_CAPABILITIES.filter((capability) =>
    capabilities.includes(capability),
  ).length;
  return Math.round((supported / DAW_PARITY_CAPABILITIES.length) * 100);
}

export function buildSystemHealth(input: BuildHealthInput): SystemHealthSnapshot {
  const aiReady = input.providers.some(
    (provider) => provider.available && provider.models.length > 0,
  );
  const hearingReady = Boolean(input.speech?.whisperAvailable);
  const voiceReady = Boolean(input.speech?.piperAvailable);
  const wakeReady = Boolean(input.wakeWord?.available && !input.wakeWord.stale);
  const desktopReady =
    Boolean(input.foreground?.available) &&
    (!input.foreground?.permissionRequired ||
      Boolean(input.foreground?.permissionGranted));

  const skillMap = new Map(input.skills.map((skill) => [skill.id, skill]));
  const appMap = new Map(input.daws.map((app) => [app.id, app]));
  const definitions = [
    {
      id: "reaper",
      name: "REAPER",
      installed: Boolean(appMap.get("reaper")?.installed),
      bridgeReady: readyBridge(input.reaperBridge),
    },
    {
      id: "flstudio",
      name: "FL Studio",
      installed: Boolean(appMap.get("flstudio")?.installed),
      bridgeReady: readyBridge(input.flStudioBridge),
    },
    {
      id: "ableton",
      name: "Ableton Live",
      installed: Boolean(appMap.get("ableton")?.installed),
      bridgeReady: readyBridge(input.abletonBridge),
    },
    {
      id: "logic",
      name: "Logic Pro",
      installed: Boolean(appMap.get("logic")?.installed),
      bridgeReady: readyBridge(input.logicBridge),
    },
    {
      id: "protools",
      name: "Pro Tools",
      installed: Boolean(appMap.get("protools")?.installed),
      bridgeReady: readyBridge(input.proToolsBridge),
    },
    {
      id: "wavr",
      name: "WAVR",
      installed: Boolean(input.wavrBridge?.available),
      bridgeReady: readyBridge(input.wavrBridge),
    },
  ];

  const daws = definitions.map((definition) => {
    const capabilities = skillMap.get(definition.id)?.capabilities ?? [];
    const missingParityCapabilities = DAW_PARITY_CAPABILITIES.filter(
      (capability) => !capabilities.includes(capability),
    );
    return {
      ...definition,
      capabilities,
      missingParityCapabilities,
      parityPercent: percent(capabilities),
    };
  });

  const issues: string[] = [];
  if (!aiReady) issues.push("No local AI model is ready.");
  if (!hearingReady) issues.push("Local transcription is offline.");
  if (!desktopReady) issues.push("Verified desktop/window awareness is not ready.");
  if (!wakeReady) issues.push("Wake phrase is optional and currently offline.");
  if (!voiceReady) issues.push("Local talk-back is optional and currently offline.");

  for (const daw of daws) {
    if (daw.installed && !daw.bridgeReady) {
      issues.push(daw.name + " is installed but its verified bridge is not live.");
    }
  }

  return {
    coreReady: [aiReady, hearingReady, desktopReady].filter(Boolean).length,
    coreTotal: 3,
    aiReady,
    hearingReady,
    voiceReady,
    wakeReady,
    desktopReady,
    daws,
    issues,
  };
}

export function answerSystemHealthQuery(
  input: string,
  health: SystemHealthSnapshot,
): string | null {
  const value = input.toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
  const wantsHealth =
    /\b(run|show|give|check)\b.*\b(diagnostics?|health check|system check)\b/.test(value) ||
    /\bwhat(?:'s| is) (broken|offline|not working|not ready)\b/.test(value) ||
    value === "diagnostics" ||
    value === "system check";

  if (!wantsHealth) return null;

  const installed = health.daws.filter((daw) => daw.installed);
  const live = installed.filter((daw) => daw.bridgeReady);
  const parity = installed.length
    ? Math.round(
        installed.reduce((sum, daw) => sum + daw.parityPercent, 0) /
          installed.length,
      )
    : 0;

  const issueText =
    health.issues.length > 0
      ? " Needs attention: " + health.issues.slice(0, 4).join(" ")
      : " No blocking local-service issues detected.";

  return (
    "AERA health: " +
    health.coreReady +
    "/" +
    health.coreTotal +
    " core systems ready; " +
    live.length +
    "/" +
    installed.length +
    " installed DAW bridges live" +
    (installed.length ? "; average DAW capability parity " + parity + "%." : ".") +
    issueText
  );
}
