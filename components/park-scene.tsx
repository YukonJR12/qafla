"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { ComponentRef } from "react";
type Controls = ComponentRef<typeof OrbitControls>;
import type { TruckTonight } from "@/lib/data";
import { truckName } from "@/lib/i18n";
import { useLocale } from "@/lib/locale";
import { PARK_TRUCKS, parkTruck, parkWords } from "@/lib/park-map";

// Allocated only when this lazy chunk loads; shared by every miniature.
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
const sphere = new THREE.SphereGeometry(1, 16, 10);
const plane = new THREE.PlaneGeometry(1, 1);
const materials = new Map<string, THREE.MeshStandardMaterial>();
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  return materials.get(color)!;
}
type V3 = [number, number, number];
function Part({ at, size, color, shape = box, rotation }: { at: V3; size: V3; color: string; shape?: THREE.BufferGeometry; rotation?: V3 }) {
  return <mesh geometry={shape} material={material(color)} position={at} scale={size} rotation={rotation} />;
}
function Logo({ texture, at, rotation, size = 1 }: { texture: THREE.Texture; at: V3; rotation?: V3; size?: number }) {
  return <group position={at} rotation={rotation} scale={size}><mesh geometry={plane}><meshBasicMaterial color="#fdfdff" side={THREE.DoubleSide} /></mesh><mesh geometry={plane} position={[0, 0, 0.005]}><meshBasicMaterial map={texture} transparent toneMapped={false} side={THREE.DoubleSide} /></mesh></group>;
}
function Roof({ kind }: { kind: string }) {
  if (kind === "tea") return <group position={[0.1, 2.6, 0]}>
    <Part at={[0, 0, 0]} size={[0.42, 0.65, 0.42]} color="#fff2d9" shape={cylinder} />
    <Part at={[0, 0.34, 0]} size={[0.38, 0.02, 0.38]} color="#8b4a23" shape={cylinder} />
    <mesh position={[0.47, 0.02, 0]}><torusGeometry args={[0.23, 0.07, 6, 12]} /><meshStandardMaterial color="#fff2d9" /></mesh>
  </group>;
  if (kind === "burger") return <group position={[0.1, 2.6, 0]}>
    <Part at={[0, 0, 0]} size={[0.75, 0.2, 0.65]} shape={sphere} color="#d9a34c" />
    <Part at={[0, 0.2, 0]} size={[0.7, 0.08, 0.62]} shape={cylinder} color="#72462e" />
    <Part at={[0, 0.3, 0]} size={[0.8, 0.1, 0.66]} shape={sphere} color="#a4c04a" />
    <Part at={[0, 0.48, 0]} size={[0.75, 0.3, 0.65]} shape={sphere} color="#efb655" />
  </group>;
  if (kind === "taco") return <group position={[0, 2.6, 0]} rotation={[0, 0, -0.12]}>
    <Part at={[0, 0, 0]} size={[0.85, 0.48, 0.24]} shape={sphere} color="#f1c34d" />
    <Part at={[0, 0.25, 0.14]} size={[0.7, 0.2, 0.15]} shape={sphere} color="#46854b" />
    <Part at={[0.3, 0.3, 0.22]} size={[0.14, 0.14, 0.1]} shape={sphere} color="#ec593d" />
  </group>;
  if (kind === "bowl") return <group position={[0, 2.6, 0]}>
    <Part at={[0, 0, 0]} size={[0.65, 0.3, 0.65]} shape={sphere} color="#fdfdff" />
    <Part at={[0, 0.15, 0]} size={[0.55, 0.05, 0.55]} shape={cylinder} color="#e8b765" />
    {[0, 0.18].map((x) => <Part key={x} at={[x, 0.6, 0]} size={[0.055, 1.15, 0.055]} rotation={[0, 0, -0.5]} color="#683f28" />)}
  </group>;
  if (kind === "chimney") return <group>
    <Part at={[-0.6, 2.8, 0]} size={[0.28, 1.2, 0.28]} shape={cylinder} color="#303c3a" />
    <Part at={[0.5, 2.5, 0]} size={[0.65, 0.22, 0.65]} shape={sphere} color="#bd8a51" />
  </group>;
  return <group position={[0, 2.55, 0]}>{[-0.45, 0, 0.45].map((x) => <Part key={x} at={[x, x === 0 ? 0.3 : 0, 0]} size={[0.32, 0.32, 0.32]} color="#c3873d" shape={sphere} />)}</group>;
}
function Palm({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <Part at={[0, 1.55, 0]} size={[0.15, 3.1, 0.15]} color="#9a7955" shape={cylinder} rotation={[0, 0, 0.09]} />
    {Array.from({ length: 6 }, (_, i) => <group key={i} position={[0.15, 3.05, 0]} rotation={[0, i * Math.PI / 3, 0]}>
      <Part at={[0.52, 0, 0]} size={[0.85, 0.12, 0.26]} shape={sphere} color={i % 2 ? "#507659" : "#648765"} rotation={[0, 0, -0.3]} />
    </group>)}
    <Part at={[0, 0.05, 0]} size={[0.65, 0.1, 0.65]} shape={cylinder} color="#b6b08b" />
  </group>;
}
function Table({ x, z }: { x: number; z: number }) {
  return <group position={[x, 0, z]}>
    <Part at={[0, 0.85, 0]} size={[1.7, 0.12, 0.75]} color="#bc8b59" />
    {[-0.6, 0.6].map((side) => <group key={side}>
      <Part at={[0, 0.48, side]} size={[1.7, 0.1, 0.28]} color="#bc8b59" />
      <Part at={[side, 0.4, 0]} size={[0.1, 0.8, 1.4]} color="#47554c" />
    </group>)}
  </group>;
}
type Props = { trucks: TruckTonight[]; selected: string | null; reset: number; onSelect: (id: string) => void; onReady: () => void; fallback: ReactNode };
function World({ trucks, selected, reset, onSelect, onReady }: Omit<Props, "fallback">) {
  const { locale } = useLocale();
  const textures = useTexture([...PARK_TRUCKS.map((t) => `/trucks/logos/${t.id}.webp`), "/brand/qafla-logo.png"]);
  textures.forEach((texture) => { texture.colorSpace = THREE.SRGBColorSpace; });
  const { size, invalidate } = useThree();
  const controls = useRef<Controls>(null);
  const movement = useRef<{ target: THREE.Vector3; position: THREE.Vector3; zoom: number } | null>(null);
  const announced = useRef(false);
  const lastAngle = useRef(0);
  const readyCallback = useRef(onReady);
  useEffect(() => { readyCallback.current = onReady; }, [onReady]);
  useEffect(() => {
    const truck = parkTruck(selected);
    const target = new THREE.Vector3(truck?.x ?? 0, 0.7, truck?.z ?? 0.5);
    const zoom = truck ? Math.min(size.width / 10, size.height / 10) : Math.min(size.width / 14, size.height / 23);
    movement.current = { target, position: target.clone().add(new THREE.Vector3(3, 24, 22)), zoom };
    invalidate();
  }, [selected, reset, size.width, size.height, invalidate]);
  useFrame(({ camera, gl, invalidate }) => {
    if (movement.current && controls.current) {
      const goal = movement.current;
      const direct = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const factor = direct || !announced.current ? 1 : 0.16;
      camera.position.lerp(goal.position, factor);
      controls.current.target.lerp(goal.target, factor);
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, goal.zoom, factor);
      camera.updateProjectionMatrix();
      controls.current.update();
      if (camera.position.distanceTo(goal.position) < 0.01 && Math.abs(camera.zoom - goal.zoom) < 0.01) movement.current = null;
      else invalidate();
    }
    if (!announced.current) {
      announced.current = true;
      // Wait for the first actual WebGL frame, not just the canvas mount.
      requestAnimationFrame(() => { gl.domElement.dataset.usable = "true"; readyCallback.current(); });
    }
  });
  return <group dispose={null}>
    <color attach="background" args={["#fcf7f1"]} />
    <hemisphereLight args={["#fff8e9", "#a5b5a8", 2.8]} />
    <directionalLight position={[-5, 12, 8]} intensity={2.2} />
    <OrbitControls ref={controls} enablePan={false} enableDamping={false} minAzimuthAngle={-0.65} maxAzimuthAngle={0.75} minPolarAngle={0.55} maxPolarAngle={1.05} minZoom={Math.min(size.width / 20, size.height / 21)} maxZoom={Math.min(size.width / 7, size.height / 7)} onStart={() => { movement.current = null; lastAngle.current = controls.current?.getAzimuthalAngle() ?? 0; }} onChange={() => {
      const control = controls.current;
      if (!control || movement.current || selected) return;
      const angle = control.getAzimuthalAngle();
      if (Math.abs(angle - lastAngle.current) > 0.001) {
        // Orbiting a long plaza increases its projected width; keep its ends in view.
        control.object.zoom = Math.min(control.object.zoom, size.width / (14 + Math.abs(Math.sin(angle)) * 16));
        control.object.updateProjectionMatrix();
        lastAngle.current = angle;
      }
    }} />
    <Part at={[0, -0.3, 0]} size={[12.3, 0.6, 23.8]} color="#c8b99f" />
    <Part at={[0, 0.01, 0]} size={[11.7, 0.04, 23]} color="#e3d5ba" />
    <Part at={[0, 0.05, 0]} size={[2.5, 0.05, 22.5]} color="#f4eade" />
    {Array.from({ length: 18 }, (_, i) => <Part key={i} at={[0, 0.09, i * 1.2 - 10]} size={[2.4, 0.01, 0.035]} color="#d3c4ac" />)}
    {[-5.3, 5.3].flatMap((x) => [-9, -3, 4].map((z) => <Palm key={`${x},${z}`} x={x} z={z} />))}
    {[-1.7, 1.7].flatMap((x) => [-3.2, 3.2].map((z) => <Table key={`${x},${z}`} x={x} z={z} />))}
    {[-1.35, 1.35].flatMap((x) => [-9, -5, 0, 5, 9].map((z) => <group key={`${x},${z}`} position={[x, 0, z]}>
      <Part at={[0, 0.35, 0]} size={[0.07, 0.7, 0.07]} shape={cylinder} color="#303c3a" />
      <mesh position={[0, 0.75, 0]} scale={[0.13, 0.15, 0.13]} geometry={sphere}><meshStandardMaterial color="#ffebae" emissive="#ffd070" emissiveIntensity={1.2} /></mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.42, 16]} /><meshBasicMaterial color="#ffe4a1" transparent opacity={0.3} depthWrite={false} /></mesh>
    </group>))}
    <group position={[0, 0, 10.2]}>
      {[-2, 2].map((x) => <Part key={x} at={[x, 1.4, 0]} size={[0.3, 2.8, 0.3]} color="#f42902" />)}
      <Part at={[0, 2.75, 0]} size={[4.3, 0.65, 0.38]} color="#101010" />
      <Logo texture={textures[6]} at={[0, 2.9, 0.21]} size={1.25} />
      <Html center position={[0, 0.3, 0.5]} style={{ pointerEvents: "none" }}><span dir={locale === "ar" ? "rtl" : "ltr"} className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">{parkWords[locale].entrance}</span></Html>
    </group>
    {PARK_TRUCKS.map((model, i) => {
      const truck = trucks.find((t) => t.id === model.id);
      if (!truck) return null;
      const chosen = selected === model.id;
      return <group key={model.id} position={[model.x, 0, model.z]}>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.1, 1.6, 1]}><circleGeometry args={[1, 24]} /><meshBasicMaterial color={chosen ? "#c6f900" : "#786b55"} transparent opacity={chosen ? 0.9 : 0.15} depthWrite={false} /></mesh>
        <group rotation={[0, model.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} onClick={(event) => { event.stopPropagation(); if (event.delta < 6) onSelect(model.id); }}>
          <Part at={[0, 1.25, 0]} size={[2.8, 1.75, 1.6]} color={model.color} />
          <Part at={[-1.8, 0.98, 0]} size={[0.9, 1.3, 1.6]} color={model.color} />
          <Part at={[-1.8, 1.62, 0]} size={[0.8, 0.1, 1.7]} color="#fff4db" />
          <Part at={[-2.26, 1.3, 0]} size={[0.02, 0.53, 1.25]} color="#354d5c" />
          {[-1.65, 0.95].flatMap((x) => [-0.83, 0.83].map((z) => <group key={`${x},${z}`}>
            <Part at={[x, 0.45, z]} size={[0.43, 0.22, 0.43]} rotation={[Math.PI / 2, 0, 0]} shape={cylinder} color="#252a2b" />
            <Part at={[x, 0.45, z * 1.15]} size={[0.22, 0.03, 0.22]} rotation={[Math.PI / 2, 0, 0]} shape={cylinder} color="#b3b6b1" />
          </group>))}
          <Part at={[0, 1.5, 0.81]} size={[1.65, 0.78, 0.04]} color="#303c3a" />
          <Part at={[0, 1.1, 1]} size={[1.9, 0.09, 0.5]} color="#fff2d9" />
          <Part at={[0, 2.14, 1.04]} size={[2.4, 0.1, 0.85]} rotation={[0.15, 0, 0]} color="#fff2d9" />
          {[-0.9, -0.3, 0.3, 0.9].map((x) => <Part key={x} at={[x, 2.16, 1.04]} size={[0.28, 0.02, 0.85]} rotation={[0.15, 0, 0]} color={model.color} />)}
          <Logo texture={textures[i]} at={[0, 0.7, 0.83]} size={0.65} />
          <Logo texture={textures[i]} at={[0, 1.3, -0.81]} rotation={[0, Math.PI, 0]} size={1.35} />
          <Logo texture={textures[i]} at={[-0.85, 2.14, 0]} rotation={[-Math.PI / 2, 0, 0]} size={0.95} />
          <Part at={[-1.8, 1.3, 0.81]} size={[0.58, 0.48, 0.02]} color="#354d5c" />
          <Part at={[-2.28, 0.55, 0]} size={[0.1, 0.16, 1.7]} color="#e0dfd5" />
          <Roof kind={model.roof} />
        </group>
        {(!selected || chosen) && <Html center position={chosen ? [0, 3.7, 0] : [0, 0.25, 2.3]} zIndexRange={[10, 0]}>
          <button data-truck={model.id} dir={locale === "ar" ? "rtl" : "ltr"} aria-pressed={chosen} onClick={() => onSelect(model.id)}
            className={`min-h-11 w-[86px] rounded-control border px-1 py-1 text-[11px] leading-tight font-bold shadow-sm ${chosen ? "border-ink bg-yellow-punk" : "border-divider bg-snowy-white"}`}>
            {truckName(truck, locale)}
          </button>
        </Html>}
      </group>;
    })}
  </group>;
}
export default function ParkScene(props: Props) {
  const [lost, setLost] = useState(false);
  return lost ? props.fallback : <div className="size-full" dir="ltr">
    <Canvas orthographic frameloop="demand" dpr={[1, 1.5]} camera={{ position: [3, 24.7, 22.5], zoom: 16, near: 0.1, far: 100 }} gl={{ antialias: true, powerPreference: "low-power" }}
      fallback={props.fallback} onCreated={({ gl }) => { gl.domElement.addEventListener("webglcontextlost", () => setLost(true), { once: true }); }}>
      <Suspense fallback={null}><World {...props} /></Suspense>
    </Canvas>
  </div>;
}


