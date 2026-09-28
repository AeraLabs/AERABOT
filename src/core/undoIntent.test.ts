import { describe, expect, it } from "vitest";
import { isUndoIntent } from "./undoIntent";

describe("undo intent", () => {
  it("recognizes natural local undo phrases", () => {
    expect(isUndoIntent("undo that")).toBe(true);
    expect(isUndoIntent("revert the last change")).toBe(true);
    expect(isUndoIntent("put that back")).toBe(true);
  });

  it("does not hijack discussion about undo", () => {
    expect(isUndoIntent("how does undo work in REAPER")).toBe(false);
  });
});
