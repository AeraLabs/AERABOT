import {
  reaperTransportLabel,
  type ReaperProjectState,
} from "../platform/reaperState";

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasReaperContext(text: string, reaperForeground: boolean) {
  return reaperForeground || /\breaper\b/.test(text);
}

export function answerVerifiedReaperQuery(
  input: string,
  state: ReaperProjectState | null,
  reaperForeground: boolean,
): string | null {
  if (!state) return null;

  const text = normalize(input);
  if (!hasReaperContext(text, reaperForeground)) return null;

  if (
    /\b(what|which)\b.*\b(track)\b/.test(text) &&
    /\b(selected|on|current)\b/.test(text)
  ) {
    if (!state.selectedTrack) return "No REAPER track is currently selected.";
    const track = state.selectedTrack;
    const conditions = [
      track.armed ? "armed" : null,
      track.muted ? "muted" : null,
      track.soloed ? "soloed" : null,
      track.monitoring ? "monitoring" : null,
    ].filter(Boolean);

    return (
      "Track " +
      track.index +
      ", “" +
      track.name +
      "” is selected" +
      (conditions.length ? " · " + conditions.join(", ") : "") +
      "."
    );
  }

  if (
    /\b(how many|number of)\b.*\btracks?\b/.test(text) ||
    /\btrack count\b/.test(text)
  ) {
    return (
      state.projectName +
      " has " +
      state.trackCount +
      (state.trackCount === 1 ? " track." : " tracks.")
    );
  }

  if (/\b(bpm|tempo)\b/.test(text) && /\b(what|current|project|is|the)\b/.test(text)) {
    return "The verified REAPER tempo is " + state.bpm.toFixed(2) + " BPM.";
  }

  if (
    /\b(is|what|status|transport)\b.*\b(playing|play|paused|recording|transport)\b/.test(
      text,
    ) ||
    /\bwhat is reaper doing\b/.test(text)
  ) {
    return (
      "REAPER is " +
      reaperTransportLabel(state) +
      " at " +
      state.playPosition.toFixed(2) +
      " seconds."
    );
  }

  if (
    /\b(fx|effects|plugins?|plug ins?)\b/.test(text) &&
    /\b(track|selected|current|what|which)\b/.test(text)
  ) {
    if (!state.selectedTrack) return "No REAPER track is currently selected.";
    const track = state.selectedTrack;
    if (track.fx.length === 0) {
      return "The selected track “" + track.name + "” has no insert FX.";
    }
    return (
      "The selected track “" +
      track.name +
      "” has: " +
      track.fx.join(", ") +
      "."
    );
  }

  return null;
}
