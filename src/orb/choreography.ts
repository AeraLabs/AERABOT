import type { OrbState } from "./state";

export interface OrbChoreography {
  ringScale: number;
  ringSpin: number;
  coreScale: number;
  corePulse: number;
  waveform: number;
  pointerResponse: number;
  drift: number;
  halo: number;
  particleGain: number;
}

const calm: OrbChoreography = {
  ringScale: 0.92,
  ringSpin: 0.72,
  coreScale: 0.96,
  corePulse: 0.35,
  waveform: 0.9,
  pointerResponse: 0.8,
  drift: 0.8,
  halo: 0.75,
  particleGain: 0.85,
};

export const ORB_CHOREOGRAPHY: Record<OrbState, OrbChoreography> = {
  IDLE: calm,
  AMBIENT: {
    ...calm,
    ringScale: 0.88,
    ringSpin: 0.52,
    coreScale: 0.93,
    pointerResponse: 0.72,
    drift: 1,
    particleGain: 0.72,
  },
  AWAKE: {
    ringScale: 1.04,
    ringSpin: 1.05,
    coreScale: 1.04,
    corePulse: 0.65,
    waveform: 1.05,
    pointerResponse: 1.2,
    drift: 0.8,
    halo: 1,
    particleGain: 1.05,
  },
  LISTENING: {
    ringScale: 1.1,
    ringSpin: 0.8,
    coreScale: 1.08,
    corePulse: 1.15,
    waveform: 1.32,
    pointerResponse: 1.38,
    drift: 0.42,
    halo: 1.16,
    particleGain: 1.12,
  },
  UNDERSTANDING: {
    ringScale: 0.98,
    ringSpin: 1.38,
    coreScale: 0.96,
    corePulse: 0.9,
    waveform: 1.08,
    pointerResponse: 0.82,
    drift: 0.3,
    halo: 0.92,
    particleGain: 1.05,
  },
  THINKING: {
    ringScale: 0.94,
    ringSpin: 1.9,
    coreScale: 0.9,
    corePulse: 1.25,
    waveform: 1.15,
    pointerResponse: 0.55,
    drift: 0.2,
    halo: 1.05,
    particleGain: 1.35,
  },
  ACTING: {
    ringScale: 1.02,
    ringSpin: 1.48,
    coreScale: 1.02,
    corePulse: 0.9,
    waveform: 1.05,
    pointerResponse: 0.45,
    drift: 0.18,
    halo: 1.05,
    particleGain: 1.18,
  },
  WAITING: {
    ...calm,
    ringScale: 0.9,
    ringSpin: 0.58,
    coreScale: 0.95,
    drift: 0.55,
  },
  SPEAKING: {
    ringScale: 1.14,
    ringSpin: 1.02,
    coreScale: 1.1,
    corePulse: 1.4,
    waveform: 1.45,
    pointerResponse: 1.05,
    drift: 0.52,
    halo: 1.28,
    particleGain: 1.18,
  },
  QUESTION: {
    ringScale: 1.06,
    ringSpin: 0.66,
    coreScale: 1.04,
    corePulse: 0.82,
    waveform: 1.12,
    pointerResponse: 1.12,
    drift: 0.38,
    halo: 1.12,
    particleGain: 1,
  },
  SUCCESS: {
    ringScale: 1.18,
    ringSpin: 1.18,
    coreScale: 1.12,
    corePulse: 1.2,
    waveform: 1.18,
    pointerResponse: 1,
    drift: 0.45,
    halo: 1.5,
    particleGain: 1.28,
  },
  WARNING: {
    ringScale: 1.03,
    ringSpin: 0.82,
    coreScale: 0.98,
    corePulse: 0.75,
    waveform: 1.08,
    pointerResponse: 0.6,
    drift: 0.22,
    halo: 0.95,
    particleGain: 0.92,
  },
  ERROR: {
    ringScale: 0.84,
    ringSpin: 0.36,
    coreScale: 0.86,
    corePulse: 0.25,
    waveform: 0.72,
    pointerResponse: 0.3,
    drift: 0.15,
    halo: 0.55,
    particleGain: 0.5,
  },
  SLEEPING: {
    ringScale: 0.62,
    ringSpin: 0.12,
    coreScale: 0.72,
    corePulse: 0.12,
    waveform: 0.45,
    pointerResponse: 0.1,
    drift: 0.18,
    halo: 0.28,
    particleGain: 0.22,
  },
  STUDIO: {
    ringScale: 0.76,
    ringSpin: 0.2,
    coreScale: 0.82,
    corePulse: 0.22,
    waveform: 0.58,
    pointerResponse: 0.35,
    drift: 0.14,
    halo: 0.42,
    particleGain: 0.35,
  },
  DND: {
    ringScale: 0.66,
    ringSpin: 0.08,
    coreScale: 0.76,
    corePulse: 0.08,
    waveform: 0.38,
    pointerResponse: 0,
    drift: 0,
    halo: 0.2,
    particleGain: 0.12,
  },
};

export function choreographyFor(state: OrbState) {
  return ORB_CHOREOGRAPHY[state];
}
