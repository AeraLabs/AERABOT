import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface KnownAppStatus {
  id: string;
  name: string;
  installed: boolean;
  path: string | null;
}

export async function getKnownAppStatus(appId: string): Promise<KnownAppStatus> {
  if (!isTauriRuntime()) {
    return { id: appId, name: appId, installed: false, path: null };
  }
  return invoke<KnownAppStatus>("known_app_status", { appId });
}

export async function openKnownApp(appId: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Desktop application control requires the AERA desktop runtime.");
  }
  await invoke("open_known_app", { appId });
}
