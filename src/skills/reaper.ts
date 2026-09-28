import { openKnownApp } from "../platform/apps";
import { runReaperTransport } from "../platform/reaperOsc";
import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";

type ReaperInput = {
  appId?: unknown;
};

function actionId(capability: string) {
  return "reaper-" + capability.replace(".", "-") + "-" + Date.now().toString(36);
}

const TRANSPORT = new Map<string, "play" | "stop" | "pause">([
  ["transport.play", "play"],
  ["transport.stop", "stop"],
  ["transport.pause", "pause"],
]);

export const reaperSkill: Skill = {
  id: "reaper",
  name: "REAPER",
  version: "0.2.0",
  capabilities: ["software.open", ...TRANSPORT.keys()],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    const candidate = (input ?? {}) as ReaperInput;
    if (candidate.appId !== "reaper") return null;

    if (capability === "software.open") {
      return {
        id: actionId(capability),
        capability,
        description: "Open REAPER",
        risk: "safe",
        input: { appId: "reaper" },
      };
    }

    const transport = TRANSPORT.get(capability);
    if (!transport) return null;

    return {
      id: actionId(capability),
      capability,
      description: transport[0].toUpperCase() + transport.slice(1) + " REAPER transport",
      risk: "safe",
      input: { appId: "reaper" },
    };
  },

  async execute(action: ProposedAction) {
    const input = (action.input ?? {}) as ReaperInput;
    if (input.appId !== "reaper") {
      throw new Error("REAPER Skill rejected an invalid application target.");
    }

    if (action.capability === "software.open") {
      await openKnownApp("reaper");
      return { appId: "reaper", opened: true };
    }

    const transport = TRANSPORT.get(action.capability);
    if (!transport) {
      throw new Error("REAPER Skill rejected an unsupported capability.");
    }

    await runReaperTransport(transport);
    return { appId: "reaper", transport };
  },
};
