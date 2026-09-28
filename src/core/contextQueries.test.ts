import { describe, expect, it } from "vitest";
import { answerLocalContextQuery } from "./contextQueries";

const foreground = {
  available: true,
  appName: "Ableton Live",
  appId: "com.ableton.live",
  processId: 42,
  title: "Set.als",
  bounds: { x: 0, y: 0, width: 1200, height: 800 },
  minimized: false,
  maximized: false,
  fullscreen: false,
  coordinateSpace: "logical" as const,
  geometrySource: "macos-accessibility" as const,
  permissionRequired: true,
  permissionGranted: true,
  isAera: false,
  error: null,
};

describe("verified local context queries", () => {
  it("answers foreground app questions", () => {
    const answer = answerLocalContextQuery("what app is focused?", {
      foreground,
      dawStatuses: [],
      spatialAwareness: true,
      spatialBehavior: "adaptive",
    });
    expect(answer?.message).toContain("Ableton Live");
    expect(answer?.message).toContain("Set.als");
  });

  it("lists only detected DAWs", () => {
    const answer = answerLocalContextQuery("what DAWs do I have installed?", {
      foreground,
      dawStatuses: [
        { id: "reaper", name: "REAPER", installed: true, path: "/x" },
        { id: "protools", name: "Pro Tools", installed: false, path: null },
      ],
      spatialAwareness: true,
      spatialBehavior: "adaptive",
    });
    expect(answer?.message).toContain("REAPER");
    expect(answer?.message).not.toContain("Pro Tools");
  });

  it("does not pretend foreground awareness is screen vision", () => {
    const answer = answerLocalContextQuery("can you see my screen?", {
      foreground,
      dawStatuses: [],
      spatialAwareness: true,
      spatialBehavior: "companion",
    });
    expect(answer?.message).toContain("do not have screen-content vision yet");
    expect(answer?.message).toContain("foreground");
  });
});
