import { invoke } from "@tauri-apps/api/core";
import type { LocalChatResponse } from "../ai/local";
import { isTauriRuntime } from "./bridge";

export interface VisualContextStatus {
  supported: boolean;
  enabled: boolean;
  mode: "explicit-focused-window" | string;
}

export interface VisualCapture {
  appName: string;
  title: string;
  processId: number;
  width: number;
  height: number;
  png: number[];
}

export async function setVisualContextEnabled(
  enabled: boolean,
): Promise<VisualContextStatus> {
  if (!isTauriRuntime()) {
    return {
      supported: false,
      enabled: false,
      mode: "explicit-focused-window",
    };
  }
  return invoke<VisualContextStatus>("set_visual_context_enabled", { enabled });
}

export async function captureVisualContext(
  processId: number | null,
  title: string | null,
): Promise<VisualCapture> {
  if (!isTauriRuntime()) {
    throw new Error("Visual Context requires the AERA desktop runtime.");
  }
  return invoke<VisualCapture>("capture_visual_context", {
    processId,
    title,
  });
}

export async function analyzeVisualContext(
  model: string,
  prompt: string,
  png: number[],
): Promise<LocalChatResponse> {
  if (!isTauriRuntime()) {
    throw new Error("Local visual analysis requires the AERA desktop runtime.");
  }
  return invoke<LocalChatResponse>("local_vision", {
    request: {
      model,
      prompt,
      imagePng: png,
    },
  });
}
