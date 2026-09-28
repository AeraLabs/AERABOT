import { describe, expect, it } from "vitest";

describe("wake-word event contract", () => {
  it("keeps the wake event intentionally tiny", () => {
    const event = {
      schemaVersion: 1,
      engine: "sherpa-onnx",
      phrase: "AERA",
      detectedAtMs: 42,
    };
    expect(Object.keys(event).sort()).toEqual([
      "detectedAtMs",
      "engine",
      "phrase",
      "schemaVersion",
    ]);
  });
});
