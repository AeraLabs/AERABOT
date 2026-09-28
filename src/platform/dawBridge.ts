import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface DawTransportState {
  playing: boolean;
  recording: boolean;
  positionSeconds: number | null;
  positionBeats?: number | null;
  bpm: number | null;
}

export interface DawTrackState {
  id: string;
  index: number;
  name: string;
  muted: boolean;
  soloed: boolean;
  armed: boolean;
  volume: number;
  pan: number;
  fx: string[];
}

export interface DawState {
  schemaVersion: number;
  dawId: string;
  bridgeVersion: string;
  projectName: string | null;
  transport: DawTransportState;
  selectedTrack: DawTrackState | null;
  capabilities: string[];
}

export interface DawBridgeStatus {
  available: boolean;
  stale: boolean;
  ageMs: number | null;
  path: string | null;
  state: DawState | null;
  error: string | null;
}

export interface DawCommandAck {
  id: string;
  ok: boolean;
  capability: string;
  result: DawState | Record<string, unknown> | null;
  error: string | null;
}

export interface DawBridgeInstallResult {
  installed: boolean;
  alreadyCurrent: boolean;
  path: string;
  instructions: string;
}

export async function getFlStudioBridgeStatus(): Promise<DawBridgeStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      stale: false,
      ageMs: null,
      path: null,
      state: null,
      error: "FL Studio bridge requires the desktop runtime.",
    };
  }
  return invoke<DawBridgeStatus>("fl_studio_bridge_status");
}

export async function installFlStudioBridge(): Promise<DawBridgeInstallResult> {
  if (!isTauriRuntime()) {
    throw new Error("FL Studio bridge installation requires the desktop runtime.");
  }
  return invoke<DawBridgeInstallResult>("install_fl_studio_bridge");
}

export async function runFlStudioCommand(
  id: string,
  capability: string,
  input: Record<string, unknown>,
): Promise<DawCommandAck> {
  if (!isTauriRuntime()) {
    throw new Error("FL Studio control requires the desktop runtime.");
  }
  return invoke<DawCommandAck>("fl_studio_command", {
    id,
    capability,
    input,
  });
}

export function flStudioModelContext(state: DawState) {
  const track = state.selectedTrack;
  return [
    "Verified local FL Studio state:",
    state.projectName ? "project “" + state.projectName + "”" : "untitled project",
    state.transport.recording
      ? "recording"
      : state.transport.playing
        ? "playing"
        : "stopped",
    state.transport.bpm != null
      ? state.transport.bpm.toFixed(2) + " BPM"
      : null,
    track
      ? [
          "selected mixer track " + track.index + " “" + track.name + "”",
          track.muted ? "muted" : "not muted",
          track.soloed ? "soloed" : "not soloed",
          track.armed ? "armed" : "not armed",
          "volume " + track.volume.toFixed(3),
          "pan " + track.pan.toFixed(3),
          track.fx.length ? "FX: " + track.fx.join(", ") : "no detected insert FX",
        ].join("; ")
      : "no selected mixer track",
  ]
    .filter(Boolean)
    .join(" ");
}


export type CompanionDawId = "flstudio" | "ableton" | "logic" | "protools";

export async function getDawBridgeStatus(
  dawId: CompanionDawId,
): Promise<DawBridgeStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      stale: false,
      ageMs: null,
      path: null,
      state: null,
      error: dawId + " bridge requires the desktop runtime.",
    };
  }
  return invoke<DawBridgeStatus>("daw_bridge_status", { dawId });
}

export async function prepareDawBridge(
  dawId: CompanionDawId,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("DAW bridge preparation requires the desktop runtime.");
  }
  return invoke<string>("prepare_daw_bridge", { dawId });
}

export async function runDawCommand(
  dawId: CompanionDawId,
  id: string,
  capability: string,
  input: Record<string, unknown>,
): Promise<DawCommandAck> {
  if (!isTauriRuntime()) {
    throw new Error("DAW bridge control requires the desktop runtime.");
  }
  return invoke<DawCommandAck>("daw_bridge_command", {
    dawId,
    id,
    capability,
    input,
  });
}

export function dawModelContext(name: string, state: DawState) {
  const track = state.selectedTrack;
  const position =
    state.transport.positionSeconds != null
      ? state.transport.positionSeconds.toFixed(2) + " seconds"
      : state.transport.positionBeats != null
        ? state.transport.positionBeats.toFixed(2) + " beats"
        : null;

  return [
    "Verified local " + name + " state:",
    state.projectName ? "project “" + state.projectName + "”" : "untitled project",
    state.transport.recording
      ? "recording"
      : state.transport.playing
        ? "playing"
        : "stopped",
    position,
    state.transport.bpm != null
      ? state.transport.bpm.toFixed(2) + " BPM"
      : null,
    track
      ? [
          "selected track " + track.index + " “" + track.name + "”",
          track.muted ? "muted" : "not muted",
          track.soloed ? "soloed" : "not soloed",
          track.armed ? "armed" : "not armed",
          "volume " + track.volume.toFixed(3),
          "pan " + track.pan.toFixed(3),
          track.fx.length ? "FX: " + track.fx.join(", ") : "no detected devices",
        ].join("; ")
      : "no selected track",
  ]
    .filter(Boolean)
    .join(" ");
}
