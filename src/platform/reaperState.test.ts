import { describe, expect, it } from "vitest";
import {
  reaperModelContext,
  reaperTransportLabel,
  type ReaperProjectState,
} from "./reaperState";

const state: ReaperProjectState = {
  schemaVersion: 1,
  reaperVersion: "7.80/x64",
  bridgeTime: 1,
  projectName: "AERA Song.rpp",
  projectFile: "C:/private/path/AERA Song.rpp",
  stateChangeCount: 1,
  playState: 1,
  playing: true,
  paused: false,
  recording: false,
  playPosition: 12.5,
  cursorPosition: 8,
  projectLength: 200,
  bpm: 120,
  trackCount: 2,
  tracksTruncated: false,
  selectedTrack: {
    index: 2,
    guid: "{x}",
    name: "Lead Vocal",
    muted: false,
    soloed: false,
    armed: true,
    monitoring: true,
    volume: 1,
    pan: 0,
    fx: ["ReaEQ", "ReaComp"],
  },
  tracks: [],
};

describe("REAPER live state", () => {
  it("labels transport state", () => {
    expect(reaperTransportLabel(state)).toBe("playing");
  });

  it("creates useful model context without exposing project file paths", () => {
    const context = reaperModelContext(state);
    expect(context).toContain("Lead Vocal");
    expect(context).toContain("120.00 BPM");
    expect(context).not.toContain("C:/private/path");
  });
});
