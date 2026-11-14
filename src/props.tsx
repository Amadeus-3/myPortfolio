import type { ComponentType } from 'react';
import * as THREE from 'three';
import type { DestinationId } from './flight';
import { seeded } from './route';
import { circle, extrude, lathe, mat, rbox, shared } from './shapes';

// Small themed models, built about one unit tall with their base at y = 0. The same pieces dot each planet from orbit
// and populate the landing scene up close, so every planet keeps one visual identity. They are toy-like but detailed:
// rounded edges, turned and extruded silhouettes, and the small parts that make an object read (latches, studs,
// mullions, tassels, grooves). Geometries and materials are shared between every copy (see shapes.ts).
const C = {
  cream: '#f1edff', lilac: '#b9a8ff', violet: '#7e6aff', indigo: '#4f5bd5', navy: '#2b2f6b', sky: '#8fb4ff',
  teal: '#5fc4bd', mint: '#a9e3d6', rose: '#f29ac0', gold: '#f5d77a', steel: '#9aa3c7', wood: '#b58a6a', dark: '#23264d',
};
type V = [number, number, number];
type Pt = [number, number];
const Part = ({ g, m, p, r, s }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V; r?: V; s?: V | number }) => <mesh geometry={g} material={m} position={p} rotation={r} scale={s}/>;
const cyl = (top: number, bottom: number, h: number, n = 24) => shared(`cyl ${top} ${bottom} ${h} ${n}`, () => new THREE.CylinderGeometry(top, bottom, h, n));
const ball = (r: number, n = 20) => shared(`ball ${r} ${n}`, () => new THREE.SphereGeometry(r, n, Math.max(8, n * .7 | 0)));
const ring = (r: number, t: number, arc = Math.PI * 2, n = 32) => shared(`ring ${r} ${t} ${arc} ${n}`, () => new THREE.TorusGeometry(r, t, 10, n, arc));
const metal = (c: string) => mat(c, { metal: .55, rough: .32 });
const glow = (c: string, g = .7) => mat(c, { glow: g });
/** A rod between two points. */
function Strut({ a, b, r, m }: { a: V; b: V; r: number; m: THREE.Material }) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from);
  return <mesh geometry={cyl(r, r, 1, 8)} material={m} position={from.add(to).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())} scale={[1, d.length(), 1]}/>;
}
/** A rounded-rectangle outline, with an optional tail (for the speech bubble). */
function roundedRect(w: number, h: number, r: number, tail?: Pt[]): Pt[] {
  const corner = (cx: number, cy: number, from: number) => Array.from({ length: 7 }, (_, i) => { const a = from + i / 6 * Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt; });
  const x = w / 2 - r, y = h / 2 - r;
  return [...corner(x, -y, -Math.PI / 2), ...corner(x, y, 0), ...corner(-x, y, Math.PI / 2), ...corner(-x, -y, Math.PI), ...(tail ?? [])];
}

// ---------- Experience ----------
function Briefcase() {
  const brass = metal(C.gold);
  return <group>
    <Part g={rbox(1.1, .72, .42, .09)} m={mat(C.navy, { rough: .5 })} p={[0, .38, 0]}/>
    <Part g={rbox(1.12, .05, .44, .02)} m={mat(C.dark)} p={[0, .52, 0]}/>
    {[-.3, .3].map(x => <Part key={x} g={rbox(.14, .1, .05, .02)} m={brass} p={[x, .52, .215]}/>)}
    <Part g={ring(.17, .045, Math.PI, 20)} m={mat(C.dark, { rough: .45 })} p={[0, .76, 0]}/>
    {[-1, 1].map(s => <Part key={s} g={rbox(.08, .06, .12, .02)} m={brass} p={[s * .17, .76, 0]}/>)}
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => <Part key={`${x}${y}`} g={ball(.045, 12)} m={brass} p={[x * .52, .38 + y * .32, .19]}/>)}
  </group>;
}
function Office() {
  const pane = rbox(.12, .15, .02, .01), lit = glow(C.sky, .75);
  return <group>
    <Part g={rbox(.8, .12, .8, .03)} m={mat(C.navy)} p={[0, .06, 0]}/>
    <Part g={rbox(.66, 1.3, .66, .05)} m={mat(C.indigo, { rough: .5 })} p={[0, .77, 0]}/>
    {[0, 1, 2, 3].flatMap(r => [-1, 0, 1].flatMap(c => [
      <Part key={`f${r}${c}`} g={pane} m={lit} p={[c * .19, .52 + r * .26, .335]}/>,
      <Part key={`s${r}${c}`} g={pane} m={lit} p={[.335, .52 + r * .26, c * .19]} r={[0, Math.PI / 2, 0]}/>]))}
    <Part g={rbox(.22, .26, .03, .02)} m={mat(C.dark)} p={[0, .25, .34]}/>
    <Part g={rbox(.36, .04, .14, .015)} m={mat(C.lilac)} p={[0, .4, .38]}/>
    <Part g={rbox(.74, .08, .74, .03)} m={mat(C.navy)} p={[0, 1.46, 0]}/>
    <Part g={rbox(.22, .12, .18, .03)} m={mat(C.steel)} p={[-.15, 1.56, .1]}/>
    <Part g={cyl(.015, .02, .36, 6)} m={mat(C.steel)} p={[.2, 1.68, -.15]}/>
    <Part g={ball(.04, 12)} m={glow(C.rose, 1.3)} p={[.2, 1.87, -.15]}/>
  </group>;
}
const flagCloth = () => shared('flag-cloth', () => {
  const g = new THREE.PlaneGeometry(.62, .38, 16, 4), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const along = (p.getX(i) + .31) / .62; p.setZ(i, Math.sin(along * 7) * .045 * along); }
  g.computeVertexNormals(); g.translate(.31, 0, 0);
  return g;
});
function Flag() {
  return <group>
    <Part g={lathe('flag-base', [[0, 0], [.17, 0], [.165, .04], [.11, .07], [.04, .09], [0, .09]], 24)} m={mat(C.steel, { metal: .4, rough: .4 })}/>
    <Part g={cyl(.022, .022, 1.5, 10)} m={mat(C.cream, { metal: .3, rough: .35 })} p={[0, .8, 0]}/>
    <Part g={ball(.045, 12)} m={metal(C.gold)} p={[0, 1.57, 0]}/>
    <Part g={flagCloth()} m={mat(C.rose, { double: true })} p={[.02, 1.32, 0]}/>
  </group>;
}
function Stairs() {
  const rail = metal(C.steel);
  return <group>
    {[0, 1, 2, 3].map(i => <Part key={i} g={rbox(.72, .24 * (i + 1), .3, .04)} m={mat(i % 2 ? C.lilac : C.cream)} p={[0, .12 * (i + 1), .42 - i * .28]}/>)}
    {[0, 1, 2, 3].map(i => <Part key={`p${i}`} g={cyl(.016, .016, .3, 6)} m={rail} p={[.32, .24 * (i + 1) + .15, .42 - i * .28]}/>)}
    <Strut a={[.32, .54, .48]} b={[.32, 1.26, -.42]} r={.02} m={rail}/>
    <Part g={ball(.06, 12)} m={glow(C.gold, .4)} p={[-.15, 1.03, -.42]}/>
  </group>;
}
function Trophy() {
  const gold = mat(C.gold, { metal: .65, rough: .25, double: true });
  return <group>
    <Part g={rbox(.46, .16, .46, .04)} m={mat(C.navy)} p={[0, .08, 0]}/>
    <Part g={rbox(.2, .06, .01, .005)} m={metal(C.gold)} p={[0, .08, .232]}/>
    <Part g={lathe('trophy', [[0, .16], [.14, .16], [.13, .19], [.07, .23], [.05, .3], [.045, .4], [.06, .46], [.1, .5], [.17, .56], [.24, .66], [.29, .78], [.31, .9], [.32, 1], [.3, 1.005], [.28, .93], [.25, .83]], 32)} m={gold}/>
    {[-1, 1].map(s => <Part key={s} g={ring(.12, .026, Math.PI, 16)} m={gold} p={[s * .3, .8, 0]} r={[0, 0, -s * Math.PI / 2]}/>)}
  </group>;
}

// ---------- Projects ----------
function Brick({ size, p, r, c }: { size: number; p: V; r?: V; c: string }) {
  const stud = cyl(size * .13, size * .13, size * .1, 16), m = mat(c, { rough: .42 });
  return <group position={p} rotation={r}>
    <Part g={rbox(size, size, size, size * .12)} m={m}/>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <Part key={`${x}${z}`} g={stud} m={m} p={[x * size * .24, size * .53, z * size * .24]}/>)}
  </group>;
}
function Blocks() {
  return <group>
    <Brick size={.5} p={[-.28, .25, 0]} c={C.lilac}/>
    <Brick size={.44} p={[.3, .22, .06]} r={[0, .5, 0]} c={C.sky}/>
    <Brick size={.42} p={[-.04, .71, .02]} r={[0, .9, 0]} c={C.teal}/>
  </group>;
}
function gearOutline(teeth: number, root: number, tip: number): Pt[] {
  return Array.from({ length: teeth * 4 }, (_, i) => {
    const a = (Math.floor(i / 4) + [0, .15, .45, .6][i % 4]) / teeth * Math.PI * 2, r = i % 4 === 1 || i % 4 === 2 ? tip : root;
    return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
  });
}
function Gear() {
  const big = extrude('gear-big', gearOutline(10, .38, .48), .12, { bevel: .02, holes: [circle(.09, 0, 0, 20, true), ...[0, 1, 2, 3].map(k => circle(.065, Math.cos(k * Math.PI / 2 + .4) * .23, Math.sin(k * Math.PI / 2 + .4) * .23, 16, true))] });
  const small = extrude('gear-small', gearOutline(7, .2, .28), .1, { bevel: .02, holes: [circle(.06, 0, 0, 16, true)] });
  return <group>
    <Part g={big} m={mat(C.steel, { metal: .45, rough: .4 })} p={[0, .52, 0]}/>
    <Part g={small} m={mat(C.lilac, { metal: .3, rough: .45 })} p={[.62, .3, .02]} r={[0, 0, .3]}/>
    <Part g={cyl(.09, .09, .22, 16)} m={mat(C.dark, { metal: .4 })} p={[0, .52, 0]} r={[Math.PI / 2, 0, 0]}/>
    <Part g={cyl(.06, .06, .18, 16)} m={mat(C.dark, { metal: .4 })} p={[.62, .3, .02]} r={[Math.PI / 2, 0, 0]}/>
  </group>;
}
function MiniRocket() {
  const fin = extrude('mini-fin', [[0, .05], [0, -.25], [.14, -.36], [.18, -.34], [.06, -.06]], .035, { bevel: .012, keep: true });
  return <group>
    <Part g={lathe('mini-body', [[0, .12], [.12, .12], [.17, .2], [.2, .34], [.2, .8]], 28)} m={mat(C.cream, { rough: .4 })}/>
    <Part g={lathe('mini-nose', [[.2, .8], [.18, .92], [.13, 1.03], [.06, 1.12], [0, 1.15]], 28)} m={mat(C.violet, { rough: .45 })}/>
    <Part g={ring(.2, .015, Math.PI * 2, 32)} m={mat(C.lilac)} p={[0, .8, 0]} r={[Math.PI / 2, 0, 0]}/>
    <Part g={ring(.075, .018, Math.PI * 2, 24)} m={metal(C.lilac)} p={[0, .6, .195]}/>
    <Part g={shared('mini-glass', () => new THREE.CircleGeometry(.07, 20))} m={mat(C.navy, { metal: .3, rough: .15 })} p={[0, .6, .2]}/>
    {[0, 1, 2].map(i => <group key={i} rotation={[0, i * Math.PI * 2 / 3 + Math.PI / 2, 0]}><Part g={fin} m={mat(C.indigo)} p={[.16, .36, 0]}/></group>)}
    <Part g={lathe('mini-bell', [[.08, .13], [.1, .08], [.13, .02], [.14, 0]], 20)} m={mat('#575d7a', { metal: .6, rough: .35, double: true })}/>
  </group>;
}
/** An open laptop with a keyboard, trackpad and lines of code on the screen. */
function LaptopModel({ body = C.steel, keys = C.dark, screen = '#1d2050', code = [C.violet, C.teal, C.gold, C.lilac] }: { body?: string; keys?: string; screen?: string; code?: string[] }) {
  return <group>
    <Part g={rbox(1, .05, .68, .02)} m={mat(body, { metal: .35, rough: .4 })} p={[0, .03, 0]}/>
    {[0, 1, 2, 3].map(i => <Part key={i} g={rbox(.82, .012, .055, .005)} m={mat(keys, { rough: .7 })} p={[0, .058, -.22 + i * .075]}/>)}
    <Part g={rbox(.3, .008, .16, .004)} m={mat(body, { metal: .2, rough: .3 })} p={[0, .057, .19]}/>
    <Part g={cyl(.025, .025, .9, 12)} m={mat(body, { metal: .4 })} p={[0, .05, -.33]} r={[0, 0, Math.PI / 2]}/>
    <group position={[0, .05, -.33]} rotation={[-.26, 0, 0]}>
      <Part g={rbox(1, .66, .035, .02)} m={mat(body, { metal: .35, rough: .4 })} p={[0, .34, 0]}/>
      <Part g={rbox(.9, .56, .01, .005)} m={mat(screen, { glow: .25, rough: .3 })} p={[0, .35, .02]}/>
      {[[.5, 0], [.32, .06], [.42, .06], [.24, .12], [.36, 0], [.2, .06]].map(([w, indent], i) =>
        <Part key={i} g={rbox(w, .03, .006, .003)} m={glow(code[i % code.length], .9)} p={[-.38 + indent + w / 2, .55 - i * .07, .028]}/>)}
    </group>
  </group>;
}
const Laptop = () => <LaptopModel/>;
function Bulb() {
  return <group>
    <Part g={cyl(.14, .14, .24, 20)} m={metal(C.steel)} p={[0, .24, 0]}/>
    {[.16, .23, .3].map(y => <Part key={y} g={ring(.145, .02, Math.PI * 2, 24)} m={metal(C.steel)} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]}/>)}
    <Part g={lathe('bulb-tip', [[0, .06], [.1, .08], [.13, .12], [0, .12]], 16)} m={mat(C.dark)}/>
    <Part g={lathe('bulb-glass', [[.1, .36], [.14, .41], [.2, .5], [.29, .63], [.33, .77], [.31, .91], [.24, 1.01], [.12, 1.07], [0, 1.08]], 32)} m={mat(C.gold, { glow: .55, opacity: .62, rough: .15 })}/>
    <Part g={ball(.07, 14)} m={glow('#fff4c8', 2.4)} p={[0, .7, 0]}/>
    {[-1, 1].map(s => <Strut key={s} a={[s * .05, .38, 0]} b={[s * .04, .66, 0]} r={.008} m={metal(C.steel)}/>)}
  </group>;
}

// ---------- Education ----------
function GraduationCap() {
  const gold = metal(C.gold);
  return <group>
    <Part g={lathe('cap-skull', [[0, .02], [.3, .02], [.33, .08], [.34, .2], [.32, .3], [0, .3]], 32)} m={mat(C.navy, { rough: .55 })}/>
    <Part g={rbox(.95, .06, .95, .02)} m={mat(C.dark, { rough: .6 })} p={[0, .34, 0]} r={[0, Math.PI / 4, 0]}/>
    <Part g={ball(.05, 12)} m={gold} p={[0, .38, 0]}/>
    <Strut a={[0, .38, 0]} b={[.6, .375, 0]} r={.012} m={gold}/>
    <Strut a={[.62, .37, 0]} b={[.63, .14, 0]} r={.012} m={gold}/>
    <Part g={lathe('tassel', [[0, .16], [.03, .15], [.05, .08], [.055, 0], [0, 0]], 16)} m={gold} p={[.63, -.04, 0]}/>
  </group>;
}
function Book({ size: [w, h, d], p, r, cover }: { size: V; p: V; r?: V; cover: string }) {
  return <group position={p} rotation={r}>
    <Part g={rbox(w, h, d, .03)} m={mat(cover, { rough: .55 })}/>
    <Part g={rbox(w * .95, h * .72, d * .95, .01)} m={mat(C.cream, { rough: .8 })} p={[w * .035, 0, 0]}/>
    {[-1, 1].map(s => <Part key={s} g={rbox(.012, h * 1.02, .018, .005)} m={metal(C.gold)} p={[-w / 2 - .003, 0, s * d * .3]}/>)}
  </group>;
}
function Books() {
  return <group>
    <Book size={[.9, .18, .62]} p={[0, .09, 0]} cover={C.indigo}/>
    <Book size={[.84, .16, .58]} p={[.03, .26, 0]} r={[0, .12, 0]} cover={C.rose}/>
    <Book size={[.78, .17, .56]} p={[-.02, .43, 0]} r={[0, -.08, 0]} cover={C.teal}/>
    <Part g={rbox(.04, .22, .01, .004)} m={mat(C.gold)} p={[.1, .3, .3]}/>
    <Part g={ball(.1, 16)} m={mat(C.rose, { rough: .35 })} p={[.12, .6, -.05]} s={[1, .9, 1]}/>
    <Part g={cyl(.01, .012, .07, 6)} m={mat(C.wood)} p={[.12, .71, -.05]}/>
    <Part g={extrude('leaf', [[0, 0], [.04, .03], [.09, .02], [.05, -.02]], .01, { bevel: .004 })} m={mat(C.teal)} p={[.16, .72, -.05]}/>
  </group>;
}
function School() {
  const roof = extrude('school-roof', [[-.58, 0], [.58, 0], [0, .34]], .74, { bevel: .015 });
  const pediment = extrude('school-pediment', [[-.28, 0], [.28, 0], [0, .14]], .08, { bevel: .01 });
  return <group>
    <Part g={rbox(1.02, .08, .74, .02)} m={mat(C.steel)} p={[0, .04, .02]}/>
    <Part g={rbox(1, .58, .66, .03)} m={mat(C.cream, { rough: .55 })} p={[0, .37, 0]}/>
    <Part g={roof} m={mat(C.violet, { rough: .5 })} p={[0, .83, 0]}/>
    {[-.21, -.07, .07, .21].map(x => <Part key={x} g={cyl(.03, .035, .46, 12)} m={mat(C.cream)} p={[x, .31, .42]}/>)}
    <Part g={rbox(.56, .04, .16, .01)} m={mat(C.lilac)} p={[0, .56, .42]}/>
    <Part g={pediment} m={mat(C.lilac)} p={[0, .65, .43]}/>
    <Part g={rbox(.12, .24, .02, .01)} m={mat(C.dark)} p={[0, .2, .335]}/>
    {[-1, 1].map(s => <group key={s}>
      <Part g={rbox(.16, .17, .02, .01)} m={glow(C.sky, .55)} p={[s * .38, .4, .335]}/>
      <Part g={rbox(.19, .03, .03, .01)} m={mat(C.lilac)} p={[s * .38, .3, .34]}/>
    </group>)}
    <Part g={cyl(.075, .075, .02, 24)} m={mat(C.cream)} p={[0, .9, .38]} r={[Math.PI / 2, 0, 0]}/>
    <Part g={rbox(.012, .05, .01, .004)} m={mat(C.dark)} p={[0, .915, .392]}/>
    <Part g={rbox(.04, .012, .01, .004)} m={mat(C.dark)} p={[.015, .9, .392]}/>
  </group>;
}
function Pencil() {
  return <group position={[0, .12, 0]} rotation={[0, .6, Math.PI / 2 - .25]}>
    <Part g={cyl(.1, .1, .86, 6)} m={mat(C.gold, { rough: .45 })}/>
    <Part g={cyl(.0, .1, .2, 6)} m={mat(C.wood)} p={[0, .53, 0]}/>
    <Part g={cyl(.0, .034, .068, 12)} m={mat(C.dark, { metal: .3 })} p={[0, .6, 0]}/>
    <Part g={cyl(.104, .104, .12, 16)} m={metal(C.steel)} p={[0, -.49, 0]}/>
    {[-.45, -.53].map(y => <Part key={y} g={ring(.105, .012, Math.PI * 2, 20)} m={metal(C.steel)} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]}/>)}
    <Part g={lathe('eraser', [[0, -.55], [.1, -.55], [.1, -.62], [.08, -.66], [0, -.67]], 16)} m={mat(C.rose, { rough: .7 })}/>
  </group>;
}
let globeSkin: THREE.Material | null = null;
/** The globe's surface: a sea with scattered continents, painted once. */
function globeMaterial() {
  if (globeSkin) return globeSkin;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const c = canvas.getContext('2d')!, rand = seeded(42);
  c.fillStyle = C.sky; c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 30; i++) { c.fillStyle = i % 3 ? C.teal : C.mint; c.beginPath(); c.ellipse(rand() * 256, 18 + rand() * 92, 6 + rand() * 22, 4 + rand() * 13, rand() * 3, 0, Math.PI * 2); c.fill(); }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  return globeSkin = new THREE.MeshStandardMaterial({ map, roughness: .5 });
}
function Globe() {
  const brass = metal(C.gold);
  return <group>
    <Part g={lathe('globe-foot', [[0, 0], [.26, 0], [.25, .04], [.16, .07], [.06, .1], [.04, .2], [0, .2]], 28)} m={mat(C.navy, { rough: .45 })}/>
    <group position={[0, .64, 0]} rotation={[0, 0, .41]}>
      <Part g={ball(.34, 32)} m={globeMaterial()}/>
      <Part g={ring(.39, .018, Math.PI * 1.25, 32)} m={brass} r={[0, 0, -Math.PI * .62]}/>
      {[-1, 1].map(s => <Part key={s} g={ball(.025, 10)} m={brass} p={[0, s * .38, 0]}/>)}
    </group>
    <Strut a={[0, .18, 0]} b={[.12, .3, 0]} r={.016} m={brass}/>
  </group>;
}

// ---------- Skills ----------
function Star() {
  const star = extrude('star', Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .23 : .52; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; }), .1, { bevel: .06 });
  return <group>
    <Part g={lathe('star-stand', [[0, 0], [.2, 0], [.19, .04], [.08, .07], [.03, .2], [0, .2]], 24)} m={mat(C.indigo, { rough: .45 })}/>
    <Part g={star} m={mat(C.gold, { glow: .3, metal: .3, rough: .3 })} p={[0, .66, 0]}/>
  </group>;
}
function Crystals() {
  const crystal = lathe('crystal', [[0, 0], [.12, .03], [.12, .55], [0, .78]], 6);
  return <group>
    <Part g={shared('crystal-rock', () => new THREE.DodecahedronGeometry(.32, 0))} m={mat(C.dark, { flat: true, rough: .8 })} p={[0, .08, 0]} s={[1.3, .45, 1.1]}/>
    {([[0, .1, 0, 1.2, 0, C.teal], [.2, .08, .1, .8, .45, C.mint], [-.2, .08, -.05, .75, -.4, C.lilac], [.06, .08, -.2, .6, -.25, C.mint], [-.08, .08, .2, .55, .3, C.teal]] as const).map(([x, y, z, s, tilt, c], i) =>
      <Part key={i} g={crystal} m={mat(c, { glow: .35, flat: true, rough: .25 })} p={[x, y, z]} r={[tilt * .5, i, tilt]} s={s}/>)}
  </group>;
}
function wrenchOutline(): Pt[] {
  const head = (from: number, to: number) => Array.from({ length: 12 }, (_, i) => { const a = (from + (to - from) * i / 11) * Math.PI / 180; return [Math.cos(a) * .2, .78 + Math.sin(a) * .2] as Pt; });
  const end = Array.from({ length: 9 }, (_, i) => { const a = -i / 8 * Math.PI; return [Math.cos(a) * .065, .04 + Math.sin(a) * .065] as Pt; });
  return [[-.065, .04], [-.065, .62], ...head(245, 115), [-.07, .9], [-.07, .82], [.07, .82], [.07, .9], ...head(65, -65), [.065, .62], [.065, .04], ...end.slice(1, -1)];
}
function Wrench() {
  return <group position={[0, .12, 0]} rotation={[0, .5, -.5]}>
    <Part g={extrude('wrench', wrenchOutline(), .06, { bevel: .02, keep: true })} m={mat(C.steel, { metal: .55, rough: .3 })}/>
    <Part g={ring(.11, .014, Math.PI * 2, 24)} m={mat(C.dark)} p={[0, .78, .05]}/>
  </group>;
}
function CodeBrackets() {
  const angle = extrude('code-angle', [[.16, .3], [-.14, 0], [.16, -.3], [.24, -.22], [.03, 0], [.24, .22]], .09, { bevel: .025 });
  const slash = extrude('code-slash', [[.06, .32], [.15, .32], [-.06, -.32], [-.15, -.32]], .09, { bevel: .025 });
  return <group position={[0, .5, 0]}>
    <Part g={angle} m={mat(C.violet, { glow: .6, rough: .35 })} p={[-.38, 0, 0]}/>
    <Part g={angle} m={mat(C.violet, { glow: .6, rough: .35 })} p={[.38, 0, 0]} r={[0, Math.PI, 0]}/>
    <Part g={slash} m={mat(C.sky, { glow: .6, rough: .35 })}/>
  </group>;
}
function Bolt() {
  const bolt = extrude('bolt', [[.1, .6], [-.25, -.02], [-.02, -.02], [-.12, -.6], [.26, .08], [.03, .08]], .1, { bevel: .04 });
  return <group>
    <Part g={bolt} m={mat(C.gold, { glow: .35, metal: .25, rough: .3 })} p={[0, .66, 0]}/>
    <Part g={bolt} m={mat(C.gold, { glow: .35, metal: .25, rough: .3 })} p={[.34, .32, -.1]} r={[0, .4, .25]} s={.42}/>
  </group>;
}

// ---------- Contact ----------
function SpeechBubble() {
  const bubble = extrude('bubble', roundedRect(.92, .6, .22, [[-.12, -.3], [-.3, -.48], [-.24, -.3]]), .14, { bevel: .06 });
  return <group position={[0, .58, 0]}>
    <Part g={bubble} m={mat(C.cream, { rough: .45 })}/>
    {[-.2, 0, .2].map(x => <Part key={x} g={ball(.06, 14)} m={mat(C.violet, { rough: .4 })} p={[x, .02, .14]}/>)}
  </group>;
}
function Mailbox() {
  const arch: Pt[] = [[-.18, 0], [.18, 0], [.18, .2], ...Array.from({ length: 13 }, (_, i) => { const a = i / 12 * Math.PI; return [Math.cos(a) * .18, .2 + Math.sin(a) * .18] as Pt; }), [-.18, .2]];
  return <group>
    <Part g={rbox(.26, .06, .26, .02)} m={mat(C.navy)} p={[0, .03, 0]}/>
    <Part g={rbox(.08, .74, .08, .02)} m={mat(C.wood, { rough: .7 })} p={[0, .43, 0]}/>
    <group position={[0, .8, 0]}>
      <Part g={extrude('mailbox', arch, .62, { bevel: .02, keep: true })} m={mat(C.indigo, { rough: .45 })}/>
      <Part g={extrude('mailbox-door', arch.map(([x, y]) => [x * 1.06, y * 1.04 - .01] as Pt), .025, { bevel: .01, keep: true })} m={mat(C.lilac, { rough: .45 })} p={[0, 0, .33]}/>
      <Part g={rbox(.18, .02, .1, .005)} m={mat(C.cream)} p={[0, .3, .33]}/>
      <group position={[.21, .16, -.1]} rotation={[0, 0, .25]}>
        <Part g={rbox(.025, .3, .04, .01)} m={mat(C.rose)} p={[0, .15, 0]}/>
        <Part g={rbox(.025, .1, .16, .01)} m={mat(C.rose)} p={[0, .27, .07]}/>
      </group>
    </group>
  </group>;
}
function Dish() {
  const steel = metal(C.steel);
  return <group>
    <Part g={lathe('dish-foot', [[0, 0], [.2, 0], [.18, .05], [.08, .09], [.06, .3], [0, .3]], 24)} m={mat(C.navy, { rough: .45 })}/>
    <Part g={rbox(.2, .06, .08, .02)} m={steel} p={[0, .34, 0]}/>
    <group position={[0, .5, 0]} rotation={[-.7, 0, 0]}>
      <Part g={lathe('dish', [[0, -.1], [.1, -.09], [.2, -.06], [.3, -.01], [.38, .05], [.42, .09]], 40)} m={mat(C.cream, { rough: .5, double: true })}/>
      <Part g={ring(.42, .018, Math.PI * 2, 48)} m={steel} p={[0, .09, 0]} r={[Math.PI / 2, 0, 0]}/>
      {[0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2; return <Strut key={k} a={[Math.cos(a) * .4, .09, Math.sin(a) * .4]} b={[0, .4, 0]} r={.01} m={steel}/>; })}
      <Part g={cyl(.04, .05, .08, 12)} m={mat(C.dark)} p={[0, .42, 0]}/>
      <Part g={ball(.035, 10)} m={glow(C.rose, 1.2)} p={[0, .48, 0]}/>
    </group>
  </group>;
}
function Envelope() {
  return <group position={[0, .38, 0]} rotation={[-.2, .3, 0]}>
    <Part g={rbox(.9, .6, .05, .03)} m={mat(C.cream, { rough: .6 })}/>
    <Part g={extrude('envelope-flap', [[-.43, .28], [.43, .28], [0, -.05]], .012, { bevel: .006 })} m={mat('#e3defa', { rough: .6 })} p={[0, .15, .03]}/>
    <Part g={cyl(.065, .065, .025, 20)} m={mat(C.rose, { rough: .4 })} p={[0, .0, .045]} r={[Math.PI / 2, 0, 0]}/>
    {[0, 1].map(i => <Part key={i} g={rbox(.3 - i * .08, .02, .006, .003)} m={mat(C.lilac)} p={[.18 - i * .04, -.13 - i * .06, .03]}/>)}
  </group>;
}
function Antenna() {
  const steel = metal(C.steel), legs = [0, 1, 2].map(k => k / 3 * Math.PI * 2 + .3);
  const at = (a: number, r: number, y: number): V => [Math.cos(a) * r, y, Math.sin(a) * r];
  return <group>
    <Part g={rbox(.6, .08, .6, .02)} m={mat(C.navy)} p={[0, .04, 0]}/>
    {legs.map(a => <Strut key={a} a={at(a, .24, .08)} b={at(a, .04, 1.3)} r={.018} m={steel}/>)}
    {[.4, .75, 1.05].map(y => { const r = .24 - (y - .08) / 1.22 * .2; return legs.map((a, k) => <Strut key={`${y}${k}`} a={at(a, r, y)} b={at(legs[(k + 1) % 3], r, y)} r={.009} m={steel}/>); })}
    <Part g={cyl(.012, .018, .34, 6)} m={steel} p={[0, 1.46, 0]}/>
    <Part g={ball(.055, 12)} m={glow(C.rose, 1.4)} p={[0, 1.65, 0]}/>
    <Part g={rbox(.05, .22, .1, .015)} m={mat(C.cream)} p={[.09, 1.1, 0]}/>
  </group>;
}

// ---------- About me: inspiration from philosophers, musicians, painters and filmmakers ----------
// Omar's own planet, and the orbit around his head in space, carry the things that inspire him.
const marble = () => mat('#ece8f2', { rough: .42 });
/** A classical philosopher's bust on a fluted pedestal: bearded, curly-haired, crowned with a gold laurel. */
export function Bust() {
  const stone = marble(), veined = mat('#d9d4e4', { rough: .5 });
  return <group>
    <Part g={lathe('bust-pedestal', [[0, 0], [.3, 0], [.3, .06], [.24, .1], [.21, .15], [.21, .56], [.25, .6], [.28, .62], [.28, .67], [0, .67]], 18)} m={mat('#c9c4d6', { rough: .5, flat: true })}/>
    <Part g={lathe('bust-chest', [[0, .67], [.3, .67], [.34, .73], [.32, .83], [.24, .91], [.12, .96], [0, .97]], 28)} m={stone} s={[1.2, 1, .75]}/>
    <Part g={cyl(.075, .095, .16, 16)} m={stone} p={[0, 1.02, 0]}/>
    <Part g={ball(.17, 24)} m={stone} p={[0, 1.22, 0]} s={[1, 1.12, 1.05]}/>
    <Part g={ball(.14, 20)} m={veined} p={[0, 1.1, .06]} s={[1, 1.15, .85]}/>
    <Part g={ball(.06, 14)} m={veined} p={[0, 1.17, .14]} s={[1.7, .55, .7]}/>
    <Part g={cyl(.0, .035, .08, 8)} m={stone} p={[0, 1.22, .18]} r={[Math.PI / 2, 0, 0]}/>
    <Part g={rbox(.2, .03, .04, .012)} m={veined} p={[0, 1.27, .16]}/>
    {Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2; return <Part key={i} g={ball(.055, 12)} m={veined} p={[Math.cos(a) * .14, 1.33 + Math.sin(i * 1.7) * .02, Math.sin(a) * .14 - .02]}/>; })}
    <Part g={ring(.175, .016, Math.PI * 2, 40)} m={metal('#d9b45a')} p={[0, 1.31, -.01]} r={[Math.PI / 2 - .12, 0, 0]}/>
  </group>;
}
/** A fluted Greek column with a scroll resting at its foot. */
export function Column() {
  const stone = marble();
  return <group>
    <Part g={rbox(.5, .08, .5, .02)} m={stone} p={[0, .04, 0]}/>
    <Part g={lathe('column-base', [[0, .08], [.2, .08], [.21, .11], [.18, .14], [.17, .17], [0, .17]], 24)} m={stone}/>
    <Part g={cyl(.13, .15, 1, 14)} m={mat('#ece8f2', { rough: .45, flat: true })} p={[0, .67, 0]}/>
    <Part g={lathe('column-capital', [[0, 1.17], [.14, 1.17], [.2, 1.22], [.21, 1.25], [0, 1.25]], 24)} m={stone}/>
    <Part g={rbox(.46, .07, .46, .02)} m={stone} p={[0, 1.28, 0]}/>
    <group position={[.32, .06, .18]} rotation={[0, .5, 0]}>
      <Part g={cyl(.045, .045, .34, 16)} m={mat('#efe2c0', { rough: .7 })} r={[0, 0, Math.PI / 2]}/>
      <Part g={rbox(.3, .006, .2, .003)} m={mat('#efe2c0', { rough: .7 })} p={[0, -.04, .1]}/>
      {[-1, 1].map(s => <Part key={s} g={cyl(.022, .022, .05, 10)} m={mat('#b58a6a')} p={[s * .19, 0, 0]} r={[0, 0, Math.PI / 2]}/>)}
    </group>
  </group>;
}
/** A gramophone: a wooden cabinet, a record on the platter, the tone arm, and a flared brass horn. */
export function Gramophone() {
  const brass = mat('#d9b45a', { metal: .7, rough: .25, double: true }), wood = mat('#8b5a3c', { rough: .55 });
  return <group>
    <Part g={rbox(.6, .26, .5, .04)} m={wood} p={[0, .13, 0]}/>
    <Part g={rbox(.62, .03, .52, .01)} m={mat('#6b4129', { rough: .5 })} p={[0, .27, 0]}/>
    <Part g={cyl(.21, .21, .025, 36)} m={mat('#1f2230', { rough: .3 })} p={[-.05, .3, .02]}/>
    <Part g={cyl(.07, .07, .028, 24)} m={mat('#c95f8a')} p={[-.05, .3, .02]}/>
    <Strut a={[.2, .3, -.18]} b={[0, .33, .08]} r={.012} m={brass}/>
    <Part g={cyl(.035, .035, .06, 12)} m={brass} p={[.2, .31, -.18]}/>
    <Strut a={[.2, .3, -.18]} b={[.16, .62, -.12]} r={.025} m={brass}/>
    <group position={[.16, .6, -.12]} rotation={[-.9, .3, 0]}>
      <Part g={lathe('gramophone-horn', [[.03, 0], [.045, .12], [.07, .24], [.12, .34], [.2, .42], [.3, .47], [.36, .48]], 32)} m={brass}/>
    </group>
    <Part g={rbox(.06, .03, .03, .01)} m={brass} p={[.31, .16, .1]}/>
  </group>;
}
/** The outline of a guitar's body: two bouts joined at a waist. */
function guitarOutline(): Pt[] {
  const half = (y: number) => {
    const lower = Math.sqrt(Math.max(0, .27 * .27 - y * y)), upper = Math.sqrt(Math.max(0, .2 * .2 - (y - .38) * (y - .38)));
    return Math.max(lower, upper, y > .05 && y < .32 ? .15 : 0);
  };
  const ys = Array.from({ length: 41 }, (_, i) => -.27 + i / 40 * .85);
  return [...ys.map(y => [half(y), y] as Pt), ...ys.slice().reverse().map(y => [-half(y), y] as Pt)];
}
/** An acoustic guitar leaning back on a little stand. */
export function Guitar() {
  const body = extrude('guitar-body', guitarOutline(), .09, { bevel: .02, keep: true }), wood = mat('#c78a55', { rough: .45 }), dark = mat('#4a2e1f', { rough: .5 });
  return <group>
    <Strut a={[-.16, 0, .12]} b={[-.1, .32, -.04]} r={.014} m={mat('#23264d')}/>
    <Strut a={[.16, 0, .12]} b={[.1, .32, -.04]} r={.014} m={mat('#23264d')}/>
    <group position={[0, .3, 0]} rotation={[-.22, 0, 0]}>
      <Part g={body} m={wood}/>
      <Part g={ring(.075, .018, Math.PI * 2, 28)} m={dark} p={[0, .2, .055]}/>
      <Part g={shared('guitar-hole', () => new THREE.CircleGeometry(.07, 24))} m={mat('#1a1010')} p={[0, .2, .052]}/>
      <Part g={rbox(.14, .03, .02, .008)} m={dark} p={[0, -.12, .058]}/>
      <Part g={rbox(.065, .56, .035, .01)} m={dark} p={[0, .86, .02]}/>
      <Part g={rbox(.1, .16, .03, .015)} m={dark} p={[0, 1.2, .015]}/>
      {[-1, 1].flatMap(s => [0, 1, 2].map(k => <Part key={`${s}${k}`} g={ball(.014, 8)} m={metal('#d9b45a')} p={[s * .06, 1.15 + k * .05, .02]}/>))}
      {[-2.5, -1.5, -.5, .5, 1.5, 2.5].map(k => <Part key={k} g={rbox(.0035, 1.28, .003, .001)} m={mat('#e9e4ff', { metal: .6, rough: .3 })} p={[k * .009, .5, .063]}/>)}
    </group>
  </group>;
}
/** A black grand piano, its lid propped open, with keys and three legs. */
export function Piano() {
  const outline: Pt[] = [[-.5, 0], [.5, 0], [.5, .35], [.4, .6], [.22, .82], [.08, 1.08], [-.1, 1.36], [-.3, 1.5], [-.45, 1.5], [-.5, 1.42]];
  const gloss = mat('#16182c', { rough: .22, metal: .1 }), body = extrude('piano-body', outline, .26, { bevel: .02, keep: true, curve: 8 }), lid = extrude('piano-lid', outline, .02, { bevel: .006, keep: true, curve: 8 });
  return <group scale={.62}>
    {([[-.42, .08], [.42, .08], [-.4, 1.38]] as const).map(([x, z], i) => <Part key={i} g={cyl(.04, .05, .5, 10)} m={gloss} p={[x, .25, z]}/>)}
    <group position={[0, .63, 0]} rotation={[Math.PI / 2, 0, 0]}><Part g={body} m={gloss}/></group>
    <group position={[-.5, .78, 0]} rotation={[0, 0, .55]}><group position={[.5, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><Part g={lid} m={gloss}/></group></group>
    <Strut a={[.3, .76, .5]} b={[.14, 1.22, .5]} r={.012} m={metal('#d9b45a')}/>
    <Part g={rbox(1, .07, .2, .01)} m={mat('#f6f4ff', { rough: .35 })} p={[0, .66, -.1]}/>
    {Array.from({ length: 10 }, (_, i) => <Part key={i} g={rbox(.035, .03, .11, .006)} m={gloss} p={[-.42 + i * .094, .71, -.06]}/>)}
    <Part g={rbox(.5, .05, .22, .02)} m={gloss} p={[0, .4, -.5]}/>
    {[-1, 1].map(s => <Part key={s} g={cyl(.02, .02, .4, 8)} m={gloss} p={[s * .2, .2, -.5]}/>)}
  </group>;
}
/** A vintage microphone on a stand. */
export function Microphone() {
  const chrome = mat('#c9cde8', { metal: .75, rough: .2 });
  return <group>
    <Part g={lathe('mic-base', [[0, 0], [.2, 0], [.19, .04], [.08, .06], [.03, .08], [0, .08]], 24)} m={mat('#23264d', { metal: .3, rough: .4 })}/>
    <Part g={cyl(.016, .016, .95, 10)} m={chrome} p={[0, .55, 0]}/>
    <Part g={ring(.12, .012, Math.PI * 2, 28)} m={chrome} p={[0, 1.13, 0]}/>
    <Part g={ball(.1, 24)} m={mat('#9aa3c7', { metal: .55, rough: .35 })} p={[0, 1.15, 0]} s={[1, 1.35, 1]}/>
    {[1.05, 1.11, 1.17, 1.23].map(y => <Part key={y} g={ring(Math.sqrt(Math.max(.001, 1 - ((y - 1.15) / .135) ** 2)) * .101, .005, Math.PI * 2, 28)} m={chrome} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]}/>)}
    <Part g={cyl(.06, .05, .05, 16)} m={chrome} p={[0, 1.01, 0]}/>
  </group>;
}
let paintingSkin: THREE.Material | null = null;
/** The easel's painting: bold abstract shapes and strokes, painted once. */
function paintingMaterial() {
  if (paintingSkin) return paintingSkin;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 200;
  const c = canvas.getContext('2d')!, rand = seeded(9), colours = ['#7e6aff', '#8fb4ff', '#f29ac0', '#f5d77a', '#5fc4bd', '#2b2f6b'];
  c.fillStyle = '#f4efe2'; c.fillRect(0, 0, 256, 200);
  for (let i = 0; i < 9; i++) { c.fillStyle = colours[i % colours.length]; c.globalAlpha = .85; c.beginPath(); c.arc(rand() * 256, rand() * 200, 14 + rand() * 46, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1; c.lineCap = 'round';
  for (let i = 0; i < 7; i++) { c.strokeStyle = colours[(i + 2) % colours.length]; c.lineWidth = 5 + rand() * 9; c.beginPath(); c.moveTo(rand() * 256, rand() * 200); c.quadraticCurveTo(rand() * 256, rand() * 200, rand() * 256, rand() * 200); c.stroke(); }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return paintingSkin = new THREE.MeshStandardMaterial({ map, roughness: .7 });
}
/** A painter's easel holding a canvas, with a brush resting on its ledge. */
export function Easel() {
  const wood = mat('#a8774f', { rough: .6 });
  return <group>
    <Strut a={[-.3, 0, .14]} b={[-.04, 1.35, -.02]} r={.022} m={wood}/>
    <Strut a={[.3, 0, .14]} b={[.04, 1.35, -.02]} r={.022} m={wood}/>
    <Strut a={[0, 0, -.42]} b={[0, 1.3, -.04]} r={.02} m={wood}/>
    <Part g={rbox(.62, .035, .08, .01)} m={wood} p={[0, .52, .1]} r={[-.1, 0, 0]}/>
    <group position={[0, .9, .07]} rotation={[-.1, 0, 0]}>
      <Part g={rbox(.66, .52, .03, .008)} m={mat('#f4efe2', { rough: .8 })}/>
      <Part g={shared('painting', () => new THREE.PlaneGeometry(.62, .48))} m={paintingMaterial()} p={[0, 0, .017]}/>
    </group>
    <group position={[.12, .56, .14]} rotation={[0, 0, .1]}>
      <Part g={cyl(.012, .01, .3, 8)} m={mat('#23264d')} r={[0, 0, Math.PI / 2]}/>
      <Part g={lathe('easel-brush', [[0, 0], [.016, 0], [.012, .04], [0, .06]], 8)} m={mat('#f29ac0')} p={[.17, 0, 0]} r={[0, 0, -Math.PI / 2]}/>
    </group>
  </group>;
}
/** An old film camera on a tripod: two reels on top, a lens with a hood, and a crank. */
export function FilmCamera() {
  const black = mat('#1f2230', { rough: .4, metal: .2 }), steel = metal('#9aa3c7');
  return <group>
    {[0, 1, 2].map(k => { const a = k / 3 * Math.PI * 2 + .5; return <Strut key={k} a={[Math.cos(a) * .32, 0, Math.sin(a) * .32]} b={[0, .66, 0]} r={.016} m={mat('#a8774f', { rough: .6 })}/>; })}
    <Part g={cyl(.06, .06, .06, 12)} m={steel} p={[0, .69, 0]}/>
    <Part g={rbox(.26, .26, .46, .04)} m={black} p={[0, .85, 0]}/>
    {[-.1, .14].map((z, i) => <group key={z} position={[0, 1.1 + i * .02, z]}>
      <Part g={cyl(.13, .13, .05, 28)} m={black} r={[0, 0, Math.PI / 2]}/>
      <Part g={cyl(.04, .04, .06, 12)} m={steel} r={[0, 0, Math.PI / 2]}/>
      {[0, 1, 2].map(k => <Part key={k} g={ball(.025, 8)} m={mat('#2b2f6b')} p={[.03, Math.cos(k * 2.1) * .07, Math.sin(k * 2.1) * .07]}/>)}
    </group>)}
    <Part g={cyl(.07, .06, .14, 20)} m={black} p={[0, .84, -.29]} r={[Math.PI / 2, 0, 0]}/>
    <Part g={lathe('camera-hood', [[.06, 0], [.08, .05], [.11, .1]], 20)} m={black} p={[0, .84, -.36]} r={[-Math.PI / 2, 0, 0]}/>
    <Part g={shared('camera-glass', () => new THREE.CircleGeometry(.055, 20))} m={mat('#2b4a8a', { metal: .4, rough: .12 })} p={[0, .84, -.365]} r={[0, Math.PI, 0]}/>
    <Strut a={[.14, .85, .05]} b={[.22, .8, .05]} r={.012} m={steel}/>
    <Part g={rbox(.03, .1, .03, .01)} m={steel} p={[.23, .76, .05]}/>
  </group>;
}

/** Every planet's models; the first is its landmark, shown larger on top of the planet. */
export const THEME_PROPS: Record<DestinationId, ComponentType[]> = {
  home: [Bust, Gramophone, Piano, Easel, Guitar, Microphone, FilmCamera, Column],
  experience: [Briefcase, Office, Flag, Stairs, Trophy],
  projects: [Blocks, Gear, MiniRocket, Laptop, Bulb],
  education: [GraduationCap, Books, School, Pencil, Globe],
  skills: [Star, Crystals, Wrench, CodeBrackets, Bolt],
  contact: [SpeechBubble, Mailbox, Dish, Envelope, Antenna],
};
