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
