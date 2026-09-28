import { describe, expect, it } from "vitest";
import { choreographyFor } from "./choreography";

describe("orb state choreography", () => {
  it("makes listening more responsive than studio mode", () => {
    expect(choreographyFor("LISTENING").pointerResponse).toBeGreaterThan(
      choreographyFor("STUDIO").pointerResponse,
    );
    expect(choreographyFor("LISTENING").waveform).toBeGreaterThan(
      choreographyFor("STUDIO").waveform,
    );
  });

  it("makes thinking gyroscopic rather than floaty", () => {
    expect(choreographyFor("THINKING").ringSpin).toBeGreaterThan(
      choreographyFor("AMBIENT").ringSpin,
    );
    expect(choreographyFor("THINKING").drift).toBeLessThan(
      choreographyFor("AMBIENT").drift,
    );
  });

  it("keeps DND quieter than success", () => {
    expect(choreographyFor("DND").particleGain).toBeLessThan(
      choreographyFor("SUCCESS").particleGain,
    );
    expect(choreographyFor("DND").halo).toBeLessThan(
      choreographyFor("SUCCESS").halo,
    );
  });
});
