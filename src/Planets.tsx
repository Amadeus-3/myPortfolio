import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DESTINATIONS, type Destination, type DestinationId } from './flight';

// Destination planets as clay toys, in the same language as the head: smooth matte forms, soft warm palette,
// no textures. Each planet carries a few clay spots, sometimes a stripe or ring, and a little themed toy on top.
type PlanetId = Exclude<DestinationId, 'home'>;
type Look = { base: string; spot: string; stripe?: string; ring?: string; seed: number };
const LOOKS: Record<PlanetId, Look> = {
  experience: { base: '#e6a47c', spot: '#d48b62', stripe: '#f3e3cb', seed: 3 },
  projects: { base: '#9fbfcf', spot: '#86aabd', ring: '#f3e3cb', seed: 7 },
  education: { base: '#b8a7d5', spot: '#a290c6', seed: 11 },
  skills: { base: '#a6c8a1', spot: '#8db488', stripe: '#eef0d8', seed: 13 },
  contact: { base: '#f0b8a3', spot: '#e39d86', seed: 17 },
};
const matte = (color: string) => <meshStandardMaterial color={color} roughness={.85} metalness={0}/>;
const noRaycast = () => null;

function random(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- The little toys that sit on top of each planet (built at roughly unit size) ----------
function Briefcase() {
  return <group rotation={[0, -.35, .08]}>
    <mesh position={[0, .38, 0]}><boxGeometry args={[1.2, .76, .46]}/>{matte('#8a5634')}</mesh>
    <mesh position={[0, .52, .235]}><boxGeometry args={[1.21, .07, .02]}/>{matte('#6b4027')}</mesh>
    <mesh position={[0, .55, .24]}><boxGeometry args={[.16, .14, .03]}/>{matte('#eed9a0')}</mesh>
    <mesh position={[0, .8, 0]} rotation={[0, 0, 0]}><torusGeometry args={[.2, .055, 10, 24, Math.PI]}/>{matte('#5e3a24')}</mesh>
  </group>;
}
function Blocks() {
  return <group rotation={[0, .4, 0]}>
    <mesh position={[-.3, .27, 0]}><boxGeometry args={[.54, .54, .54]}/>{matte('#e9a083')}</mesh>
    <mesh position={[.3, .24, .08]} rotation={[0, .5, 0]}><boxGeometry args={[.48, .48, .48]}/>{matte('#eed9a0')}</mesh>
    <mesh position={[-.05, .78, .02]} rotation={[0, .9, 0]}><boxGeometry args={[.46, .46, .46]}/>{matte('#9fbf9f')}</mesh>
  </group>;
}
function GraduationCap() {
  return <group rotation={[0, .5, 0]}>
    <mesh position={[0, .22, 0]}><cylinderGeometry args={[.42, .48, .42, 32]}/>{matte('#33405a')}</mesh>
    <mesh position={[0, .47, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.15, .09, 1.15]}/>{matte('#2b3650')}</mesh>
    <mesh position={[0, .53, 0]}><sphereGeometry args={[.07, 16, 12]}/>{matte('#e9a083')}</mesh>
    <mesh position={[.42, .3, .1]} rotation={[0, 0, .1]}><cylinderGeometry args={[.025, .025, .42, 8]}/>{matte('#e9a083')}</mesh>
    <mesh position={[.43, .07, .1]}><sphereGeometry args={[.07, 16, 12]}/>{matte('#e9a083')}</mesh>
  </group>;
}
function Star() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .26 : .6;
      if (i) shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r); else shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: true, bevelThickness: .09, bevelSize: .08, bevelSegments: 6, curveSegments: 4 });
    g.center(); return g;
  }, []);
  return <mesh geometry={geometry} position={[0, .62, 0]} rotation={[0, .4, 0]}>{matte('#f2d27a')}</mesh>;
}
function SpeechBubble() {
  return <group position={[0, .5, 0]} rotation={[0, -.3, 0]}>
    <mesh scale={[.62, .46, .3]}><sphereGeometry args={[1, 32, 24]}/>{matte('#f3e6d0')}</mesh>
    <mesh position={[-.3, -.42, 0]} rotation={[0, 0, -.55]}><coneGeometry args={[.13, .3, 16]}/>{matte('#f3e6d0')}</mesh>
    {[-.22, 0, .22].map(x => <mesh key={x} position={[x, 0, .29]} scale={[1, 1, .5]}><sphereGeometry args={[.065, 16, 12]}/>{matte('#8a5634')}</mesh>)}
  </group>;
}
const TOYS: Record<PlanetId, () => ReactNode> = { experience: Briefcase, projects: Blocks, education: GraduationCap, skills: Star, contact: SpeechBubble };

function Planet({ destination, reduced, onSelect }: { destination: Destination; reduced: boolean; onSelect: (id: DestinationId) => void }) {
  const id = destination.id as PlanetId, look = LOOKS[id], r = destination.radius, Toy = TOYS[id];
  // Soft clay spots: small spheres half-sunk into the surface, a shade darker than the planet.
  const spots = useMemo(() => {
    const rand = random(look.seed);
    return Array.from({ length: 7 }, () => {
      const direction = new THREE.Vector3(rand() * 2 - 1, rand() * 1.4 - .5, rand() * 2 - 1).normalize();
      const size = r * (.16 + rand() * .16);
      return { position: direction.clone().multiplyScalar(r * .97), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction), size };
    });
  }, [look.seed, r]);
  const body = useRef<THREE.Group>(null), toy = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (reduced) return;
    if (body.current) body.current.rotation.y += delta * .06;
    if (toy.current) { toy.current.position.y = r * .96 + Math.sin(clock.elapsedTime * 1.2 + look.seed) * .06; toy.current.rotation.y = Math.sin(clock.elapsedTime * .4 + look.seed) * .25; }
  });
  const select = (event: { stopPropagation: () => void }) => { event.stopPropagation(); onSelect(destination.id); };
  return <group position={[destination.x, 0, destination.z]} onClick={select}
    onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
    <group ref={body}>
      <mesh><sphereGeometry args={[r, 64, 48]}/>{matte(look.base)}</mesh>
      {spots.map((spot, i) => <mesh key={i} position={spot.position} quaternion={spot.quaternion} scale={[spot.size, spot.size * .45, spot.size]} raycast={noRaycast}>
        <sphereGeometry args={[1, 24, 16]}/>{matte(look.spot)}</mesh>)}
      {look.stripe && <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, .7]} raycast={noRaycast}><torusGeometry args={[r * .99, r * .1, 16, 96]}/>{matte(look.stripe)}</mesh>}
    </group>
    {look.ring && destination.ring && <mesh rotation={[Math.PI / 2 - .22, .1, 0]} scale={[1, 1, .32]} raycast={noRaycast}>
      <torusGeometry args={[(r * 1.35 + destination.ring) / 2, (destination.ring - r * 1.35) / 2, 20, 96]}/>{matte(look.ring)}</mesh>}
    {/* Tipped towards the camera, which looks down from the front, so the toy reads at a glance. */}
    <group ref={toy} position={[0, r * .96, 0]} rotation={[.38, 0, 0]} scale={r * .85}><Toy/></group>
  </group>;
}

export default function Planets({ reduced, onSelect }: { reduced: boolean; onSelect: (id: DestinationId) => void }) {
  return <>{DESTINATIONS.filter(d => d.id !== 'home').map(d => <Planet key={d.id} destination={d} reduced={reduced} onSelect={onSelect}/>)}</>;
}
