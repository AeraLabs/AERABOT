import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";
import { openKnownApp } from "../platform/apps";
import {
  getFlStudioBridgeStatus,
  runFlStudioCommand,
} from "../platform/dawBridge";

type FlStudioInput = {
  appId?: unknown;
  target?: unknown;
  value?: unknown;
};

const CAPABILITIES = [
  "software.open",
  "transport.play",
  "transport.stop",
  "transport.record.toggle",
  "track.mute.set",
  "track.solo.set",
  "track.arm.set",
  "track.volume.set",
  "track.pan.set",
];

function actionId(capability: string) {
  return "flstudio-" + capability.replaceAll(".", "-") + "-" + Date.now().toString(36);
}

function plannerActions() {
  return [
    {
      capability: "software.open",
      description: "Open or launch FL Studio.",
      inputExample: { appId: "flstudio" },
    },
    {
      capability: "transport.play",
      description: "Start FL Studio transport playback when the AERA FL Studio bridge is connected.",
      inputExample: { appId: "flstudio" },
    },
    {
      capability: "transport.stop",
      description: "Stop FL Studio transport playback when the AERA FL Studio bridge is connected.",
      inputExample: { appId: "flstudio" },
    },
    {
      capability: "transport.record.toggle",
      description: "Toggle FL Studio recording when the AERA FL Studio bridge is connected.",
      inputExample: { appId: "flstudio" },
    },
    {
      capability: "track.mute.set",
      description: "Mute or unmute the selected FL Studio mixer track.",
      inputExample: { appId: "flstudio", target: "selected", value: true },
    },
    {
      capability: "track.solo.set",
      description: "Solo or unsolo the selected FL Studio mixer track.",
      inputExample: { appId: "flstudio", target: "selected", value: true },
    },
    {
      capability: "track.arm.set",
      description: "Arm or disarm the selected FL Studio mixer track.",
      inputExample: { appId: "flstudio", target: "selected", value: true },
    },
    {
      capability: "track.volume.set",
      description: "Set normalized volume 0..1 on the selected FL Studio mixer track.",
      inputExample: { appId: "flstudio", target: "selected", value: 0.75 },
    },
    {
      capability: "track.pan.set",
      description: "Set pan -1..1 on the selected FL Studio mixer track.",
      inputExample: { appId: "flstudio", target: "selected", value: 0 },
    },
  ];
}

export const flStudioSkill: Skill = {
  id: "flstudio",
  name: "FL Studio",
  version: "0.2.0",
  capabilities: CAPABILITIES,
  plannerActions: plannerActions(),

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    const candidate = (input ?? {}) as FlStudioInput;
    if (candidate.appId !== "flstudio" || !CAPABILITIES.includes(capability)) {
      return null;
    }

    if (capability === "software.open") {
      return {
        id: actionId(capability),
        skillId: "flstudio",
        capability,
        description: "Open FL Studio",
        risk: "safe",
        input: { appId: "flstudio" },
      };
    }

    const bridge = await getFlStudioBridgeStatus();
    if (!bridge.available || bridge.stale || !bridge.state) return null;
    if (!bridge.state.capabilities.includes(capability)) return null;

    const isTrackBoolean =
      capability === "track.mute.set" ||
      capability === "track.solo.set" ||
      capability === "track.arm.set";
    const isTrackNumber =
      capability === "track.volume.set" || capability === "track.pan.set";

    if ((isTrackBoolean || isTrackNumber) && candidate.target !== "selected") {
      return null;
    }
    if (isTrackBoolean && typeof candidate.value !== "boolean") return null;
    if (isTrackNumber && typeof candidate.value !== "number") return null;
    if (capability === "track.volume.set" && (candidate.value as number) < 0) return null;
    if (capability === "track.volume.set" && (candidate.value as number) > 1) return null;
    if (capability === "track.pan.set" && Math.abs(candidate.value as number) > 1) return null;

    const selected = bridge.state.selectedTrack;
    const inputValue = {
      appId: "flstudio",
      ...(isTrackBoolean || isTrackNumber
        ? { target: "selected", value: candidate.value }
        : {}),
    };

    let before: unknown;
    if (selected && isTrackBoolean) {
      before = {
        value:
          capability === "track.mute.set"
            ? selected.muted
            : capability === "track.solo.set"
              ? selected.soloed
              : selected.armed,
      };
    }
    if (selected && isTrackNumber) {
      before = {
        value:
          capability === "track.volume.set"
            ? selected.volume
            : selected.pan,
      };
    }

    return {
      id: actionId(capability),
      skillId: "flstudio",
      capability,
      description:
        capability.startsWith("transport.")
          ? capability.replace("transport.", "") + " FL Studio transport"
          : capability + " on selected FL Studio mixer track",
      risk: isTrackBoolean || isTrackNumber ? "reversible" : "safe",
      input: inputValue,
      before,
      after:
        isTrackBoolean || isTrackNumber ? { value: candidate.value } : undefined,
    };
  },

  async execute(action: ProposedAction) {
    if (action.skillId !== "flstudio") {
      throw new Error("FL Studio Skill received an action for another Skill.");
    }

    const input = (action.input ?? {}) as Record<string, unknown>;
    if (input.appId !== "flstudio") {
      throw new Error("FL Studio Skill rejected an invalid application target.");
    }

    if (action.capability === "software.open") {
      await openKnownApp("flstudio");
      return { appId: "flstudio", opened: true };
    }

    const ack = await runFlStudioCommand(action.id, action.capability, input);
    return {
      appId: "flstudio",
      acknowledged: ack.ok,
      capability: action.capability,
      observed: ack.result,
    };
  },

  async undo(action: ProposedAction) {
    if (action.risk !== "reversible") {
      throw new Error("This FL Studio action is not reversible.");
    }
    const before = (action.before ?? {}) as { value?: unknown };
    if (
      typeof before.value !== "boolean" &&
      typeof before.value !== "number"
    ) {
      throw new Error("The previous FL Studio value was not captured.");
    }

    const input = (action.input ?? {}) as Record<string, unknown>;
    await runFlStudioCommand(
      action.id + "-undo-" + Date.now().toString(36),
      action.capability,
      { ...input, value: before.value },
    );
  },
};
