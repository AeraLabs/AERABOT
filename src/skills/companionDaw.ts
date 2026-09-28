import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";
import { openKnownApp } from "../platform/apps";
import {
  getDawBridgeStatus,
  runDawCommand,
  type CompanionDawId,
} from "../platform/dawBridge";

type CompanionInput = {
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

export interface CompanionDawSkillSpec {
  id: Extract<CompanionDawId, "logic" | "protools">;
  name: string;
  platforms: Array<"macOS" | "Windows">;
}

function actionId(id: string, capability: string) {
  return (
    id +
    "-" +
    capability.replaceAll(".", "-") +
    "-" +
    Date.now().toString(36)
  );
}

function plannerActions(spec: CompanionDawSkillSpec) {
  return [
    {
      capability: "software.open",
      description: "Open or launch " + spec.name + ".",
      inputExample: { appId: spec.id },
    },
    {
      capability: "transport.play",
      description:
        "Start " +
        spec.name +
        " transport through the connected verified AERA companion bridge.",
      inputExample: { appId: spec.id },
    },
    {
      capability: "transport.stop",
      description:
        "Stop " +
        spec.name +
        " transport through the connected verified AERA companion bridge.",
      inputExample: { appId: spec.id },
    },
    {
      capability: "transport.record.toggle",
      description:
        "Toggle " +
        spec.name +
        " recording through the connected verified AERA companion bridge.",
      inputExample: { appId: spec.id },
    },
    {
      capability: "track.mute.set",
      description: "Mute or unmute the selected " + spec.name + " track.",
      inputExample: { appId: spec.id, target: "selected", value: true },
    },
    {
      capability: "track.solo.set",
      description: "Solo or unsolo the selected " + spec.name + " track.",
      inputExample: { appId: spec.id, target: "selected", value: true },
    },
    {
      capability: "track.arm.set",
      description: "Arm or disarm the selected " + spec.name + " track.",
      inputExample: { appId: spec.id, target: "selected", value: true },
    },
    {
      capability: "track.volume.set",
      description:
        "Set normalized 0..1 volume on the selected " + spec.name + " track.",
      inputExample: { appId: spec.id, target: "selected", value: 0.75 },
    },
    {
      capability: "track.pan.set",
      description:
        "Set -1..1 pan on the selected " + spec.name + " track.",
      inputExample: { appId: spec.id, target: "selected", value: 0 },
    },
  ];
}

export function createCompanionDawSkill(
  spec: CompanionDawSkillSpec,
): Skill {
  return {
    id: spec.id,
    name: spec.name,
    version: "0.2.0",
    capabilities: CAPABILITIES,
    plannerActions: plannerActions(spec),

    supports(context: SkillContext) {
      return spec.platforms.includes(
        context.platform as "macOS" | "Windows",
      );
    },

    async propose(
      capability: string,
      input?: unknown,
    ): Promise<ProposedAction | null> {
      const candidate = (input ?? {}) as CompanionInput;
      if (
        candidate.appId !== spec.id ||
        !CAPABILITIES.includes(capability)
      ) {
        return null;
      }

      if (capability === "software.open") {
        return {
          id: actionId(spec.id, capability),
          skillId: spec.id,
          capability,
          description: "Open " + spec.name,
          risk: "safe",
          input: { appId: spec.id },
        };
      }

      const bridge = await getDawBridgeStatus(spec.id);
      if (!bridge.available || bridge.stale || !bridge.state) return null;
      if (!bridge.state.capabilities.includes(capability)) return null;

      const isBoolean =
        capability === "track.mute.set" ||
        capability === "track.solo.set" ||
        capability === "track.arm.set";
      const isNumber =
        capability === "track.volume.set" ||
        capability === "track.pan.set";

      if ((isBoolean || isNumber) && candidate.target !== "selected") {
        return null;
      }
      if (isBoolean && typeof candidate.value !== "boolean") return null;
      if (isNumber && typeof candidate.value !== "number") return null;
      if (
        capability === "track.volume.set" &&
        ((candidate.value as number) < 0 ||
          (candidate.value as number) > 1)
      ) {
        return null;
      }
      if (
        capability === "track.pan.set" &&
        Math.abs(candidate.value as number) > 1
      ) {
        return null;
      }

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
        id: actionId(spec.id, capability),
        skillId: spec.id,
        capability,
        description:
          capability.startsWith("transport.")
            ? capability.replace("transport.", "") +
              " " +
              spec.name +
              " transport"
            : capability + " on selected " + spec.name + " track",
        risk: isBoolean || isNumber ? "reversible" : "safe",
        input: {
          appId: spec.id,
          ...(isBoolean || isNumber
            ? { target: "selected", value: candidate.value }
            : {}),
        },
        before,
        after:
          isBoolean || isNumber
            ? { value: candidate.value }
            : undefined,
      };
    },

    async execute(action: ProposedAction) {
      const input = (action.input ?? {}) as Record<string, unknown>;
      if (action.skillId !== spec.id || input.appId !== spec.id) {
        throw new Error(
          spec.name + " Skill rejected an invalid target.",
        );
      }

      if (action.capability === "software.open") {
        await openKnownApp(spec.id);
        return { appId: spec.id, opened: true };
      }

      const ack = await runDawCommand(
        spec.id,
        action.id,
        action.capability,
        input,
      );
      return {
        appId: spec.id,
        acknowledged: ack.ok,
        capability: action.capability,
        observed: ack.result,
      };
    },

    async undo(action: ProposedAction) {
      const before = (action.before ?? {}) as { value?: unknown };
      if (
        action.risk !== "reversible" ||
        (typeof before.value !== "boolean" &&
          typeof before.value !== "number")
      ) {
        throw new Error(
          "This " +
            spec.name +
            " action does not have captured reversible state.",
        );
      }

      const input = (action.input ?? {}) as Record<string, unknown>;
      await runDawCommand(
        spec.id,
        action.id + "-undo-" + Date.now().toString(36),
        action.capability,
        { ...input, value: before.value },
      );
    },
  };
}
