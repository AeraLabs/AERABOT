import type { ForegroundWindowSnapshot } from "./bridge";

export type CoreDawId =
  | "reaper"
  | "flstudio"
  | "protools"
  | "logic"
  | "ableton";

export interface CoreDawDescriptor {
  id: CoreDawId;
  name: string;
}

export const CORE_DAWS: readonly CoreDawDescriptor[] = [
  { id: "reaper", name: "REAPER" },
  { id: "flstudio", name: "FL Studio" },
  { id: "protools", name: "Pro Tools" },
  { id: "logic", name: "Logic Pro" },
  { id: "ableton", name: "Ableton Live" },
];

export function isCoreDawId(value: unknown): value is CoreDawId {
  return CORE_DAWS.some((daw) => daw.id === value);
}

export function foregroundDaw(
  snapshot: ForegroundWindowSnapshot | null,
): CoreDawDescriptor | null {
  if (!snapshot?.available || snapshot.isAera) return null;

  const identity = [snapshot.appName ?? "", snapshot.appId ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/[_-]/g, " ");

  if (/\breaper(?:64)?\b/.test(identity)) {
    return { id: "reaper", name: "REAPER" };
  }

  if (/\bfl\s*studio\b|\bflstudio\b|\bimage line\b/.test(identity)) {
    return { id: "flstudio", name: "FL Studio" };
  }

  if (/\bpro\s*tools\b|\bprotools\b|\bavid.*pro\s*tools\b/.test(identity)) {
    return { id: "protools", name: "Pro Tools" };
  }

  if (
    /\blogic\s*pro\b|\blogicpro\b|\bcom\.apple\.logic/.test(identity)
  ) {
    return { id: "logic", name: "Logic Pro" };
  }

  if (/\bableton(?:\s*live)?\b/.test(identity)) {
    return { id: "ableton", name: "Ableton Live" };
  }

  return null;
}

export function foregroundDawModelContext(
  snapshot: ForegroundWindowSnapshot | null,
) {
  const daw = foregroundDaw(snapshot);
  if (!daw) return null;

  return (
    "Verified local desktop context: " +
    daw.name +
    " is the foreground DAW." +
    " Only use DAW actions that are explicitly present in the installed AERA Skill catalog." +
    " Do not assume deeper session state unless a verified DAW bridge provides it."
  );
}
