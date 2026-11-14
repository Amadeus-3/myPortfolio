import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared building blocks for the toy models: rounded boxes, turned (lathe) and extruded shapes, and matte materials.
// Every geometry and material is made once and reused by every copy of a model, so detailed models stay cheap: the
// same few buffers and shader programs serve dozens of props across the planets and the landing scenes.

const geometries = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geometries.get(key);
  if (!g) { g = make(); geometries.set(key, g); }
  return g;
};
type Pt = [number, number];
const vec = (points: Pt[]) => points.map(([x, y]) => new THREE.Vector2(x, y));

/** A box with softly rounded edges. */
export const rbox = (w: number, h: number, d: number, r = Math.min(w, h, d) * .2) => cached(`rb ${w} ${h} ${d} ${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
/** A shape turned around the y axis, from (radius, height) points. */
export const lathe = (key: string, points: Pt[], segments = 32) => cached(`la ${key}`, () => new THREE.LatheGeometry(vec(points), segments));
/** A flat outline extruded into a slab with bevelled edges, centred on the origin unless `keep` holds the outline's
 *  own coordinates (then only the thickness is centred). Optional holes are cut through it. */
export function extrude(key: string, points: Pt[], depth: number, { bevel = .03, holes = [] as Pt[][], keep = false, curve = 16 } = {}) {
  return cached(`ex ${key}`, () => {
    const shape = new THREE.Shape(vec(points));
    for (const hole of holes) shape.holes.push(new THREE.Path(vec(hole)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * .8, bevelSegments: 3, curveSegments: curve });
    if (keep) g.translate(0, 0, -depth / 2); else g.center();
    return g;
  });
}
/** Any other geometry, made once under a name. */
export const shared = (key: string, make: () => THREE.BufferGeometry) => cached(`sh ${key}`, make);
/** Points around a circle (for round outlines and holes). */
export const circle = (r: number, cx = 0, cy = 0, n = 24, reverse = false): Pt[] =>
  Array.from({ length: n }, (_, i) => { const a = (reverse ? -1 : 1) * i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

const materials = new Map<string, THREE.Material>();
/** A matte material (optionally glowing, metallic, faceted or see-through), shared by colour and finish. */
export function mat(color: string, { glow = 0, rough = .6, metal = 0, flat = false, opacity = 1, double = false } = {}) {
  const key = `${color} ${glow} ${rough} ${metal} ${flat} ${opacity} ${double}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: glow ? color : '#000000', emissiveIntensity: glow, flatShading: flat, transparent: opacity < 1, opacity, side: double ? THREE.DoubleSide : THREE.FrontSide });
    materials.set(key, m);
  }
  return m;
}
