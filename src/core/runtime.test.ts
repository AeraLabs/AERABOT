import { describe, expect, it } from "vitest";
import type { Skill } from "./skills";
import { AeraRuntime } from "./runtime";

describe("AERA runtime Skill addressing", () => {
  it("executes the Skill explicitly named by the proposed action", async () => {
    const runtime = new AeraRuntime();
    const calls: string[] = [];

    const reaper: Skill = {
      id: "reaper",
      name: "REAPER",
      version: "1",
      capabilities: ["transport.play"],
      supports: () => true,
      propose: async () => null,
      execute: async () => {
        calls.push("reaper");
      },
    };

    const wavr: Skill = {
      id: "wavr",
      name: "WAVR",
      version: "1",
      capabilities: ["transport.play"],
      supports: () => true,
      propose: async () => null,
      execute: async () => {
        calls.push("wavr");
      },
    };

    runtime.skills.register(reaper);
    runtime.skills.register(wavr);

    const result = await runtime.execute({
      id: "wavr-play",
      skillId: "wavr",
      capability: "transport.play",
      description: "Play WAVR",
      risk: "safe",
      input: { appId: "wavr" },
    });

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["wavr"]);
  });

  it("rejects capability spoofing against an addressed Skill", async () => {
    const runtime = new AeraRuntime();
    runtime.skills.register({
      id: "reaper",
      name: "REAPER",
      version: "1",
      capabilities: ["transport.play"],
      supports: () => true,
      propose: async () => null,
      execute: async () => undefined,
    });

    const result = await runtime.execute({
      id: "bad",
      skillId: "reaper",
      capability: "file.delete",
      description: "Bad action",
      risk: "safe",
    });

    expect(result.ok).toBe(false);
  });
});
