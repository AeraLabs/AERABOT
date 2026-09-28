import { describe, expect, it } from "vitest";
import { parseDirectIntent } from "./directIntent";

describe("deterministic AERA intents", () => {
  it("opens every core DAW without an LLM", () => {
    expect(parseDirectIntent("Aera, open Reaper")).toMatchObject({
      capability: "software.open",
      input: { appId: "reaper" },
    });
    expect(parseDirectIntent("launch FL Studio")).toMatchObject({
      capability: "software.open",
      input: { appId: "flstudio" },
    });
    expect(parseDirectIntent("open Pro Tools")).toMatchObject({
      capability: "software.open",
      input: { appId: "protools" },
    });
    expect(parseDirectIntent("start Logic Pro")).toMatchObject({
      capability: "software.open",
      input: { appId: "logic" },
    });
    expect(parseDirectIntent("launch Ableton Live")).toMatchObject({
      capability: "software.open",
      input: { appId: "ableton" },
    });
  });

  it("maps only currently implemented REAPER transport commands", () => {
    expect(parseDirectIntent("play reaper")?.capability).toBe("transport.play");
    expect(parseDirectIntent("stop REAPER")?.capability).toBe("transport.stop");
    expect(parseDirectIntent("pause the reaper transport")?.capability).toBe("transport.pause");
    expect(parseDirectIntent("play Ableton")).toBeNull();
    expect(parseDirectIntent("stop FL Studio")).toBeNull();
  });

  it("does not hijack ordinary conversation", () => {
    expect(parseDirectIntent("How does playback latency work?")).toBeNull();
    expect(parseDirectIntent("Tell me about REAPER")).toBeNull();
    expect(parseDirectIntent("Compare Logic and Ableton")).toBeNull();
  });
});
