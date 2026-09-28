export interface DirectIntent {
  capability: string;
  input: Record<string, unknown>;
  successMessage: string;
}

export type DirectControlDawId =
  | "reaper"
  | "flstudio"
  | "protools"
  | "logic"
  | "ableton"
  | "wavr";

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
    id: "wavr",
    label: "WAVR",
    pattern: /\bwavr\b|\bwaver\b/,
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

function isDirectControlDaw(value: string | undefined): value is DirectControlDawId {
  return (
    value === "reaper" ||
    value === "flstudio" ||
    value === "protools" ||
    value === "logic" ||
    value === "ableton" ||
    value === "wavr"
  );
}

function labelFor(id: DirectControlDawId) {
  return DAWS.find((daw) => daw.id === id)?.label ?? id;
}

export function parseDirectIntent(
  text: string,
  activeDawId?: string,
): DirectIntent | null {
  const value = normalize(text);
  if (!value) return null;

  const namedDaw = dawFromText(value);

  if (
    namedDaw &&
    /\b(open|launch|start up|start)\b/.test(value) &&
    !/\b(play|playing|playback|transport|record)\b/.test(value)
  ) {
    return {
      capability: "software.open",
      input: { appId: namedDaw.id },
      successMessage: namedDaw.label + " is open.",
    };
  }

  const targetId = isDirectControlDaw(namedDaw?.id)
    ? namedDaw.id
    : !namedDaw && isDirectControlDaw(activeDawId)
      ? activeDawId
      : null;

  if (!targetId) return null;
  const label = labelFor(targetId);

  if (/\b(unmute)\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.mute.set",
      input: { appId: targetId, target: "selected", value: false },
      successMessage: "Selected " + label + " track unmuted.",
    };
  }

  if (/\b(mute)\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.mute.set",
      input: { appId: targetId, target: "selected", value: true },
      successMessage: "Selected " + label + " track muted.",
    };
  }

  if (/\b(unsolo)\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.solo.set",
      input: { appId: targetId, target: "selected", value: false },
      successMessage: "Selected " + label + " track unsoloed.",
    };
  }

  if (/\b(solo)\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.solo.set",
      input: { appId: targetId, target: "selected", value: true },
      successMessage: "Selected " + label + " track soloed.",
    };
  }

  if (/\b(disarm)\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.arm.set",
      input: { appId: targetId, target: "selected", value: false },
      successMessage: "Selected " + label + " track disarmed.",
    };
  }

  if (/\barm\b/.test(value) && /\b(track|channel|it|this)\b/.test(value)) {
    return {
      capability: "track.arm.set",
      input: { appId: targetId, target: "selected", value: true },
      successMessage: "Selected " + label + " track armed.",
    };
  }

  if (
    targetId !== "reaper" &&
    /\b(record|recording)\b/.test(value) &&
    /\b(toggle|start|stop|record)\b/.test(value)
  ) {
    return {
      capability: "transport.record.toggle",
      input: { appId: targetId },
      successMessage: label + " record mode toggled.",
    };
  }

  if (/\b(stop|halt)\b/.test(value) && !/\btrack|channel\b/.test(value)) {
    return {
      capability: "transport.stop",
      input: { appId: targetId },
      successMessage: label + " stopped.",
    };
  }

  if (
    (targetId === "reaper" || targetId === "wavr") &&
    /\b(pause|hold)\b/.test(value) &&
    !/\btrack|channel\b/.test(value)
  ) {
    return {
      capability: "transport.pause",
      input: { appId: targetId },
      successMessage: label + " paused.",
    };
  }

  if (targetId === "wavr") {
    const tempo = value.match(/\b(?:set|change)\s+(?:the\s+)?(?:tempo|bpm)(?:\s+to)?\s+(\d{2,3})\b/);
    if (tempo) {
      const bpm = Number(tempo[1]);
      if (bpm >= 30 && bpm <= 300) {
        return {
          capability: "tempo.set",
          input: { appId: "wavr", value: bpm },
          successMessage: "WAVR tempo set to " + bpm + " BPM.",
        };
      }
    }
  }

  if (/\b(play|resume)\b/.test(value) && !/\btrack|channel\b/.test(value)) {
    return {
      capability: "transport.play",
      input: { appId: targetId },
      successMessage: label + " is playing.",
    };
  }

  return null;
}
