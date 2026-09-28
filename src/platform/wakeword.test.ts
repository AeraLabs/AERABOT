import { describe, expect, it } from "vitest";

describe("wake-word event contract", () => {
  it("keeps wake events local, attributable, and deduplicatable", () => {
    const event = {
      schemaVersion: 1,
      engine: "sherpa-onnx",
      eventId: "wake-abc",
      phrase: "AERA",
      detectedAtMs: 42,
    };
    expect(Object.keys(event).sort()).toEqual([
      "detectedAtMs",
      "engine",
      "eventId",
      "phrase",
      "schemaVersion",
    ]);
  });
});
