import { describe, expect, it } from "vitest";
import { flStudioSkill } from "./flstudio";

describe("FL Studio Skill surface", () => {
  it("advertises semantic transport and selected-track capabilities", () => {
    expect(flStudioSkill.capabilities).toContain("transport.play");
    expect(flStudioSkill.capabilities).toContain("track.mute.set");
    expect(flStudioSkill.capabilities).toContain("track.volume.set");
    expect(flStudioSkill.capabilities).toContain("track.pan.set");
  });

  it("supports Intel/Apple macOS and Windows through one Skill", () => {
    expect(flStudioSkill.supports({ platform: "macOS", arch: "x86_64" })).toBe(true);
    expect(flStudioSkill.supports({ platform: "macOS", arch: "aarch64" })).toBe(true);
    expect(flStudioSkill.supports({ platform: "Windows", arch: "x86_64" })).toBe(true);
  });
});
