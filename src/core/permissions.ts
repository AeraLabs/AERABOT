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

export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AERA_JOURNAL_STORAGE_KEY = "aera.action-journal.v1";
const MAX_JOURNAL_ENTRIES = 250;

export const requiresConfirmation = (action: ProposedAction) =>
  action.risk === "destructive";

function browserJournalStorage(): JournalStorage | null {
  try {
    if (typeof globalThis === "undefined") return null;
    return (
      (globalThis as typeof globalThis & { localStorage?: JournalStorage })
        .localStorage ?? null
    );
  } catch {
    return null;
  }
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<JournalEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.skillId === "string" &&
    typeof entry.capability === "string" &&
    typeof entry.description === "string" &&
    (entry.risk === "safe" ||
      entry.risk === "reversible" ||
      entry.risk === "destructive") &&
    (entry.status === "executed" ||
      entry.status === "rejected" ||
      entry.status === "undone") &&
    typeof entry.timestamp === "number" &&
    Number.isFinite(entry.timestamp)
  );
}

export class ActionJournal {
  private entries: JournalEntry[];

  constructor(
    private readonly storage: JournalStorage | null = browserJournalStorage(),
    private readonly storageKey = AERA_JOURNAL_STORAGE_KEY,
  ) {
    this.entries = this.load();
  }

  record(action: ProposedAction, status: JournalEntry["status"] = "executed") {
    const entry: JournalEntry = { ...action, status, timestamp: Date.now() };
    this.entries = [entry, ...this.entries].slice(0, MAX_JOURNAL_ENTRIES);
    this.persist();
    return entry;
  }

  markUndone(id: string) {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (entry) {
      entry.status = "undone";
      this.persist();
    }
    return entry;
  }

  list(limit = MAX_JOURNAL_ENTRIES) {
    const safeLimit = Math.max(0, Math.min(MAX_JOURNAL_ENTRIES, limit));
    return this.entries.slice(0, safeLimit).map((entry) => ({ ...entry }));
  }

  clear() {
    this.entries = [];
    this.persist();
  }

  private load(): JournalEntry[] {
    if (!this.storage) return [];

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(isJournalEntry).slice(0, MAX_JOURNAL_ENTRIES);
    } catch {
      return [];
    }
  }

  private persist() {
    if (!this.storage) return;

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // History persistence must never block a verified action.
    }
  }
}
