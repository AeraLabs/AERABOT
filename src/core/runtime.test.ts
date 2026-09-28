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


describe("AERA runtime undo", () => {
  it("undoes the newest reversible executed action through its addressed Skill", async () => {
    const runtime = new AeraRuntime();
    const calls: string[] = [];

    runtime.skills.register({
      id: "reaper",
      name: "REAPER",
      version: "1",
      capabilities: ["track.mute.set"],
      supports: () => true,
      propose: async () => null,
      execute: async () => undefined,
      undo: async (action) => {
        calls.push(action.id);
      },
    });

    await runtime.execute({
      id: "mute-1",
      skillId: "reaper",
      capability: "track.mute.set",
      description: "Mute selected track",
      risk: "reversible",
      before: { value: false },
      after: { value: true },
    });

    const result = await runtime.undoLast();

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["mute-1"]);
    expect(runtime.journal.list()[0].status).toBe("undone");
  });

  it("does not undo safe actions or already-undone actions", async () => {
    const runtime = new AeraRuntime();
    runtime.skills.register({
      id: "reaper",
      name: "REAPER",
      version: "1",
      capabilities: ["software.open"],
      supports: () => true,
      propose: async () => null,
      execute: async () => undefined,
    });

    await runtime.execute({
      id: "open",
      skillId: "reaper",
      capability: "software.open",
      description: "Open REAPER",
      risk: "safe",
    });

    const result = await runtime.undoLast();
    expect(result.ok).toBe(false);
  });
});
