import { describe, expect, it } from "vitest";
import { parsePreferenceIntent } from "./preferenceIntent";

describe("AERA preference intents", () => {
  it("changes visual presence without an LLM", () => {
    expect(parsePreferenceIntent("be more expressive")).toMatchObject({
      type: "presence",
      value: "expressive",
    });
    expect(parsePreferenceIntent("calm down")).toMatchObject({
      type: "presence",
      value: "serene",
    });
  });

  it("changes physical orb size", () => {
    expect(parsePreferenceIntent("make the orb smaller")).toMatchObject({
      type: "size",
      value: "compact",
    });
    expect(parsePreferenceIntent("make yourself bigger")).toMatchObject({
      type: "size",
      value: "large",
    });
  });

  it("controls spatial behavior", () => {
    expect(parsePreferenceIntent("stay here and don't move")).toMatchObject({
      type: "spatial",
      value: false,
    });
    expect(parsePreferenceIntent("follow my work")).toMatchObject({
      type: "spatial",
      value: true,
    });
    expect(parsePreferenceIntent("companion mode")).toMatchObject({
      type: "spatial-behavior",
      value: "companion",
    });
  });

  it("does not hijack normal conversation", () => {
    expect(parsePreferenceIntent("why is animation expressive?")).toBeNull();
    expect(parsePreferenceIntent("tell me about spatial audio")).toBeNull();
  });
});
