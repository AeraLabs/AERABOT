import * as THREE from "three";

export type LivingQuality = "ultra" | "high" | "balanced" | "efficiency";

export interface LivingQualityProfile {
  sphereSegments: number;
  energyDetail: number;
  particleCount: number;
  filamentCount: number;
  filamentPoints: number;
  pixelRatio: number;
  glints: number;
}

export const LIVING_QUALITY: Record<LivingQuality, LivingQualityProfile> = {
  efficiency: {
    sphereSegments: 40,
    energyDetail: 2,
    particleCount: 38,
    filamentCount: 2,
    filamentPoints: 52,
    pixelRatio: 1.15,
    glints: 1,
  },
  balanced: {
    sphereSegments: 64,
    energyDetail: 3,
    particleCount: 72,
    filamentCount: 4,
    filamentPoints: 72,
    pixelRatio: 1.5,
    glints: 2,
  },
  high: {
    sphereSegments: 84,
    energyDetail: 4,
    particleCount: 118,
    filamentCount: 6,
    filamentPoints: 92,
    pixelRatio: 1.8,
    glints: 3,
  },
  ultra: {
    sphereSegments: 104,
    energyDetail: 5,
    particleCount: 180,
    filamentCount: 8,
    filamentPoints: 112,
    pixelRatio: 2,
    glints: 3,
  },
};

export function resolveLivingQuality(
  requested: "auto" | LivingQuality,
): LivingQuality {
  if (requested !== "auto") return requested;
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 2) return "efficiency";
  if (cores <= 4) return "balanced";
  return "high";
}

export const livingEnergyVertexShader = `
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocal;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vLocal = position;

  float waveA = sin(position.y * 8.2 + uTime * 2.05);
  float waveB = sin(position.x * 10.6 - uTime * 1.52);
  float waveC = sin((position.x + position.z) * 13.0 + uTime * 1.08);
  float waveD = cos(length(position.xz) * 14.0 - uTime * 2.35);
  float displacement =
    (waveA * 0.038 + waveB * 0.022 + waveC * 0.012 + waveD * 0.012) *
    uEnergy +
    uPulse * 0.04;

  vec3 displaced = position + normal * displacement;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const livingEnergyFragmentShader = `
uniform float uTime;
uniform float uGlow;
uniform float uOpacity;
uniform float uPulse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uWarm;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocal;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float facing = max(0.0, dot(normalize(vNormal), viewDir));
  float fresnel = pow(1.0 - facing, 1.9);

  float flowA =
    0.5 + 0.5 * sin(vLocal.y * 10.0 + vLocal.x * 5.0 + uTime * 1.8);
  float flowB =
    0.5 + 0.5 * sin(vLocal.z * 13.0 - vLocal.y * 6.0 - uTime * 1.35);
  float flowC =
    0.5 + 0.5 * cos(length(vLocal.xz) * 17.0 - uTime * 2.1);

  float ridge = pow(abs(flowA - flowB), 1.45);
  float hot = pow(max(0.0, flowC * flowA), 3.0);

  vec3 color = mix(uColorA, uColorB, flowA);
  color = mix(color, uColorC, flowB * 0.68);
  color = mix(color, uWarm, hot * 0.34);
  color += vec3(1.0) * fresnel * uGlow * 0.34;
  color += uPulse * mix(uColorB, vec3(1.0), 0.65) * 0.28;

  float alpha =
    (0.10 + ridge * 0.27 + hot * 0.18 + fresnel * 0.28 + uPulse * 0.07) *
    uOpacity;

  gl_FragColor = vec4(color, alpha);
}
`;

export const livingGlassVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocal;

void main() {
  vLocal = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const livingGlassFragmentShader = `
uniform float uTime;
uniform float uGlow;
uniform float uPulse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vLocal;

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(n, viewDir), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 2.25);
  float rimSharp = pow(1.0 - ndv, 7.0);

  vec3 keyDir = normalize(vec3(-0.48, 0.72, 0.62));
  vec3 fillDir = normalize(vec3(0.58, -0.30, 0.76));
  float specA = pow(max(dot(reflect(-keyDir, n), viewDir), 0.0), 72.0);
  float specB = pow(max(dot(reflect(-fillDir, n), viewDir), 0.0), 34.0);

  float causticA =
    0.5 + 0.5 * sin(vLocal.y * 12.0 + vLocal.x * 8.0 + uTime * 0.42);
  float causticB =
    0.5 + 0.5 * sin(vLocal.z * 15.0 - vLocal.y * 7.0 - uTime * 0.31);
  float caustic = pow(max(0.0, causticA * causticB), 4.5);

  vec3 pearl = mix(vec3(0.93, 0.99, 1.0), uColorA, 0.12);
  vec3 edge = mix(uColorB, uColorC, 0.52 + vLocal.y * 0.16);
  vec3 color = mix(pearl, edge, rim * 0.66);
  color += vec3(1.0) * specA * 1.2;
  color += mix(uColorA, vec3(1.0), 0.5) * specB * 0.48;
  color += mix(uColorB, uColorC, 0.5) * caustic * (0.12 + uGlow * 0.09);
  color += mix(uColorA, vec3(1.0), 0.72) * uPulse * 0.08;

  float alpha =
    0.055 +
    rim * 0.18 +
    rimSharp * 0.34 +
    specA * 0.72 +
    specB * 0.16 +
    caustic * 0.045;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.86));
}
`;

export const livingAtmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const livingAtmosphereFragmentShader = `
uniform float uGlow;
uniform float uPulse;
uniform vec3 uColorB;
uniform vec3 uColorC;

varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 3.25);
  vec3 color = mix(uColorB, uColorC, 0.58);
  float alpha = rim * (0.10 + uGlow * 0.12 + uPulse * 0.05);
  gl_FragColor = vec4(color, alpha);
}
`;

export function makeLivingGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(239,252,255,.9)");
  gradient.addColorStop(0.34, "rgba(127,229,255,.34)");
  gradient.addColorStop(1, "rgba(92,150,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function deterministicUnit(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}
