import { describe, expect, it } from "vitest";
import { answerSystemHealthQuery, buildSystemHealth } from "./systemHealth";

const foreground = {
  available: true,
  appName: "Finder",
  appId: "com.apple.finder",
  processId: 1,
  title: null,
  bounds: null,
  minimized: false,
  maximized: false,
  fullscreen: false,
  coordinateSpace: "logical" as const,
  geometrySource: "none" as const,
  permissionRequired: false,
  permissionGranted: true,
  isAera: false,
  error: null,
};

describe("system health", () => {
  it("reports verified readiness and capability gaps", () => {
    const health = buildSystemHealth({
      providers: [
        {
          id: "ollama",
          name: "Ollama",
          endpoint: "http://127.0.0.1:11434",
          available: true,
          models: ["qwen3"],
          error: null,
        },
      ],
      speech: {
        whisperAvailable: true,
        piperAvailable: false,
        whisperEndpoint: "local",
        piperEndpoint: "local",
      },
      wakeWord: null,
      foreground,
      daws: [
        { id: "reaper", name: "REAPER", installed: true, path: "/Applications/REAPER.app" },
      ],
      skills: [
        {
          id: "reaper",
          name: "REAPER",
          version: "0.5.0",
          capabilities: [
            "transport.play",
            "transport.stop",
            "track.mute.set",
            "track.solo.set",
            "track.arm.set",
          ],
        },
      ],
      reaperBridge: {
        available: true,
        stale: false,
        ageMs: 50,
        path: "state",
        state: null,
        error: null,
      },
      flStudioBridge: null,
      abletonBridge: null,
      logicBridge: null,
      proToolsBridge: null,
      wavrBridge: null,
    });

    expect(health.coreReady).toBe(3);
    expect(health.daws.find((daw) => daw.id === "reaper")?.bridgeReady).toBe(true);
    expect(
      health.daws.find((daw) => daw.id === "reaper")?.missingParityCapabilities,
    ).toContain("track.volume.set");
  });

  it("answers local diagnostics requests", () => {
    const health = buildSystemHealth({
      providers: [],
      speech: null,
      wakeWord: null,
      foreground: null,
      daws: [],
      skills: [],
      reaperBridge: null,
      flStudioBridge: null,
      abletonBridge: null,
      logicBridge: null,
      proToolsBridge: null,
      wavrBridge: null,
    });

    const answer = answerSystemHealthQuery("run diagnostics", health);
    expect(answer).toContain("0/3 core systems ready");
    expect(answer).toContain("No local AI model is ready");
  });
});
