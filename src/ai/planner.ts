import { localChat, type ChatMessage, type LocalChatRequest, type LocalChatResponse } from "./local";
import { AERA_SYSTEM_PROMPT } from "./prompt";
import type { PlannerActionDescriptor } from "../core/skills";

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

function buildActionProtocol(actions: PlannerActionDescriptor[]) {
  const actionText =
    actions.length === 0
      ? "No desktop actions are currently available."
      : actions
          .map(
            (action) =>
              "- " +
              action.capability +
              ": " +
              action.description +
              "\n  input example: " +
              JSON.stringify(action.inputExample),
          )
          .join("\n");

  return `
You are also AERA's intent planner.

Return exactly one JSON object and no markdown.

For a normal conversational answer:
{"kind":"reply","message":"your concise answer"}

Available desktop actions:
${actionText}

For an action, use:
{"kind":"action","capability":"one exact available capability","input":{...},"message":"short acknowledgement"}

Rules:
- Use an action only when the user clearly requests it.
- Never invent a capability not listed above.
- Treat input examples as the permitted shape; do not add unrelated fields.
- Never put file paths, shell commands, executable names, URLs, scripts, keyboard shortcuts, OSC addresses, or code in input unless a future Skill explicitly advertises such a field.
- Questions about software are replies, not actions.
- If you are unsure, use kind=reply.
- The runtime and Skill independently validate the request and decide whether it actually executes.
`.trim();
}

function stripFence(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parsePlan(
  text: string,
  allowedActions: PlannerActionDescriptor[],
): AeraPlan {
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
      candidate.input && typeof candidate.input === "object" && !Array.isArray(candidate.input)
        ? (candidate.input as Record<string, unknown>)
        : null;

    const advertised = allowedActions.some(
      (action) => action.capability === capability,
    );

    if (advertised && input) {
      return {
        kind: "action",
        capability,
        input,
        message:
          typeof candidate.message === "string"
            ? candidate.message
            : "Running the requested action.",
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
  allowedActions: PlannerActionDescriptor[],
): Promise<{ plan: AeraPlan; response: LocalChatResponse }> {
  const response = await localChat({
    provider: request.provider,
    model: request.model,
    messages: [
      {
        role: "system",
        content: AERA_SYSTEM_PROMPT + "\n\n" + buildActionProtocol(allowedActions),
      },
      ...request.messages,
    ],
  });

  return { plan: parsePlan(response.content, allowedActions), response };
}
