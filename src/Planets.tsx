import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DESTINATIONS, type Destination, type DestinationId } from './flight';
import { THEME_PROPS } from './props';
import { AIR } from './content';

// Destination planets as little worlds: a soft clay globe in a cool tone, a thin atmosphere at the edge, its landmark
// model on top and smaller themed models scattered over the upper half (the same ones you see when you land).
/** A planet's colours: its ground, its darker patches (and boulders), its air; optional stripe and ring; whether its
 *  ground is Earth-like (grass, lakes and trees rather than bare rock); and its road colour if not derived from the ground. */
export type PlanetLook = { base: string; spot: string; air: string; stripe?: string; ring?: string; seed: number; earth?: boolean; road?: string };
export const LOOKS: Record<DestinationId, PlanetLook> = {
  // Omar's own planet (in space it's his head) is Earth-like: grass, lakes and trees under a blue sky, grey stones, an
  // asphalt road.
  home: { base: '#4e9a4c', spot: '#8a9098', air: AIR.home, seed: 1, earth: true, road: '#6b7286' },
  experience: { base: '#5866d6', spot: '#4a56bf', air: AIR.experience, stripe: '#c9cdfb', seed: 3 },
  projects: { base: '#3d8fba', spot: '#327aa1', air: AIR.projects, ring: '#cfe0ff', seed: 7 },
  education: { base: '#8a63d2', spot: '#7552bd', air: AIR.education, seed: 11 },
  skills: { base: '#36a59c', spot: '#2c8d86', air: AIR.skills, stripe: '#d4f1ec', seed: 13 },
  contact: { base: '#c05a9a', spot: '#a64b86', air: AIR.contact, seed: 17 },
};
export const matte = (color: string) => <meshStandardMaterial color={color} roughness={.78} metalness={0}/>;
const noRaycast = () => null;
export function random(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const airVertex = `varying vec3 vNormal; varying vec3 vView; void main(){ vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`;
const airFragment = `uniform vec3 tint; uniform float strength; varying vec3 vNormal; varying vec3 vView; void main(){ float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0); gl_FragColor = vec4(tint * rim * strength, rim * strength); }`;
/** A thin atmosphere: brightest at the planet's edge, invisible face-on. */
export function Atmosphere({ radius, color, strength = .55 }: { radius: number; color: string; strength?: number }) {
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color(color) }, strength: { value: strength } }), [color, strength]);
  return <mesh scale={radius} raycast={noRaycast}><sphereGeometry args={[1, 48, 32]}/>
    <shaderMaterial vertexShader={airVertex} fragmentShader={airFragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>;
}
/** A transform that stands an object on a sphere's surface, pointing outward. */
export function onSphere(direction: THREE.Vector3, radius: number) {
  const d = direction.clone().normalize();
  return { position: d.clone().multiplyScalar(radius), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d) };
}

function Planet({ destination, reduced, onSelect }: { destination: Destination; reduced: boolean; onSelect: (id: DestinationId) => void }) {
  const look = LOOKS[destination.id], r = destination.radius, props = THEME_PROPS[destination.id];
  const Landmark = props[0];
  const layout = useMemo(() => {
    const rand = random(look.seed);
    const spots = Array.from({ length: 8 }, () => ({ ...onSphere(new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1), r * .97), size: r * (.14 + rand() * .14) }));
    // Smaller models around the upper half, evenly spread, skipping the very top where the landmark stands.
    const scattered = Array.from({ length: 7 }, (_, i) => {
      const angle = i / 7 * Math.PI * 2 + rand() * .4, height = .3 + rand() * .35;
      const direction = new THREE.Vector3(Math.cos(angle) * Math.sqrt(1 - height * height), height, Math.sin(angle) * Math.sqrt(1 - height * height));
      return { ...onSphere(direction, r * .985), Toy: props[1 + i % (props.length - 1)], spin: rand() * Math.PI * 2, scale: r * (.17 + rand() * .05) };
    });
    return { spots, scattered };
  }, [look.seed, r, props]);
  const body = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (body.current && !reduced) body.current.rotation.y += delta * .05; });
  const select = (event: { stopPropagation: () => void }) => { event.stopPropagation(); onSelect(destination.id); };
  return <group position={[destination.x, 0, destination.z]} onClick={select}
    onPointerOver={() => { document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
    <group ref={body}>
      <mesh><sphereGeometry args={[r, 72, 54]}/>{matte(look.base)}</mesh>
      {layout.spots.map((spot, i) => <mesh key={i} position={spot.position} quaternion={spot.quaternion} scale={[spot.size, spot.size * .4, spot.size]} raycast={noRaycast}>
        <sphereGeometry args={[1, 24, 16]}/>{matte(look.spot)}</mesh>)}
      {look.stripe && <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, .6]} raycast={noRaycast}><torusGeometry args={[r * .99, r * .08, 16, 120]}/>{matte(look.stripe)}</mesh>}
      {layout.scattered.map(({ position, quaternion, Toy, spin, scale }, i) => <group key={i} position={position} quaternion={quaternion}>
        <group rotation={[0, spin, 0]} scale={scale}><Toy/></group></group>)}
      <group position={[0, r * .97, 0]} scale={r * .42}><Landmark/></group>
    </group>
    <Atmosphere radius={r * 1.06} color={look.air}/>
    {look.ring && destination.ring && <mesh rotation={[Math.PI / 2 - .22, .1, 0]} scale={[1, 1, .3]} raycast={noRaycast}>
      <torusGeometry args={[(r * 1.4 + destination.ring) / 2, (destination.ring - r * 1.4) / 2, 20, 120]}/>{matte(look.ring)}</mesh>}
  </group>;
}

export default function Planets({ reduced, onSelect }: { reduced: boolean; onSelect: (id: DestinationId) => void }) {
  return <>{DESTINATIONS.filter(d => d.id !== 'home').map(d => <Planet key={d.id} destination={d} reduced={reduced} onSelect={onSelect}/>)}</>;
}
