import { describe, expect, it } from "vitest";
import { choosePlacement, overlapArea } from "./spatial";

describe("spatial placement", () => {
  it("computes overlap area", () => {
    expect(overlapArea(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 },
    )).toBe(2500);
  });

  it("prefers an unoccupied edge candidate", () => {
    const chosen = choosePlacement(
      { x: 0, y: 0, width: 1000, height: 700 },
      100,
      [{ x: 850, y: 0, width: 150, height: 200 }],
      20,
    );
    expect(chosen).not.toEqual({ x: 880, y: 20 });
  });
});
