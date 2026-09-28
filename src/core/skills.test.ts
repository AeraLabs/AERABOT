import { describe, expect, it } from "vitest";
import type { ProposedAction } from "./permissions";
import { SkillBus, type Skill } from "./skills";

function makeSkill(id: string, appId: string): Skill {
  return {
    id,
    name: id.toUpperCase(),
    version: "1.0.0",
    capabilities: ["transport.play"],
    plannerActions: [
      {
        capability: "transport.play",
        description: "Play " + id,
        inputExample: { appId },
      },
    ],
    supports: () => true,
    async propose(capability, input) {
      const target = (input as { appId?: string } | undefined)?.appId;
      if (capability !== "transport.play" || target !== appId) return null;
      return {
        id: id + "-play",
        skillId: id,
        capability,
        description: "Play " + id,
        risk: "safe",
        input: { appId },
      };
    },
    async execute(_action: ProposedAction) {
      return id;
    },
  };
}

describe("SkillBus routing", () => {
  it("preserves duplicate semantic capabilities in the planner catalog", () => {
    const bus = new SkillBus();
    bus.register(makeSkill("reaper", "reaper"));
    bus.register(makeSkill("wavr", "wavr"));

    const actions = bus
      .plannerCatalog()
      .filter((action) => action.capability === "transport.play");

    expect(actions).toHaveLength(2);
    expect(actions.map((action) => action.skillId)).toEqual(["reaper", "wavr"]);
  });

  it("routes shared capabilities using Skill proposal validation", async () => {
    const bus = new SkillBus();
    bus.register(makeSkill("reaper", "reaper"));
    bus.register(makeSkill("wavr", "wavr"));

    const proposal = await bus.propose("transport.play", { appId: "wavr" });

    expect(proposal?.skill.id).toBe("wavr");
    expect(proposal?.action.skillId).toBe("wavr");
  });
});
