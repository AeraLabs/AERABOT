import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../platform/bridge";

export type LocalProviderId = "ollama" | "llamacpp";
export type ChatRole = "system" | "user" | "assistant";

export interface LocalProviderStatus {
  id: LocalProviderId;
  name: string;
  endpoint: string;
  available: boolean;
  models: string[];
  error: string | null;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LocalChatRequest {
  provider: LocalProviderId;
  model: string;
  messages: ChatMessage[];
}

export interface LocalChatResponse {
  provider: LocalProviderId;
  model: string;
  content: string;
  thinking: string | null;
  elapsedMs: number;
}

export async function probeLocalAI(): Promise<LocalProviderStatus[]> {
  if (!isTauriRuntime()) return [];
  return invoke<LocalProviderStatus[]>("probe_local_ai");
}

export async function localChat(request: LocalChatRequest): Promise<LocalChatResponse> {
  if (!isTauriRuntime()) {
    throw new Error("Local AI is available in the desktop runtime.");
  }
  return invoke<LocalChatResponse>("local_chat", { request });
}

export function resolveProvider(
  preference: "auto" | LocalProviderId,
  providers: LocalProviderStatus[],
): LocalProviderStatus | null {
  if (preference !== "auto") {
    return providers.find((provider) => provider.id === preference && provider.available) ?? null;
  }

  const withModels = providers.find((provider) => provider.available && provider.models.length > 0);
  return withModels ?? providers.find((provider) => provider.available) ?? null;
}
