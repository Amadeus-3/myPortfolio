import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DestinationId } from './flight';
import type { Controls } from './World';
import { LOOKS, matte } from './Planets';
import { THEME_PROPS } from './props';
import { LANDING, ROAD_HALF_WIDTH, ROCKET_PAD, bayOf, boundsFor, makeRoute, nearestOnRoad, obstaclesFor, pointAt, scatter, stepRover, type Rover as RoverState } from './route';
import { Rocket, Rover } from './vehicles';

// The landing scene. The rocket makes a powered descent from high above the planet and lands on its pad; a door in its
// side swings down into a ramp and the rover drives out, and from there it's yours to drive. A painted road leads from
// the rocket past every stop, with a light running along it towards the next stop you haven't seen. Each stop is a
// station beside the road; pull up next to one and press E to unfold its board with that entry's content. The ground is a large sphere whose curve falls away to the horizon. The scene sits far below the solar
// system; the camera jumps between the two under the entry haze.
export const SURFACE_ORIGIN = new THREE.Vector3(0, -400, 0);
const R = 140;
const CENTRE = new THREE.Vector3(0, -R, 0).add(SURFACE_ORIGIN);
const UP = new THREE.Vector3(0, 1, 0);
const noRaycast = () => null;
const upright = (normal: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(UP, normal);

/** Landing timeline, in seconds. The descent ends at touchdown; then the door opens into a ramp, the rover drives out
 *  and down it, and is then free to go. */
export const DESCENT = 4.4;
const DOOR_OPEN = [.2, .95], ROLL_OUT = [1, 2.7], DRIVE_FROM = 2.8;
/** The door in the rocket's side, in world units: its hinge height, length and the angle at which it rests on the ground. */
const DOOR = { hinge: .6, length: 1.25, arc: 1.6, body: .3 };
const DOOR_ANGLE = Math.acos(-DOOR.hinge / DOOR.length), DOOR_REACH = DOOR.length * Math.sin(DOOR_ANGLE);
const ALTITUDE = 75, ROCKET_SCALE = 2.4, ROCKET_FOOT = .756 * ROCKET_SCALE, ROVER_SCALE = .72;
/** Altitude of the rocket during the descent: fast at first, then a long braking burn that kills the speed at touchdown. */
const altitudeAt = (t: number) => t >= DESCENT ? 0 : ALTITUDE * Math.pow(1 - t / DESCENT, 2.4);
const descentSpeed = (t: number) => t >= DESCENT ? 0 : ALTITUDE * 2.4 / DESCENT * Math.pow(1 - t / DESCENT, 1.4);
/** The hovering board: its size in world units (taller on phones) and how high its bottom edge floats. */
const BOARD = { wide: { w: 4.6, h: 3 }, tall: { w: 3.2, h: 4 } }, BOARD_LIFT = 2.5;
/** On-screen width of the board's HTML (keep in step with .board in style.css), so the camera can frame it 1:1. */
const boardPixels = (width: number, compact: boolean) => compact ? width * .88 : Math.min(700, Math.max(400, width * .44));

/** A point on the ground at horizontal (x, z), relative to the scene origin, lifted by `height`. */
function ground(x: number, z: number, height = 0) {
  const y = Math.sqrt(Math.max(0, R * R - x * x - z * z)) - R;
  const normal = new THREE.Vector3(x, y + R, z).normalize();
  return { point: new THREE.Vector3(x, y, z).addScaledVector(normal, height), normal };
}

/** The open board the camera squares up to: where to aim (the board, nudged to sit in the free part of the screen), the
 *  direction it faces, its up, and how far back to stand. */
export type Focus = { aim: THREE.Vector3; facing: THREE.Vector3; up: THREE.Vector3; distance: number };
/** What the camera follows on the surface, written by the scene every frame (world space). */
export type SurfaceRig = {
  rover: THREE.Vector3; normal: THREE.Vector3; forward: THREE.Vector3; speed: number;
  rocket: THREE.Vector3; altitude: number; time: number; shake: number;
  /** The open board, when the rover has stopped beside it: the camera turns to face it. */
  focus: Focus | null;
};
export function landingRig(): SurfaceRig {
  const start = ground(LANDING.x, LANDING.z), rocket = ground(ROCKET_PAD.x, ROCKET_PAD.z, ALTITUDE + ROCKET_FOOT);
  return { rover: start.point.add(SURFACE_ORIGIN), normal: start.normal, forward: new THREE.Vector3(0, 0, -1), speed: 0, rocket: rocket.point.add(SURFACE_ORIGIN), altitude: ALTITUDE, time: 0, shake: 0, focus: null };
}
/** Camera on the surface. During the descent it rides down beside the rocket, looking down at the landing site, and
 *  drops back to the ground to watch the touchdown; it watches the rover being lowered; then it follows the rover from
 *  behind, or squares up to an open board so its text reads at full size. */
export function surfaceView(rig: SurfaceRig, heading: THREE.Vector3, compact: boolean) {
  const landing = ground(LANDING.x, LANDING.z), padTop = ground(ROCKET_PAD.x, ROCKET_PAD.z, 1.4).point.add(SURFACE_ORIGIN);
  // Watching from the side the rocket's door faces, so you see it open and the rover drive out.
  const watchFrom = landing.point.clone().add(SURFACE_ORIGIN).add(new THREE.Vector3(compact ? 5.5 : 8, 3.2, compact ? 7 : 3.5));
  if (rig.time < DESCENT) {
    const ride = THREE.MathUtils.smoothstep(rig.altitude, 4, 26);
    const beside = rig.rocket.clone().add(new THREE.Vector3(compact ? 6 : 9, 7, compact ? 17 : 15)), below = rig.rocket.clone().add(new THREE.Vector3(0, -5, 0));
    const watch = padTop.clone(); watch.y = Math.max(padTop.y, rig.rocket.y - 2.2);
    return { position: watchFrom.lerp(beside, ride), target: watch.lerp(below, ride), up: landing.normal, fov: compact ? 62 : 52 };
  }
  if (rig.time < DESCENT + DRIVE_FROM + .25) return { position: watchFrom, target: rig.rover.clone().lerp(padTop, .35), up: landing.normal, fov: compact ? 62 : 52 };
  if (rig.focus) {
    const { aim, facing, up, distance } = rig.focus;
    return { position: aim.clone().addScaledVector(facing, distance), target: aim.clone(), up, fov: compact ? 60 : 50 };
  }
  const n = rig.normal, f = heading, right = new THREE.Vector3().crossVectors(f, n).normalize();
  const position = rig.rover.clone().addScaledVector(f, compact ? -8.6 : -7.4).addScaledVector(n, compact ? 4.2 : 3.3).addScaledVector(right, .5);
  return { position, target: rig.rover.clone().addScaledVector(f, 2.2).addScaledVector(n, .45), up: n, fov: compact ? 60 : 50 };
}

/** Additive glow that is brightest facing the camera and fades to nothing at its silhouette, so it reads as light. */
function Glow({ color, material }: { color: string; material: React.RefObject<THREE.ShaderMaterial | null> }) {
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color(color) }, opacity: { value: 0 } }), [color]);
  return <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}
    vertexShader={`varying float vFacing; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vFacing = max(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)), 0.0); gl_Position = projectionMatrix * mv; }`}
    fragmentShader={`uniform vec3 tint; uniform float opacity; varying float vFacing; void main(){ gl_FragColor = vec4(tint * pow(vFacing, 2.2) * opacity, 1.0); }`}/>;
}

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=.5;mat2 turn=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*noise(p);p=turn*p;a*=.5;}return v;}`;
/** Height of the rock surface, roughly 0–1: slabs of rock about two units across (each a little higher or lower than
 *  its neighbours) with cracks between them, broad lumps and grit; also how much of a crack each point is. `detail`
 *  fades the finest layers out with distance, so they never shimmer. */
const rock = `
vec2 hash2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
vec3 plates(vec2 p){
  vec2 i=floor(p),f=fract(p);float d1=8.0,d2=8.0,id=0.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),r=g+hash2(i+g)-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;id=hash(i+g);}else if(d<d2)d2=d;}
  return vec3(sqrt(d1),sqrt(d2),id);
}
float rockHeight(vec2 p,float detail,out float crack){
  vec3 c=plates(p*.42+fbm(p*.35)*.9);
  float edge=c.y-c.x;crack=1.0-smoothstep(.0,.14+fwidth(edge)*2.0,edge); // widened by its own on-screen size, so crack edges never stair-step
  float tilt=c.z*.12*smoothstep(.0,.3,edge); // each slab a little higher or lower, meeting its neighbours at the crack
  return fbm(p*.3)*.5+tilt-crack*crack*(.06+.1*detail)+detail*fbm(p*2.4+5.0)*.12;
}`;
/** Earth-like land: how far each point is from the nearest lake's shore (negative in the water; lakes are centre x, z
 *  and radius, shorelines roughened with noise), and the gentle relief of the land. */
const land = `
uniform vec3 lakes[6];
float shoreAt(vec2 p){
  float s=1e3;
  for(int i=0;i<6;i++){if(lakes[i].z<=0.0)continue;s=min(s,(length(p-lakes[i].xy)-lakes[i].z)/lakes[i].z+(fbm(p*.45+float(i)*3.1)-.5)*.3);}
  return s;
}
float landHeight(vec2 p,float detail,float shore){return (fbm(p*.22)*.35+detail*noise(p*6.0)*.07)*smoothstep(-.02,.15,shore);}`;
/** The ground. Rocky planets: bare rock in the planet's colour, its lumps, slabs, cracks and grit shaded in (dark in the
 *  crevices, light on the tops) and bent into its lighting, with pebbles and drifts of paler dust. Earth-like planets:
 *  meadows of grass in several greens, dry and bare patches, and lakes with sandy shores and glossy water. Either way
 *  no geometry moves, so the road, stations and models still sit exactly on it. */
function useGround({ base, spot, earth }: { base: string; spot: string; earth?: boolean }, lakes: { x: number; z: number; r: number }[]) {
  return useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: .96, metalness: 0 });
    const water = Array.from({ length: 6 }, (_, i) => lakes[i] ? new THREE.Vector3(lakes[i].x, lakes[i].z, lakes[i].r) : new THREE.Vector3());
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { patchTint: { value: new THREE.Color(spot).multiplyScalar(.85) }, crackTint: { value: new THREE.Color(spot).multiplyScalar(.45) }, earth: { value: earth ? 1 : 0 }, lakes: { value: water } });
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vGround; uniform vec3 patchTint, crackTint; uniform float earth;${noise}${rock}${land}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float detail = 1.0 - smoothstep(14.0, 48.0, length(vViewPosition)), water = 0.0, shore = 1.0;
          if (earth > .5) {
            shore = shoreAt(vGround);
            water = 1.0 - smoothstep(-.03, .0, shore);
            float sand = (1.0 - smoothstep(.0, .14, shore)) * (1.0 - water);
            float meadow = fbm(vGround * .12 + 1.0), dryness = smoothstep(.52, .74, fbm(vGround * .2 + 7.0)), bare = smoothstep(.64, .8, fbm(vGround * .33 + 13.0));
            vec3 grass = mix(vec3(.07, .26, .06), vec3(.2, .45, .1), meadow);
            grass = mix(grass, vec3(.42, .46, .14), dryness * .5);
            grass = mix(grass, vec3(.3, .21, .12), bare * .6);
            grass *= mix(.92, .82 + .32 * noise(vGround * 8.0), detail);
            vec3 sea = mix(vec3(.08, .27, .5), vec3(.22, .5, .68), smoothstep(-.4, -.02, shore));
            diffuseColor.rgb = mix(mix(grass, vec3(.8, .72, .52), sand), sea, water);
          } else {
            float crack, height = rockHeight(vGround, detail, crack), patchy = smoothstep(.38, .72, fbm(vGround * .16 + 3.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, patchTint, patchy * .7);
            diffuseColor.rgb *= .6 + .72 * height;
            diffuseColor.rgb = mix(diffuseColor.rgb, crackTint, crack * crack * .55);
            diffuseColor.rgb *= 1.0 - detail * smoothstep(.8, .86, noise(vGround * 7.0)) * .25;
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.14 + .015, smoothstep(.55, .78, fbm(vGround * .5 + 9.0)) * .4);
          }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .16, water); // still water shines')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 at = -vViewPosition, dx = dFdx(at), dy = dFdy(at);
            float crack, bump = earth > .5 ? landHeight(vGround, detail, shore) * .6 : rockHeight(vGround, detail, crack) * .7;
            vec3 r1 = cross(dy, normal), r2 = cross(normal, dx);
            float det = dot(dx, r1);
            normal = normalize(abs(det) * normal - sign(det) * (dFdx(bump) * r1 + dFdy(bump) * r2));
          }`);
    };
    return m;
  }, [base, spot, earth, lakes]);
}

const glowVertex = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const glowFragment = `uniform vec3 tint; uniform vec3 up; uniform float horizon, sky; varying vec3 vDir;
void main(){ float e = max(asin(clamp(dot(normalize(vDir), up), -1.0, 1.0)) - horizon, 0.0);
  gl_FragColor = vec4(tint * (exp(-e * 14.0) * .5 + exp(-e * 3.2) * .1 + sky * exp(-e * 2.2) * .34), 1.0); }`;
/** A thin band of lit air along the horizon, fading up into black space (on an Earth-like planet, a broad blue sky
 *  fading to a starry twilight overhead). It travels with the camera, always measured from the ground right below it,
 *  so it also works from high up during the descent. World space. */
function HorizonGlow({ color, sky = false }: { color: string; sky?: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color(color) }, up: { value: new THREE.Vector3(0, 1, 0) }, horizon: { value: -.2 }, sky: { value: sky ? 1 : 0 } }), [color, sky]);
  useFrame(({ camera }) => {
    if (!mesh.current) return;
    mesh.current.position.copy(camera.position);
    const fromCentre = camera.position.clone().sub(CENTRE);
    uniforms.up.value.copy(fromCentre).normalize();
    uniforms.horizon.value = -Math.acos(Math.min(1, R / fromCentre.length()));
  });
  return <mesh ref={mesh} scale={180} raycast={noRaycast} renderOrder={-1} frustumCulled={false}><sphereGeometry args={[1, 64, 48]}/>
    <shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} uniforms={uniforms} side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>;
}

/** Omar's head hanging in the sky like a moon, up and to the right of wherever the camera looks. After touchdown it
 *  rises from the horizon and fades in, rather than appearing all at once. */
function SkyHead({ character, rig, reduced }: { character: THREE.Group; rig: React.RefObject<SurfaceRig>; reduced: boolean }) {
  const { head, skins } = useMemo(() => {
    const copy = character.clone(true), skins: THREE.Material[] = [];
    // Its own materials: no haze (it's far beyond it) and see-through while it fades in.
    const own = (m: THREE.Material) => { const c = Object.assign(m.clone(), { fog: false, transparent: true, opacity: 0 }); skins.push(c); return c; };
    copy.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material); });
    return { head: copy, skins };
  }, [character]);
  const group = useRef<THREE.Group>(null), spin = useRef<THREE.Group>(null);
  const facing = useRef(new THREE.Vector3(0, 0, -1)), yaw = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    const rise = reduced ? 1 : THREE.MathUtils.smoothstep(rig.current.time, DESCENT + .5, DESCENT + 2.8);
    group.current.visible = rise > .002;
    for (const skin of skins) skin.opacity = rise;
    const up = camera.position.clone().sub(CENTRE).normalize(), look = camera.getWorldDirection(new THREE.Vector3());
    const flat = look.addScaledVector(up, -look.dot(up)).normalize();
    facing.current.lerp(flat, rise < .05 ? 1 : 1 - Math.exp(-3 * Math.min(delta, .05))).normalize(); // follows closely, so it stays clear of the title
    const height = THREE.MathUtils.lerp(-.17, -.035, 1 - (1 - rise) * (1 - rise)); // from just below the horizon to its place
    const direction = facing.current.clone().applyQuaternion(yaw.setFromAxisAngle(up, -.32)).addScaledVector(up, height).normalize();
    group.current.position.copy(camera.position).addScaledVector(direction, 84);
    if (spin.current && !reduced) spin.current.rotation.y += delta * .08;
  });
  return <group ref={group} scale={1.8}><group ref={spin} rotation={[.05, -.25, 0]}><primitive object={head}/></group></group>;
}

/** Low-poly trees, round-topped or conifers in varied greens, each standing on the ground: three draw calls for all. */
function Trees({ trees }: { trees: { x: number; z: number; size: number; conifer: boolean; shade: number; spin: number }[] }) {
  const parts = useMemo(() => {
    const trunks: THREE.Matrix4[] = [], crowns: { m: THREE.Matrix4; c: THREE.Color }[] = [], cones: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    for (const t of trees) {
      const g = ground(t.x, t.z), turn = upright(g.normal).multiply(new THREE.Quaternion().setFromAxisAngle(UP, t.spin)), at = (h: number) => g.point.clone().addScaledVector(g.normal, h * t.size);
      trunks.push(new THREE.Matrix4().compose(at(t.conifer ? .2 : .32), turn, new THREE.Vector3(t.size, t.size * (t.conifer ? .55 : .9), t.size)));
      if (t.conifer) cones.push({ m: new THREE.Matrix4().compose(at(1.02), turn, new THREE.Vector3().setScalar(t.size)), c: new THREE.Color('#2c6a3a').lerp(new THREE.Color('#47884f'), t.shade) });
      else crowns.push({ m: new THREE.Matrix4().compose(at(1.02), turn, new THREE.Vector3(t.size, t.size * .9, t.size)), c: new THREE.Color('#3f8a3c').lerp(new THREE.Color('#7ab352'), t.shade) });
    }
    return { trunks, crowns, cones };
  }, [trees]);
  const geometries = useMemo(() => ({ trunk: new THREE.CylinderGeometry(.06, .09, .7, 7), crown: new THREE.IcosahedronGeometry(.5, 1), cone: new THREE.ConeGeometry(.46, 1.3, 8) }), []);
  const materials = useMemo(() => ({ bark: new THREE.MeshStandardMaterial({ color: '#7a5636', roughness: .9 }), leaves: new THREE.MeshStandardMaterial({ roughness: .8, flatShading: true }) }), []);
  const crown = useRef<THREE.InstancedMesh>(null), cone = useRef<THREE.InstancedMesh>(null), trunk = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    parts.trunks.forEach((m, i) => trunk.current?.setMatrixAt(i, m));
    parts.crowns.forEach(({ m, c }, i) => { crown.current?.setMatrixAt(i, m); crown.current?.setColorAt(i, c); });
    parts.cones.forEach(({ m, c }, i) => { cone.current?.setMatrixAt(i, m); cone.current?.setColorAt(i, c); });
    for (const mesh of [trunk.current, crown.current, cone.current]) if (mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); }
  }, [parts]);
  return <>
    <instancedMesh ref={trunk} args={[geometries.trunk, materials.bark, parts.trunks.length]} raycast={noRaycast}/>
    <instancedMesh ref={crown} args={[geometries.crown, materials.leaves, Math.max(1, parts.crowns.length)]} count={parts.crowns.length} raycast={noRaycast}/>
    <instancedMesh ref={cone} args={[geometries.cone, materials.leaves, Math.max(1, parts.cones.length)]} count={parts.cones.length} raycast={noRaycast}/>
  </>;
}

/** Many copies of one mesh standing on the ground, in a single draw call. */
function Scattered({ items, geometry, color }: { items: THREE.Matrix4[]; geometry: THREE.BufferGeometry; color: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true }), [color]);
  useLayoutEffect(() => { if (!mesh.current) return; items.forEach((m, i) => mesh.current!.setMatrixAt(i, m)); mesh.current.instanceMatrix.needsUpdate = true; mesh.current.computeBoundingSphere(); }, [items]);
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} raycast={noRaycast}/>;
}

const DUST = 220;
/** Regolith blown out from under the rocket's plume: particles thrown out low across the ground, slowing, settling. */
function Dust({ rate, burst, at, color }: { rate: React.RefObject<number>; burst: React.RefObject<number>; at: ReturnType<typeof ground>; color: string }) {
  const points = useRef<THREE.Points>(null);
  const data = useMemo(() => ({ pos: new Float32Array(DUST * 3), vel: new Float32Array(DUST * 3), life: new Float32Array(DUST), size: new Float32Array(DUST), cursor: 0, carry: 0 }), []);
  const frame = useMemo(() => { const up = at.normal.clone(), a = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x).normalize(); return { up, a, b: new THREE.Vector3().crossVectors(up, a) }; }, [at]);
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color(color) } }), [color]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05), { up, a, b } = frame;
    data.carry += rate.current * dt;
    let spawn = Math.floor(data.carry) + burst.current; data.carry -= Math.floor(data.carry); burst.current = 0;
    while (spawn-- > 0) {
      const i = data.cursor++ % DUST, angle = Math.random() * Math.PI * 2, out = .5 + Math.random() * .9, push = 4.5 + Math.random() * 7.5, lift = .3 + Math.random() * 1.6;
      const c = Math.cos(angle), s = Math.sin(angle), dx = a.x * c + b.x * s, dy = a.y * c + b.y * s, dz = a.z * c + b.z * s;
      data.pos.set([at.point.x + dx * out + up.x * .12, at.point.y + dy * out + up.y * .12, at.point.z + dz * out + up.z * .12], i * 3);
      data.vel.set([dx * push + up.x * lift, dy * push + up.y * lift, dz * push + up.z * lift], i * 3);
      data.life[i] = 1; data.size[i] = .6 + Math.random() * 1.2;
    }
    const drag = Math.exp(-1.7 * dt);
    for (let i = 0; i < DUST; i++) {
      if (data.life[i] <= 0) continue;
      data.life[i] = Math.max(0, data.life[i] - dt / 2.1);
      for (let j = 0; j < 3; j++) { const k = i * 3 + j; data.vel[k] = data.vel[k] * drag - up.getComponent(j) * .5 * dt; data.pos[k] += data.vel[k] * dt; }
    }
    const g = points.current?.geometry; if (g) { g.attributes.position.needsUpdate = true; g.attributes.life.needsUpdate = true; g.attributes.size.needsUpdate = true; }
  });
  return <points ref={points} frustumCulled={false} raycast={noRaycast}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]}/><bufferAttribute attach="attributes-life" args={[data.life, 1]}/><bufferAttribute attach="attributes-size" args={[data.size, 1]}/></bufferGeometry>
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`attribute float life; attribute float size; varying float vLife; void main(){ vLife = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = life > 0.0 ? clamp(size * (1.0 + (1.0 - life) * 2.6) * 240.0 / -mv.z, 0.0, 96.0) : 0.0; }`}
      fragmentShader={`uniform vec3 tint; varying float vLife; void main(){ float r = length(gl_PointCoord - .5) * 2.0; float a = (1.0 - smoothstep(.2, 1.0, r)) * vLife * (1.0 - vLife) * 2.2; gl_FragColor = vec4(tint, a * .6); }`}/>
  </points>;
}

/** A stop: a plinth beside the road with one of the planet's models turning slowly above it, and a projector beam up
 *  to where its board opens. Where to pull in is painted on the road (see Road). */
function Station({ at, Toy, active, reduced }: { at: ReturnType<typeof ground>; Toy: React.ComponentType; active: boolean; reduced: boolean }) {
  const model = useRef<THREE.Group>(null), beam = useRef<THREE.MeshBasicMaterial>(null), ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, delta) => {
    if (model.current && !reduced) model.current.rotation.y += delta * .35;
    const pulse = reduced ? .5 : .5 + .5 * Math.sin(clock.elapsedTime * 2.2);
    if (beam.current) beam.current.opacity = active ? .12 + pulse * .06 : .045;
    if (ring.current) ring.current.scale.setScalar(active ? 1 + pulse * .05 : 1);
  });
  return <>
    <group position={at.point} quaternion={upright(at.normal)}>
      <mesh position={[0, .13, 0]}><cylinderGeometry args={[1.1, 1.25, .26, 40]}/><meshStandardMaterial color="#1e2150" roughness={.6}/></mesh>
      <mesh ref={ring} position={[0, .27, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.88, .98, 48]}/><meshBasicMaterial color={active ? '#c9c0ff' : '#7e6aff'}/></mesh>
      <group ref={model} position={[0, .36, 0]} scale={1.3}><Toy/></group>
      <mesh position={[0, BOARD_LIFT / 2 + .15, 0]} raycast={noRaycast}><cylinderGeometry args={[.5, .95, BOARD_LIFT - .1, 32, 1, true]}/>
        <meshBasicMaterial ref={beam} color="#9b8cff" transparent opacity={.045} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending}/></mesh>
    </group>
  </>;
}

/** The road, painted so it's easy to follow: a dark strip with glowing edge lines, a dashed centre line, chevrons
 *  pointing on towards the later stops, and each stop's number on the road at its bay. A light runs along the centre
 *  line from the rover towards the next stop it hasn't visited. All the markings are drawn by one shader. */
function Road({ route, base, air, guide, reduced }: { route: ReturnType<typeof makeRoute>; base: string; air: string; guide: React.RefObject<{ from: number; to: number; dir: number; next: number }>; reduced: boolean }) {
  const geometry = useMemo(() => {
    const positions: number[] = [], road: number[] = [], index: number[] = [];
    route.samples.forEach((p, i) => {
      const q = pointAt(route, p.s);
      for (const side of [-1, 1]) { const g = ground(p.x + q.tz * side * ROAD_HALF_WIDTH, p.z - q.tx * side * ROAD_HALF_WIDTH, .025); positions.push(g.point.x, g.point.y, g.point.z); road.push(side, p.s); }
      if (i) index.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1); // wound to face up
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('aRoad', new THREE.Float32BufferAttribute(road, 2));
    g.setIndex(index); g.computeVertexNormals();
    return g;
  }, [route]);
  const uniforms = useMemo(() => ({ time: { value: 0 }, litFrom: { value: -1 }, litTo: { value: -1 }, flow: { value: 1 }, nextAt: { value: -100 }, stopAt: { value: Array.from({ length: 8 }, (_, i) => route.stops[i] ?? -100) }, paint: { value: new THREE.Color('#dcd8ff') }, glow: { value: new THREE.Color(air) } }), [air, route]);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(base).lerp(new THREE.Color('#0d0f2e'), .55), roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 });
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aRoad; varying vec2 vRoad;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = aRoad;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRoad; uniform float time, litFrom, litTo, flow, nextAt; uniform float stopAt[8]; uniform vec3 paint, glow;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float across = abs(vRoad.x), along = vRoad.y, aw = fwidth(across) * 1.5, sw = fwidth(along) * 1.5;
          float edge = 1.0 - smoothstep(.035, .035 + aw, abs(across - .86));
          float dash = (1.0 - smoothstep(.045, .045 + aw, across)) * step(fract(along / 1.8), .5);
          float u = mod(along, 6.0);
          float chevron = (1.0 - smoothstep(.14, .14 + sw, abs(u - 3.0 + across * 1.12))) * (1.0 - smoothstep(.6, .6 + aw, across)) * step(.3, u);
          float lit = step(litFrom, along) * step(along, litTo);
          float pulse = pow(fract((along - flow * time * 3.5) / 5.0), 7.0);
          // A double stop line across the road at each stop; the next one you haven't visited glows.
          float inside = 1.0 - smoothstep(.8, .8 + aw, across), stopLine = 0.0;
          for (int i = 0; i < 8; i++) stopLine = max(stopLine, max(1.0 - smoothstep(.1, .1 + sw, abs(along - stopAt[i])), 1.0 - smoothstep(.04, .04 + sw, abs(along - stopAt[i] + .34))));
          stopLine *= inside;
          float nextLine = stopLine * step(abs(along - nextAt + .17), .4);
          float marks = clamp(edge + dash + chevron + stopLine, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, paint, marks * .55);
          totalEmissiveRadiance += paint * (edge * .5 + dash * (.45 + lit * .8 + pulse * lit * 2.2)) + glow * chevron * (.35 + lit * .65)
            + glow * lit * pulse * (1.0 - smoothstep(.0, .5, across)) * .35
            + paint * stopLine * .45 + glow * nextLine * (.7 + .5 * sin(time * 4.0));`);
    };
    return m;
  }, [base, uniforms]);
  // Each stop's number, painted on the road just before its bay, reading the right way up as you drive towards it.
  const labels = useMemo(() => route.stops.map((stop, i) => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = 'rgba(226,222,255,.92)'; c.font = '700 92px Orbitron, "Exo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(i + 1).padStart(2, '0'), 128, 70);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const q = pointAt(route, Math.max(0, stop - 2.5)), g = ground(q.x, q.z, .035), forward = new THREE.Vector3(q.tx, 0, q.tz);
    forward.addScaledVector(g.normal, -forward.dot(g.normal)).normalize();
    const right = new THREE.Vector3().crossVectors(forward, g.normal).normalize();
    return { map, position: g.point, quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, forward, g.normal)) };
  }), [route]);
  useEffect(() => () => labels.forEach(l => l.map.dispose()), [labels]);
  useFrame(({ clock }) => {
    uniforms.time.value = reduced ? 0 : clock.elapsedTime;
    uniforms.litFrom.value = guide.current.from; uniforms.litTo.value = guide.current.to; uniforms.flow.value = guide.current.dir; uniforms.nextAt.value = guide.current.next;
  });
  return <>
    <mesh geometry={geometry} material={material} raycast={noRaycast}/>
    {labels.map((l, i) => <mesh key={i} position={l.position} quaternion={l.quaternion} raycast={noRaycast}><planeGeometry args={[1.5, .75]}/>
      <meshBasicMaterial map={l.map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4}/></mesh>)}
  </>;
}

/** CSS matrix3d that maps a w × h element onto a screen quadrilateral given as top-left, top-right, bottom-right,
 *  bottom-left corners in pixels (a projective transform; the element needs transform-origin 0 0). */
function quadTransform(w: number, h: number, [p0, p1, p2, p3]: [number, number][]) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0], sy = p0[1] - p1[1] + p2[1] - p3[1], det = dx1 * dy2 - dx2 * dy1 || 1e-9;
  const g = (sx * dy2 - dx2 * sy) / det, k = (dx1 * sy - sx * dy1) / det;
  const a = p1[0] - p0[0] + g * p1[0], b = p3[0] - p0[0] + k * p3[0], c = p0[0];
  const d = p1[1] - p0[1] + g * p1[1], e = p3[1] - p0[1] + k * p3[1], f = p0[1];
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1].map(v => +v.toFixed(8)).join(',')})`;
}

type Props = {
  id: DestinationId; count: number; character: THREE.Group; reduced: boolean;
  rig: React.RefObject<SurfaceRig>; controls: React.RefObject<Controls>;
  tags: React.RefObject<(HTMLElement | null)[]>; board: React.RefObject<HTMLElement | null>;
  /** The next stop not yet visited (the road's guide light runs towards it), if any; and the stop to light up. */
  next: number | null; highlight: number | null;
  /** The stop whose board you asked to read (with E); it unfolds while you're beside it. */
  open: number | null;
  /** Reports the station the rover is pulled up beside (or null), and the board on show (null once it has folded away). */
  onNear: (stop: number | null) => void; onBoard: (stop: number | null) => void; onLanded: () => void;
};
export default function Surface({ id, count, character, reduced, rig, controls, tags, board, next, highlight, open, onNear, onBoard, onLanded }: Props) {
  const look = LOOKS[id], toys = THEME_PROPS[id], Landmark = toys[0];
  const size = useThree(state => state.size), scene = useThree(state => state.scene), compact = size.width <= 760;
  const route = useMemo(() => makeRoute(count), [count]);
  const scenery = useMemo(() => scatter(route, look.seed * 31 + 5, look.earth), [route, look.seed, look.earth]);
  const soil = useGround(look, scenery.lakes);
  const obstacles = useMemo(() => obstaclesFor(route, scenery), [route, scenery]), bounds = useMemo(() => boundsFor(route), [route]);
  const stations = useMemo(() => route.stations.map(p => ground(p.x, p.z)), [route]);
  const bays = useMemo(() => route.stops.map((_, i) => { const p = bayOf(route, i); return { ...ground(p.x, p.z), x: p.x, z: p.z }; }), [route]);
  const anchors = useMemo(() => stations.map(st => st.point.clone().addScaledVector(st.normal, 3.6).add(SURFACE_ORIGIN)), [stations]);
  const rocks = useMemo(() => scenery.rocks.map(r => { const g = ground(r.x, r.z, -.05); return new THREE.Matrix4().compose(g.point, new THREE.Quaternion().setFromEuler(new THREE.Euler(r.spin, r.spin * 2, 0)), new THREE.Vector3().setScalar(r.size)); }), [scenery]);
  const rockGeometry = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const pad = useMemo(() => ground(ROCKET_PAD.x, ROCKET_PAD.z), []);
  const side = useMemo(() => new THREE.Vector3(LANDING.x - ROCKET_PAD.x, 0, LANDING.z - ROCKET_PAD.z).normalize(), []);
  const dustColor = useMemo(() => new THREE.Color(look.base).lerp(new THREE.Color(look.air), .55).getStyle(), [look]);
  const haze = useMemo(() => ({ low: new THREE.Color(look.air).multiplyScalar(.34), high: new THREE.Color(look.air).multiplyScalar(.8) }), [look]);
  const boardSize = compact ? BOARD.tall : BOARD.wide;

  const roverGroup = useRef<THREE.Group>(null), rocket = useRef<THREE.Group>(null), hinge = useRef<THREE.Group>(null), doorway = useRef<THREE.Mesh>(null), arrow = useRef<THREE.Mesh>(null);
  // The rocket stands with its porthole and door facing the start of the road.
  const rocketTurn = useMemo(() => upright(pad.normal).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(side.x, side.z))), [pad, side]);
  /** The rover's way out, as distance from the rocket's axis (towards the road) and height: from inside, through the
   *  doorway, down the ramp, to the start of the road. */
  const rollout = useMemo(() => {
    const body = DOOR.body * ROCKET_SCALE, reach = Math.hypot(LANDING.x - ROCKET_PAD.x, LANDING.z - ROCKET_PAD.z);
    const points = [{ r: .15, h: DOOR.hinge }, { r: body + .1, h: DOOR.hinge }, { r: body + DOOR_REACH, h: 0 }, { r: reach, h: 0 }];
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.r - points[i].r, p.h - points[i].h)), total = lengths.reduce((a, b) => a + b, 0);
    const at = (u: number) => {
      let left = THREE.MathUtils.clamp(u, 0, total);
      for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i] || i === lengths.length - 1) { const k = Math.min(1, left / lengths[i]); return { r: THREE.MathUtils.lerp(points[i].r, points[i + 1].r, k), h: THREE.MathUtils.lerp(points[i].h, points[i + 1].h, k) }; }
        left -= lengths[i];
      }
      return points[points.length - 1];
    };
    return { total, at };
  }, []);
  const startHeading = useMemo(() => Math.atan2(pointAt(route, 0).tx, -pointAt(route, 0).tz), [route]);
  const arrowShape = useMemo(() => new THREE.ShapeGeometry(new THREE.Shape([[0, .55], [.5, -.1], [.32, -.28], [0, .14], [-.32, -.28], [-.5, -.1]].map(([x, y]) => new THREE.Vector2(x, y)))), []);
  const plasma = useRef<THREE.ShaderMaterial>(null), halo = useRef<THREE.ShaderMaterial>(null), plume = useRef<THREE.PointLight>(null);
  const boardGroup = useRef<THREE.Group>(null), boardFrame = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const start = useRef<number | null>(null), thrust = useRef(0), travel = useRef(0), dustRate = useRef(0), dustBurst = useRef(0), landedSent = useRef(false);
  const state = useRef<RoverState>({ x: LANDING.x, z: LANDING.z, heading: Math.atan2(pointAt(route, 0).tx, -pointAt(route, 0).tz), speed: 0 });
  const guide = useRef({ from: -1, to: -1, dir: 1, next: -100 }), nearSent = useRef<number | null | undefined>(undefined), shown = useRef<number | null>(null), unfold = useRef(0), reported = useRef<number | null | undefined>(undefined);
  const facing = useRef(new THREE.Vector3(0, 0, 1)), focused = useRef(false);
  const scratch = useMemo(() => ({ v: new THREE.Vector3(), f: new THREE.Vector3(), right: new THREE.Vector3(), m: new THREE.Matrix4() }), []);

  // Everything that moves, before the camera reads where it is.
  useFrame(({ clock, gl }, delta) => {
    const dt = Math.min(delta, .05), r = rig.current;
    if (start.current === null) start.current = clock.elapsedTime - (reduced ? DESCENT + DRIVE_FROM : 0);
    const t = clock.elapsedTime - start.current, since = t - DESCENT;
    r.time = t;

    // The rocket: braking on its engine all the way down, glowing from the heat of entry while it's still fast.
    const altitude = altitudeAt(t), speed = descentSpeed(t), at = ground(ROCKET_PAD.x, ROCKET_PAD.z, altitude + ROCKET_FOOT);
    rocket.current?.position.copy(at.point);
    r.rocket.copy(at.point).add(SURFACE_ORIGIN); r.altitude = altitude;
    thrust.current = t < DESCENT ? .55 + .95 * THREE.MathUtils.smoothstep(t / DESCENT, .35, .9) : Math.max(0, 1.5 - since * 5);
    const heat = reduced ? 0 : THREE.MathUtils.clamp((speed - 9) / 26, 0, 1);
    if (plasma.current) plasma.current.uniforms.opacity.value = heat * 1.4;
    if (halo.current) halo.current.uniforms.opacity.value = heat * .55;
    // The plume lights the ground as it gets close, and blows the dust out sideways.
    const close = THREE.MathUtils.clamp(1 - altitude / 16, 0, 1);
    if (plume.current) { plume.current.intensity = reduced ? 0 : thrust.current * close * 45; plume.current.position.copy(ground(ROCKET_PAD.x, ROCKET_PAD.z, Math.min(altitude * .5 + .5, 6)).point); }
    dustRate.current = !reduced && t < DESCENT && altitude < 10 ? 170 * (1 - altitude / 10) : 0;
    if (!reduced && since >= 0 && since < dt + 1e-6) dustBurst.current = 90;
    r.shake = reduced ? 0 : since >= 0 && since < .7 ? .16 * Math.exp(-since * 7) : t < DESCENT ? .03 * close : 0;

    // The door swings down into a ramp; the rover, stowed inside for the flight, drives out through the doorway, down
    // the ramp and on to the start of the road, turning to face along it.
    const s = state.current;
    let lift = 0, slope = 0;
    if (hinge.current) hinge.current.rotation.x = DOOR_ANGLE * (1 - Math.pow(1 - THREE.MathUtils.smoothstep(since, DOOR_OPEN[0], DOOR_OPEN[1]), 3));
    if (doorway.current) doorway.current.visible = since > DOOR_OPEN[0];
    if (roverGroup.current) roverGroup.current.visible = since > ROLL_OUT[0];
    if (since < ROLL_OUT[1]) {
      const u = rollout.total * THREE.MathUtils.smoothstep(since, ROLL_OUT[0], ROLL_OUT[1]);
      const p = rollout.at(u), ahead = rollout.at(u + .1), behind = rollout.at(u - .1);
      s.x = ROCKET_PAD.x + side.x * p.r; s.z = ROCKET_PAD.z + side.z * p.r; lift = p.h;
      slope = (ahead.h - behind.h) / Math.max(1e-3, ahead.r - behind.r);
      const turn = THREE.MathUtils.smoothstep(u, rollout.total - 1.8, rollout.total), outward = Math.atan2(side.x, -side.z);
      s.heading = outward + Math.atan2(Math.sin(startHeading - outward), Math.cos(startHeading - outward)) * turn;
      travel.current = u / ROVER_SCALE;
    } else if (since < DRIVE_FROM) {
      s.x = LANDING.x; s.z = LANDING.z; s.heading = startHeading;
    } else {
      if (!landedSent.current) { landedSent.current = true; onLanded(); }
      const keys = controls.current.keys, touch = controls.current.touch;
      const throttle = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')) - touch.z;
      const steer = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) + touch.x;
      Object.assign(s, stepRover(s, { throttle, steer }, dt, obstacles, bounds));
      if (!reduced) travel.current += s.speed * dt / ROVER_SCALE;
    }
    // The road's guide light: the stretch from where the rover is (or the nearest bit of road) to the next stop.
    // Off the road, an arrow on the ground beside the rover points back to it, on the way to that stop.
    let away = 0;
    if (next !== null && since >= DRIVE_FROM) {
      const near = nearestOnRoad(route, s), to = route.stops[next], dir = to >= near.s ? 1 : -1;
      guide.current = { from: Math.min(near.s, to), to: Math.max(near.s, to), dir, next: to };
      away = THREE.MathUtils.smoothstep(near.d, ROAD_HALF_WIDTH + .8, ROAD_HALF_WIDTH + 2.2);
      if (arrow.current && away > 0) {
        const aim = pointAt(route, THREE.MathUtils.clamp(near.s + dir * 5, 0, route.total)), toward = scratch.v.set(aim.x - s.x, 0, aim.z - s.z).normalize();
        const at = ground(s.x + toward.x * 1.7, s.z + toward.z * 1.7, .06), forward = toward.clone().addScaledVector(at.normal, -toward.dot(at.normal)).normalize();
        arrow.current.position.copy(at.point);
        arrow.current.quaternion.setFromRotationMatrix(scratch.m.makeBasis(new THREE.Vector3().crossVectors(forward, at.normal).normalize(), forward, at.normal));
      }
    } else guide.current = { from: -1, to: -1, dir: 1, next: -100 };
    if (arrow.current) { arrow.current.visible = away > 0; (arrow.current.material as THREE.MeshBasicMaterial).opacity = away * (reduced ? .85 : .6 + .3 * Math.sin(clock.elapsedTime * 5)); }
    const g = ground(s.x, s.z, lift), f = scratch.f.set(Math.sin(s.heading), 0, -Math.cos(s.heading));
    f.addScaledVector(g.normal, -f.dot(g.normal)).normalize();
    const up = g.normal.clone();
    if (slope) { f.addScaledVector(g.normal, slope).normalize(); up.addScaledVector(f, -up.dot(f)).normalize(); } // pitched down the ramp
    const right = scratch.right.crossVectors(f, up).normalize();
    scratch.m.makeBasis(right, up, f.clone().negate());
    if (roverGroup.current) { roverGroup.current.position.copy(g.point); roverGroup.current.quaternion.setFromRotationMatrix(scratch.m); }
    r.rover.copy(g.point).add(SURFACE_ORIGIN); r.normal.copy(g.normal); r.forward.copy(f); r.speed = since < DRIVE_FROM ? 0 : s.speed;
    // Boards: pull up beside a station (slowly) and you can read it; its board unfolds when you ask (E), and folds away
    // when you close it or drive off.
    let beside: number | null = null, best = Infinity;
    if (since >= DRIVE_FROM && Math.abs(s.speed) < 2.4) bays.forEach((b, i) => {
      const d = Math.min(Math.hypot(s.x - b.x, s.z - b.z), Math.hypot(s.x - route.stations[i].x, s.z - route.stations[i].z) - 1.4);
      if (d < 2.6 && d < best) { best = d; beside = i; }
    });
    if (beside !== nearSent.current) { nearSent.current = beside; onNear(beside); }
    const wanted = open !== null && open === beside ? open : null;
    if (shown.current !== wanted && unfold.current <= 0) {
      shown.current = wanted;
      if (wanted !== null) facing.current.set(s.x - route.stations[wanted].x, 0, s.z - route.stations[wanted].z).normalize();
    }
    const opening = shown.current !== null && shown.current === wanted;
    unfold.current = reduced ? Number(opening) : THREE.MathUtils.clamp(unfold.current + (opening ? 1 : -1) * dt * 2.6, 0, 1);
    if (shown.current !== reported.current) { reported.current = shown.current; onBoard(shown.current); }
    r.focus = null;
    const group = boardGroup.current;
    if (shown.current !== null && group) {
      const st = stations[shown.current], spot = route.stations[shown.current], want = scratch.v.set(s.x - spot.x, 0, s.z - spot.z);
      if (want.lengthSq() > .01) facing.current.lerp(want.normalize(), reduced ? 1 : 1 - Math.exp(-3 * dt)).normalize();
      const face = facing.current.clone().addScaledVector(st.normal, -facing.current.dot(st.normal)).normalize(), across = new THREE.Vector3().crossVectors(st.normal, face).normalize();
      const centre = st.point.clone().addScaledVector(st.normal, BOARD_LIFT + boardSize.h / 2 + (reduced ? 0 : Math.sin(clock.elapsedTime * 1.4) * .06));
      group.position.copy(centre);
      group.quaternion.setFromRotationMatrix(scratch.m.makeBasis(across, st.normal, face));
      const p = 1 - Math.pow(1 - unfold.current, 3);
      group.scale.set(.2 + .8 * p, Math.max(.001, p), 1);
      group.visible = unfold.current > 0;
      for (const m of boardFrame.current) if (m) m.opacity = p;
      // Stopped beside an open board: the camera squares up to it, close enough that its text reads at full size.
      focused.current = unfold.current > .55 && Math.abs(s.speed) < (focused.current ? .8 : .3);
      if (focused.current) {
        // Fit the board into the band between the title and the controls: as wide as its HTML is laid out (so text is
        // drawn 1:1) unless the band is too short, and centred in that band.
        const canvasTop = gl.domElement.getBoundingClientRect().top, half = Math.tan((compact ? 60 : 50) * Math.PI / 360);
        const top = (document.querySelector('.surface-header')?.getBoundingClientRect().bottom ?? canvasTop) - canvasTop + 18;
        const bottom = Math.min(...['.surface-nav', '.read-prompt'].map(q => document.querySelector(q)?.getBoundingClientRect().top ?? canvasTop + size.height)) - canvasTop - 18;
        const wide = Math.min(boardPixels(size.width, compact), Math.max(120, bottom - top) * boardSize.w / boardSize.h);
        const distance = boardSize.w / 2 / (wide / size.width * half * size.width / size.height);
        const lower = ((top + bottom) / 2 - size.height / 2) / (size.height / 2) * distance * half; // aim above to sit lower
        r.focus = { aim: centre.clone().add(SURFACE_ORIGIN).addScaledVector(st.normal, lower), facing: face, up: st.normal.clone(), distance };
      }
    } else if (group) { group.visible = false; focused.current = false; }
  }, -2);

  // After the camera has moved: pin the board's HTML onto the board, place the stop tags, thin the haze with altitude.
  useFrame(({ camera, gl }) => {
    camera.updateMatrixWorld();
    // The air: thick and bright high up (you're falling through the planet's sunlit atmosphere), clearing as you come
    // down to the ground's usual light haze.
    if (scene.fog instanceof THREE.Fog) {
      const altitude = Math.max(0, camera.position.distanceTo(CENTRE) - R), high = THREE.MathUtils.smoothstep(altitude, 4, 70);
      scene.fog.near = 12 + altitude * .15; scene.fog.far = 62 + altitude * .75; scene.fog.color.copy(haze.low).lerp(haze.high, high);
    }
    const canvas = gl.domElement.getBoundingClientRect(), element = board.current, group = boardGroup.current;
    if (element) {
      let quad: [number, number][] | null = null;
      if (group && shown.current !== null && unfold.current > 0) {
        group.updateMatrixWorld();
        const parent = (element.offsetParent ?? document.body).getBoundingClientRect(), w = boardSize.w / 2, h = boardSize.h / 2;
        const corners = ([[-w, h], [w, h], [w, -h], [-w, -h]] as const).map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(group.matrixWorld).project(camera));
        if (corners.every(p => p.z < 1)) quad = corners.map(p => [canvas.left - parent.left + (p.x * .5 + .5) * canvas.width, canvas.top - parent.top + (-p.y * .5 + .5) * canvas.height]);
      }
      if (quad) {
        const p = unfold.current;
        element.style.transform = quadTransform(element.offsetWidth, element.offsetHeight, quad);
        element.style.opacity = (p * p).toFixed(3); element.style.visibility = 'visible'; element.style.pointerEvents = p > .9 ? 'auto' : 'none';
      } else { element.style.visibility = 'hidden'; element.style.pointerEvents = 'none'; }
    }
    // Stop tags fade in from about 12 units away and out towards the horizon, hide while a board is open in front of
    // you, and step aside for the title.
    const list = tags.current; if (!list) return;
    const ready = rig.current.time > DESCENT + DRIVE_FROM, title = document.querySelector('.surface-header')?.getBoundingClientRect();
    const placed = anchors.map((anchor, i) => {
      const tag = list[i]; if (!tag) return null;
      const parent = (tag.offsetParent ?? document.body).getBoundingClientRect();
      const distance = anchor.distanceTo(camera.position), p = scratch.v.copy(anchor).project(camera);
      const w = tag.offsetWidth, h = tag.offsetHeight, y = canvas.top + (-p.y * .5 + .5) * canvas.height;
      const x = THREE.MathUtils.clamp(canvas.left + (p.x * .5 + .5) * canvas.width, canvas.left + w / 2 + 8, canvas.right - w / 2 - 8); // keep the whole tag on screen
      const overTitle = !!title && x + w / 2 > title.left - 8 && x - w / 2 < title.right + 8 && y > title.top - 8 && y - h < title.bottom + 8;
      const open = (shown.current === i && unfold.current > 0) || !!rig.current.focus; // reading a board: no other tags
      const opacity = ready && p.z < 1 && !overTitle && !open ? Math.min(THREE.MathUtils.clamp((distance - 12) / 4, 0, 1), THREE.MathUtils.clamp((50 - distance) / 14, 0, 1)) : 0;
      return { tag, opacity, distance, x: x - parent.left, y: y - parent.top, w, h };
    });
    // Where tags would overlap, the nearer stop's tag wins.
    const taken: { x: number; y: number; w: number; h: number }[] = [];
    for (const item of [...placed].filter(Boolean).sort((a, b) => a!.distance - b!.distance)) {
      if (!item || item.opacity <= .02) continue;
      if (taken.some(o => Math.abs(o.x - item.x) < (o.w + item.w) / 2 + 4 && Math.abs(o.y - item.y) < (o.h + item.h) / 2 + 2)) item.opacity = 0;
      else taken.push(item);
    }
    for (const item of placed) {
      if (!item) continue;
      item.tag.style.opacity = item.opacity.toFixed(2);
      item.tag.style.visibility = item.opacity > .02 ? 'visible' : 'hidden';
      item.tag.style.transform = `translate(${item.x.toFixed(1)}px,${item.y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  });

  return <>
    <group position={SURFACE_ORIGIN}>
      <mesh position={[0, -R, 0]} material={soil}><sphereGeometry args={[R, 256, 192]}/></mesh>
      <Road route={route} base={look.road ?? look.base} air={look.air} guide={guide} reduced={reduced}/>
      {look.earth && <Trees trees={scenery.trees}/>}
      {scenery.craters.map((c, i) => { const g = ground(c.x, c.z, -.02); return <group key={`c${i}`} position={g.point} quaternion={upright(g.normal)}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, .35]}><torusGeometry args={[c.size, c.size * .16, 10, 40]}/>{matte(look.spot)}</mesh>
        <mesh scale={[c.size * .9, .04, c.size * .9]}><sphereGeometry args={[1, 32, 12]}/>{matte(look.spot)}</mesh>
      </group>; })}
      <Scattered items={rocks} geometry={rockGeometry} color={look.spot}/>
      {scenery.props.map((p, i) => { const g = ground(p.x, p.z), Toy = toys[p.kind % toys.length]; return <group key={`m${i}`} position={g.point} quaternion={upright(g.normal)}>
        <group rotation={[0, p.spin, 0]} scale={p.scale}><Toy/></group></group>; })}
      {(() => { const g = ground(scenery.landmark.x, scenery.landmark.z); return <group position={g.point} quaternion={upright(g.normal)} scale={5}><Landmark/></group>; })()}
      {stations.map((at, i) => <Station key={`s${i}`} at={at} Toy={toys[1 + i % (toys.length - 1)]} active={i === highlight} reduced={reduced}/>)}
      {/* The hovering board: a glowing frame. Its content is HTML, pinned onto it each frame. */}
      <group ref={boardGroup} visible={false}>
        {([[0, boardSize.h / 2, boardSize.w + .12, .05], [0, -boardSize.h / 2, boardSize.w + .12, .05], [boardSize.w / 2, 0, .05, boardSize.h], [-boardSize.w / 2, 0, .05, boardSize.h]] as const).map(([x, y, w, h], i) =>
          <mesh key={i} position={[x, y, 0]} raycast={noRaycast}><boxGeometry args={[w, h, .04]}/><meshBasicMaterial ref={m => { boardFrame.current[i] = m; }} color="#c9c0ff" transparent opacity={0}/></mesh>)}
      </group>
      {/* The landing pad, the rocket on it, the dust it blows out and the light of its plume. */}
      <group position={pad.point} quaternion={upright(pad.normal)}>
        <mesh position={[0, .05, 0]}><cylinderGeometry args={[2.3, 2.45, .1, 48]}/><meshStandardMaterial color="#1e2150" roughness={.7}/></mesh>
        <mesh position={[0, .11, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.7, 1.85, 48]}/><meshBasicMaterial color="#9b8cff"/></mesh>
      </group>
      <pointLight ref={plume} color="#b4c8ff" intensity={0} distance={20} decay={1.4}/>
      <Dust rate={dustRate} burst={dustBurst} at={pad} color={dustColor}/>
      <group ref={rocket} quaternion={rocketTurn} scale={ROCKET_SCALE}>
        <Rocket thrust={thrust} reduced={reduced} upright/>
        {/* The door, curved to the body and hinged at its foot, and the dark doorway behind it once it opens. */}
        <group ref={hinge} position={[0, (DOOR.hinge - ROCKET_FOOT) / ROCKET_SCALE, DOOR.body]}>
          <mesh position={[0, DOOR.length / ROCKET_SCALE / 2, -DOOR.body]}><cylinderGeometry args={[DOOR.body + .006, DOOR.body + .006, DOOR.length / ROCKET_SCALE, 24, 1, true, -DOOR.arc / 2, DOOR.arc]}/><meshStandardMaterial color="#e6dfcf" roughness={.5} side={THREE.DoubleSide}/></mesh>
        </group>
        <mesh ref={doorway} visible={false} position={[0, (DOOR.hinge - ROCKET_FOOT) / ROCKET_SCALE + DOOR.length / ROCKET_SCALE / 2, 0]}><cylinderGeometry args={[DOOR.body + .002, DOOR.body + .002, DOOR.length / ROCKET_SCALE * .97, 24, 1, true, -DOOR.arc * .46, DOOR.arc * .92]}/><meshBasicMaterial color="#06071a"/></mesh>
        <mesh position={[0, -1.2, 0]} scale={[.55, .8, .55]} raycast={noRaycast}><sphereGeometry args={[1, 32, 24]}/><Glow color="#f2f5ff" material={plasma}/></mesh>
        <mesh position={[0, -.75, 0]} scale={[.9, 1.6, .9]} raycast={noRaycast}><sphereGeometry args={[1, 32, 24]}/><Glow color={look.air} material={halo}/></mesh>
      </group>
      <mesh ref={arrow} geometry={arrowShape} visible={false} raycast={noRaycast}><meshBasicMaterial color={look.air} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/></mesh>
      <group ref={roverGroup}><group scale={ROVER_SCALE}><Rover travel={travel} reduced={reduced}/></group></group>
    </group>
    <HorizonGlow color={look.air} sky={look.earth}/>
    {/* On your own planet you're standing on the head, so it isn't in the sky. */}
    {id !== 'home' && <SkyHead character={character} rig={rig} reduced={reduced}/>}
  </>;
}
