import { describe, expect, it } from "vitest";
import { abletonSkill } from "./ableton";

describe("Ableton Skill surface", () => {
  it("uses the shared semantic DAW vocabulary", () => {
    expect(abletonSkill.capabilities).toContain("transport.play");
    expect(abletonSkill.capabilities).toContain("track.mute.set");
    expect(abletonSkill.capabilities).toContain("track.volume.set");
    expect(abletonSkill.capabilities).toContain("track.pan.set");
  });

  it("keeps Intel Mac, Apple Silicon, and Windows support", () => {
    expect(abletonSkill.supports({ platform: "macOS", arch: "x86_64" })).toBe(true);
    expect(abletonSkill.supports({ platform: "macOS", arch: "aarch64" })).toBe(true);
    expect(abletonSkill.supports({ platform: "Windows", arch: "x86_64" })).toBe(true);
  });
});
