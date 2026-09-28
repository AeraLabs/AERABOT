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

  it("routes named transport commands to implemented deep DAW Skills", () => {
    expect(parseDirectIntent("play reaper")?.input).toEqual({ appId: "reaper" });
    expect(parseDirectIntent("stop FL Studio")?.input).toEqual({ appId: "flstudio" });
    expect(parseDirectIntent("play Ableton")?.input).toEqual({ appId: "ableton" });
    expect(parseDirectIntent("pause REAPER")?.capability).toBe("transport.pause");
  });

  it("uses verified foreground DAW identity when the user omits the name", () => {
    expect(parseDirectIntent("play", "ableton")).toMatchObject({
      capability: "transport.play",
      input: { appId: "ableton" },
    });
    expect(parseDirectIntent("mute this track", "flstudio")).toMatchObject({
      capability: "track.mute.set",
      input: { appId: "flstudio", target: "selected", value: true },
    });
    expect(parseDirectIntent("unmute it", "ableton")).toMatchObject({
      capability: "track.mute.set",
      input: { appId: "ableton", target: "selected", value: false },
    });
  });

  it("routes Logic and Pro Tools through their verified companion Skills", () => {
    expect(parseDirectIntent("play Logic Pro")).toMatchObject({
      capability: "transport.play",
      input: { appId: "logic" },
    });
    expect(parseDirectIntent("mute this track", "protools")).toMatchObject({
      capability: "track.mute.set",
      input: { appId: "protools", target: "selected", value: true },
    });
  });

  it("does not hijack ordinary conversation", () => {
    expect(parseDirectIntent("How does playback latency work?")).toBeNull();
    expect(parseDirectIntent("Tell me about REAPER")).toBeNull();
    expect(parseDirectIntent("Compare Logic and Ableton")).toBeNull();
  });
});
