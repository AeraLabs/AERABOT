export type OrbState =
  | "IDLE" | "AMBIENT" | "AWAKE" | "LISTENING" | "UNDERSTANDING"
  | "THINKING" | "ACTING" | "WAITING" | "SPEAKING" | "QUESTION"
  | "SUCCESS" | "WARNING" | "ERROR" | "SLEEPING" | "STUDIO" | "DND";

export type DepthZone = "Z0" | "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export interface OrbVisualState {
  scale: number;
  depth: DepthZone;
  opacity: number;
  glow: number;
  energySpeed: number;
  waveformAmplitude: number;
  movementAmplitude: number;
  particleIntensity: number;
  nativeDiameter: number;
}

const base: OrbVisualState = {
  scale: 0.86, depth: "Z2", opacity: 0.92, glow: 0.78, energySpeed: 0.8,
  waveformAmplitude: 0.12, movementAmplitude: 0.035, particleIntensity: 0.55,
  nativeDiameter: 128,
};

export const ORB_VISUALS: Record<OrbState, OrbVisualState> = {
  IDLE: base,
  AMBIENT: { ...base, scale: 0.62, depth: "Z1", opacity: 0.72, glow: 0.48, energySpeed: 0.38, movementAmplitude: 0.02, particleIntensity: 0.24, nativeDiameter: 86 },
  AWAKE: { ...base, scale: 0.98, depth: "Z3", glow: 1, energySpeed: 1.12, waveformAmplitude: 0.18, nativeDiameter: 154 },
  LISTENING: { ...base, scale: 1, depth: "Z3", glow: 1.08, energySpeed: 1.35, waveformAmplitude: 0.3, nativeDiameter: 164 },
  UNDERSTANDING: { ...base, scale: 0.94, depth: "Z3", glow: 0.95, energySpeed: 1.5, waveformAmplitude: 0.2, nativeDiameter: 154 },
  THINKING: { ...base, scale: 0.9, depth: "Z3", glow: 0.9, energySpeed: 2.2, waveformAmplitude: 0.25, particleIntensity: 0.82, nativeDiameter: 156 },
  ACTING: { ...base, scale: 0.96, depth: "Z3", glow: 1.02, energySpeed: 1.75, waveformAmplitude: 0.2, movementAmplitude: 0.018, nativeDiameter: 160 },
  WAITING: { ...base, scale: 0.78, depth: "Z2", glow: 0.62, energySpeed: 0.55, nativeDiameter: 118 },
  SPEAKING: { ...base, scale: 1.04, depth: "Z4", glow: 1.12, energySpeed: 1.25, waveformAmplitude: 0.34, nativeDiameter: 190 },
  QUESTION: { ...base, scale: 1.02, depth: "Z4", glow: 1.08, waveformAmplitude: 0.24, nativeDiameter: 184 },
  SUCCESS: { ...base, scale: 1.05, depth: "Z4", glow: 1.28, energySpeed: 1.7, waveformAmplitude: 0.22, nativeDiameter: 186 },
  WARNING: { ...base, scale: 0.98, depth: "Z4", glow: 0.92, energySpeed: 1.15, waveformAmplitude: 0.18, nativeDiameter: 180 },
  ERROR: { ...base, scale: 0.92, depth: "Z4", glow: 0.7, energySpeed: 0.48, waveformAmplitude: 0.11, nativeDiameter: 172 },
  SLEEPING: { ...base, scale: 0.34, depth: "Z0", opacity: 0.48, glow: 0.2, energySpeed: 0.16, waveformAmplitude: 0.035, movementAmplitude: 0.008, particleIntensity: 0.08, nativeDiameter: 44 },
  STUDIO: { ...base, scale: 0.52, depth: "Z1", opacity: 0.72, glow: 0.42, energySpeed: 0.3, waveformAmplitude: 0.07, movementAmplitude: 0.006, particleIntensity: 0.12, nativeDiameter: 68 },
  DND: { ...base, scale: 0.46, depth: "Z1", opacity: 0.56, glow: 0.28, energySpeed: 0.12, waveformAmplitude: 0.025, movementAmplitude: 0, particleIntensity: 0.04, nativeDiameter: 60 },
};

export const visualFor = (state: OrbState) => ORB_VISUALS[state];
