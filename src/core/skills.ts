import type { ProposedAction } from "./permissions";

export interface SkillContext {
  platform: string;
  arch: string;
}

export interface PlannerActionDescriptor {
  capability: string;
  description: string;
  inputExample: Record<string, unknown>;
  skillId?: string;
  skillName?: string;
}

export interface Skill {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  plannerActions?: PlannerActionDescriptor[];
  supports(context: SkillContext): boolean;
  propose(capability: string, input?: unknown): Promise<ProposedAction | null>;
  execute(action: ProposedAction): Promise<unknown>;
  undo?(action: ProposedAction): Promise<void>;
}

export interface SkillProposal {
  skill: Skill;
  action: ProposedAction;
}

export class SkillBus {
  private skills = new Map<string, Skill>();

  register(skill: Skill) {
    this.skills.set(skill.id, skill);
  }

  get(skillId: string) {
    return this.skills.get(skillId);
  }

  list() {
    return [...this.skills.values()].map(
      ({ id, name, version, capabilities, plannerActions }) => ({
        id,
        name,
        version,
        capabilities: [...capabilities],
        plannerActions: plannerActions ? [...plannerActions] : [],
      }),
    );
  }

  plannerCatalog(): PlannerActionDescriptor[] {
    const catalog: PlannerActionDescriptor[] = [];

    for (const skill of this.skills.values()) {
      for (const action of skill.plannerActions ?? []) {
        if (!skill.capabilities.includes(action.capability)) continue;
        catalog.push({
          ...action,
          skillId: skill.id,
          skillName: skill.name,
        });
      }
    }

    return catalog;
  }

  async propose(capability: string, input?: unknown): Promise<SkillProposal | null> {
    for (const skill of this.skills.values()) {
      if (!skill.capabilities.includes(capability)) continue;

      const action = await skill.propose(capability, input);
      if (!action) continue;

      if (action.skillId !== skill.id) {
        throw new Error(
          "Skill " +
            skill.id +
            " proposed an action addressed to " +
            action.skillId +
            ".",
        );
      }

      if (action.capability !== capability) {
        throw new Error(
          "Skill " + skill.id + " changed the requested capability during proposal.",
        );
      }

      return { skill, action };
    }

    return null;
  }
}
