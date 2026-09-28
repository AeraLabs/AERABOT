import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface ReaperOscStatus {
  enabled: boolean;
  port: number;
  address: string;
}

export async function getReaperOscStatus(): Promise<ReaperOscStatus> {
  if (!isTauriRuntime()) {
    return { enabled: false, port: 8000, address: "127.0.0.1:8000" };
  }
  return invoke<ReaperOscStatus>("reaper_osc_status");
}

export async function runReaperTransport(
  action: "play" | "stop" | "pause",
): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("REAPER transport requires the AERA desktop runtime.");
  }
  await invoke("reaper_transport", { action });
}
