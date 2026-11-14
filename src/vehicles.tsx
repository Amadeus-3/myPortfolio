import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { extrude, lathe, mat, rbox, shared } from './shapes';

type V = [number, number, number];
const Part = ({ g, m, p, r, s }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V; r?: V; s?: V | number }) => <mesh geometry={g} material={m} position={p} rotation={r} scale={s}/>;
const COLOURS = { hull: '#eee7d8', nose: '#8b78ff', trim: '#c3b8ff', fin: '#5b6cf0', metal: '#575d7a', glass: '#1f2560', violet: '#7e6aff', cream: '#f1edff', navy: '#2b2f6b', dark: '#23264d', steel: '#9aa3c7', rose: '#f29ac0', gold: '#f5d77a' };

/** The fins (and, standing, the landing legs under them) sit at the back and at ±120° from it, leaving the front (+z)
 *  clear for the porthole and the door. Angles turn +x about y. */
const FIN_ANGLES = [Math.PI / 2, Math.PI / 2 + Math.PI * 2 / 3, Math.PI / 2 + Math.PI * 4 / 3];

/** The rocket. In space it flies flat (nose forward); on a planet it stands upright on its landing legs. Built about
 *  2.4 units tall in its own units (scaled by .7): a turned hull with an ogive nose, seam lines, a framed porthole,
 *  three swept fins, a flared engine bell and a two-layer flame. */
export function Rocket({ thrust, reduced, upright = false }: { thrust: React.RefObject<number>; reduced: boolean; upright?: boolean }) {
  const flame = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!flame.current) return;
    flame.current.scale.set(1, .3 + thrust.current * (1 + (reduced ? 0 : Math.sin(clock.elapsedTime * 32) * .13)), 1);
    flame.current.visible = thrust.current > .05;
  });
  const hull = lathe('rocket-hull', [[0, -.98], [.28, -.98], [.38, -.93], [.42, -.8], [.42, .62]], 48);
  const nose = lathe('rocket-nose', [[.42, .6], [.415, .74], [.39, .88], [.33, 1.04], [.24, 1.18], [.13, 1.29], [0, 1.35]], 48);
  const bell = lathe('rocket-bell', [[.16, -.95], [.19, -1], [.25, -1.1], [.31, -1.19], [.34, -1.22]], 32);
  const fin = extrude('rocket-fin', [[0, .12], [0, -.7], [.34, -.98], [.46, -1], [.42, -.86], [.15, -.2]], .05, { bevel: .02, keep: true });
  const seam = shared('rocket-seam', () => new THREE.TorusGeometry(.423, .007, 6, 64));
  return <group rotation={upright ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} scale={.7}>
    <Part g={hull} m={mat(COLOURS.hull, { rough: .38 })}/>
    <Part g={nose} m={mat(COLOURS.nose, { rough: .45 })}/>
    <Part g={shared('rocket-tip', () => new THREE.SphereGeometry(.035, 12, 8))} m={mat(COLOURS.trim, { metal: .5, rough: .3 })} p={[0, 1.35, 0]}/>
    <Part g={shared('rocket-collar', () => new THREE.TorusGeometry(.424, .022, 8, 64))} m={mat(COLOURS.trim, { metal: .4, rough: .35 })} p={[0, .61, 0]} r={[Math.PI / 2, 0, 0]}/>
    {[-.12, .2].map(y => <Part key={y} g={seam} m={mat('#d8d0c0', { rough: .5 })} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]}/>)}
    {/* Porthole: a metal rim, dark glass and a glint. */}
    <Part g={shared('rocket-rim', () => new THREE.TorusGeometry(.16, .035, 10, 40))} m={mat(COLOURS.trim, { metal: .55, rough: .3 })} p={[0, .3, .41]}/>
    <Part g={shared('rocket-glass', () => new THREE.CircleGeometry(.15, 32))} m={mat(COLOURS.glass, { metal: .3, rough: .12 })} p={[0, .3, .425]}/>
    <Part g={shared('glint', () => new THREE.SphereGeometry(.03, 10, 8))} m={mat('#ffffff', { glow: .8 })} p={[-.06, .36, .43]} s={[1, .7, .3]}/>
    {FIN_ANGLES.map(a => <group key={a} rotation={[0, a, 0]}><Part g={fin} m={mat(COLOURS.fin, { rough: .5 })} p={[.36, 0, 0]}/></group>)}
    <Part g={bell} m={mat(COLOURS.metal, { metal: .6, rough: .35, double: true })}/>
    <Part g={shared('rocket-throat', () => new THREE.CylinderGeometry(.2, .2, .06, 24))} m={mat(COLOURS.dark, { metal: .5, rough: .4 })} p={[0, -.96, 0]}/>
    <group ref={flame} position={[0, -1.2, 0]}>
      <mesh position={[0, -.5, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.28, 1, 20, 1, true]}/><meshBasicMaterial color="#9fc4ff" transparent opacity={.5} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
      <mesh position={[0, -.35, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.14, .7, 16]}/><meshBasicMaterial color="#eef4ff" transparent opacity={.9} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
    </group>
    {upright && FIN_ANGLES.map(a => <group key={a} rotation={[0, a, 0]}>
      {/* A landing leg under each fin: strut, brace, knee and footpad, reaching the ground at y = -1.08. */}
      <Part g={shared('leg-strut', () => new THREE.CylinderGeometry(.03, .03, .52, 8))} m={mat(COLOURS.steel, { metal: .5, rough: .4 })} p={[.56, -.83, 0]} r={[0, 0, .62]}/>
      <Part g={shared('leg-brace', () => new THREE.CylinderGeometry(.018, .018, .34, 6))} m={mat(COLOURS.steel, { metal: .5, rough: .4 })} p={[.47, -.95, 0]} r={[0, 0, 1.15]}/>
      <Part g={shared('leg-knee', () => new THREE.SphereGeometry(.045, 10, 8))} m={mat(COLOURS.dark, { metal: .4, rough: .4 })} p={[.4, -.61, 0]}/>
      <Part g={lathe('leg-pad', [[0, -1.08], [.14, -1.08], [.13, -1.05], [.07, -1.03], [0, -1.03]], 20)} m={mat(COLOURS.fin, { rough: .5 })} p={[.72, 0, 0]}/>
    </group>)}
  </group>;
}

const WHEEL = .3;
/** A little toy space rover, facing −z and standing on y = 0: a rounded two-tone body with wheel arches, chunky
 *  treaded tyres on hubs, a glass cockpit with a tiny astronaut, head and tail lights, a solar panel, a dish and a
 *  blinking antenna. `travel` is the distance driven, which spins the wheels. */
export function Rover({ travel, reduced }: { travel: React.RefObject<number>; reduced: boolean }) {
  const wheels = useRef<(THREE.Group | null)[]>([]), tip = useRef<THREE.MeshBasicMaterial>(null), body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    for (const wheel of wheels.current) if (wheel) wheel.rotation.x = -travel.current / WHEEL;
    if (tip.current) tip.current.color.setScalar(reduced || Math.sin(clock.elapsedTime * 4) > 0 ? 1 : .35);
    if (body.current) body.current.position.y = reduced ? 0 : Math.sin(travel.current * 3.1) * .025; // a little suspension bounce
  });
  const tyre = lathe('rover-tyre', [[.17, -.12], [.25, -.125], [.29, -.1], [.305, -.05], [.31, 0], [.305, .05], [.29, .1], [.25, .125], [.17, .12]], 28);
  const tread = shared('rover-tread', () => new THREE.BoxGeometry(.05, .2, .045));
  const dish = lathe('rover-dish', [[0, 0], [.08, .01], [.14, .035], [.17, .06]], 20);
  return <group>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => <group key={i} position={[x * .6, WHEEL, z * .55]}>
      <group ref={el => { wheels.current[i] = el; }}>
        <Part g={tyre} m={mat(COLOURS.dark, { rough: .9 })} r={[0, 0, Math.PI / 2]}/>
        {Array.from({ length: 12 }, (_, k) => { const a = k / 12 * Math.PI * 2; return <Part key={k} g={tread} m={mat(COLOURS.dark, { rough: .95 })} p={[0, Math.cos(a) * .3, Math.sin(a) * .3]} r={[a, 0, 0]}/>; })}
        <Part g={shared('rover-hub', () => new THREE.CylinderGeometry(.14, .14, .26, 20))} m={mat(COLOURS.cream, { rough: .45 })} r={[0, 0, Math.PI / 2]}/>
        {Array.from({ length: 5 }, (_, k) => { const a = k / 5 * Math.PI * 2; return <Part key={k} g={shared('rover-bolt', () => new THREE.SphereGeometry(.022, 8, 6))} m={mat(COLOURS.steel, { metal: .5, rough: .35 })} p={[x * .135, Math.cos(a) * .08, Math.sin(a) * .08]}/>; })}
        <Part g={shared('rover-cap', () => new THREE.SphereGeometry(.05, 12, 8))} m={mat(COLOURS.violet, { rough: .4 })} p={[x * .13, 0, 0]} s={[.6, 1, 1]}/>
      </group>
      {/* Wheel arch and suspension arm. */}
      <Part g={shared('rover-arch', () => new THREE.TorusGeometry(.35, .05, 8, 20, Math.PI))} m={mat('#6a58e6', { rough: .45 })} r={[0, Math.PI / 2, 0]}/>
      <Part g={shared('rover-arm', () => new THREE.CylinderGeometry(.03, .03, .2, 8))} m={mat(COLOURS.steel, { metal: .5, rough: .4 })} p={[-x * .14, .12, 0]} r={[0, 0, Math.PI / 2 - x * .5]}/>
    </group>)}
    <group ref={body}>
      <Part g={rbox(.92, .1, 1.3, .04)} m={mat(COLOURS.navy, { rough: .55 })} p={[0, .36, 0]}/>
      <Part g={rbox(1, .24, 1.5, .09)} m={mat(COLOURS.violet, { rough: .42 })} p={[0, .5, 0]}/>
      {[-1, 1].map(x => <Part key={x} g={rbox(.02, .05, 1.18, .01)} m={mat(COLOURS.trim, { glow: .2 })} p={[x * .505, .53, 0]}/>)}
      <Part g={rbox(.86, .14, 1.12, .06)} m={mat(COLOURS.cream, { rough: .5 })} p={[0, .68, .02]}/>
      {/* Cockpit: a glass dome on a metal ring, with a little astronaut inside. */}
      <Part g={shared('rover-helmet', () => new THREE.SphereGeometry(.12, 20, 14))} m={mat(COLOURS.cream, { rough: .35 })} p={[0, .88, -.14]}/>
      <Part g={shared('rover-visor', () => new THREE.SphereGeometry(.1, 20, 14))} m={mat(COLOURS.glass, { metal: .5, rough: .15 })} p={[0, .89, -.2]} s={[.85, .62, .55]}/>
      <Part g={shared('rover-dome', () => new THREE.SphereGeometry(.32, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2))} m={mat('#bfe3ff', { opacity: .45, rough: .05, metal: .1 })} p={[0, .75, -.14]}/>
      <Part g={shared('rover-ring', () => new THREE.TorusGeometry(.32, .025, 8, 40))} m={mat(COLOURS.trim, { metal: .5, rough: .3 })} p={[0, .75, -.14]} r={[Math.PI / 2, 0, 0]}/>
      {/* Front: bumper, two headlights and a light bar; back: tail lights. */}
      <Part g={rbox(.9, .12, .1, .04)} m={mat(COLOURS.navy, { rough: .5 })} p={[0, .43, -.78]}/>
      {[-1, 1].map(x => <group key={x} position={[x * .28, .53, -.76]} rotation={[Math.PI / 2, 0, 0]}>
        <Part g={shared('rover-lamp', () => new THREE.CylinderGeometry(.075, .085, .06, 16))} m={mat(COLOURS.dark, { metal: .4, rough: .4 })}/>
        <Part g={shared('rover-lens', () => new THREE.CylinderGeometry(.06, .06, .065, 16))} m={mat('#fff1c4', { glow: 1.3 })}/>
      </group>)}
      <Part g={rbox(.46, .045, .05, .02)} m={mat(COLOURS.trim, { glow: .9 })} p={[0, .77, -.52]}/>
      {[-1, 1].map(x => <Part key={x} g={rbox(.13, .06, .03, .015)} m={mat(COLOURS.rose, { glow: .9 })} p={[x * .32, .53, .765]}/>)}
      {/* Solar panel on the back deck. */}
      <group position={[0, .86, .4]} rotation={[-.28, 0, 0]}>
        <Part g={rbox(.6, .03, .34, .01)} m={mat(COLOURS.navy, { metal: .3, rough: .3 })}/>
        {[-.15, 0, .15].map(x => <Part key={x} g={rbox(.006, .034, .3, .002)} m={mat(COLOURS.steel, { metal: .5 })} p={[x, 0, 0]}/>)}
        <Part g={rbox(.56, .034, .006, .002)} m={mat(COLOURS.steel, { metal: .5 })}/>
      </group>
      <Part g={shared('rover-post', () => new THREE.CylinderGeometry(.03, .03, .16, 8))} m={mat(COLOURS.steel, { metal: .5 })} p={[0, .78, .4]}/>
      {/* Antenna with a blinking tip, and a small dish. */}
      <Part g={shared('rover-mast', () => new THREE.CylinderGeometry(.012, .016, .6, 6))} m={mat(COLOURS.steel, { metal: .5 })} p={[.34, 1.04, .5]}/>
      <mesh position={[.34, 1.36, .5]}><sphereGeometry args={[.05, 12, 8]}/><meshBasicMaterial ref={tip} color={COLOURS.gold}/></mesh>
      <group position={[-.3, .86, .5]} rotation={[-.6, .3, 0]}>
        <Part g={shared('rover-stem', () => new THREE.CylinderGeometry(.02, .025, .14, 8))} m={mat(COLOURS.steel, { metal: .5 })}/>
        <Part g={dish} m={mat(COLOURS.cream, { rough: .5, double: true })} p={[0, .07, 0]}/>
        <Part g={shared('rover-feed', () => new THREE.CylinderGeometry(.008, .008, .12, 6))} m={mat(COLOURS.steel)} p={[0, .14, 0]}/>
      </group>
    </group>
  </group>;
}
