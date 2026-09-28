import { describe, expect, it } from "vitest";
import { parsePlan } from "./planner";
import type { PlannerActionDescriptor } from "../core/skills";

const catalog: PlannerActionDescriptor[] = [
  {
    capability: "software.open",
    description: "Open REAPER.",
    inputExample: { appId: "reaper" },
  },
  {
    capability: "transport.play",
    description: "Play REAPER.",
    inputExample: { appId: "reaper" },
  },
];

describe("AERA planner protocol", () => {
  it("accepts an advertised action", () => {
    expect(
      parsePlan(
        '{"kind":"action","capability":"software.open","input":{"appId":"reaper"},"message":"Opening."}',
        catalog,
      ),
    ).toEqual({
      kind: "action",
      capability: "software.open",
      input: { appId: "reaper" },
      message: "Opening.",
    });
  });

  it("accepts advertised transport", () => {
    expect(
      parsePlan(
        '{"kind":"action","capability":"transport.play","input":{"appId":"reaper"},"message":"Playing."}',
        catalog,
      ),
    ).toEqual({
      kind: "action",
      capability: "transport.play",
      input: { appId: "reaper" },
      message: "Playing.",
    });
  });

  it("rejects a capability not advertised by a Skill", () => {
    const plan = parsePlan(
      '{"kind":"action","capability":"shell.exec","input":{"command":"rm -rf /"},"message":"done"}',
      catalog,
    );
    expect(plan.kind).toBe("reply");
  });

  it("lets the Skill, not the planner, perform detailed input validation", () => {
    const plan = parsePlan(
      '{"kind":"action","capability":"software.open","input":{"appId":"other"},"message":"Opening."}',
      catalog,
    );
    expect(plan.kind).toBe("action");
  });

  it("falls back to normal text when a model ignores JSON mode", () => {
    expect(parsePlan("Hello there.", catalog)).toEqual({
      kind: "reply",
      message: "Hello there.",
    });
  });
});
