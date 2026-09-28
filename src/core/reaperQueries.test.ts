import { describe, expect, it } from "vitest";
import { answerVerifiedReaperQuery } from "./reaperQueries";
import type { ReaperProjectState } from "../platform/reaperState";

const state: ReaperProjectState = {
  schemaVersion: 1,
  reaperVersion: "7.80",
  bridgeTime: 1,
  projectName: "Song.rpp",
  projectFile: "/private/song.rpp",
  stateChangeCount: 2,
  playState: 1,
  playing: true,
  paused: false,
  recording: false,
  playPosition: 22.25,
  cursorPosition: 10,
  projectLength: 180,
  bpm: 98.5,
  trackCount: 12,
  tracksTruncated: false,
  selectedTrack: {
    index: 4,
    guid: "{track}",
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

describe("verified REAPER queries", () => {
  it("answers selected-track questions from live state", () => {
    expect(answerVerifiedReaperQuery("what track am I on?", state, true)).toContain(
      "Lead Vocal",
    );
  });

  it("answers project tempo and track count without an LLM", () => {
    expect(answerVerifiedReaperQuery("what's the BPM?", state, true)).toContain(
      "98.50 BPM",
    );
    expect(
      answerVerifiedReaperQuery("how many tracks are there?", state, true),
    ).toContain("12 tracks");
  });

  it("answers selected FX queries", () => {
    expect(
      answerVerifiedReaperQuery("what plugins are on this track?", state, true),
    ).toContain("ReaEQ");
  });

  it("does not hijack unrelated conversation without REAPER context", () => {
    expect(
      answerVerifiedReaperQuery("what is the tempo of this song genre?", state, false),
    ).toBeNull();
  });
});
