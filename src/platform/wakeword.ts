import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./bridge";

export interface WakeWordStatus {
  available: boolean;
  stale: boolean;
  ageMs: number | null;
  engine: string | null;
  phrase: string | null;
  sampleRate: number | null;
  error: string | null;
}

export interface WakeWordEvent {
  schemaVersion: number;
  engine: string;
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
      phrase: null,
      sampleRate: null,
      error: "Wake-word detection requires the desktop runtime.",
    };
  }
  return invoke<WakeWordStatus>("wake_word_status");
}

export async function consumeWakeWordEvent(): Promise<WakeWordEvent | null> {
  if (!isTauriRuntime()) return null;
  return invoke<WakeWordEvent | null>("consume_wake_word_event");
}
