import type { JournalEntry } from "./permissions";

const HISTORY_QUERY =
  /\b(what did you (?:change|do)|what have you (?:changed|done)|show (?:me )?(?:your )?(?:recent )?(?:changes|actions|history)|recent (?:changes|actions)|action history|change history)\b/i;

function formatEntry(entry: JournalEntry) {
  const skill = entry.skillId.toUpperCase();
  const state =
    entry.status === "undone"
      ? "undone"
      : entry.status === "rejected"
        ? "rejected"
        : "executed";

  return `${skill} · ${entry.description} · ${state}`;
}

export function answerActionHistoryQuery(
  input: string,
  entries: JournalEntry[],
): string | null {
  if (!HISTORY_QUERY.test(input.trim())) return null;

  const recent = entries
    .filter((entry) => entry.status !== "rejected")
    .slice(0, 5);

  if (recent.length === 0) {
    return "I haven't recorded any local actions yet.";
  }

  return [
    "Recent AERA actions:",
    ...recent.map((entry, index) => `${index + 1}. ${formatEntry(entry)}`),
  ].join("\n");
}
