import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORB_PALETTE,
  sanitizeOrbPalette,
} from "../core/preferences";
import { PRESENCE_PROFILES, paletteCssVariables } from "./palette";

describe("orb personalization", () => {
  it("preserves valid user colors", () => {
    expect(
      sanitizeOrbPalette({
        primary: "#FF00AA",
        secondary: "#00ffaa",
        accent: "#112233",
      }),
    ).toEqual({
      primary: "#ff00aa",
      secondary: "#00ffaa",
      accent: "#112233",
    });
  });

  it("repairs invalid colors independently", () => {
    const palette = sanitizeOrbPalette({
      primary: "red",
      secondary: "#abcdef",
      accent: null,
    });
    expect(palette.primary).toBe(DEFAULT_ORB_PALETTE.primary);
    expect(palette.secondary).toBe("#abcdef");
    expect(palette.accent).toBe(DEFAULT_ORB_PALETTE.accent);
  });

  it("keeps expressive presence more animated than serene", () => {
    expect(PRESENCE_PROFILES.expressive.motion).toBeGreaterThan(
      PRESENCE_PROFILES.serene.motion,
    );
    expect(PRESENCE_PROFILES.expressive.bloom).toBeGreaterThan(
      PRESENCE_PROFILES.serene.bloom,
    );
  });

  it("maps all three palette colors into css variables", () => {
    expect(paletteCssVariables(DEFAULT_ORB_PALETTE)).toMatchObject({
      "--aera-primary": DEFAULT_ORB_PALETTE.primary,
      "--aera-secondary": DEFAULT_ORB_PALETTE.secondary,
      "--aera-accent": DEFAULT_ORB_PALETTE.accent,
    });
  });
});
