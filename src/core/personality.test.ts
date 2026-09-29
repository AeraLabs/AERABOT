import { describe, expect, it } from "vitest";
import {
  acknowledgementFor,
  confusionFor,
  vibeDefaults,
  vibeSystemInstruction,
} from "./personality";

describe("AERA personality", () => {
  it("maps vibe choices to desktop presence defaults", () => {
    expect(vibeDefaults("cute")).toMatchObject({
      vibe: "cute",
      presenceStyle: "expressive",
      spatialBehavior: "companion",
    });
    expect(vibeDefaults("calm")).toMatchObject({
      vibe: "calm",
      presenceStyle: "serene",
      spatialBehavior: "quiet",
    });
  });

  it("keeps response selection deterministic for the same event", () => {
    expect(acknowledgementFor("cute", "summon")).toBe(
      acknowledgementFor("cute", "summon"),
    );
    expect(confusionFor("futuristic", "brain")).toBe(
      confusionFor("futuristic", "brain"),
    );
  });

  it("gives the model concise vibe guidance", () => {
    expect(vibeSystemInstruction("professional")).toContain("concisely");
    expect(vibeSystemInstruction("cute")).toContain("playful");
  });
});
