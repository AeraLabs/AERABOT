import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/bridge";

export type BrainState =
  | "NEEDS_SETUP"
  | "DOWNLOADING"
  | "VERIFYING"
  | "INSTALLING"
  | "STARTING"
  | "LOADING"
  | "READY"
  | "SLEEPING"
  | "OFFLINE"
  | "ERROR";

export interface BrainStatus {
  state: BrainState;
  message: string;
  ready: boolean;
  installed: boolean;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  model: string;
  modelDetail: string;
  modelLicense: string;
  runtime: string;
  runtimeLicense: string;
  port: number | null;
  error: string | null;
}

const previewStatus: BrainStatus = {
  state: "NEEDS_SETUP",
  message: "AERA Brain requires the desktop runtime.",
  ready: false,
  installed: false,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  model: "AERA Core Tiny",
  modelDetail: "Qwen3 0.6B · Q4_K_M",
  modelLicense: "Apache-2.0",
  runtime: "llama.cpp",
  runtimeLicense: "MIT",
  port: null,
  error: null,
};

export async function getBuiltinBrainStatus(): Promise<BrainStatus> {
  if (!isTauriRuntime()) return previewStatus;
  return invoke<BrainStatus>("builtin_brain_status");
}

export async function ensureBuiltinBrain(): Promise<BrainStatus> {
  if (!isTauriRuntime()) return previewStatus;
  return invoke<BrainStatus>("ensure_builtin_brain");
}

export async function repairBuiltinBrain(): Promise<BrainStatus> {
  if (!isTauriRuntime()) return previewStatus;
  return invoke<BrainStatus>("repair_builtin_brain");
}

export function brainIsPreparing(status: BrainStatus | null) {
  return Boolean(
    status &&
      ["DOWNLOADING", "VERIFYING", "INSTALLING", "STARTING", "LOADING"].includes(
        status.state,
      ),
  );
}

export function formatBrainProgress(status: BrainStatus | null) {
  if (!status || status.totalBytes <= 0) return "";
  const percent = Math.round(status.progress * 100);
  const downloadedMb = status.downloadedBytes / 1024 / 1024;
  const totalMb = status.totalBytes / 1024 / 1024;
  return `${percent}% · ${downloadedMb.toFixed(0)} / ${totalMb.toFixed(0)} MB`;
}
