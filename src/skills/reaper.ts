import { openKnownApp } from "../platform/apps";
import { runReaperTransport } from "../platform/reaperOsc";
import {
  getReaperState,
  runReaperTrackCommand,
  verifyReaperTransport,
  type ReaperTrackOperation,
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
  return "reaper-" + capability.replace(".", "-") + "-" + Date.now().toString(36);
}

const TRANSPORT = new Map<string, "play" | "stop" | "pause">([
  ["transport.play", "play"],
  ["transport.stop", "stop"],
  ["transport.pause", "pause"],
]);

const TRACK_CONTROL = new Map<string, ReaperTrackOperation>([
  ["track.mute.set", "mute"],
  ["track.solo.set", "solo"],
  ["track.arm.set", "arm"],
]);

export const reaperSkill: Skill = {
  id: "reaper",
  name: "REAPER",
  version: "0.5.0",
  capabilities: ["software.open", ...TRANSPORT.keys(), ...TRACK_CONTROL.keys()],
  plannerActions: [
    {
      capability: "software.open",
      description:
        "Open or launch REAPER when the user explicitly asks to open REAPER.",
      inputExample: { appId: "reaper" },
    },
    {
      capability: "transport.play",
      description: "Start or resume REAPER transport playback.",
      inputExample: { appId: "reaper" },
    },
    {
      capability: "transport.stop",
      description: "Stop REAPER transport playback.",
      inputExample: { appId: "reaper" },
    },
    {
      capability: "transport.pause",
      description: "Pause REAPER transport playback.",
      inputExample: { appId: "reaper" },
    },
    {
      capability: "track.mute.set",
      description: "Mute or unmute the currently selected REAPER track.",
      inputExample: { appId: "reaper", target: "selected", value: true },
    },
    {
      capability: "track.solo.set",
      description: "Solo or unsolo the currently selected REAPER track.",
      inputExample: { appId: "reaper", target: "selected", value: true },
    },
    {
      capability: "track.arm.set",
      description: "Arm or disarm the currently selected REAPER track for recording.",
      inputExample: { appId: "reaper", target: "selected", value: true },
    },
  ],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(
    capability: string,
    input?: unknown,
  ): Promise<ProposedAction | null> {
    const candidate = (input ?? {}) as ReaperInput;
    if (candidate.appId !== "reaper") return null;

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
        description:
          transport[0].toUpperCase() + transport.slice(1) + " REAPER transport",
        risk: "safe",
        input: { appId: "reaper" },
      };
    }

    const operation = TRACK_CONTROL.get(capability);
    if (!operation) return null;
    if (candidate.target !== "selected" || typeof candidate.value !== "boolean") {
      return null;
    }

    const status = await getReaperState();
    if (!status.available || status.stale || !status.state?.selectedTrack) {
      return null;
    }

    const selected = status.state.selectedTrack;
    const before =
      operation === "mute"
        ? selected.muted
        : operation === "solo"
          ? selected.soloed
          : selected.armed;

    return {
      id: actionId(capability),
      skillId: "reaper",
      capability,
      description:
        (candidate.value ? "Enable " : "Disable ") +
        operation +
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
        operation,
      },
      before: { value: before },
      after: { value: candidate.value },
    };
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

    const operation = TRACK_CONTROL.get(action.capability);
    const trackGuid =
      typeof input.trackGuid === "string" ? input.trackGuid : "";
    const value = input.value;
    if (!operation || !trackGuid || typeof value !== "boolean") {
      throw new Error("REAPER Skill rejected an invalid track-control action.");
    }

    return runReaperTrackCommand(action.id, trackGuid, operation, value);
  },

  async undo(action: ProposedAction) {
    const operation = TRACK_CONTROL.get(action.capability);
    const input = (action.input ?? {}) as ReaperInput;
    const trackGuid =
      typeof input.trackGuid === "string" ? input.trackGuid : "";
    const before = (action.before ?? {}) as { value?: unknown };

    if (!operation || !trackGuid || typeof before.value !== "boolean") {
      throw new Error("This REAPER action does not have reversible state.");
    }

    await runReaperTrackCommand(
      action.id + "-undo-" + Date.now().toString(36),
      trackGuid,
      operation,
      before.value,
    );
  },
};
