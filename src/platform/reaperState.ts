import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface ReaperTrackState {
  index: number;
  guid: string;
  name: string;
  selected: boolean;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  monitoring: boolean;
  volume: number;
  pan: number;
  itemCount: number;
  fxCount: number;
  folderDepth: number;
}

export interface ReaperSelectedTrack {
  index: number;
  guid: string;
  name: string;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  monitoring: boolean;
  volume: number;
  pan: number;
  fx: string[];
}

export interface ReaperProjectState {
  schemaVersion: number;
  reaperVersion: string;
  bridgeTime: number;
  projectName: string;
  projectFile: string;
  stateChangeCount: number;
  playState: number;
  playing: boolean;
  paused: boolean;
  recording: boolean;
  playPosition: number;
  cursorPosition: number;
  projectLength: number;
  bpm: number;
  trackCount: number;
  tracksTruncated: boolean;
  selectedTrack: ReaperSelectedTrack | null;
  tracks: ReaperTrackState[];
}

export interface ReaperBridgeStatus {
  available: boolean;
  stale: boolean;
  ageMs: number | null;
  path: string | null;
  state: ReaperProjectState | null;
  error: string | null;
}

export async function getReaperState(): Promise<ReaperBridgeStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      stale: false,
      ageMs: null,
      path: null,
      state: null,
      error: "REAPER live inspection requires the desktop runtime.",
    };
  }

  return invoke<ReaperBridgeStatus>("reaper_state_snapshot");
}

export function reaperTransportLabel(state: ReaperProjectState) {
  if (state.recording) return "recording";
  if (state.paused) return "paused";
  if (state.playing) return "playing";
  return "stopped";
}

export function reaperModelContext(state: ReaperProjectState) {
  const selected = state.selectedTrack;
  const selectedText = selected
    ? [
        "selected track " + selected.index + " “" + selected.name + "”",
        selected.armed ? "armed" : "not armed",
        selected.muted ? "muted" : "not muted",
        selected.soloed ? "soloed" : "not soloed",
        selected.monitoring ? "monitoring" : "not monitoring",
        selected.fx.length > 0
          ? "FX: " + selected.fx.slice(0, 12).join(", ")
          : "no insert FX",
      ].join("; ")
    : "no selected track";

  return [
    "Verified local REAPER state:",
    "project “" + state.projectName + "”",
    reaperTransportLabel(state),
    "play position " + state.playPosition.toFixed(2) + " s",
    "tempo " + state.bpm.toFixed(2) + " BPM",
    state.trackCount + " tracks",
    selectedText,
  ].join(" ");
}


export interface ReaperBridgeInstallResult {
  installed: boolean;
  alreadyCurrent: boolean;
  path: string;
}

export async function installReaperBridge(): Promise<ReaperBridgeInstallResult> {
  if (!isTauriRuntime()) {
    throw new Error("REAPER bridge installation requires the desktop runtime.");
  }
  return invoke<ReaperBridgeInstallResult>("install_reaper_bridge");
}


export type ReaperTransportAction = "play" | "stop" | "pause";

export interface ReaperTransportVerification {
  connected: boolean;
  verified: boolean;
  state: ReaperProjectState | null;
}

function transportMatches(
  action: ReaperTransportAction,
  state: ReaperProjectState,
) {
  if (action === "play") return state.playing && !state.paused;
  if (action === "pause") return state.paused;
  return !state.playing && !state.paused && !state.recording;
}

export async function verifyReaperTransport(
  action: ReaperTransportAction,
  timeoutMs = 1200,
): Promise<ReaperTransportVerification> {
  const deadline = Date.now() + timeoutMs;
  let connected = false;
  let lastState: ReaperProjectState | null = null;

  while (Date.now() <= deadline) {
    const status = await getReaperState().catch(() => null);
    if (status?.available && !status.stale && status.state) {
      connected = true;
      lastState = status.state;
      if (transportMatches(action, status.state)) {
        return { connected: true, verified: true, state: status.state };
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  return { connected, verified: false, state: lastState };
}


export type ReaperTrackOperation = "mute" | "solo" | "arm";

export interface ReaperTrackCommandOutcome {
  id: string;
  operation: ReaperTrackOperation;
  trackGuid: string;
  requestedValue: boolean;
  before: boolean;
  after: boolean;
}

export async function runReaperTrackCommand(
  id: string,
  trackGuid: string,
  operation: ReaperTrackOperation,
  value: boolean,
): Promise<ReaperTrackCommandOutcome> {
  if (!isTauriRuntime()) {
    throw new Error("REAPER track control requires the desktop runtime.");
  }
  return invoke<ReaperTrackCommandOutcome>("reaper_track_command", {
    id,
    trackGuid,
    operation,
    value,
  });
}


export type ReaperTrackValueOperation = "volume" | "pan";

export interface ReaperTrackValueCommandOutcome {
  id: string;
  operation: ReaperTrackValueOperation;
  trackGuid: string;
  requestedValue: number;
  before: number;
  after: number;
}

export interface ReaperTrackSelectCommandOutcome {
  id: string;
  trackGuid: string;
  previousTrackGuid: string | null;
  selectedTrackGuid: string;
}

export async function runReaperTrackValueCommand(
  id: string,
  trackGuid: string,
  operation: ReaperTrackValueOperation,
  value: number,
): Promise<ReaperTrackValueCommandOutcome> {
  if (!isTauriRuntime()) {
    throw new Error("REAPER numeric track control requires the desktop runtime.");
  }
  return invoke<ReaperTrackValueCommandOutcome>("reaper_track_value_command", {
    id,
    trackGuid,
    operation,
    value,
  });
}

export async function runReaperTrackSelectCommand(
  id: string,
  trackGuid: string,
): Promise<ReaperTrackSelectCommandOutcome> {
  if (!isTauriRuntime()) {
    throw new Error("REAPER track selection requires the desktop runtime.");
  }
  return invoke<ReaperTrackSelectCommandOutcome>("reaper_track_select_command", {
    id,
    trackGuid,
  });
}
