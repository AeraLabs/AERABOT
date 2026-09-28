import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbState } from "./state";
import { visualFor } from "./state";

interface OrbSceneProps {
  state: OrbState;
  reducedMotion?: boolean;
  quality?: "auto" | "ultra" | "high" | "balanced" | "efficiency";
}

const vertexShader = `
uniform float uTime;
uniform float uEnergy;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  float wave = sin(position.y * 7.0 + uTime * 1.8) * 0.035 * uEnergy;
  wave += sin(position.x * 9.0 - uTime * 1.3) * 0.018 * uEnergy;
  vec3 displaced = position + normal * wave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform float uGlow;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.2);
  float flow = 0.5 + 0.5 * sin(vPosition.y * 8.0 + vPosition.x * 5.0 + uTime * 1.7);
  vec3 pearl = vec3(0.88, 0.97, 1.0);
  vec3 mint = vec3(0.48, 1.0, 0.84);
  vec3 blue = vec3(0.36, 0.72, 1.0);
  vec3 color = mix(pearl, mix(mint, blue, flow), 0.34 + fresnel * 0.28);
  color += fresnel * uGlow * 0.42;
  gl_FragColor = vec4(color, (0.22 + fresnel * 0.46) * uOpacity);
}
`;

export function OrbScene({ state, reducedMotion = false, quality = "auto" }: OrbSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality !== "efficiency",
      powerPreference: quality === "efficiency" ? "low-power" : "high-performance",
      premultipliedAlpha: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === "efficiency" ? 1.25 : 2));
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(1, quality === "efficiency" ? 48 : 80, quality === "efficiency" ? 32 : 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xf6fbff,
        roughness: 0.07,
        metalness: 0.04,
        transmission: 0.9,
        thickness: 0.85,
        ior: 1.42,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transparent: true,
        opacity: 0.78,
        iridescence: 0.42,
        iridescenceIOR: 1.25,
        iridescenceThicknessRange: [90, 420],
      }),
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
      },
    });
    const energy = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.72, quality === "efficiency" ? 3 : 5),
      energyMaterial,
    );
    group.add(energy);

    const ringGeometry = new THREE.BufferGeometry();
    const ringCount = quality === "efficiency" ? 64 : 128;
    const ringPositions = new Float32Array(ringCount * 3);
    ringGeometry.setAttribute("position", new THREE.BufferAttribute(ringPositions, 3));
    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0xa9ffe8,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.LineLoop(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI * 0.56;
    group.add(ring);

    const particleCount = quality === "efficiency" ? 42 : quality === "balanced" ? 80 : 128;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 0.24 + Math.random() * 0.62;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.cos(phi);
      particlePositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.025,
      color: 0xeaffff,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    group.add(particles);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const cool = new THREE.PointLight(0x7fdfff, 7, 9);
    cool.position.set(-2.4, 1.9, 3);
    scene.add(cool);
    const mint = new THREE.PointLight(0x89ffd8, 4.5, 7);
    mint.position.set(2.2, -1.2, 2.5);
    scene.add(mint);

    let raf = 0;
    let pointerX = 0;
    let pointerY = 0;
    let currentScale = 0.8;
    let currentGlow = 0.7;
    let currentOpacity = 0.8;
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
      pointerX = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    };
    mount.addEventListener("pointermove", onPointer);

    const animate = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const v = visualFor(stateRef.current);
      const smooth = 1 - Math.exp(-dt * 7.5);
      currentScale = THREE.MathUtils.lerp(currentScale, v.scale, smooth);
      currentGlow = THREE.MathUtils.lerp(currentGlow, v.glow, smooth);
      currentOpacity = THREE.MathUtils.lerp(currentOpacity, v.opacity, smooth);

      group.scale.setScalar(currentScale);
      energyMaterial.uniforms.uTime.value = now / 1000 * v.energySpeed;
      energyMaterial.uniforms.uEnergy.value = v.waveformAmplitude * 4.6;
      energyMaterial.uniforms.uGlow.value = currentGlow;
      energyMaterial.uniforms.uOpacity.value = currentOpacity;
      (shell.material as THREE.MeshPhysicalMaterial).opacity = 0.48 + currentOpacity * 0.32;
      particleMaterial.opacity = v.particleIntensity * 0.75;
      ringMaterial.opacity = 0.32 + v.glow * 0.34;

      if (!reducedMotion) {
        group.rotation.y += dt * 0.12 * v.energySpeed;
        group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -pointerY * 0.09, smooth * 0.5);
        group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, pointerX * 0.07, smooth * 0.5);
        energy.rotation.x -= dt * 0.25 * v.energySpeed;
        energy.rotation.y += dt * 0.4 * v.energySpeed;
        particles.rotation.y -= dt * 0.16 * v.energySpeed;
        group.position.y = Math.sin(now / 1000 * 1.1) * v.movementAmplitude;
      } else {
        group.rotation.set(0, 0, 0);
        group.position.y = 0;
      }

      const ringAttr = ringGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < ringCount; i += 1) {
        const angle = (i / ringCount) * Math.PI * 2;
        const waveform = Math.sin(angle * 5 + now / 1000 * v.energySpeed * 2.4) * v.waveformAmplitude;
        const r = 0.84 + waveform;
        ringAttr.setXYZ(i, Math.cos(angle) * r, Math.sin(angle) * r, Math.sin(angle * 3 + now / 1700) * 0.06);
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
      renderer.dispose();
      shell.geometry.dispose();
      (shell.material as THREE.Material).dispose();
      energy.geometry.dispose();
      energyMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [quality, reducedMotion]);

  return <div ref={mountRef} className="orb-scene" aria-hidden="true" />;
}
