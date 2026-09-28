export function isUndoIntent(input: string) {
  const value = input
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /^(undo|undo that|undo it|undo last|undo last action|undo last change)$/.test(value) ||
    /\b(undo|revert)\b.*\b(last|that|change|action)\b/.test(value) ||
    /\bput that back\b/.test(value)
  );
}
