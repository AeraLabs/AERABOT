export interface DirectIntent {
  capability: string;
  input: Record<string, unknown>;
  successMessage: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DAWS = [
  {
    id: "flstudio",
    label: "FL Studio",
    pattern: /\bfl\s*studio\b|\bfruit[y]?\s*loops\b/,
  },
  {
    id: "protools",
    label: "Pro Tools",
    pattern: /\bpro\s*tools\b/,
  },
  {
    id: "logic",
    label: "Logic Pro",
    pattern: /\blogic(?:\s*pro)?\b/,
  },
  {
    id: "ableton",
    label: "Ableton Live",
    pattern: /\bableton(?:\s*live)?\b/,
  },
  {
    id: "reaper",
    label: "REAPER",
    pattern: /\breaper\b/,
  },
] as const;

function dawFromText(value: string) {
  return DAWS.find((daw) => daw.pattern.test(value)) ?? null;
}

export function parseDirectIntent(text: string): DirectIntent | null {
  const value = normalize(text);
  if (!value) return null;

  const daw = dawFromText(value);

  if (
    daw &&
    /\b(open|launch|start up|start)\b/.test(value) &&
    !/\b(play|playing|playback|transport)\b/.test(value)
  ) {
    return {
      capability: "software.open",
      input: { appId: daw.id },
      successMessage: daw.label + " is open.",
    };
  }

  // Transport is real only for the REAPER Skill today.
  const reaperContext =
    daw?.id === "reaper" || (!daw && /\breaper\s+transport\b/.test(value));
  if (!reaperContext) return null;

  if (/\b(stop|halt)\b/.test(value)) {
    return {
      capability: "transport.stop",
      input: { appId: "reaper" },
      successMessage: "REAPER stopped.",
    };
  }

  if (/\b(pause|hold)\b/.test(value)) {
    return {
      capability: "transport.pause",
      input: { appId: "reaper" },
      successMessage: "REAPER paused.",
    };
  }

  if (/\b(play|resume)\b/.test(value)) {
    return {
      capability: "transport.play",
      input: { appId: "reaper" },
      successMessage: "REAPER is playing.",
    };
  }

  return null;
}
