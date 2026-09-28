import { localChat, type ChatMessage, type LocalChatRequest, type LocalChatResponse } from "./local";
import { AERA_SYSTEM_PROMPT } from "./prompt";

export type PlannedReply = {
  kind: "reply";
  message: string;
};

export type PlannedAction = {
  kind: "action";
  capability: string;
  input: Record<string, unknown>;
  message: string;
};

export type AeraPlan = PlannedReply | PlannedAction;

const ALLOWED = new Set([
  "software.open",
  "transport.play",
  "transport.stop",
  "transport.pause",
]);

const ACTION_PROTOCOL = `
You are also AERA's intent planner.

Return exactly one JSON object and no markdown.

For a normal conversational answer:
{"kind":"reply","message":"your concise answer"}

Allowed REAPER actions:
{"kind":"action","capability":"software.open","input":{"appId":"reaper"},"message":"Opening REAPER."}
{"kind":"action","capability":"transport.play","input":{"appId":"reaper"},"message":"Playing."}
{"kind":"action","capability":"transport.stop","input":{"appId":"reaper"},"message":"Stopping."}
{"kind":"action","capability":"transport.pause","input":{"appId":"reaper"},"message":"Pausing."}

Rules:
- Use an action only when the user explicitly requests that operation in REAPER, or REAPER is unambiguous from the immediately preceding conversation.
- Never invent another capability.
- Never put file paths, shell commands, executable names, URLs, scripts, keyboard shortcuts, OSC addresses, or code in input.
- A question about how REAPER works is a reply, not an action.
- If you are unsure, use kind=reply.
- The runtime decides whether an action is permitted and whether it actually succeeded.
`.trim();

function stripFence(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parsePlan(text: string): AeraPlan {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    return { kind: "reply", message: text.trim() || "I couldn't form a response." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { kind: "reply", message: text.trim() || "I couldn't form a response." };
  }

  const candidate = parsed as Record<string, unknown>;

  if (candidate.kind === "action") {
    const capability =
      typeof candidate.capability === "string" ? candidate.capability : "";
    const input =
      candidate.input && typeof candidate.input === "object"
        ? (candidate.input as Record<string, unknown>)
        : {};

    if (ALLOWED.has(capability) && input.appId === "reaper") {
      return {
        kind: "action",
        capability,
        input: { appId: "reaper" },
        message:
          typeof candidate.message === "string"
            ? candidate.message
            : "Running the REAPER action.",
      };
    }

    return {
      kind: "reply",
      message: "That desktop action is not available through an installed AERA Skill yet.",
    };
  }

  if (candidate.kind === "reply" && typeof candidate.message === "string") {
    return { kind: "reply", message: candidate.message.trim() };
  }

  return { kind: "reply", message: text.trim() || "I couldn't form a response." };
}

export async function planWithLocalModel(
  request: Omit<LocalChatRequest, "messages"> & { messages: ChatMessage[] },
): Promise<{ plan: AeraPlan; response: LocalChatResponse }> {
  const response = await localChat({
    provider: request.provider,
    model: request.model,
    messages: [
      { role: "system", content: AERA_SYSTEM_PROMPT + "\n\n" + ACTION_PROTOCOL },
      ...request.messages,
    ],
  });

  return { plan: parsePlan(response.content), response };
}
