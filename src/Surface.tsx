import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DestinationId } from './flight';
import { LOOKS, matte, random } from './Planets';
import { THEME_PROPS } from './props';

// The landing scene: standing on a planet. The ground is a large sphere whose curve falls away to the horizon,
// dotted with the planet's themed models. Each content entry has a glowing beacon where its card floats.
// The whole scene sits far below the solar system, so the two never overlap; the camera jumps between them
// under the warp transition.
export const SURFACE_ORIGIN = new THREE.Vector3(0, -400, 0);
const R = 140; // large enough for a broad, distant horizon from eye level
const noRaycast = () => null;
const LANDMARK: [number, number] = [4.5, -19]; // the planet's big model, standing on the horizon to the right

/** A point on the ground at horizontal (x, z), relative to the scene origin, lifted by `height`. */
function ground(x: number, z: number, height = 0) {
  const y = Math.sqrt(Math.max(0, R * R - x * x - z * z)) - R;
  const normal = new THREE.Vector3(x, y + R, z).normalize();
  return { point: new THREE.Vector3(x, y, z).addScaledVector(normal, height), normal };
}
const UP = new THREE.Vector3(0, 1, 0);
const upright = (normal: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(UP, normal);

/** The camera on the surface: standing on the ground looking out to the horizon, which sits a little above the middle
 *  of the screen so the title has dark sky behind it. It drifts by orbiting the beacons, so the cards barely move
 *  while the horizon and sky slide past behind them. Positions are world space. */
export function surfaceCamera(time: number, compact: boolean, reduced: boolean) {
  const sway = reduced ? 0 : Math.sin(time * .07), bob = reduced ? 0 : Math.sin(time * .11) * .08;
  const position = new THREE.Vector3(sway * .45, (compact ? 4 : 3.4) + bob, compact ? 9 : 8).add(SURFACE_ORIGIN);
  const target = new THREE.Vector3(-sway * .22, compact ? .71 : .4, compact ? -.44 : -1.54).add(SURFACE_ORIGIN);
  return { position, target, fov: compact ? 58 : 48 };
}

export type Beacon = { point: THREE.Vector3; normal: THREE.Vector3; top: THREE.Vector3 };
export type SurfaceLayout = { beacons: Beacon[]; anchors: THREE.Vector3[]; head: THREE.Vector3; eye: THREE.Vector3 };
/** Where everything goes for this window. The cards are laid out in screen space first (a centred row, sized like
 *  .surface-card) and each beacon is placed on the ground right below its card, so the cards never run into the title
 *  or off the edge whatever the window shape. Beacons are relative to the scene origin; anchors are world space. */
export function surfaceLayout(count: number, width: number, height: number, compact: boolean): SurfaceLayout {
  const pose = surfaceCamera(0, compact, true), camera = new THREE.PerspectiveCamera(pose.fov, width / height, .1, 500);
  camera.position.copy(pose.position).sub(SURFACE_ORIGIN);
  camera.lookAt(pose.target.clone().sub(SURFACE_ORIGIN));
  camera.updateMatrixWorld();
  const eye = camera.position, forward = camera.getWorldDirection(new THREE.Vector3()), centre = new THREE.Vector3(0, -R, 0);
  const ray = (sx: number, sy: number) => new THREE.Vector3(sx * 2 - 1, 1 - sy * 2, .5).unproject(camera).sub(eye).normalize();
  const step = (Math.min(250, width * .27) + (compact ? 16 : 48)) / width; // card width + gap, as a fraction of the screen
  const [beaconY, cardY] = compact ? [.64, .52] : height < 760 ? [.8, .68] : [.77, .64]; // short windows: keep cards clear of the title
  const beacons = Array.from({ length: count }, (_, i) => {
    const sx = .5 + (i - (count - 1) / 2) * step, down = ray(sx, beaconY);
    const oc = eye.clone().sub(centre), b = oc.dot(down), t = -b - Math.sqrt(Math.max(0, b * b - oc.lengthSq() + R * R));
    const point = eye.clone().addScaledVector(down, t), normal = point.clone().sub(centre).normalize();
    const up = ray(sx, cardY), top = eye.clone().addScaledVector(up, point.clone().sub(eye).dot(forward) / up.dot(forward));
    return { point, normal, top };
  });
  const head = eye.clone().addScaledVector(ray(compact ? .2 : .78, compact ? .285 : .2), 82);
  return { beacons, anchors: beacons.map(b => b.top.clone().add(SURFACE_ORIGIN)), head, eye: eye.clone() };
}

function Beacon({ spot, index, reduced }: { spot: Beacon; index: number; reduced: boolean }) {
  const ring = useRef<THREE.Mesh>(null), beam = useRef<THREE.MeshBasicMaterial>(null);
  const { pad, lean, length } = useMemo(() => {
    const rise = spot.top.clone().sub(spot.point);
    return { pad: upright(spot.normal), lean: new THREE.Quaternion().setFromUnitVectors(UP, rise.clone().normalize()), length: rise.length() };
  }, [spot]);
  useFrame(({ clock }) => {
    if (reduced) return;
    const pulse = .5 + .5 * Math.sin(clock.elapsedTime * 2 + index);
    if (ring.current) ring.current.scale.setScalar(1 + pulse * .25);
    if (beam.current) beam.current.opacity = .1 + pulse * .08;
  });
  return <group position={spot.point}>
    <group quaternion={pad}>
      <mesh position={[0, .04, 0]}><cylinderGeometry args={[.36, .42, .07, 40]}/><meshStandardMaterial color="#1e2150" roughness={.5}/></mesh>
      <mesh position={[0, .09, 0]}><cylinderGeometry args={[.23, .23, .02, 40]}/><meshBasicMaterial color="#9b8cff"/></mesh>
      <mesh ref={ring} position={[0, .1, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.33, .36, 48]}/><meshBasicMaterial color="#b9afff" transparent opacity={.7} side={THREE.DoubleSide}/></mesh>
    </group>
    {/* A soft beam from the pad up to the card it projects. */}
    <group quaternion={lean}><mesh position={[0, length / 2, 0]} raycast={noRaycast}><cylinderGeometry args={[.025, .17, length, 20, 1, true]}/>
      <meshBasicMaterial ref={beam} color="#9b8cff" transparent opacity={.14} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/></mesh></group>
  </group>;
}

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}`;
/** The ground: matte regolith, mottled with darker patches and fine grain so it doesn't read as plastic. */
function useGround(base: string, spot: string) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: .95, metalness: 0 }), patch = new THREE.Color(spot).multiplyScalar(.85);
    m.onBeforeCompile = shader => {
      shader.uniforms.patchTint = { value: patch };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vGround; uniform vec3 patchTint;${noise}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float broad = fbm(vGround * .16 + 3.0), grain = fbm(vGround * 2.2);
          diffuseColor.rgb = mix(diffuseColor.rgb, patchTint, smoothstep(.38, .72, broad) * .75);
          diffuseColor.rgb *= .84 + .3 * grain;`);
    };
    return m;
  }, [base, spot]);
  return material;
}
const glowVertex = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const glowFragment = `uniform vec3 tint; uniform float horizon; varying vec3 vDir;
void main(){ float e = max(asin(clamp(normalize(vDir).y, -1.0, 1.0)) - horizon, 0.0);
  gl_FragColor = vec4(tint * (exp(-e * 14.0) * .5 + exp(-e * 3.2) * .1), 1.0); }`;
/** A thin band of lit air along the horizon, fading up into black space, as seen from the ground. */
function HorizonGlow({ eye, color }: { eye: THREE.Vector3; color: string }) {
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color(color) }, horizon: { value: -Math.acos(R / (R + eye.y)) } }), [color, eye]);
  return <mesh position={eye} scale={180} raycast={noRaycast} renderOrder={-1}><sphereGeometry args={[1, 64, 48]}/>
    <shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} uniforms={uniforms} side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>;
}

function SkyHead({ character, at, reduced }: { character: THREE.Group; at: THREE.Vector3; reduced: boolean }) {
  const head = useMemo(() => {
    const copy = character.clone(true); // far beyond the haze, so it keeps its own colours
    copy.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => Object.assign(m.clone(), { fog: false })) : Object.assign(mesh.material.clone(), { fog: false }); });
    return copy;
  }, [character]), group = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (group.current && !reduced) group.current.rotation.y += delta * .08; });
  return <group position={at} scale={1.7} rotation={[.05, -.25, 0]}><group ref={group}><primitive object={head}/></group></group>;
}

export default function Surface({ id, layout: spots, character, reduced }: { id: DestinationId; layout: SurfaceLayout; character: THREE.Group; reduced: boolean }) {
  const look = LOOKS[id], props = THEME_PROPS[id], Landmark = props[0], soil = useGround(look.base, look.spot);
  // Scenery is placed from a fixed seed and kept off the strip where the beacons stand (and the ground right in front
  // of the camera), so resizing the window never reshuffles it.
  const layout = useMemo(() => {
    const rand = random(look.seed * 31 + 5);
    const open = (x: number, z: number) => !(Math.abs(x) < 7.5 && z > -1.5 && z < 5.5) && !(Math.abs(x) < 3.5 && z >= 5.5);
    const models: { at: ReturnType<typeof ground>; Toy: typeof props[number]; scale: number; spin: number }[] = [];
    for (let tries = 0; models.length < 22 && tries < 400; tries++) {
      const x = (rand() - .5) * 36, z = -21 + rand() * 25;
      if (!open(x, z) || Math.hypot(x - LANDMARK[0], z - LANDMARK[1]) < 4.5 || models.some(m => Math.hypot(m.at.point.x - x, m.at.point.z - z) < 2.3)) continue;
      models.push({ at: ground(x, z), Toy: props[models.length % props.length], scale: (.85 + rand() * .7 + Math.max(0, -z) * .015) * (x < -4 && z < -9 ? .7 : 1), spin: rand() * Math.PI * 2 });
    }
    const rocks = Array.from({ length: 52 }, () => { const x = (rand() - .5) * 40, z = -24 + rand() * 32; return { at: ground(x, z, -.05), size: .12 + rand() * .32, spin: rand() * 6 }; })
      .filter(({ at }) => !(Math.abs(at.point.x) < 7.5 && at.point.z > .5 && at.point.z < 4.5));
    const craters = Array.from({ length: 7 }, () => { const x = (rand() - .5) * 34, z = -22 + rand() * 22; return { at: ground(x, z, -.02), size: 1 + rand() * 1.8 }; });
    return { models, rocks, craters };
  }, [look.seed, props]);
  return <group position={SURFACE_ORIGIN}>
    <mesh position={[0, -R, 0]} material={soil}><sphereGeometry args={[R, 256, 192]}/></mesh>
    <HorizonGlow eye={spots.eye} color={look.air}/>
    {layout.craters.map(({ at, size }, i) => <group key={`c${i}`} position={at.point} quaternion={upright(at.normal)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, .35]}><torusGeometry args={[size, size * .16, 10, 40]}/>{matte(look.spot)}</mesh>
      <mesh scale={[size * .9, .04, size * .9]}><sphereGeometry args={[1, 32, 12]}/>{matte(look.spot)}</mesh>
    </group>)}
    {layout.rocks.map(({ at, size, spin }, i) => <mesh key={`r${i}`} position={at.point} rotation={[spin, spin * 2, 0]} scale={size}><dodecahedronGeometry args={[1, 0]}/>{matte(look.spot)}</mesh>)}
    {layout.models.map(({ at, Toy, scale, spin }, i) => <group key={`m${i}`} position={at.point} quaternion={upright(at.normal)}>
      <group rotation={[0, spin, 0]} scale={scale}><Toy/></group></group>)}
    {/* The planet's landmark, standing tall in the distance. */}
    {(() => { const at = ground(...LANDMARK); return <group position={at.point} quaternion={upright(at.normal)} scale={3.8}><Landmark/></group>; })()}
    {spots.beacons.map((spot, i) => <Beacon key={`b${i}`} spot={spot} index={i} reduced={reduced}/>)}
    <SkyHead character={character} at={spots.head} reduced={reduced}/>
  </group>;
}
