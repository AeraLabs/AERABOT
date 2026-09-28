import { openKnownApp } from "../platform/apps";
import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";

type OpenSoftwareInput = {
  appId?: unknown;
};

function actionId() {
  return "reaper-open-" + Date.now().toString(36);
}

export const reaperSkill: Skill = {
  id: "reaper",
  name: "REAPER",
  version: "0.1.0",
  capabilities: ["software.open"],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    if (capability !== "software.open") return null;

    const candidate = (input ?? {}) as OpenSoftwareInput;
    if (candidate.appId !== "reaper") return null;

    return {
      id: actionId(),
      capability,
      description: "Open REAPER",
      risk: "safe",
      input: { appId: "reaper" },
    };
  },

  async execute(action: ProposedAction) {
    const input = (action.input ?? {}) as OpenSoftwareInput;
    if (action.capability !== "software.open" || input.appId !== "reaper") {
      throw new Error("REAPER Skill rejected an invalid action.");
    }

    await openKnownApp("reaper");
    return { appId: "reaper", opened: true };
  },
};
