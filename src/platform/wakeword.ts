import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface WakeWordStatus {
  available: boolean;
  stale: boolean;
  ageMs: number | null;
  engine: string | null;
  serviceVersion: string | null;
  phrase: string | null;
  sampleRate: number | null;
  cooldownMs: number | null;
  error: string | null;
}

export interface WakeWordEvent {
  schemaVersion: number;
  engine: string;
  eventId: string | null;
  phrase: string;
  detectedAtMs: number;
}

export async function getWakeWordStatus(): Promise<WakeWordStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      stale: false,
      ageMs: null,
      engine: null,
      serviceVersion: null,
      phrase: null,
      sampleRate: null,
      cooldownMs: null,
      error: "Wake-word detection requires the desktop runtime.",
    };
  }
  return invoke<WakeWordStatus>("wake_word_status");
}

export async function consumeWakeWordEvent(): Promise<WakeWordEvent | null> {
  if (!isTauriRuntime()) return null;
  return invoke<WakeWordEvent | null>("consume_wake_word_event");
}


export interface WakeWordInstallResult {
  installed: boolean;
  alreadyCurrent: boolean;
  path: string;
  instructions: string;
}

export async function installWakeWordCompanion(): Promise<WakeWordInstallResult> {
  if (!isTauriRuntime()) {
    throw new Error("Wake-word installation requires the desktop runtime.");
  }
  return invoke<WakeWordInstallResult>("install_wake_word_companion");
}
