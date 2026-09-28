import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface SystemProfile {
  platform: string;
  architecture: string;
  renderer: string;
  aiRuntime: string;
}

export interface MonitorSnapshot {
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
}

export const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

export async function getSystemProfile(): Promise<SystemProfile> {
  if (!isTauriRuntime()) {
    return {
      platform: navigator.platform,
      architecture: "browser-preview",
      renderer: "WebGL",
      aiRuntime: "preview",
    };
  }
  return invoke<SystemProfile>("system_profile");
}

export async function resizeOrbHost(diameter: number) {
  if (isTauriRuntime()) await invoke("set_orb_size", { diameter });
}

export async function moveOrbHost(x: number, y: number) {
  if (isTauriRuntime()) await invoke("move_orb", { x, y });
}

export async function setClickThrough(enabled: boolean) {
  if (isTauriRuntime()) await invoke("set_click_through", { enabled });
}

export async function listMonitors(): Promise<MonitorSnapshot[]> {
  return isTauriRuntime() ? invoke<MonitorSnapshot[]>("list_monitors") : [];
}

export async function beginNativeDrag() {
  if (isTauriRuntime()) await getCurrentWindow().startDragging();
}
