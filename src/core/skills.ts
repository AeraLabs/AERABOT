import type { ProposedAction } from "./permissions";

export interface SkillContext { platform: string; arch: string; }

export interface Skill {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
  supports(context: SkillContext): boolean;
  propose(capability: string, input?: unknown): Promise<ProposedAction | null>;
  execute(action: ProposedAction): Promise<unknown>;
  undo?(action: ProposedAction): Promise<void>;
}

export class SkillBus {
  private skills = new Map<string, Skill>();

  register(skill: Skill) { this.skills.set(skill.id, skill); }

  list() {
    return [...this.skills.values()].map(({ id, name, version, capabilities }) => ({
      id, name, version, capabilities: [...capabilities],
    }));
  }

  findFor(capability: string) {
    return [...this.skills.values()].find((skill) => skill.capabilities.includes(capability));
  }
}
