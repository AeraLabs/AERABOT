import type { OrbState } from "../orb/state";
import {
  ActionJournal,
  requiresConfirmation,
  type ProposedAction,
} from "./permissions";
import { SkillBus } from "./skills";

export type RuntimeEvent =
  | { type: "state"; state: OrbState }
  | { type: "message"; message: string }
  | { type: "action-proposed"; action: ProposedAction }
  | { type: "action-completed"; action: ProposedAction }
  | { type: "action-rejected"; action: ProposedAction };

type Listener = (event: RuntimeEvent) => void;

export class AeraRuntime {
  state: OrbState = "AMBIENT";
  readonly journal = new ActionJournal();
  readonly skills = new SkillBus();
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(state: OrbState) {
    if (this.state === state) return;
    this.state = state;
    this.emit({ type: "state", state });
  }

  notify(message: string) {
    this.emit({ type: "message", message });
  }

  async runInternalCommand(command: string): Promise<boolean> {
    const normalized = command.trim().toLowerCase();
    if (!normalized) return false;

    const stateCommands: Record<string, OrbState> = {
      wake: "AWAKE",
      listen: "LISTENING",
      think: "THINKING",
      studio: "STUDIO",
      sleep: "SLEEPING",
      ambient: "AMBIENT",
      dnd: "DND",
      focus: "AWAKE",
    };

    const next = stateCommands[normalized];
    if (!next) return false;

    this.setState(next);
    this.emit({ type: "message", message: "AERA state: " + next.toLowerCase() });
    return true;
  }

  async execute(action: ProposedAction, confirmed = false) {
    this.emit({ type: "action-proposed", action });

    if (requiresConfirmation(action) && !confirmed) {
      this.setState("QUESTION");
      this.emit({ type: "action-rejected", action });
      return { ok: false, needsConfirmation: true as const };
    }

    const skill = this.skills.get(action.skillId);
    if (!skill || !skill.capabilities.includes(action.capability)) {
      this.setState("ERROR");
      this.journal.record(action, "rejected");
      return {
        ok: false,
        error:
          "The addressed Skill is not installed or does not provide this capability.",
      };
    }

    this.setState("ACTING");
    try {
      const result = await skill.execute(action);
      this.journal.record(action);
      this.setState("SUCCESS");
      this.emit({ type: "action-completed", action });
      return { ok: true, result };
    } catch (error) {
      this.setState("ERROR");
      this.journal.record(action, "rejected");
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private emit(event: RuntimeEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}
