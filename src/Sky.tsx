import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// A sky at infinity: everything here follows the camera, so it never gets closer while flying, like a real sky.
// Directions are built from yaw/pitch in degrees; the camera mostly looks forward (-z) and about 35 degrees down,
// so the Milky Way, nebulae and galaxies are placed to cross that view.
const direction = (yaw: number, pitch: number) => {
  const y = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)).normalize();
};
const glsl = (v: THREE.Vector3) => `vec3(${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)})`;
const FORWARD = direction(0, -35), RIGHT = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3().crossVectors(RIGHT, FORWARD).negate().normalize();
// The galactic plane runs diagonally across the view, lower left to upper right.
const BAND_TANGENT = RIGHT.clone().multiplyScalar(Math.cos(.6)).addScaledVector(UP, Math.sin(.6)).normalize();
const BAND_NORMAL = new THREE.Vector3().crossVectors(FORWARD, BAND_TANGENT).normalize();
const CORE = FORWARD.clone().multiplyScalar(Math.cos(.42)).addScaledVector(BAND_TANGENT, -Math.sin(.42)).normalize();
// Violet and deep-blue emission clouds; some low in the orbit view, some above the horizon for when you've landed.
const NEBULAE = [
  { at: direction(-30, -20), color: 'vec3(.34,.12,.50)' }, { at: direction(28, -50), color: 'vec3(.08,.16,.46)' },
  { at: direction(-22, 10), color: 'vec3(.26,.10,.44)' }, { at: direction(34, 16), color: 'vec3(.07,.14,.40)' },
];
const GALAXIES = [
  { at: direction(-27, -30), size: .012, tilt: .5, squash: .38, color: 'vec3(1.,.86,.72)' },
  { at: direction(26, -40), size: .009, tilt: -.9, squash: .55, color: 'vec3(.80,.86,1.)' },
  { at: direction(-15, -54), size: .007, tilt: 1.3, squash: .3, color: 'vec3(1.,.9,.82)' },
  { at: direction(19, -55), size: .010, tilt: .2, squash: .7, color: 'vec3(.92,.88,1.)' },
  { at: direction(-6, -17), size: .006, tilt: -.4, squash: .45, color: 'vec3(1.,.92,.85)' },
  { at: direction(-38, 14), size: .011, tilt: .8, squash: .4, color: 'vec3(.86,.84,1.)' },
  { at: direction(12, 22), size: .008, tilt: -1.1, squash: .6, color: 'vec3(.95,.9,1.)' },
];

const domeVertex = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const domeFragment = `
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float v = 0.0, a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return v; }
vec3 galaxy(vec3 d, vec3 at, float size, float tilt, float squash, vec3 tint){
  vec3 t1 = normalize(cross(at, vec3(0.0, 1.0, 0.0))), t2 = cross(at, t1);
  vec2 q = vec2(dot(d, t1), dot(d, t2)); if (dot(d, at) < 0.0) return vec3(0.0);
  q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * q; q.y /= squash;
  float r = length(q) / size;
  return tint * (exp(-r * r * 3.0) * .22 + exp(-r * r * 40.0) * .55);
}
void main(){
  vec3 d = normalize(vDir);
  // Deep space: near black with a hint of blue.
  vec3 col = mix(vec3(.006, .009, .018), vec3(.014, .018, .034), smoothstep(-.9, .6, d.y));
  // The Milky Way: a soft band, clumpy with unresolved stars, brighter and warmer towards the galactic core,
  // split by a dark dust lane.
  float h = dot(d, ${glsl(BAND_NORMAL)});
  float n = fbm(d * 3.3), n2 = fbm(d * 8.0 + 3.0);
  float core = exp(-pow(distance(d, ${glsl(CORE)}), 2.0) / .16);
  float band = exp(-h * h / (.03 + .05 * core)) * (.45 + .95 * n);
  float dust = exp(-pow(h + .035 * (n2 - .5), 2.0) / .0025) * smoothstep(.38, .72, n2);
  float milky = band * (.5 + 1.4 * core) * (1.0 - .8 * dust);
  col += milky * mix(vec3(.20, .24, .46), vec3(.60, .52, .68), core) * .44;
  col += band * smoothstep(.5, .85, fbm(d * 34.0)) * vec3(.10, .10, .12);
  // Faint emission nebulae.
  ${NEBULAE.map(nb => `col += ${nb.color} * smoothstep(.48, .9, fbm(d * 2.6 + ${glsl(nb.at)} * 4.0)) * exp(-pow(distance(d, ${glsl(nb.at)}), 2.0) / .05) * .5;`).join('\n  ')}
  // Small, far-away galaxies: soft elliptical smudges with brighter cores.
  ${GALAXIES.map(g => `col += galaxy(d, ${glsl(g.at)}, ${g.size}, ${g.tilt}, ${g.squash}, ${g.color});`).join('\n  ')}
  gl_FragColor = vec4(col, 1.0);
}`;

const starVertex = `
attribute float aSize; attribute vec3 aColor; attribute float aPhase;
uniform float uTime; uniform float uPixelRatio;
varying vec3 vColor; varying float vSpike;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float twinkle = .82 + .18 * sin(uTime * (.8 + aPhase) + aPhase * 40.0);
  vSpike = aSize > 7.2 ? 1.0 : 0.0; // only the brightest stars show diffraction spikes
  gl_PointSize = aSize * uPixelRatio * (1.0 + vSpike * 2.4);
  vColor = aColor * twinkle;
}`;
const starFragment = `
varying vec3 vColor; varying float vSpike;
void main(){
  vec2 q = (gl_PointCoord - .5) * 2.0;
  float r = length(q) * (1.0 + vSpike * 2.4);
  float light = exp(-r * r * 14.0) + exp(-r * r * 3.0) * .22;
  light += vSpike * (exp(-abs(q.x) * 34.0) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 34.0) * exp(-abs(q.x) * 2.6)) * .32;
  if (light < .01) discard;
  gl_FragColor = vec4(vColor * light, light);
}`;
// Real star colours, from hot blue-white to cool orange-red, weighted towards white.
const STAR_COLORS = ['#aebfff', '#cad8ff', '#f4f6ff', '#ffffff', '#fff4e8', '#ffe2bd', '#ffc58f', '#ffad7a'].map(c => new THREE.Color(c));
const STAR_WEIGHTS = [.06, .14, .22, .2, .16, .12, .07, .03];
function random(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function StarField({ reduced }: { reduced: boolean }) {
  const { gl } = useThree();
  const geometry = useMemo(() => {
    const rand = random(2024), count = 9000;
    const position = new Float32Array(count * 3), color = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Most spread evenly, two in five crowded towards the galactic plane, as in the real sky.
      do { v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < .01);
      v.normalize();
      if (rand() < .4) { v.addScaledVector(BAND_NORMAL, -v.dot(BAND_NORMAL) * (.72 + rand() * .25)).normalize(); }
      v.multiplyScalar(150); position.set([v.x, v.y, v.z], i * 3);
      let pick = rand(), k = 0; while (k < STAR_WEIGHTS.length - 1 && pick > STAR_WEIGHTS[k]) { pick -= STAR_WEIGHTS[k]; k++; }
      const magnitude = Math.pow(rand(), 6); // most stars faint, a few bright
      const c = STAR_COLORS[k].clone().multiplyScalar(.22 + .78 * magnitude + .12 * rand());
      color.set([c.r, c.g, c.b], i * 3);
      size[i] = 1.3 + magnitude * 6.8; phase[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: gl.getPixelRatio() } }), [gl]);
  useFrame(({ clock }) => { uniforms.uTime.value = reduced ? 0 : clock.elapsedTime; uniforms.uPixelRatio.value = gl.getPixelRatio(); });
  return <points geometry={geometry} frustumCulled={false} renderOrder={-1}>
    <shaderMaterial vertexShader={starVertex} fragmentShader={starFragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}/>
  </points>;
}

export default function Sky({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => { group.current?.position.copy(camera.position); });
  return <group ref={group}>
    <mesh renderOrder={-2} frustumCulled={false}>
      <sphereGeometry args={[170, 64, 32]}/>
      <shaderMaterial vertexShader={domeVertex} fragmentShader={domeFragment} side={THREE.BackSide} depthWrite={false}/>
    </mesh>
    <StarField reduced={reduced}/>
  </group>;
}

/**
 * Faint dust drifting in the play area. Unlike the sky it stays put in the world, so it slides past as you fly
 * and gives a sense of depth and speed.
 */
export function SpaceDust() {
  const geometry = useMemo(() => {
    const rand = random(77), count = 900, position = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) position.set([(rand() - .5) * 110, -14 + rand() * 22, (rand() - .5) * 100], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(position, 3)); return g;
  }, []);
  return <points geometry={geometry}><pointsMaterial color="#a9b2ff" size={.07} sizeAttenuation transparent opacity={.38} depthWrite={false}/></points>;
}
