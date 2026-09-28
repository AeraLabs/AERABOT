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

const REAPER_WORD = /\breaper\b/;

export function parseDirectIntent(text: string): DirectIntent | null {
  const value = normalize(text);
  if (!value) return null;

  if (
    REAPER_WORD.test(value) &&
    /\b(open|launch|start up|start)\b/.test(value) &&
    !/\b(play|playing|playback|transport)\b/.test(value)
  ) {
    return {
      capability: "software.open",
      input: { appId: "reaper" },
      successMessage: "REAPER is open.",
    };
  }

  const reaperContext = REAPER_WORD.test(value) || /\btransport\b/.test(value);
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
