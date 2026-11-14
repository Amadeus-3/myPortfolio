import * as THREE from 'three';

// Omar as a minimal "vinyl toy" head: smooth matte forms, no textures, calm closed eyes, a neutral mouth.
// Identity comes from a few bold shapes: a curly top, short sides, a beard along the jaw, a moustache, thick brows.
// Coordinates: +x = Omar's left, +y = up, +z = out of the face. Roughly 5.4 wide and 7.3 tall with the hair.
// Export with: node --experimental-strip-types scripts/export-character.mjs

type V3 = [number, number, number];
const { clamp } = THREE.MathUtils;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function random(seed: number) {
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export const PALETTE = { skin: '#ece5de', hair: '#25201d', feature: '#3b3330', lip: '#8a6c64' };

// ---------- The head shape: a soft egg, slightly narrower at the jaw, with a rounded chin ----------
const RADIUS = { x: 2.7, y: 3.3, front: 2.85, back: 3.0 };
const chin = new THREE.Vector3(0, -.72, .69).normalize();
function shape(u: THREE.Vector3) {
  const low = smooth(.15, -1, u.y);
  const width = u.y > .15 ? 1 - .05 * (u.y - .15) : 1 - .27 * Math.pow(low, 1.3);
  const depth = u.z > 0 ? RADIUS.front * (1 - .05 * low) : RADIUS.back;
  const p = new THREE.Vector3(u.x * RADIUS.x * width, u.y * RADIUS.y, u.z * depth);
  const r = p.length(), lift = .12 * Math.exp(-u.distanceToSquared(chin) / .05);
  return p.multiplyScalar((r + lift) / r);
}
/** 0 = straight ahead, .5 = the sides, 1 = the back. */
const azimuth = (u: THREE.Vector3) => Math.abs(Math.atan2(u.x, u.z)) / Math.PI;
/** Where the hair starts: a forehead hairline, short sides (the fade), and full coverage down the back. */
const hairline = (a: number) => a < .22 ? .5 : a < .5 ? mix(.5, .4, smooth(.22, .5, a)) : mix(.4, -.2, smooth(.5, 1, a));
/** Top edge of the beard: a goatee under the lip in the middle, rising along the cheeks to the sideburns. */
const beardTop = (a: number) => a < .07 ? -.52 : a < .36 ? mix(-.5, -.3, smooth(.07, .36, a)) : mix(-.3, -.85, smooth(.36, .48, a));

// ---------- Geometry helpers ----------
const sphere = (() => { const g = new THREE.SphereGeometry(1, 28, 20); g.deleteAttribute('uv'); return g; })();
/** A surface layer that follows the head where `cover` is 1 and tucks just inside it elsewhere, so edges taper smoothly. */
function shell(cover: (u: THREE.Vector3) => number, thickness: number | ((u: THREE.Vector3) => number), detail = 1) {
  const geometry = new THREE.SphereGeometry(1, Math.round(128 * detail), Math.round(96 * detail)); geometry.deleteAttribute('uv');
  const position = geometry.attributes.position, u = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    u.fromBufferAttribute(position, i).normalize();
    const p = shape(u), r = p.length(), k = cover(u);
    const t = typeof thickness === 'number' ? thickness : thickness(u);
    p.multiplyScalar((r + t * k - .08 * (1 - k)) / r);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}
/** A tube along points, with a varying radius; `out` flattens it against a surface facing that way. */
function tube(points: THREE.Vector3[], radius: (t: number) => number, out?: THREE.Vector3, flatten = 1) {
  const segments = 32, radial = 14, curve = new THREE.CatmullRomCurve3(points);
  const frames = out ? null : curve.computeFrenetFrames(segments, false);
  const position: number[] = [], index: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    const n = out ? new THREE.Vector3().crossVectors(tangent, out).normalize() : frames!.normals[i];
    const b = out ? new THREE.Vector3().crossVectors(tangent, n).normalize() : frames!.binormals[i];
    const r = radius(t);
    for (let j = 0; j < radial; j++) {
      const th = j / radial * Math.PI * 2, c = Math.cos(th) * r, s = Math.sin(th) * r * flatten;
      position.push(p.x + c * n.x + s * b.x, p.y + c * n.y + s * b.y, p.z + c * n.z + s * b.z);
    }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    index.push(a, b, a + radial, b, b + radial, a + radial);
  }
  const start = position.length / 3, p0 = curve.getPointAt(0), p1 = curve.getPointAt(1), last = segments * radial;
  position.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
  for (let j = 0; j < radial; j++) { index.push(start, (j + 1) % radial, j); index.push(start + 1, last + j, last + (j + 1) % radial); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

export function createOmarCharacter() {
  const model = new THREE.Group(); model.name = 'OmarCharacter';
  const matte = (color: string, roughness = .62) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const skin = matte(PALETTE.skin), hair = matte(PALETTE.hair, .75), feature = matte(PALETTE.feature, .7), lip = matte(PALETTE.lip, .7);
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = model) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; parent.add(mesh); return mesh;
  };
  const blob = (name: string, at: THREE.Vector3 | V3, scale: V3, material: THREE.Material, rotation?: V3, parent: THREE.Object3D = model) => {
    const mesh = add(name, sphere, material, parent);
    if (Array.isArray(at)) mesh.position.set(...at); else mesh.position.copy(at);
    mesh.scale.set(...scale); if (rotation) mesh.rotation.set(...rotation); return mesh;
  };

  // Face
  const face = add('Face', shell(() => 1, 0, .75), skin);
  face.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  const front = (x: number, y: number) => { ray.set(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1)); const hit = ray.intersectObject(face, false)[0]; return { point: hit.point.clone(), normal: hit.face!.normal.clone() }; };
  const on = (x: number, y: number, lift = 0) => { const h = front(x, y); return h.point.addScaledVector(h.normal, lift); };
  const stroke = (name: string, xy: [number, number][], lift: number, radius: (t: number) => number, material: THREE.Material, flatten = .55) => {
    const out = xy.reduce((n, [x, y]) => n.add(front(x, y).normal), new THREE.Vector3()).normalize();
    return add(name, tube(xy.map(([x, y]) => on(x, y, lift)), radius, out, flatten), material);
  };

  // Calm closed eyes: a soft lid bulge with a dark lash curve, like the eyes of a sleeping toy.
  for (const side of [-1, 1]) {
    const lid = front(side * .95, .3);
    blob(`Lid_${side}`, lid.point.clone().addScaledVector(lid.normal, -.06), [.5, .3, .2], skin, [0, side * .25, 0]);
    stroke(`Lash_${side}`, [[side * .55, .34], [side * .95, .24], [side * 1.35, .34]], .12, t => .028 + .022 * Math.sin(Math.PI * t), feature, .6);
    stroke(`Brow_${side}`, [[side * .42, .86], [side * .9, .98], [side * 1.42, .92]], .07, t => .13 - .04 * t, hair, .5);
  }
  // Nose: one rounded form, like the reference's simple button nose but a little longer.
  blob('Nose', on(0, -.4, .1), [.36, .34, .3], skin);
  blob('NoseBridge', on(0, -.05, .02), [.18, .34, .16], skin);
  // Neutral mouth: a short level line with a hint of lower lip.
  stroke('Mouth', [[-.5, -1.2], [0, -1.23], [.5, -1.2]], .03, t => .03 + .01 * Math.sin(Math.PI * t), feature, .6);
  stroke('LowerLip', [[-.32, -1.33], [0, -1.37], [.32, -1.33]], .02, t => .02 + .05 * Math.sin(Math.PI * t), lip, .5);

  // Ears: a soft oval with a C-shaped inner ridge.
  for (const side of [-1, 1]) {
    ray.set(new THREE.Vector3(side * 10, .1, -.1), new THREE.Vector3(-side, 0, 0));
    const hit = ray.intersectObject(face, false)[0];
    const ear = new THREE.Group(); ear.name = `Ear_${side}`; ear.position.copy(hit.point); ear.rotation.y = -side * .15; model.add(ear);
    blob('EarShell', [side * .14, 0, 0], [.2, .6, .44], skin, undefined, ear);
    const ridge = add('EarRidge', new THREE.TorusGeometry(.26, .065, 12, 36, Math.PI * 1.35), skin, ear);
    ridge.position.set(side * .3, -.02, 0); ridge.rotation.set(0, side * Math.PI / 2, Math.PI * .85);
  }

  // Hair: a smooth cap with big rounded curl lumps on top, cut short on the sides.
  const hairCover = (u: THREE.Vector3) => { const line = hairline(azimuth(u)); return smooth(line - .02, line + .08, u.y); };
  // Curls are soft bumps in one continuous surface, not separate balls: rounded and toy-like, still clearly curly.
  const rand = random(11), golden = Math.PI * (3 - Math.sqrt(5)), curls: THREE.Vector3[] = [];
  for (let i = 0; i < 90; i++) {
    const y = 1 - (i + .5) / 90 * 2, ring = Math.sqrt(1 - y * y), u = new THREE.Vector3(Math.cos(i * golden) * ring, y, Math.sin(i * golden) * ring);
    if (u.y > hairline(azimuth(u)) + .1 && u.y > .2) curls.push(u.add(new THREE.Vector3(rand() - .5, rand() - .5, rand() - .5).multiplyScalar(.06)).normalize());
  }
  const hairThickness = (u: THREE.Vector3) => {
    let bump = 0; for (const c of curls) bump = Math.max(bump, Math.exp(-u.distanceToSquared(c) / .018));
    const top = smooth(hairline(azimuth(u)) + .05, .75, u.y); // full volume on top, short over the sides and back
    return .12 + top * (.3 + .34 * bump);
  };
  add('Hair', shell(hairCover, hairThickness), hair);

  // Beard: a thin smooth layer along the jaw and chin, plus a moustache and a goatee.
  const beardCover = (u: THREE.Vector3) => { const top = beardTop(azimuth(u)); return smooth(top + .02, top - .07, u.y) * smooth(-.15, .25, u.z + .35); };
  add('Beard', shell(beardCover, .05, .8), hair);
  stroke('Moustache', [[-.62, -1.12], [-.3, -1.02], [0, -1.04], [.3, -1.02], [.62, -1.12]], .06, t => .06 + .07 * Math.sin(Math.PI * t), hair, .5);
  blob('Goatee', on(0, -1.6, .05), [.18, .26, .1], hair);
  return model;
}
