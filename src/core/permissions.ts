export type RiskClass = "safe" | "reversible" | "destructive";

export interface ProposedAction {
  id: string;
  skillId: string;
  capability: string;
  description: string;
  risk: RiskClass;
  input?: unknown;
  before?: unknown;
  after?: unknown;
}

export interface JournalEntry extends ProposedAction {
  timestamp: number;
  status: "executed" | "rejected" | "undone";
}

export const requiresConfirmation = (action: ProposedAction) =>
  action.risk === "destructive";

export class ActionJournal {
  private entries: JournalEntry[] = [];

  record(action: ProposedAction, status: JournalEntry["status"] = "executed") {
    const entry: JournalEntry = { ...action, status, timestamp: Date.now() };
    this.entries = [entry, ...this.entries].slice(0, 250);
    return entry;
  }

  markUndone(id: string) {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (entry) entry.status = "undone";
    return entry;
  }

  list() {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
