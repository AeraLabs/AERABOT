import type { ProposedAction } from "../core/permissions";
import type { Skill, SkillContext } from "../core/skills";
import { getDawBridgeStatus, runDawCommand } from "../platform/dawBridge";

type WavrInput = {
  appId?: unknown;
  target?: unknown;
  value?: unknown;
  trackId?: unknown;
  seconds?: unknown;
};

const CAPABILITIES = [
  "transport.play",
  "transport.pause",
  "transport.stop",
  "transport.record.toggle",
  "transport.seek",
  "tempo.set",
  "track.select",
  "track.mute.set",
  "track.solo.set",
  "track.arm.set",
  "track.volume.set",
  "track.pan.set",
  "project.inspect",
  "track.fx.inspect",
] as const;

function actionId(capability: string) {
  return "wavr-" + capability.replaceAll(".", "-") + "-" + Date.now().toString(36);
}

function selectedValue(
  capability: string,
  state: Awaited<ReturnType<typeof getDawBridgeStatus>>["state"],
) {
  const selected = state?.selectedTrack;
  if (!selected) return undefined;
  if (capability === "track.mute.set") return selected.muted;
  if (capability === "track.solo.set") return selected.soloed;
  if (capability === "track.arm.set") return selected.armed;
  if (capability === "track.volume.set") return selected.volume;
  if (capability === "track.pan.set") return selected.pan;
  return undefined;
}

export const wavrSkill: Skill = {
  id: "wavr",
  name: "WAVR",
  version: "0.1.0",
  capabilities: [...CAPABILITIES],
  plannerActions: [
    { capability: "transport.play", description: "Start WAVR playback.", inputExample: { appId: "wavr" } },
    { capability: "transport.pause", description: "Pause or resume WAVR transport.", inputExample: { appId: "wavr" } },
    { capability: "transport.stop", description: "Stop WAVR transport.", inputExample: { appId: "wavr" } },
    { capability: "transport.record.toggle", description: "Start or stop WAVR recording. Recording still obeys WAVR’s armed-track and microphone safety checks.", inputExample: { appId: "wavr" } },
    { capability: "transport.seek", description: "Seek WAVR to an absolute time in seconds.", inputExample: { appId: "wavr", seconds: 30 } },
    { capability: "tempo.set", description: "Set WAVR tempo between 30 and 300 BPM.", inputExample: { appId: "wavr", value: 120 } },
    { capability: "track.select", description: "Select a WAVR track using an exact verified track id from live WAVR state.", inputExample: { appId: "wavr", trackId: "verified-track-id" } },
    { capability: "track.mute.set", description: "Mute or unmute the selected WAVR track.", inputExample: { appId: "wavr", target: "selected", value: true } },
    { capability: "track.solo.set", description: "Solo or unsolo the selected WAVR track.", inputExample: { appId: "wavr", target: "selected", value: true } },
    { capability: "track.arm.set", description: "Arm or disarm the selected WAVR track.", inputExample: { appId: "wavr", target: "selected", value: true } },
    { capability: "track.volume.set", description: "Set selected WAVR track volume from 0 to 1.", inputExample: { appId: "wavr", target: "selected", value: 0.75 } },
    { capability: "track.pan.set", description: "Set selected WAVR track pan from -1 to 1.", inputExample: { appId: "wavr", target: "selected", value: 0 } },
    { capability: "project.inspect", description: "Return verified WAVR project/transport/track state without changing anything.", inputExample: { appId: "wavr" } },
    { capability: "track.fx.inspect", description: "Return verified FX names on the selected WAVR track.", inputExample: { appId: "wavr", target: "selected" } },
  ],

  supports(context: SkillContext) {
    return context.platform === "macOS" || context.platform === "Windows";
  },

  async propose(capability: string, input?: unknown): Promise<ProposedAction | null> {
    if (!CAPABILITIES.includes(capability as (typeof CAPABILITIES)[number])) return null;
    const candidate = (input ?? {}) as WavrInput;
    if (candidate.appId !== "wavr") return null;

    const bridge = await getDawBridgeStatus("wavr");
    if (!bridge.available || bridge.stale || !bridge.state) return null;
    if (!bridge.state.capabilities.includes(capability)) return null;

    const booleanCapability = ["track.mute.set", "track.solo.set", "track.arm.set"].includes(capability);
    const selectedNumber = ["track.volume.set", "track.pan.set"].includes(capability);
    if ((booleanCapability || selectedNumber) && candidate.target !== "selected") return null;
    if (booleanCapability && typeof candidate.value !== "boolean") return null;
    if (selectedNumber && typeof candidate.value !== "number") return null;
    if (capability === "track.volume.set" && ((candidate.value as number) < 0 || (candidate.value as number) > 1)) return null;
    if (capability === "track.pan.set" && Math.abs(candidate.value as number) > 1) return null;
    if (capability === "tempo.set" && (typeof candidate.value !== "number" || candidate.value < 30 || candidate.value > 300)) return null;
    if (capability === "transport.seek" && (typeof candidate.seconds !== "number" || candidate.seconds < 0 || candidate.seconds > 86400)) return null;

    if (capability === "track.select") {
      if (typeof candidate.trackId !== "string") return null;
      if (!(bridge.state.tracks ?? []).some((track) => track.id === candidate.trackId)) return null;
    }

    const selectedBefore = selectedValue(capability, bridge.state);
    const reversible =
      selectedBefore !== undefined ||
      capability === "tempo.set" ||
      capability === "transport.seek" ||
      capability === "track.select";

    let before: unknown;
    if (selectedBefore !== undefined) before = { value: selectedBefore };
    else if (capability === "tempo.set") before = { value: bridge.state.transport.bpm };
    else if (capability === "transport.seek") before = { seconds: bridge.state.transport.positionSeconds };
    else if (capability === "track.select") before = { trackId: bridge.state.selectedTrack?.id ?? null };

    return {
      id: actionId(capability),
      skillId: "wavr",
      capability,
      description: capability + " in WAVR",
      risk: reversible ? "reversible" : "safe",
      input: {
        appId: "wavr",
        ...(candidate.target ? { target: candidate.target } : {}),
        ...(candidate.value !== undefined ? { value: candidate.value } : {}),
        ...(candidate.trackId ? { trackId: candidate.trackId } : {}),
        ...(candidate.seconds !== undefined ? { seconds: candidate.seconds } : {}),
      },
      before,
      after: candidate.value !== undefined ? { value: candidate.value } : undefined,
    };
  },

  async execute(action: ProposedAction) {
    if (action.skillId !== "wavr") throw new Error("WAVR Skill rejected another Skill’s action.");
    const input = (action.input ?? {}) as Record<string, unknown>;
    if (input.appId !== "wavr") throw new Error("WAVR Skill rejected an invalid application target.");
    const ack = await runDawCommand("wavr", action.id, action.capability, input);
    return {
      appId: "wavr",
      acknowledged: ack.ok,
      capability: action.capability,
      observed: ack.result,
    };
  },

  async undo(action: ProposedAction) {
    const before = (action.before ?? {}) as Record<string, unknown>;
    const input = (action.input ?? {}) as Record<string, unknown>;
    let undoInput: Record<string, unknown> | null = null;

    if (["track.mute.set", "track.solo.set", "track.arm.set", "track.volume.set", "track.pan.set", "tempo.set"].includes(action.capability)) {
      if (typeof before.value !== "boolean" && typeof before.value !== "number") {
        throw new Error("WAVR did not capture the previous value for this action.");
      }
      undoInput = { ...input, value: before.value };
    } else if (action.capability === "transport.seek" && typeof before.seconds === "number") {
      undoInput = { appId: "wavr", seconds: before.seconds };
    } else if (action.capability === "track.select" && typeof before.trackId === "string") {
      undoInput = { appId: "wavr", trackId: before.trackId };
    }

    if (!undoInput) throw new Error("This WAVR action does not have reversible state.");
    await runDawCommand(
      "wavr",
      action.id + "-undo-" + Date.now().toString(36),
      action.capability,
      undoInput,
    );
  },
};
