import { describe, expect, it } from "vitest";
import { ActionJournal, requiresConfirmation } from "./permissions";

describe("permission engine", () => {
  it("requires confirmation only for destructive actions", () => {
    expect(requiresConfirmation({ id: "1", capability: "file.delete", description: "delete", risk: "destructive" })).toBe(true);
    expect(requiresConfirmation({ id: "2", capability: "track.arm", description: "arm", risk: "reversible" })).toBe(false);
  });

  it("tracks undo state", () => {
    const journal = new ActionJournal();
    journal.record({ id: "x", capability: "parameter.set", description: "change", risk: "reversible" });
    journal.markUndone("x");
    expect(journal.list()[0].status).toBe("undone");
  });
});
