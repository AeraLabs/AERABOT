import { describe, expect, it } from "vitest";
import {
  foregroundDaw,
  foregroundDawModelContext,
  isCoreDawId,
} from "./dawAwareness";
import type { ForegroundWindowSnapshot } from "./bridge";

function snapshot(
  appName: string,
  appId: string,
): ForegroundWindowSnapshot {
  return {
    available: true,
    appName,
    appId,
    processId: 7,
    title: null,
    bounds: null,
    minimized: false,
    maximized: false,
    fullscreen: false,
    coordinateSpace: "logical",
    geometrySource: "none",
    permissionRequired: false,
    permissionGranted: true,
    isAera: false,
    error: null,
  };
}

describe("core DAW foreground awareness", () => {
  it("recognizes all core DAWs", () => {
    expect(foregroundDaw(snapshot("REAPER", "com.cockos.reaper"))?.id).toBe("reaper");
    expect(foregroundDaw(snapshot("FL Studio", "com.image-line.FLStudio"))?.id).toBe("flstudio");
    expect(foregroundDaw(snapshot("Pro Tools", "com.avid.ProTools"))?.id).toBe("protools");
    expect(foregroundDaw(snapshot("Logic Pro", "com.apple.logic10"))?.id).toBe("logic");
    expect(foregroundDaw(snapshot("Ableton Live 13 Suite", "com.ableton.live"))?.id).toBe("ableton");
  });

  it("rejects non-DAW foreground apps", () => {
    expect(foregroundDaw(snapshot("Finder", "com.apple.finder"))).toBeNull();
  });

  it("creates cautious model context", () => {
    const context = foregroundDawModelContext(
      snapshot("Ableton Live 13 Suite", "com.ableton.live"),
    );
    expect(context).toContain("Ableton Live");
    expect(context).toContain("Do not assume deeper session state");
  });

  it("validates stable DAW ids", () => {
    expect(isCoreDawId("logic")).toBe(true);
    expect(isCoreDawId("photoshop")).toBe(false);
  });
});
