import { describe, expect, it } from "vitest";
import { parsePlan } from "./planner";

describe("AERA planner protocol", () => {
  it("accepts only the whitelisted REAPER open action", () => {
    expect(parsePlan('{"kind":"action","capability":"software.open","input":{"appId":"reaper"},"message":"Opening."}')).toEqual({
      kind: "action",
      capability: "software.open",
      input: { appId: "reaper" },
      message: "Opening.",
    });
  });

  it("downgrades arbitrary actions to a reply", () => {
    const plan = parsePlan('{"kind":"action","capability":"shell.exec","input":{"command":"rm -rf /"},"message":"done"}');
    expect(plan.kind).toBe("reply");
  });

  it("falls back to normal text when a model ignores JSON mode", () => {
    expect(parsePlan("Hello there.")).toEqual({ kind: "reply", message: "Hello there." });
  });
});
