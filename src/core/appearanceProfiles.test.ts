import { describe, expect, it } from "vitest";
import {
  applyAppearanceProfile,
  captureAppearanceProfile,
  normalizeAppearanceProfile,
} from "./appearanceProfiles";
import { DEFAULT_PREFERENCES } from "./preferences";

describe("appearance profiles", () => {
  it("captures the visual and behavior identity", () => {
    const profile = captureAppearanceProfile(
      "studio",
      "Studio Night",
      {
        ...DEFAULT_PREFERENCES,
        presenceStyle: "serene",
        orbSize: "compact",
        spatialBehavior: "quiet",
        orbPalette: {
          primary: "#ffffff",
          secondary: "#00ffaa",
          accent: "#3366ff",
        },
      },
    );

    expect(profile).toMatchObject({
      id: "studio",
      name: "Studio Night",
      presenceStyle: "serene",
      orbSize: "compact",
      spatialBehavior: "quiet",
    });
  });

  it("sanitizes persisted profile data", () => {
    const profile = normalizeAppearanceProfile({
      id: "x",
      name: "  My Look  ",
      palette: {
        primary: "bad",
        secondary: "#abcdef",
        accent: "#123456",
      },
      presenceStyle: "expressive",
      orbSize: "large",
      spatialBehavior: "companion",
    });

    expect(profile?.name).toBe("My Look");
    expect(profile?.palette.secondary).toBe("#abcdef");
  });

  it("applies a profile without altering unrelated AI preferences", () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      aiModel: "local-model",
    };
    const profile = captureAppearanceProfile(
      "one",
      "One",
      {
        ...preferences,
        presenceStyle: "expressive",
        orbSize: "large",
      },
    );

    const applied = applyAppearanceProfile(preferences, profile);
    expect(applied.aiModel).toBe("local-model");
    expect(applied.presenceStyle).toBe("expressive");
    expect(applied.orbSize).toBe("large");
  });
});
