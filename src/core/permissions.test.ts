import { describe, expect, it } from "vitest";
import {
  ActionJournal,
  requiresConfirmation,
  type JournalStorage,
} from "./permissions";

describe("permission engine", () => {
  it("requires confirmation only for destructive actions", () => {
    expect(
      requiresConfirmation({
        id: "1",
        skillId: "files",
        capability: "file.delete",
        description: "delete",
        risk: "destructive",
      }),
    ).toBe(true);

    expect(
      requiresConfirmation({
        id: "2",
        skillId: "daw",
        capability: "track.arm",
        description: "arm",
        risk: "reversible",
      }),
    ).toBe(false);
  });

  it("tracks undo state", () => {
    const journal = new ActionJournal(null);
    journal.record({
      id: "x",
      skillId: "daw",
      capability: "parameter.set",
      description: "change",
      risk: "reversible",
    });
    journal.markUndone("x");
    expect(journal.list()[0].status).toBe("undone");
  });

  it("persists and restores verified action history", () => {
    let stored: string | null = null;
    const storage: JournalStorage = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    };

    const first = new ActionJournal(storage, "test-journal");
    first.record({
      id: "persisted",
      skillId: "reaper",
      capability: "track.volume.set",
      description: "Lower Lead Vocal",
      risk: "reversible",
      before: 0.82,
      after: 0.71,
    });

    const restored = new ActionJournal(storage, "test-journal");
    expect(restored.list()).toHaveLength(1);
    expect(restored.list()[0]).toMatchObject({
      id: "persisted",
      skillId: "reaper",
      status: "executed",
      before: 0.82,
      after: 0.71,
    });

    restored.markUndone("persisted");
    const reloaded = new ActionJournal(storage, "test-journal");
    expect(reloaded.list()[0].status).toBe("undone");
  });

  it("ignores corrupt persisted journal data instead of blocking startup", () => {
    const storage: JournalStorage = {
      getItem: () => "{not-json",
      setItem: () => undefined,
    };

    expect(new ActionJournal(storage).list()).toEqual([]);
  });
});
