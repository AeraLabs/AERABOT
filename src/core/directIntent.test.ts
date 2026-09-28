import { describe, expect, it } from "vitest";
import { parseDirectIntent } from "./directIntent";

describe("deterministic AERA intents", () => {
  it("opens REAPER without an LLM", () => {
    expect(parseDirectIntent("Aera, open Reaper")).toMatchObject({
      capability: "software.open",
      input: { appId: "reaper" },
    });
  });

  it("maps explicit REAPER transport commands", () => {
    expect(parseDirectIntent("play reaper")?.capability).toBe("transport.play");
    expect(parseDirectIntent("stop REAPER")?.capability).toBe("transport.stop");
    expect(parseDirectIntent("pause the reaper transport")?.capability).toBe("transport.pause");
  });

  it("does not hijack ordinary conversation", () => {
    expect(parseDirectIntent("How does playback latency work?")).toBeNull();
    expect(parseDirectIntent("Tell me about REAPER")).toBeNull();
    expect(parseDirectIntent("play some music")).toBeNull();
  });
});
