import { describe, expect, it } from "vitest";
import { answerActionHistoryQuery } from "./actionHistoryQueries";
import type { JournalEntry } from "./permissions";

const entries: JournalEntry[] = [
  {
    id: "1",
    skillId: "reaper",
    capability: "track.volume.set",
    description: "Lower Lead Vocal",
    risk: "reversible",
    timestamp: 2,
    status: "executed",
  },
  {
    id: "2",
    skillId: "reaper",
    capability: "track.mute.set",
    description: "Mute Harmony",
    risk: "reversible",
    timestamp: 1,
    status: "undone",
  },
];

describe("action history queries", () => {
  it("answers natural questions from the local journal", () => {
    const answer = answerActionHistoryQuery("AERA, what did you change?", entries);
    expect(answer).toContain("Recent AERA actions");
    expect(answer).toContain("Lower Lead Vocal");
    expect(answer).toContain("Mute Harmony");
    expect(answer).toContain("undone");
  });

  it("does not intercept unrelated conversation", () => {
    expect(answerActionHistoryQuery("write me a chorus", entries)).toBeNull();
  });

  it("explains when there is no recorded history", () => {
    expect(answerActionHistoryQuery("show recent actions", [])).toContain(
      "haven't recorded any local actions",
    );
  });
});
