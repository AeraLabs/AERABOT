import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";
import { openKnownApp } from "../platform/apps";

export type DawAppId =
  | "protools"
  | "logic"
  | "ableton";

type LaunchInput = {
  appId?: unknown;
};

interface LaunchSkillSpec {
  id: DawAppId;
  name: string;
  platforms: Array<"macOS" | "Windows">;
}

export function createDawLaunchSkill(spec: LaunchSkillSpec): Skill {
  return {
    id: spec.id,
    name: spec.name,
    version: "0.1.0",
    capabilities: ["software.open"],
    plannerActions: [
      {
        capability: "software.open",
        description: "Open or launch " + spec.name + " when the user explicitly asks.",
        inputExample: { appId: spec.id },
      },
    ],

    supports(context: SkillContext) {
      return spec.platforms.includes(context.platform as "macOS" | "Windows");
    },

    async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
      const candidate = (input ?? {}) as LaunchInput;
      if (capability !== "software.open" || candidate.appId !== spec.id) {
        return null;
      }

      return {
        id: spec.id + "-open-" + Date.now().toString(36),
        skillId: spec.id,
        capability,
        description: "Open " + spec.name,
        risk: "safe",
        input: { appId: spec.id },
      };
    },

    async execute(action: ProposedAction) {
      const candidate = (action.input ?? {}) as LaunchInput;
      if (
        action.skillId !== spec.id ||
        action.capability !== "software.open" ||
        candidate.appId !== spec.id
      ) {
        throw new Error(spec.name + " Skill rejected an invalid launch action.");
      }

      await openKnownApp(spec.id);
      return { appId: spec.id, opened: true };
    },
  };
}

export const proToolsSkill = createDawLaunchSkill({
  id: "protools",
  name: "Pro Tools",
  platforms: ["macOS", "Windows"],
});

export const logicSkill = createDawLaunchSkill({
  id: "logic",
  name: "Logic Pro",
  platforms: ["macOS"],
});

export const abletonSkill = createDawLaunchSkill({
  id: "ableton",
  name: "Ableton Live",
  platforms: ["macOS", "Windows"],
});
