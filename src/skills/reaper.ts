import { openKnownApp } from "../platform/apps";
import { runReaperTransport } from "../platform/reaperOsc";
import {
  getReaperState,
  runReaperTrackCommand,
  runReaperTrackSelectCommand,
  runReaperTrackValueCommand,
  verifyReaperTransport,
  type ReaperTrackOperation,
  type ReaperTrackValueOperation,
} from "../platform/reaperState";
import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";

type ReaperInput = {
  appId?: unknown;
  target?: unknown;
  value?: unknown;
  trackGuid?: unknown;
  trackName?: unknown;
  operation?: unknown;
};

function actionId(capability: string) {
  return "reaper-" + capability.replaceAll(".", "-") + "-" + Date.now().toString(36);
}

const TRANSPORT = new Map<string, "play" | "stop" | "pause">([
  ["transport.play", "play"],
  ["transport.stop", "stop"],
  ["transport.pause", "pause"],
]);

const TRACK_BOOL_CONTROL = new Map<string, ReaperTrackOperation>([
  ["track.mute.set", "mute"],
  ["track.solo.set", "solo"],
  ["track.arm.set", "arm"],
]);

const TRACK_VALUE_CONTROL = new Map<string, ReaperTrackValueOperation>([
  ["track.volume.set", "volume"],
  ["track.pan.set", "pan"],
]);

const CAPABILITIES = [
  "software.open",
  ...TRANSPORT.keys(),
  ...TRACK_BOOL_CONTROL.keys(),
  ...TRACK_VALUE_CONTROL.keys(),
  "track.select",
  "project.inspect",
  "track.fx.inspect",
];

export const reaperSkill: Skill = {
  id: "reaper",
  name: "REAPER",
  version: "0.6.0",
  capabilities: CAPABILITIES,
  plannerActions: [
    { capability: "software.open", description: "Open or launch REAPER.", inputExample: { appId: "reaper" } },
    { capability: "transport.play", description: "Start or resume REAPER transport playback.", inputExample: { appId: "reaper" } },
    { capability: "transport.stop", description: "Stop REAPER transport playback.", inputExample: { appId: "reaper" } },
    { capability: "transport.pause", description: "Pause REAPER transport playback.", inputExample: { appId: "reaper" } },
    { capability: "track.select", description: "Select a REAPER track by exact verified track name or GUID.", inputExample: { appId: "reaper", trackName: "Lead Vocal" } },
    { capability: "track.mute.set", description: "Mute or unmute the currently selected REAPER track.", inputExample: { appId: "reaper", target: "selected", value: true } },
    { capability: "track.solo.set", description: "Solo or unsolo the currently selected REAPER track.", inputExample: { appId: "reaper", target: "selected", value: true } },
    { capability: "track.arm.set", description: "Arm or disarm the currently selected REAPER track for recording.", inputExample: { appId: "reaper", target: "selected", value: true } },
    { capability: "track.volume.set", description: "Set selected REAPER track volume from 0 to 1.", inputExample: { appId: "reaper", target: "selected", value: 0.75 } },
    { capability: "track.pan.set", description: "Set selected REAPER track pan from -1 to 1.", inputExample: { appId: "reaper", target: "selected", value: 0 } },
    { capability: "project.inspect", description: "Read verified REAPER project, transport, tempo, and track state.", inputExample: { appId: "reaper" } },
    { capability: "track.fx.inspect", description: "Read verified insert FX names from the selected REAPER track.", inputExample: { appId: "reaper", target: "selected" } },
  ],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    const candidate = (input ?? {}) as ReaperInput;
    if (candidate.appId !== "reaper" || !CAPABILITIES.includes(capability)) return null;

    if (capability === "software.open") {
      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description: "Open REAPER",
        risk: "safe",
        input: { appId: "reaper" },
      };
    }

    const transport = TRANSPORT.get(capability);
    if (transport) {
      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description: transport[0].toUpperCase() + transport.slice(1) + " REAPER transport",
        risk: "safe",
        input: { appId: "reaper" },
      };
    }

    const status = await getReaperState();
    if (!status.available || status.stale || !status.state) return null;

    if (capability === "project.inspect") {
      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description: "Inspect verified REAPER project state",
        risk: "safe",
        input: { appId: "reaper" },
      };
    }

    if (capability === "track.fx.inspect") {
      if (!status.state.selectedTrack) return null;
      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description: "Inspect FX on selected REAPER track “" + status.state.selectedTrack.name + "”",
        risk: "safe",
        input: { appId: "reaper", target: "selected" },
      };
    }

    if (capability === "track.select") {
      let target = null;
      if (typeof candidate.trackGuid === "string") {
        target = status.state.tracks.find((track) => track.guid === candidate.trackGuid) ?? null;
      } else if (typeof candidate.trackName === "string") {
        const normalized = candidate.trackName.trim().toLowerCase();
        const matches = status.state.tracks.filter(
          (track) => track.name.trim().toLowerCase() === normalized,
        );
        if (matches.length === 1) target = matches[0];
      }
      if (!target) return null;

      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description: "Select REAPER track “" + target.name + "”",
        risk: "reversible",
        input: {
          appId: "reaper",
          trackGuid: target.guid,
          trackName: target.name,
        },
        before: {
          trackGuid: status.state.selectedTrack?.guid ?? null,
        },
        after: { trackGuid: target.guid },
      };
    }

    const selected = status.state.selectedTrack;
    if (!selected || candidate.target !== "selected") return null;

    const boolOperation = TRACK_BOOL_CONTROL.get(capability);
    if (boolOperation) {
      if (typeof candidate.value !== "boolean") return null;
      const before =
        boolOperation === "mute"
          ? selected.muted
          : boolOperation === "solo"
            ? selected.soloed
            : selected.armed;

      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description:
          (candidate.value ? "Enable " : "Disable ") +
          boolOperation +
          " on REAPER track “" +
          selected.name +
          "”",
        risk: "reversible",
        input: {
          appId: "reaper",
          target: "selected",
          value: candidate.value,
          trackGuid: selected.guid,
          trackName: selected.name,
          operation: boolOperation,
        },
        before: { value: before },
        after: { value: candidate.value },
      };
    }

    const valueOperation = TRACK_VALUE_CONTROL.get(capability);
    if (valueOperation) {
      if (typeof candidate.value !== "number") return null;
      if (valueOperation === "volume" && (candidate.value < 0 || candidate.value > 1)) return null;
      if (valueOperation === "pan" && Math.abs(candidate.value) > 1) return null;
      const before = valueOperation === "volume" ? selected.volume : selected.pan;
      return {
        id: actionId(capability),
        skillId: "reaper",
        capability,
        description:
          "Set " + valueOperation + " on REAPER track “" + selected.name + "”",
        risk: "reversible",
        input: {
          appId: "reaper",
          target: "selected",
          value: candidate.value,
          trackGuid: selected.guid,
          trackName: selected.name,
          operation: valueOperation,
        },
        before: { value: before },
        after: { value: candidate.value },
      };
    }

    return null;
  },

  async execute(action: ProposedAction) {
    if (action.skillId !== "reaper") {
      throw new Error("REAPER Skill received an action for another Skill.");
    }

    const input = (action.input ?? {}) as ReaperInput;
    if (input.appId !== "reaper") {
      throw new Error("REAPER Skill rejected an invalid application target.");
    }

    if (action.capability === "software.open") {
      await openKnownApp("reaper");
      return { appId: "reaper", opened: true };
    }

    const transport = TRANSPORT.get(action.capability);
    if (transport) {
      await runReaperTransport(transport);
      const verification = await verifyReaperTransport(transport);
      return {
        appId: "reaper",
        transport,
        bridgeConnected: verification.connected,
        verified: verification.verified,
        observedTransport: verification.state
          ? verification.state.recording
            ? "recording"
            : verification.state.paused
              ? "paused"
              : verification.state.playing
                ? "playing"
                : "stopped"
          : null,
      };
    }

    if (action.capability === "project.inspect") {
      const status = await getReaperState();
      if (!status.available || status.stale || !status.state) {
        throw new Error(status.error ?? "REAPER live state is unavailable.");
      }
      return { appId: "reaper", verified: true, state: status.state };
    }

    if (action.capability === "track.fx.inspect") {
      const status = await getReaperState();
      if (!status.available || status.stale || !status.state?.selectedTrack) {
        throw new Error(status.error ?? "REAPER selected-track state is unavailable.");
      }
      return {
        appId: "reaper",
        verified: true,
        track: status.state.selectedTrack.name,
        fx: status.state.selectedTrack.fx,
      };
    }

    const trackGuid = typeof input.trackGuid === "string" ? input.trackGuid : "";
    if (!trackGuid) throw new Error("REAPER action is missing a verified track GUID.");

    if (action.capability === "track.select") {
      return runReaperTrackSelectCommand(action.id, trackGuid);
    }

    const boolOperation = TRACK_BOOL_CONTROL.get(action.capability);
    if (boolOperation) {
      if (typeof input.value !== "boolean") {
        throw new Error("REAPER Skill rejected an invalid boolean track action.");
      }
      return runReaperTrackCommand(
        action.id,
        trackGuid,
        boolOperation,
        input.value,
      );
    }

    const valueOperation = TRACK_VALUE_CONTROL.get(action.capability);
    if (valueOperation) {
      if (typeof input.value !== "number") {
        throw new Error("REAPER Skill rejected an invalid numeric track action.");
      }
      return runReaperTrackValueCommand(
        action.id,
        trackGuid,
        valueOperation,
        input.value,
      );
    }

    throw new Error("REAPER Skill does not implement this action.");
  },

  async undo(action: ProposedAction) {
    const input = (action.input ?? {}) as ReaperInput;
    const trackGuid = typeof input.trackGuid === "string" ? input.trackGuid : "";
    const before = (action.before ?? {}) as { value?: unknown; trackGuid?: unknown };

    if (action.capability === "track.select") {
      if (typeof before.trackGuid !== "string" || !before.trackGuid) {
        throw new Error("REAPER did not capture the previously selected track.");
      }
      await runReaperTrackSelectCommand(
        action.id + "-undo-" + Date.now().toString(36),
        before.trackGuid,
      );
      return;
    }

    const boolOperation = TRACK_BOOL_CONTROL.get(action.capability);
    if (boolOperation) {
      if (!trackGuid || typeof before.value !== "boolean") {
        throw new Error("This REAPER boolean action does not have reversible state.");
      }
      await runReaperTrackCommand(
        action.id + "-undo-" + Date.now().toString(36),
        trackGuid,
        boolOperation,
        before.value,
      );
      return;
    }

    const valueOperation = TRACK_VALUE_CONTROL.get(action.capability);
    if (valueOperation) {
      if (!trackGuid || typeof before.value !== "number") {
        throw new Error("This REAPER numeric action does not have reversible state.");
      }
      await runReaperTrackValueCommand(
        action.id + "-undo-" + Date.now().toString(36),
        trackGuid,
        valueOperation,
        before.value,
      );
      return;
    }

    throw new Error("This REAPER action is not reversible.");
  },
};
