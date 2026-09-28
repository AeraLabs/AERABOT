import { describe, expect, it } from "vitest";
import {
  choosePlacement,
  chooseWindowAwarePlacement,
  containsPoint,
  overlapArea,
  quantizedWindowKey,
} from "./spatial";

describe("spatial placement", () => {
  it("computes overlap area", () => {
    expect(
      overlapArea(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 },
      ),
    ).toBe(2500);
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

  it("sits beside a window when desktop space exists", () => {
    const viewport = { x: 0, y: 0, width: 1440, height: 900 };
    const focused = { x: 100, y: 100, width: 900, height: 650 };
    const chosen = chooseWindowAwarePlacement(viewport, 100, focused, 20);
    const orb = { ...chosen, width: 100, height: 100 };

    expect(overlapArea(orb, focused)).toBe(0);
    expect(containsPoint(viewport, { x: chosen.x, y: chosen.y })).toBe(true);
  });

  it("falls back to a screen edge for a fullscreen window", () => {
    const viewport = { x: 0, y: 0, width: 1440, height: 900 };
    const focused = { ...viewport };
    const chosen = chooseWindowAwarePlacement(viewport, 80, focused, 16);

    expect(chosen.x === 16 || chosen.x === 1344).toBe(true);
    expect(chosen.y === 16 || chosen.y === 804).toBe(true);
  });

  it("quantizes small geometry jitter into one stable key", () => {
    const first = quantizedWindowKey(
      "app",
      "Project",
      { x: 100, y: 100, width: 900, height: 600 },
    );
    const second = quantizedWindowKey(
      "app",
      "Project",
      { x: 105, y: 103, width: 898, height: 604 },
    );
    expect(first).toBe(second);
  });
});
