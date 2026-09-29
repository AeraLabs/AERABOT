import type { AeraVibe } from "../core/preferences";
import type { OrbState } from "../orb/state";

type Tone = {
  frequency: number;
  duration: number;
  offset?: number;
  gain?: number;
  type?: OscillatorType;
  detune?: number;
};

const PATTERNS: Partial<Record<OrbState, Tone[]>> = {
  AWAKE: [
    { frequency: 540, duration: 0.09, gain: 0.022, type: "sine" },
    { frequency: 810, duration: 0.13, offset: 0.055, gain: 0.018, type: "triangle" },
    { frequency: 1080, duration: 0.18, offset: 0.1, gain: 0.008, type: "sine" },
  ],
  LISTENING: [
    { frequency: 690, duration: 0.12, gain: 0.018, type: "sine" },
    { frequency: 1040, duration: 0.16, offset: 0.025, gain: 0.007, type: "triangle" },
  ],
  UNDERSTANDING: [
    { frequency: 610, duration: 0.08, gain: 0.014 },
    { frequency: 820, duration: 0.09, offset: 0.05, gain: 0.012 },
  ],
  THINKING: [
    { frequency: 760, duration: 0.055, gain: 0.009 },
    { frequency: 980, duration: 0.06, offset: 0.095, gain: 0.006 },
  ],
  ACTING: [
    { frequency: 510, duration: 0.055, gain: 0.012, type: "triangle" },
    { frequency: 650, duration: 0.075, offset: 0.065, gain: 0.01, type: "sine" },
  ],
  SUCCESS: [
    { frequency: 670, duration: 0.09, gain: 0.018, type: "sine" },
    { frequency: 930, duration: 0.14, offset: 0.06, gain: 0.016, type: "triangle" },
    { frequency: 1240, duration: 0.2, offset: 0.11, gain: 0.007, type: "sine" },
  ],
  QUESTION: [
    { frequency: 570, duration: 0.09, gain: 0.014 },
    { frequency: 760, duration: 0.14, offset: 0.085, gain: 0.012 },
  ],
  WARNING: [
    { frequency: 410, duration: 0.12, gain: 0.015, type: "triangle" },
    { frequency: 465, duration: 0.16, offset: 0.11, gain: 0.01 },
  ],
  ERROR: [
    { frequency: 430, duration: 0.11, gain: 0.015, type: "triangle" },
    { frequency: 310, duration: 0.17, offset: 0.09, gain: 0.012, type: "sine" },
  ],
  SLEEPING: [
    { frequency: 360, duration: 0.22, gain: 0.009 },
    { frequency: 245, duration: 0.28, offset: 0.12, gain: 0.006 },
  ],
};

const VIBE_PITCH: Record<AeraVibe, number> = {
  calm: 0.92,
  cute: 1.1,
  professional: 0.98,
  futuristic: 1.03,
};

let context: AudioContext | null = null;
const audioContext = () => (context ??= new AudioContext());

export async function unlockAudio() {
  const ctx = audioContext();
  if (ctx.state === "suspended") await ctx.resume();
}

export async function playEarcon(
  state: OrbState,
  enabled = true,
  vibe: AeraVibe = "futuristic",
) {
  const pattern = PATTERNS[state];
  if (!enabled || !pattern) return;
  const ctx = audioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
  if (ctx.state !== "running") return;

  const start = ctx.currentTime + 0.004;
  const pitch = VIBE_PITCH[vibe];

  for (const tone of pattern) {
    const osc = ctx.createOscillator();
    const shimmer = ctx.createOscillator();
    const gain = ctx.createGain();
    const shimmerGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const at = start + (tone.offset ?? 0);
    const level = tone.gain ?? 0.012;
    const frequency = tone.frequency * pitch;

    osc.type = tone.type ?? "sine";
    osc.frequency.setValueAtTime(frequency, at);
    osc.detune.setValueAtTime(tone.detune ?? 0, at);

    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(frequency * 2.01, at);

    filter.type = "lowpass";
    filter.frequency.value = vibe === "cute" ? 3400 : 2800;
    filter.Q.value = 0.35;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);

    shimmerGain.gain.setValueAtTime(0.0001, at);
    shimmerGain.gain.exponentialRampToValueAtTime(level * 0.23, at + 0.022);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration * 1.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    osc.start(at);
    shimmer.start(at);
    osc.stop(at + tone.duration + 0.03);
    shimmer.stop(at + tone.duration * 1.2 + 0.03);
  }
}
