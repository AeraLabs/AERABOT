import { useEffect, useRef } from "react";
import * as THREE from "three";
import type {
  OrbPalette,
  PresenceStyle,
} from "../core/preferences";
import { DEFAULT_ORB_PALETTE } from "../core/preferences";
import { choreographyFor } from "./choreography";
import { PRESENCE_PROFILES } from "./palette";
import type { OrbState } from "./state";
import { visualFor } from "./state";

interface OrbSceneProps {
  state: OrbState;
  reducedMotion?: boolean;
  quality?: "auto" | "ultra" | "high" | "balanced" | "efficiency";
  palette?: OrbPalette;
  presence?: PresenceStyle;
  desktopActivityKey?: string;
}

const vertexShader = `
uniform float uTime;
uniform float uEnergy;
uniform float uPulse;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  float waveA = sin(position.y * 7.0 + uTime * 1.8);
  float waveB = sin(position.x * 9.0 - uTime * 1.3);
  float waveC = sin((position.x + position.z) * 11.0 + uTime * 0.9);
  float wave = (waveA * 0.035 + waveB * 0.018 + waveC * 0.009) * uEnergy;
  wave += uPulse * 0.035;

  vec3 displaced = position + normal * wave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uGlow;
uniform float uOpacity;
uniform float uPulse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.2);
  float flowA = 0.5 + 0.5 * sin(vPosition.y * 8.0 + vPosition.x * 5.0 + uTime * 1.7);
  float flowB = 0.5 + 0.5 * sin(vPosition.z * 10.0 - vPosition.y * 4.0 - uTime * 1.15);

  vec3 color = mix(uColorA, uColorB, flowA);
  color = mix(color, uColorC, flowB * 0.52 + fresnel * 0.22);
  color += fresnel * uGlow * 0.38;
  color += uPulse * 0.18;

  float alpha = (0.2 + fresnel * 0.48 + uPulse * 0.05) * uOpacity;
  gl_FragColor = vec4(color, alpha);
}
`;

export function OrbScene({
  state,
  reducedMotion = false,
  quality = "auto",
  palette = DEFAULT_ORB_PALETTE,
  presence = "balanced",
  desktopActivityKey = "",
}: OrbSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const paletteRef = useRef(palette);
  const presenceRef = useRef(presence);
  const desktopActivityRef = useRef(desktopActivityKey);
  stateRef.current = state;
  paletteRef.current = palette;
  presenceRef.current = presence;
  desktopActivityRef.current = desktopActivityKey;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality !== "efficiency",
      powerPreference:
        quality === "efficiency" ? "low-power" : "high-performance",
      premultipliedAlpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        quality === "efficiency" ? 1.25 : 2,
      ),
    );
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const colorA = new THREE.Color(paletteRef.current.primary);
    const colorB = new THREE.Color(paletteRef.current.secondary);
    const colorC = new THREE.Color(paletteRef.current.accent);
    const targetA = new THREE.Color();
    const targetB = new THREE.Color();
    const targetC = new THREE.Color();

    const shellMaterial = new THREE.MeshPhysicalMaterial({
      color: colorA.clone().lerp(new THREE.Color(0xffffff), 0.74),
      roughness: 0.06,
      metalness: 0.035,
      transmission: 0.92,
      thickness: 0.9,
      ior: 1.43,
      clearcoat: 1,
      clearcoatRoughness: 0.065,
      transparent: true,
      opacity: 0.78,
      iridescence: 0.5,
      iridescenceIOR: 1.28,
      iridescenceThicknessRange: [80, 480],
    });
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        quality === "efficiency" ? 48 : 88,
        quality === "efficiency" ? 32 : 72,
      ),
      shellMaterial,
    );
    group.add(shell);

    const energyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.7 },
        uGlow: { value: 0.8 },
        uOpacity: { value: 0.8 },
        uPulse: { value: 0 },
        uColorA: { value: colorA },
        uColorB: { value: colorB },
        uColorC: { value: colorC },
      },
    });
    const energy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(
        0.72,
        quality === "efficiency" ? 3 : 5,
      ),
      energyMaterial,
    );
    group.add(energy);

    const coreMaterial = new THREE.MeshBasicMaterial({
      color: colorB,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.4,
        quality === "efficiency" ? 28 : 48,
        quality === "efficiency" ? 18 : 32,
      ),
      coreMaterial,
    );
    group.add(core);

    const ringGeometry = new THREE.BufferGeometry();
    const ringCount = quality === "efficiency" ? 72 : 144;
    const ringPositions = new Float32Array(ringCount * 3);
    ringGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(ringPositions, 3),
    );

    const ringMaterials = [
      new THREE.LineBasicMaterial({
        color: colorA,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.LineBasicMaterial({
        color: colorB,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.LineBasicMaterial({
        color: colorC,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
      }),
    ];

    const rings = ringMaterials.map((material, index) => {
      const ring = new THREE.LineLoop(ringGeometry, material);
      ring.rotation.x = Math.PI * (0.48 + index * 0.12);
      ring.rotation.y = index * 0.65;
      ring.rotation.z = index * 0.38;
      group.add(ring);
      return ring;
    });

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: colorC,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.11, quality === "efficiency" ? 48 : 96),
      haloMaterial,
    );
    halo.rotation.x = Math.PI * 0.5;
    group.add(halo);

    const particleCount =
      quality === "efficiency" ? 48 : quality === "balanced" ? 90 : 150;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 0.22 + Math.random() * 0.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] =
        radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.cos(phi);
      particlePositions[i * 3 + 2] =
        radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.026,
      color: colorC,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(
      particleGeometry,
      particleMaterial,
    );
    group.add(particles);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const lightA = new THREE.PointLight(colorA, 7, 9);
    lightA.position.set(-2.4, 1.9, 3);
    scene.add(lightA);
    const lightB = new THREE.PointLight(colorB, 5.2, 8);
    lightB.position.set(2.3, -1.1, 2.5);
    scene.add(lightB);
    const lightC = new THREE.PointLight(colorC, 3.2, 7);
    lightC.position.set(0.2, 2.2, 1.6);
    scene.add(lightC);

    let raf = 0;
    let pointerX = 0;
    let pointerY = 0;
    let currentScale = 0.8;
    let currentGlow = 0.7;
    let currentOpacity = 0.8;
    let transitionPulse = 0;
    let attentionPulse = 0;
    let previousState = stateRef.current;
    let previousDesktopActivity = desktopActivityRef.current;
    let last = performance.now();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const size = Math.max(1, Math.min(rect.width, rect.height));
      renderer.setSize(size, size, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const onPointer = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointerX =
        ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      pointerY =
        ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    };
    const onLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };
    mount.addEventListener("pointermove", onPointer);
    mount.addEventListener("pointerleave", onLeave);

    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const currentState = stateRef.current;
      const v = visualFor(currentState);
      const choreography = choreographyFor(currentState);
      const presenceProfile = PRESENCE_PROFILES[presenceRef.current];
      const motion = reducedMotion ? 0 : presenceProfile.motion;

      if (currentState !== previousState) {
        transitionPulse = Math.min(
          1.5,
          0.72 * presenceProfile.bloom +
            (currentState === "SUCCESS" ? 0.42 : 0) +
            (currentState === "AWAKE" ? 0.22 : 0),
        );
        previousState = currentState;
      }

      if (desktopActivityRef.current !== previousDesktopActivity) {
        previousDesktopActivity = desktopActivityRef.current;
        attentionPulse =
          currentState === "SLEEPING" || currentState === "DND" ? 0 : 1;
      }

      transitionPulse *= Math.exp(-dt * 3.6);
      attentionPulse *= Math.exp(-dt * 2.35);

      targetA.set(paletteRef.current.primary);
      targetB.set(paletteRef.current.secondary);
      targetC.set(paletteRef.current.accent);
      const colorSmooth = 1 - Math.exp(-dt * 6);
      colorA.lerp(targetA, colorSmooth);
      colorB.lerp(targetB, colorSmooth);
      colorC.lerp(targetC, colorSmooth);

      shellMaterial.color
        .copy(colorA)
        .lerp(new THREE.Color(0xffffff), 0.74);
      coreMaterial.color.copy(colorB);
      particleMaterial.color.copy(colorC);
      ringMaterials[0].color.copy(colorA);
      ringMaterials[1].color.copy(colorB);
      ringMaterials[2].color.copy(colorC);
      haloMaterial.color.copy(colorC);
      lightA.color.copy(colorA);
      lightB.color.copy(colorB);
      lightC.color.copy(colorC);

      const smooth = 1 - Math.exp(-dt * 7.5);
      currentScale = THREE.MathUtils.lerp(currentScale, v.scale, smooth);
      currentGlow = THREE.MathUtils.lerp(currentGlow, v.glow, smooth);
      currentOpacity = THREE.MathUtils.lerp(
        currentOpacity,
        v.opacity,
        smooth,
      );

      const stateBreath =
        Math.sin(now / (currentState === "SPEAKING" ? 75 : 118)) *
        0.026 *
        choreography.corePulse;
      const expressivePulse =
        stateBreath * presenceProfile.motion;

      const ambientCuriosity =
        currentState === "AMBIENT" || currentState === "IDLE"
          ? (Math.sin(now / 1050) + Math.sin(now / 1730)) *
            0.0045 *
            presenceProfile.motion
          : 0;

      group.scale.setScalar(
        currentScale +
          transitionPulse * 0.055 +
          attentionPulse * 0.022 +
          expressivePulse +
          ambientCuriosity,
      );

      energyMaterial.uniforms.uTime.value =
        (now / 1000) * v.energySpeed * Math.max(0.28, motion);
      energyMaterial.uniforms.uEnergy.value =
        v.waveformAmplitude *
        4.6 *
        (0.82 + presenceProfile.motion * 0.18);
      energyMaterial.uniforms.uGlow.value =
        currentGlow * presenceProfile.bloom;
      energyMaterial.uniforms.uOpacity.value = currentOpacity;
      energyMaterial.uniforms.uPulse.value =
        transitionPulse + attentionPulse * 0.34;

      shellMaterial.opacity =
        0.46 + currentOpacity * 0.31 + transitionPulse * 0.045;
      coreMaterial.opacity =
        0.07 +
        v.glow * 0.075 +
        transitionPulse * 0.12 +
        choreography.corePulse * 0.045;
      core.scale.setScalar(
        choreography.coreScale +
          Math.sin(now / 140) *
            0.025 *
            choreography.corePulse *
            presenceProfile.motion,
      );
      particleMaterial.opacity =
        v.particleIntensity *
        0.72 *
        presenceProfile.particles *
        choreography.particleGain;
      particleMaterial.size =
        0.022 + transitionPulse * 0.008;

      const ringBase = 0.22 + v.glow * 0.29;
      ringMaterials[0].opacity =
        ringBase + transitionPulse * 0.18;
      ringMaterials[1].opacity =
        ringBase * 0.78 + transitionPulse * 0.13;
      ringMaterials[2].opacity =
        ringBase * 0.62 + transitionPulse * 0.1;

      const ambientHalo =
        (currentState === "SPEAKING" || currentState === "LISTENING"
          ? 0.045 + Math.max(0, Math.sin(now / 115)) * 0.035
          : 0) * choreography.halo;
      haloMaterial.opacity =
        Math.min(
          0.5,
          transitionPulse *
            0.28 *
            presenceProfile.bloom *
            choreography.halo +
            attentionPulse * 0.12 +
            ambientHalo,
        );
      const haloScale =
        1 +
        (1 - transitionPulse) * 0.17 +
        Math.max(0, Math.sin(now / 170)) * 0.025 * choreography.halo;
      halo.scale.setScalar(haloScale);

      const ringScale =
        choreography.ringScale +
        Math.sin(now / 155) *
          0.014 *
          choreography.corePulse *
          presenceProfile.motion;
      rings.forEach((ring) => ring.scale.setScalar(ringScale));

      if (!reducedMotion) {
        const orbit = presenceProfile.orbit;
        group.rotation.y += dt * 0.105 * v.energySpeed * motion;
        group.rotation.x = THREE.MathUtils.lerp(
          group.rotation.x,
          -pointerY *
            0.095 *
            presenceProfile.hover *
            choreography.pointerResponse,
          smooth * 0.45,
        );
        group.rotation.z = THREE.MathUtils.lerp(
          group.rotation.z,
          pointerX *
            0.075 *
            presenceProfile.hover *
            choreography.pointerResponse,
          smooth * 0.45,
        );
        energy.rotation.x -=
          dt * 0.24 * v.energySpeed * motion;
        energy.rotation.y +=
          dt *
          (currentState === "THINKING" ? 0.62 : 0.38) *
          v.energySpeed *
          motion;
        core.rotation.y -= dt * 0.18 * v.energySpeed * motion;
        particles.rotation.y -=
          dt * 0.14 * v.energySpeed * motion;

        rings[0].rotation.z +=
          dt * 0.055 * orbit * choreography.ringSpin;
        rings[1].rotation.y -=
          dt * 0.07 * orbit * choreography.ringSpin;
        rings[2].rotation.x +=
          dt * 0.045 * orbit * choreography.ringSpin;

        const breath =
          Math.sin((now / 1000) * (0.82 + v.energySpeed * 0.16)) *
          v.movementAmplitude *
          motion *
          choreography.drift;
        const idleLift =
          currentState === "AMBIENT" || currentState === "IDLE"
            ? Math.sin(now / 720) * 0.006 * presenceProfile.hover
            : 0;
        group.position.y = breath + idleLift - attentionPulse * 0.018;
        const errorJitter =
          currentState === "ERROR"
            ? Math.sin(now / 21) * 0.006 * motion
            : 0;
        group.position.x =
          Math.sin(now / 2100) *
            v.movementAmplitude *
            0.32 *
            presenceProfile.motion *
            choreography.drift +
          Math.sin(now / 1360) * 0.004 * presenceProfile.hover +
          attentionPulse * 0.012 +
          errorJitter;
      } else {
        group.rotation.set(0, 0, 0);
        group.position.set(0, 0, 0);
      }

      const ringAttr =
        ringGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < ringCount; i += 1) {
        const angle = (i / ringCount) * Math.PI * 2;
        const stateGain = choreography.waveform;
        const waveform =
          Math.sin(
            angle * 5 +
              (now / 1000) * v.energySpeed * 2.4,
          ) *
          v.waveformAmplitude *
          stateGain *
          (0.85 + presenceProfile.motion * 0.15);
        const secondary =
          Math.sin(
            angle * 11 -
              (now / 1000) * v.energySpeed * 1.35,
          ) *
          v.waveformAmplitude *
          0.18;
        const radius =
          0.84 +
          waveform +
          secondary +
          transitionPulse * 0.035 +
          (currentState === "SPEAKING"
            ? Math.max(0, Math.sin(now / 90)) * 0.015
            : 0);
        ringAttr.setXYZ(
          i,
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          Math.sin(angle * 3 + now / 1700) *
            0.06 *
            presenceProfile.motion,
        );
      }
      ringAttr.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      mount.removeEventListener("pointermove", onPointer);
      mount.removeEventListener("pointerleave", onLeave);
      renderer.dispose();
      shell.geometry.dispose();
      shellMaterial.dispose();
      energy.geometry.dispose();
      energyMaterial.dispose();
      core.geometry.dispose();
      coreMaterial.dispose();
      ringGeometry.dispose();
      ringMaterials.forEach((material) => material.dispose());
      halo.geometry.dispose();
      haloMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [quality, reducedMotion]);

  return (
    <div
      ref={mountRef}
      className="orb-scene"
      aria-hidden="true"
    />
  );
}
