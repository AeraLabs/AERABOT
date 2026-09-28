import { describe, expect, it, vi } from "vitest";
import { createCompanionDawSkill } from "./companionDaw";

vi.mock("../platform/dawBridge", () => ({
  getDawBridgeStatus: vi.fn(async () => ({
    available: false,
    stale: false,
    ageMs: null,
    path: null,
    state: null,
    error: "not connected",
  })),
  runDawCommand: vi.fn(),
}));

vi.mock("../platform/apps", () => ({
  openKnownApp: vi.fn(async () => undefined),
}));

describe("companion DAW Skill", () => {
  it("always allows whitelisted launch but gates deep control on a live bridge", async () => {
    const skill = createCompanionDawSkill({
      id: "logic",
      name: "Logic Pro",
      platforms: ["macOS"],
    });

    expect(
      await skill.propose("software.open", { appId: "logic" }),
    ).toMatchObject({
      skillId: "logic",
      capability: "software.open",
      risk: "safe",
    });

    expect(
      await skill.propose("transport.play", { appId: "logic" }),
    ).toBeNull();
  });
});
