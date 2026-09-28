import { describe, expect, it } from "vitest";
import {
  findForegroundMonitor,
  isReaperForeground,
  planSpatialTarget,
} from "./spatialAwareness";
import type {
  ForegroundWindowSnapshot,
  MonitorSnapshot,
} from "./bridge";

const monitor: MonitorSnapshot = {
  name: "Main",
  x: 0,
  y: 0,
  width: 2880,
  height: 1800,
  scaleFactor: 2,
};

function snapshot(
  overrides: Partial<ForegroundWindowSnapshot> = {},
): ForegroundWindowSnapshot {
  return {
    available: true,
    appName: "REAPER",
    appId: "com.cockos.reaper",
    processId: 42,
    title: "Song",
    bounds: { x: 100, y: 100, width: 1000, height: 700 },
    minimized: false,
    maximized: false,
    fullscreen: false,
    coordinateSpace: "logical",
    geometrySource: "macos-accessibility",
    permissionRequired: true,
    permissionGranted: true,
    isAera: false,
    error: null,
    ...overrides,
  };
}

describe("spatial awareness", () => {
  it("identifies REAPER without matching unrelated words", () => {
    expect(isReaperForeground(snapshot())).toBe(true);
    expect(
      isReaperForeground(
        snapshot({ appName: "Notepad", appId: "com.example.reader" }),
      ),
    ).toBe(false);
  });

  it("matches a logical foreground window to a retina monitor", () => {
    expect(findForegroundMonitor(snapshot(), [monitor])?.name).toBe("Main");
  });

  it("returns a physical target for logical macOS geometry", () => {
    const target = planSpatialTarget(snapshot(), [monitor], 160, 20);
    expect(target).not.toBeNull();
    expect(Number.isFinite(target!.x)).toBe(true);
    expect(Number.isFinite(target!.y)).toBe(true);
    expect(target!.x).toBeGreaterThanOrEqual(0);
    expect(target!.x).toBeLessThanOrEqual(2880 - 160);
  });

  it("uses physical coordinates unchanged on Windows-like snapshots", () => {
    const physicalMonitor = { ...monitor, width: 1920, height: 1080, scaleFactor: 1 };
    const target = planSpatialTarget(
      snapshot({
        coordinateSpace: "physical",
        geometrySource: "win32-dwm",
        permissionRequired: false,
        bounds: { x: 100, y: 100, width: 1200, height: 800 },
      }),
      [physicalMonitor],
      140,
      20,
    );
    expect(target).not.toBeNull();
    expect(target!.x).toBeGreaterThanOrEqual(0);
    expect(target!.y).toBeGreaterThanOrEqual(0);
  });
});
