import { describe, expect, it } from "vitest";
import { encodePcmWav, resampleLinear } from "./recorder";

describe("local voice recorder utilities", () => {
  it("writes a valid PCM WAV header", () => {
    const wav = encodePcmWav(new Float32Array([0, 0.5, -0.5]), 16000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(wav.byteLength).toBe(50);
  });

  it("resamples audio to a smaller sample count", () => {
    const input = new Float32Array(48000);
    const output = resampleLinear(input, 48000, 16000);
    expect(output.length).toBe(16000);
  });
});
