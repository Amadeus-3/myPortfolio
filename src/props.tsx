import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import type { DestinationId } from './flight';
import { Book, Clapper, Glove, Laptop as InterestLaptop, Palette, Record } from './Interests';

// Small themed models, built about one unit tall with their base at y = 0. The same pieces dot each planet
// from orbit and populate the landing scene up close, so every planet keeps one visual identity.
const C = {
  cream: '#f1edff', lilac: '#b9a8ff', violet: '#7e6aff', indigo: '#4f5bd5', navy: '#2b2f6b', sky: '#8fb4ff',
  teal: '#5fc4bd', mint: '#a9e3d6', rose: '#f29ac0', gold: '#f5d77a', steel: '#9aa3c7', wood: '#b58a6a', dark: '#23264d',
};
const M = ({ c, glow = 0 }: { c: string; glow?: number }) =>
  <meshStandardMaterial color={c} roughness={.62} metalness={0} emissive={glow ? c : '#000000'} emissiveIntensity={glow}/>;
type V = [number, number, number];
const Box = ({ s, p = [0, 0, 0], r, c, glow }: { s: V; p?: V; r?: V; c: string; glow?: number }) =>
  <mesh position={p} rotation={r}><boxGeometry args={s}/><M c={c} glow={glow}/></mesh>;
const Cyl = ({ a, p = [0, 0, 0], r, c, glow }: { a: [number, number, number, number?]; p?: V; r?: V; c: string; glow?: number }) =>
  <mesh position={p} rotation={r}><cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 24]}/><M c={c} glow={glow}/></mesh>;
const Ball = ({ rad, p = [0, 0, 0], s, c, glow }: { rad: number; p?: V; s?: V; c: string; glow?: number }) =>
  <mesh position={p} scale={s}><sphereGeometry args={[rad, 24, 16]}/><M c={c} glow={glow}/></mesh>;

function extruded(points: [number, number][], depth: number) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .05, bevelSize: .04, bevelSegments: 4 });
  g.center(); return g;
}

// ---------- Experience ----------
function Office() {
  return <group>
    <Box s={[.7, 1.3, .7]} p={[0, .65, 0]} c={C.indigo}/>
    {[.35, .65, .95].map(y => <Box key={y} s={[.56, .1, .02]} p={[0, y, .36]} c={C.sky} glow={.6}/>)}
    <Box s={[.8, .08, .8]} p={[0, 1.34, 0]} c={C.navy}/>
    <Cyl a={[.02, .02, .3, 6]} p={[.2, 1.52, .2]} c={C.steel}/><Ball rad={.04} p={[.2, 1.68, .2]} c={C.rose} glow={1.2}/>
  </group>;
}
function Briefcase() {
  return <group>
    <Box s={[1.1, .7, .42]} p={[0, .35, 0]} c={C.navy}/>
    <Box s={[1.11, .06, .43]} p={[0, .48, 0]} c={C.dark}/>
    <Box s={[.14, .12, .03]} p={[0, .5, .22]} c={C.gold}/>
    <mesh position={[0, .72, 0]}><torusGeometry args={[.18, .05, 10, 24, Math.PI]}/><M c={C.dark}/></mesh>
  </group>;
}
function Flag() {
  return <group>
    <Cyl a={[.14, .16, .06]} p={[0, .03, 0]} c={C.steel}/>
    <Cyl a={[.025, .025, 1.5, 8]} p={[0, .75, 0]} c={C.cream}/>
    <Box s={[.6, .36, .03]} p={[.31, 1.3, 0]} c={C.rose}/>
  </group>;
}
function Stairs() {
  return <group>{[0, 1, 2, 3].map(i => <Box key={i} s={[.7, .24 * (i + 1), .28]} p={[0, .12 * (i + 1), -i * .28 + .42]} c={i % 2 ? C.lilac : C.cream}/>)}</group>;
}
function Trophy() {
  return <group>
    <Box s={[.5, .16, .5]} p={[0, .08, 0]} c={C.navy}/>
    <Cyl a={[.06, .1, .3, 12]} p={[0, .31, 0]} c={C.gold}/>
    <Cyl a={[.32, .16, .45, 24]} p={[0, .68, 0]} c={C.gold}/>
    {[-1, 1].map(s => <mesh key={s} position={[s * .34, .72, 0]} rotation={[0, 0, s * Math.PI / 2]}><torusGeometry args={[.12, .03, 8, 16, Math.PI]}/><M c={C.gold}/></mesh>)}
  </group>;
}

// ---------- Projects ----------
function Blocks() {
  return <group>
    <Box s={[.5, .5, .5]} p={[-.28, .25, 0]} c={C.lilac}/>
    <Box s={[.44, .44, .44]} p={[.3, .22, .06]} r={[0, .5, 0]} c={C.sky}/>
    <Box s={[.42, .42, .42]} p={[-.04, .71, .02]} r={[0, .9, 0]} c={C.teal}/>
  </group>;
}
function Gear() {
  return <group position={[0, .55, 0]} rotation={[Math.PI / 2, 0, 0]}>
    <Cyl a={[.42, .42, .18, 32]} c={C.steel}/>
    {Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return <Box key={i} s={[.16, .18, .16]} p={[Math.cos(a) * .48, 0, Math.sin(a) * .48]} r={[0, -a, 0]} c={C.steel}/>; })}
    <Cyl a={[.13, .13, .2, 20]} c={C.dark}/>
  </group>;
}
function MiniRocket() {
  return <group>
    <mesh position={[0, .55, 0]}><capsuleGeometry args={[.2, .5, 6, 16]}/><M c={C.cream}/></mesh>
    <mesh position={[0, 1.02, 0]}><coneGeometry args={[.2, .3, 16]}/><M c={C.violet}/></mesh>
    {[0, 1, 2].map(i => <Box key={i} s={[.04, .3, .22]} p={[Math.cos(i * 2.09) * .2, .2, Math.sin(i * 2.09) * .2]} r={[0, -i * 2.09, 0]} c={C.indigo}/>)}
    <Cyl a={[.08, .08, .02, 16]} p={[0, .66, .2]} r={[Math.PI / 2, 0, 0]} c={C.sky} glow={.5}/>
  </group>;
}
function Laptop() {
  return <group>
    <Box s={[1, .05, .7]} p={[0, .03, 0]} c={C.steel}/>
    <Box s={[1, .66, .04]} p={[0, .38, -.34]} r={[-.18, 0, 0]} c={C.steel}/>
    <Box s={[.88, .54, .01]} p={[0, .39, -.31]} r={[-.18, 0, 0]} c={C.sky} glow={.55}/>
  </group>;
}
function Bulb() {
  return <group>
    <Cyl a={[.14, .16, .26, 16]} p={[0, .13, 0]} c={C.steel}/>
    <Ball rad={.34} p={[0, .55, 0]} c={C.gold} glow={.7}/>
  </group>;
}

// ---------- Education ----------
function Books() {
  return <group>
    <Box s={[.9, .18, .62]} p={[0, .09, 0]} c={C.indigo}/>
    <Box s={[.84, .16, .58]} p={[.03, .26, 0]} r={[0, .12, 0]} c={C.rose}/>
    <Box s={[.78, .17, .56]} p={[-.02, .43, 0]} r={[0, -.08, 0]} c={C.teal}/>
    <Box s={[.8, .02, .5]} p={[-.02, .52, 0]} r={[0, -.08, 0]} c={C.cream}/>
  </group>;
}
function GraduationCap() {
  return <group>
    <Cyl a={[.34, .38, .34, 32]} p={[0, .17, 0]} c={C.navy}/>
    <Box s={[.95, .07, .95]} p={[0, .37, 0]} r={[0, Math.PI / 4, 0]} c={C.dark}/>
    <Ball rad={.06} p={[0, .42, 0]} c={C.gold}/>
    <Cyl a={[.02, .02, .34, 8]} p={[.34, .22, .08]} c={C.gold}/><Ball rad={.06} p={[.34, .04, .08]} c={C.gold}/>
  </group>;
}
function School() {
  return <group>
    <Box s={[1, .62, .7]} p={[0, .31, 0]} c={C.cream}/>
    <mesh position={[0, .86, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[.78, .48, 4]}/><M c={C.violet}/></mesh>
    <Box s={[.22, .34, .02]} p={[0, .17, .36]} c={C.dark}/>
    {[-1, 1].map(s => <Box key={s} s={[.18, .16, .02]} p={[s * .32, .4, .36]} c={C.sky} glow={.5}/>)}
  </group>;
}
function Pencil() {
  return <group position={[0, .12, 0]} rotation={[0, .6, Math.PI / 2 - .25]}>
    <Cyl a={[.11, .11, .9, 6]} c={C.gold}/>
    <mesh position={[0, .56, 0]}><coneGeometry args={[.11, .22, 6]}/><M c={C.wood}/></mesh>
    <Cyl a={[.11, .11, .14, 12]} p={[0, -.52, 0]} c={C.rose}/>
  </group>;
}
function Globe() {
  return <group>
    <Cyl a={[.24, .3, .08]} p={[0, .04, 0]} c={C.navy}/>
    <Cyl a={[.03, .03, .32, 8]} p={[0, .2, 0]} c={C.steel}/>
    <Ball rad={.36} p={[0, .66, 0]} c={C.sky}/>
    <mesh position={[0, .66, 0]} rotation={[0, 0, .4]}><torusGeometry args={[.42, .025, 8, 32, Math.PI * 1.2]}/><M c={C.steel}/></mesh>
  </group>;
}

// ---------- Skills ----------
function Star() {
  const geometry = useMemo(() => extruded(Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .24 : .55; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
  }), .14), []);
  return <mesh geometry={geometry} position={[0, .6, 0]}><M c={C.gold} glow={.25}/></mesh>;
}
function Crystals() {
  return <group>
    {([[0, .55, 0, 1, C.teal], [.3, .35, .1, .65, C.mint], [-.28, .32, -.05, .6, C.lilac]] as const).map(([x, y, z, s, c], i) =>
      <mesh key={i} position={[x, y * s, z]} scale={[.28 * s, .62 * s, .28 * s]} rotation={[0, i, (i - 1) * .18]}><octahedronGeometry args={[1]}/><M c={c} glow={.35}/></mesh>)}
  </group>;
}
function Wrench() {
  return <group position={[0, .1, 0]} rotation={[0, .5, -.5]}>
    <Box s={[.14, .8, .08]} p={[0, .4, 0]} c={C.steel}/>
    <mesh position={[0, .88, 0]}><torusGeometry args={[.16, .07, 10, 20, Math.PI * 1.5]}/><M c={C.steel}/></mesh>
  </group>;
}
function CodeBrackets() {
  return <group position={[0, .5, 0]}>
    {[-1, 1].map(s => <group key={s} position={[s * .38, 0, 0]}>
      <Box s={[.34, .09, .09]} p={[0, .11, 0]} r={[0, 0, s * .6]} c={C.violet} glow={.6}/>
      <Box s={[.34, .09, .09]} p={[0, -.11, 0]} r={[0, 0, -s * .6]} c={C.violet} glow={.6}/>
    </group>)}
    <Box s={[.09, .6, .09]} r={[0, 0, -.38]} c={C.sky} glow={.6}/>
  </group>;
}
function Bolt() {
  const geometry = useMemo(() => extruded([[.1, .6], [-.25, -.02], [-.02, -.02], [-.12, -.6], [.26, .08], [.03, .08]], .12), []);
  return <mesh geometry={geometry} position={[0, .62, 0]}><M c={C.gold} glow={.3}/></mesh>;
}

// ---------- Contact ----------
function SpeechBubble() {
  return <group position={[0, .5, 0]}>
    <Ball rad={1} s={[.56, .42, .28]} c={C.cream}/>
    <mesh position={[-.28, -.38, 0]} rotation={[0, 0, -.55]}><coneGeometry args={[.12, .28, 16]}/><M c={C.cream}/></mesh>
    {[-.2, 0, .2].map(x => <Ball key={x} rad={.06} p={[x, 0, .27]} c={C.violet}/>)}
  </group>;
}
function Mailbox() {
  return <group>
    <Cyl a={[.05, .05, .7, 8]} p={[0, .35, 0]} c={C.steel}/>
    <Box s={[.36, .3, .6]} p={[0, .85, 0]} c={C.indigo}/>
    <Cyl a={[.18, .18, .6, 20]} p={[0, 1, 0]} r={[Math.PI / 2, 0, 0]} c={C.indigo}/>
    <Box s={[.04, .3, .1]} p={[.2, 1.05, .12]} c={C.rose}/>
  </group>;
}
function Dish() {
  return <group>
    <Cyl a={[.06, .08, .5, 10]} p={[0, .25, 0]} c={C.steel}/>
    <group position={[0, .6, 0]} rotation={[-.7, 0, 0]}>
      <mesh scale={[1, .3, 1]}><sphereGeometry args={[.45, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshStandardMaterial color={C.cream} roughness={.6} side={THREE.DoubleSide}/></mesh>
      <Cyl a={[.015, .015, .4, 6]} p={[0, .2, 0]} c={C.steel}/><Ball rad={.05} p={[0, .4, 0]} c={C.rose} glow={1}/>
    </group>
  </group>;
}
function Envelope() {
  return <group position={[0, .36, 0]} rotation={[-.2, .3, 0]}>
    <Box s={[.9, .6, .06]} c={C.cream}/>
    <Box s={[.55, .05, .02]} p={[-.22, .1, .04]} r={[0, 0, -.6]} c={C.violet}/>
    <Box s={[.55, .05, .02]} p={[.22, .1, .04]} r={[0, 0, .6]} c={C.violet}/>
  </group>;
}
function Antenna() {
  return <group>
    <Cyl a={[.22, .3, .12]} p={[0, .06, 0]} c={C.navy}/>
    <Cyl a={[.03, .05, 1.5, 8]} p={[0, .8, 0]} c={C.steel}/>
    {[.6, .9, 1.2].map((y, i) => <Box key={y} s={[.5 - i * .12, .03, .03]} p={[0, y, 0]} c={C.steel}/>)}
    <Ball rad={.06} p={[0, 1.58, 0]} c={C.rose} glow={1.4}/>
  </group>;
}

// ---------- About me: the things in Omar's orbit ----------
const lift = (Toy: ComponentType, y = .5, scale = 1) => () => <group position={[0, y, 0]} scale={scale}><Toy/></group>;

/** Every planet's models; the first is its landmark, shown larger on top of the planet. */
export const THEME_PROPS: Record<DestinationId, ComponentType[]> = {
  home: [lift(InterestLaptop, .45), lift(Glove, .55, 1.2), lift(Record, .45), lift(Book, .5), lift(Clapper, .45), lift(Palette, .4)],
  experience: [Briefcase, Office, Flag, Stairs, Trophy],
  projects: [Blocks, Gear, MiniRocket, Laptop, Bulb],
  education: [GraduationCap, Books, School, Pencil, Globe],
  skills: [Star, Crystals, Wrench, CodeBrackets, Bolt],
  contact: [SpeechBubble, Mailbox, Dish, Envelope, Antenna],
};
