import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";
import { openKnownApp } from "../platform/apps";
import {
  getDawBridgeStatus,
  runDawCommand,
} from "../platform/dawBridge";

type AbletonInput = {
  appId?: unknown;
  target?: unknown;
  value?: unknown;
};

const CONTROL_CAPABILITIES = [
  "transport.play",
  "transport.stop",
  "transport.record.toggle",
  "track.mute.set",
  "track.solo.set",
  "track.arm.set",
  "track.volume.set",
  "track.pan.set",
] as const;

const CAPABILITIES = ["software.open", ...CONTROL_CAPABILITIES];

function actionId(capability: string) {
  return "ableton-" + capability.replaceAll(".", "-") + "-" + Date.now().toString(36);
}

export const abletonSkill: Skill = {
  id: "ableton",
  name: "Ableton Live",
  version: "0.2.0",
  capabilities: CAPABILITIES,
  plannerActions: [
    {
      capability: "software.open",
      description: "Open or launch Ableton Live.",
      inputExample: { appId: "ableton" },
    },
    {
      capability: "transport.play",
      description: "Start Ableton Live transport through the connected AERA Max for Live bridge.",
      inputExample: { appId: "ableton" },
    },
    {
      capability: "transport.stop",
      description: "Stop Ableton Live transport through the connected AERA Max for Live bridge.",
      inputExample: { appId: "ableton" },
    },
    {
      capability: "transport.record.toggle",
      description: "Toggle Ableton Arrangement Record through the connected AERA Max for Live bridge.",
      inputExample: { appId: "ableton" },
    },
    {
      capability: "track.mute.set",
      description: "Mute or unmute the selected Ableton track.",
      inputExample: { appId: "ableton", target: "selected", value: true },
    },
    {
      capability: "track.solo.set",
      description: "Solo or unsolo the selected Ableton track.",
      inputExample: { appId: "ableton", target: "selected", value: true },
    },
    {
      capability: "track.arm.set",
      description: "Arm or disarm the selected Ableton track.",
      inputExample: { appId: "ableton", target: "selected", value: true },
    },
    {
      capability: "track.volume.set",
      description: "Set normalized 0..1 volume on the selected Ableton track.",
      inputExample: { appId: "ableton", target: "selected", value: 0.75 },
    },
    {
      capability: "track.pan.set",
      description: "Set -1..1 pan on the selected Ableton track.",
      inputExample: { appId: "ableton", target: "selected", value: 0 },
    },
  ],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    const candidate = (input ?? {}) as AbletonInput;
    if (candidate.appId !== "ableton" || !CAPABILITIES.includes(capability)) {
      return null;
    }

    if (capability === "software.open") {
      return {
        id: actionId(capability),
        skillId: "ableton",
        capability,
        description: "Open Ableton Live",
        risk: "safe",
        input: { appId: "ableton" },
      };
    }

    const bridge = await getDawBridgeStatus("ableton");
    if (!bridge.available || bridge.stale || !bridge.state) return null;
    if (!bridge.state.capabilities.includes(capability)) return null;

    const isBoolean =
      capability === "track.mute.set" ||
      capability === "track.solo.set" ||
      capability === "track.arm.set";
    const isNumber =
      capability === "track.volume.set" ||
      capability === "track.pan.set";

    if ((isBoolean || isNumber) && candidate.target !== "selected") return null;
    if (isBoolean && typeof candidate.value !== "boolean") return null;
    if (isNumber && typeof candidate.value !== "number") return null;
    if (
      capability === "track.volume.set" &&
      ((candidate.value as number) < 0 || (candidate.value as number) > 1)
    ) return null;
    if (
      capability === "track.pan.set" &&
      Math.abs(candidate.value as number) > 1
    ) return null;

    const selected = bridge.state.selectedTrack;
    let before: unknown;
    if (selected && isBoolean) {
      before = {
        value:
          capability === "track.mute.set"
            ? selected.muted
            : capability === "track.solo.set"
              ? selected.soloed
              : selected.armed,
      };
    } else if (selected && isNumber) {
      before = {
        value:
          capability === "track.volume.set"
            ? selected.volume
            : selected.pan,
      };
    }

    return {
      id: actionId(capability),
      skillId: "ableton",
      capability,
      description:
        capability.startsWith("transport.")
          ? capability.replace("transport.", "") + " Ableton transport"
          : capability + " on selected Ableton track",
      risk: isBoolean || isNumber ? "reversible" : "safe",
      input: {
        appId: "ableton",
        ...(isBoolean || isNumber
          ? { target: "selected", value: candidate.value }
          : {}),
      },
      before,
      after: isBoolean || isNumber ? { value: candidate.value } : undefined,
    };
  },

  async execute(action: ProposedAction) {
    const input = (action.input ?? {}) as Record<string, unknown>;
    if (action.skillId !== "ableton" || input.appId !== "ableton") {
      throw new Error("Ableton Skill rejected an invalid target.");
    }

    if (action.capability === "software.open") {
      await openKnownApp("ableton");
      return { appId: "ableton", opened: true };
    }

    const ack = await runDawCommand("ableton", action.id, action.capability, input);
    return {
      appId: "ableton",
      acknowledged: ack.ok,
      capability: action.capability,
      observed: ack.result,
    };
  },

  async undo(action: ProposedAction) {
    const before = (action.before ?? {}) as { value?: unknown };
    if (
      action.risk !== "reversible" ||
      (typeof before.value !== "boolean" && typeof before.value !== "number")
    ) {
      throw new Error("This Ableton action does not have captured reversible state.");
    }

    const input = (action.input ?? {}) as Record<string, unknown>;
    await runDawCommand(
      "ableton",
      action.id + "-undo-" + Date.now().toString(36),
      action.capability,
      { ...input, value: before.value },
    );
  },
};
