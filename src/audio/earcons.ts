import type { OrbState } from "../orb/state";

type Tone = { frequency: number; duration: number; offset?: number; gain?: number };

const PATTERNS: Partial<Record<OrbState, Tone[]>> = {
  AWAKE: [{ frequency: 520, duration: 0.07 }, { frequency: 760, duration: 0.1, offset: 0.055 }],
  LISTENING: [{ frequency: 660, duration: 0.09, gain: 0.045 }],
  UNDERSTANDING: [{ frequency: 620, duration: 0.06 }, { frequency: 830, duration: 0.07, offset: 0.05 }],
  THINKING: [{ frequency: 760, duration: 0.045, gain: 0.025 }, { frequency: 980, duration: 0.045, offset: 0.08, gain: 0.018 }],
  ACTING: [{ frequency: 540, duration: 0.04 }, { frequency: 540, duration: 0.04, offset: 0.07 }],
  SUCCESS: [{ frequency: 680, duration: 0.06 }, { frequency: 920, duration: 0.1, offset: 0.055 }],
  QUESTION: [{ frequency: 580, duration: 0.07 }, { frequency: 780, duration: 0.11, offset: 0.09 }],
  WARNING: [{ frequency: 390, duration: 0.1, gain: 0.035 }, { frequency: 460, duration: 0.12, offset: 0.1, gain: 0.03 }],
  ERROR: [{ frequency: 440, duration: 0.08 }, { frequency: 320, duration: 0.14, offset: 0.08 }],
  SLEEPING: [{ frequency: 340, duration: 0.18, gain: 0.02 }, { frequency: 240, duration: 0.22, offset: 0.12, gain: 0.012 }],
};

let context: AudioContext | null = null;
const audioContext = () => (context ??= new AudioContext());

export async function unlockAudio() {
  const ctx = audioContext();
  if (ctx.state === "suspended") await ctx.resume();
}

export async function playEarcon(state: OrbState, enabled = true) {
  const pattern = PATTERNS[state];
  if (!enabled || !pattern) return;
  const ctx = audioContext();
  if (ctx.state !== "running") return;
  const start = ctx.currentTime + 0.004;

  for (const tone of pattern) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const at = start + (tone.offset ?? 0);
    const level = tone.gain ?? 0.032;
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone.frequency, at);
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + tone.duration + 0.02);
  }
}
