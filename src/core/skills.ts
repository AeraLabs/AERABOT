import type { ProposedAction } from "./permissions";

export interface SkillContext {
  platform: string;
  arch: string;
}

export interface PlannerActionDescriptor {
  capability: string;
  description: string;
  inputExample: Record<string, unknown>;
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

export class SkillBus {
  private skills = new Map<string, Skill>();

  register(skill: Skill) {
    this.skills.set(skill.id, skill);
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
    const catalog = new Map<string, PlannerActionDescriptor>();

    for (const skill of this.skills.values()) {
      for (const action of skill.plannerActions ?? []) {
        if (!skill.capabilities.includes(action.capability)) continue;
        if (!catalog.has(action.capability)) catalog.set(action.capability, action);
      }
    }

    return [...catalog.values()];
  }

  findFor(capability: string) {
    return [...this.skills.values()].find((skill) =>
      skill.capabilities.includes(capability),
    );
  }
}
