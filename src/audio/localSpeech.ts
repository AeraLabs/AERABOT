import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/bridge";

export interface SpeechStatus {
  whisperAvailable: boolean;
  piperAvailable: boolean;
  whisperEndpoint: string;
  piperEndpoint: string;
}

export async function probeLocalSpeech(): Promise<SpeechStatus> {
  if (!isTauriRuntime()) {
    return {
      whisperAvailable: false,
      piperAvailable: false,
      whisperEndpoint: "",
      piperEndpoint: "",
    };
  }
  return invoke<SpeechStatus>("probe_local_speech");
}

export async function transcribeAudio(audio: Uint8Array): Promise<string> {
  if (!isTauriRuntime()) throw new Error("Local speech recognition requires the desktop runtime.");
  return invoke<string>("transcribe_audio", { audio: Array.from(audio) });
}

export async function synthesizeSpeech(text: string): Promise<number[]> {
  if (!isTauriRuntime()) throw new Error("Local speech synthesis requires the desktop runtime.");
  return invoke<number[]>("synthesize_speech", { text });
}

export async function playWavBytes(bytes: number[]) {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  try {
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("AERA could not play the synthesized voice."));
      audio.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
