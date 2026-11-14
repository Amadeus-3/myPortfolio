// Turns a textured Meshy clay head into the web head the site loads.
// Keeps Meshy's base colour texture (shrunk to 1K), drops the normal and roughness maps (the look is matte clay),
// removes the ring and loose pieces, makes every face point outward, fills the open slits (eyes, mouth, crown) with
// a dark second material, computes smooth normals across UV seams, and normalises size and position.
// Usage (macOS, needs sips): node scripts/prepare-clay-head.mjs <in.glb> <out.glb>
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , input = '/Users/omar/Downloads/Meshy_AI__1105202012_texture.glb', output = 'public/models/omar-clay-head.glb'] = process.argv;
const HEIGHT = 7.3, TEXTURE_SIZE = 1024;
const TARGET_TRIANGLES = Number(process.env.TARGET ?? 60000);

// ---- Read the source GLB.
const src = await readFile(input);
const jsonLength = src.readUInt32LE(12), doc = JSON.parse(src.subarray(20, 20 + jsonLength)), bin = src.subarray(28 + jsonLength);
const prim = doc.meshes[0].primitives[0];
const accessor = (id, Type, width) => { const a = doc.accessors[id], v = doc.bufferViews[a.bufferView]; return new Type(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), a.count * width); };
let pos = accessor(prim.attributes.POSITION, Float32Array, 3), uv = accessor(prim.attributes.TEXCOORD_0, Float32Array, 2);
const indexType = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array }[doc.accessors[prim.indices].componentType];
let idx = accessor(prim.indices, indexType, 1);
console.log(`source: ${pos.length / 3} vertices, ${idx.length / 3} triangles`);

// ---- Meshy's full-resolution exports run to millions of triangles. Simplify first, keeping the UV layout intact
// (the texture is addressed through it), so the cleanup below works on a mesh the browser can actually load.
if (idx.length / 3 > TARGET_TRIANGLES * 1.5) {
  await MeshoptSimplifier.ready;
  MeshoptSimplifier.useExperimentalFeatures = true;
  const indices = idx instanceof Uint32Array ? idx : Uint32Array.from(idx);
  const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
    indices, pos, 3, uv, 2, [.4, .4], new Uint8Array(pos.length / 3), TARGET_TRIANGLES * 3, Number(process.env.ERROR ?? .05), ['LockBorder']);
  // compactMesh rewrites `simplified` to the compact indexing itself and returns old -> new for the vertex buffers.
  const [remap, unique] = MeshoptSimplifier.compactMesh(simplified);
  const newPos = new Float32Array(unique * 3), newUv = new Float32Array(unique * 2);
  for (let i = 0; i < remap.length; i++) { const j = remap[i]; if (j === 0xffffffff) continue; newPos.set(pos.subarray(i * 3, i * 3 + 3), j * 3); newUv.set(uv.subarray(i * 2, i * 2 + 2), j * 2); }
  idx = simplified;
  pos = newPos; uv = newUv;
  console.log(`simplified to ${idx.length / 3} triangles, ${unique} vertices (error ${error.toFixed(4)})`);
}
const count = pos.length / 3;

// ---- Topology by position (UV seams split vertices; the surface is connected by position).
const merged = new Uint32Array(count), keys = new Map(); let mergedCount = 0;
for (let i = 0; i < count; i++) { const key = `${pos[i * 3].toFixed(6)},${pos[i * 3 + 1].toFixed(6)},${pos[i * 3 + 2].toFixed(6)}`; if (!keys.has(key)) keys.set(key, mergedCount++); merged[i] = keys.get(key); }
let faces = [];
for (let f = 0; f < idx.length; f += 3) { const a = idx[f], b = idx[f + 1], c = idx[f + 2]; if (merged[a] !== merged[b] && merged[b] !== merged[c] && merged[a] !== merged[c]) faces.push([a, b, c]); }
const M = i => merged[i];

// ---- Connected pieces. Default: keep only the largest (drops a ring modelled around the neck).
// PARTS=<share>: keep every piece with at least that share of the faces, for models built from separate parts
// (Meshy's Smart Topology makes the brows, eyes, moustache and goatee their own pieces).
const parent = Uint32Array.from({ length: mergedCount }, (_, i) => i);
const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
for (const [a, b, c] of faces) { parent[find(M(b))] = find(M(a)); parent[find(M(c))] = find(M(a)); }
const sizes = new Map(); for (const [a] of faces) { const r = find(M(a)); sizes.set(r, (sizes.get(r) ?? 0) + 1); }
const [main] = [...sizes.entries()].sort((x, y) => y[1] - x[1])[0];
console.log('components (faces):', [...sizes.values()].sort((x, y) => y - x).slice(0, 12).join(', '), sizes.size > 12 ? `... (${sizes.size} in all)` : '');
const partShare = Number(process.env.PARTS ?? NaN), keepParts = Number.isFinite(partShare);
if (keepParts) {
  const minimum = faces.length * partShare, kept = new Set([...sizes].filter(([, n]) => n >= minimum).map(([r]) => r));
  faces = faces.filter(([a]) => kept.has(find(M(a))));
  console.log(`kept ${kept.size} pieces with at least ${Math.ceil(minimum)} faces each`);
} else faces = faces.filter(([a]) => find(M(a)) === main);

// ---- Neck removal. Meshy models a neck when the reference sheet shows one, but the sun is a floating head.
// Measure the horizontal half-width of the mesh in slabs down the Y axis: it peaks at the cheeks and ears, then
// narrows to a waist at the jawline before the neck continues as a near-constant column. Cut at that waist.
if (process.env.KEEP_NECK !== '1') {
  let lo = Infinity, hi = -Infinity;
  for (const [a, b, c] of faces) for (const v of [a, b, c]) { const y = pos[v * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y; }
  const slabs = 60, width = new Float64Array(slabs), seenSlab = new Int32Array(slabs);
  let cx = 0, cz = 0, n = 0;
  for (const [a] of faces) { cx += pos[a * 3]; cz += pos[a * 3 + 2]; n++; }
  cx /= n; cz /= n;
  for (const [a, b, c] of faces) for (const v of [a, b, c]) {
    const s = Math.min(slabs - 1, Math.floor((pos[v * 3 + 1] - lo) / (hi - lo) * slabs));
    const r = Math.hypot(pos[v * 3] - cx, pos[v * 3 + 2] - cz);
    if (r > width[s]) width[s] = r; seenSlab[s] = 1;
  }
  let widest = 0; for (let s = 0; s < slabs; s++) if (width[s] > width[widest]) widest = s;
  // Print the profile from the bottom up, as a share of the widest slab: a neck shows as a run of narrow,
  // near-constant values before the jaw flares out. NECK=<0..1> then cuts at that height fraction.
  console.log('width profile (bottom to top, share of widest):');
  for (let row = 0; row < slabs; row += 5)
    console.log('  ' + Array.from({ length: Math.min(5, slabs - row) }, (_, k) => `${((row + k) / slabs).toFixed(2)}:${(width[row + k] / width[widest]).toFixed(2)}`).join('  '));
  const fraction = Number(process.env.NECK ?? NaN);
  if (Number.isFinite(fraction) && fraction > 0 && fraction < 1) {
    const cutY = lo + fraction * (hi - lo), before = faces.length;
    faces = faces.filter(([a, b, c]) => pos[a * 3 + 1] > cutY && pos[b * 3 + 1] > cutY && pos[c * 3 + 1] > cutY);
    console.log(`cut below y ${cutY.toFixed(3)} (NECK=${fraction}): removed ${before - faces.length} faces`);
  }
}

// ---- Consistent winding, outward.
const edgeKey = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
const edgeFaces = new Map();
faces.forEach((face, f) => { for (let k = 0; k < 3; k++) { const key = edgeKey(M(face[k]), M(face[(k + 1) % 3])); (edgeFaces.get(key) ?? edgeFaces.set(key, []).get(key)).push(f); } });
const visited = new Uint8Array(faces.length); let flipped = 0;
for (let seed = 0; seed < faces.length; seed++) {
  if (visited[seed]) continue; visited[seed] = 1; const queue = [seed];
  while (queue.length) {
    const f = queue.pop(), face = faces[f];
    for (let k = 0; k < 3; k++) {
      const a = M(face[k]), b = M(face[(k + 1) % 3]), others = edgeFaces.get(edgeKey(a, b));
      if (others.length !== 2) continue;
      const g = others[0] === f ? others[1] : others[0];
      if (visited[g]) continue;
      const other = faces[g];
      if ([0, 1, 2].some(m => M(other[m]) === a && M(other[(m + 1) % 3]) === b)) { faces[g] = [other[0], other[2], other[1]]; flipped++; }
      visited[g] = 1; queue.push(g);
    }
  }
}
const P = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
let volume = 0;
for (const [a, b, c] of faces) { const A = P(a), B = P(b), C = P(c); volume += (A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6; }
if (volume < 0) { faces = faces.map(([a, b, c]) => [a, c, b]); console.log('mesh was inside-out: flipped all faces'); }
console.log(`kept ${faces.length} faces, reoriented ${flipped}`);

// ---- Fill boundary loops (eye and mouth slits, the crown hole) with fans, as a separate dark primitive.
const boundary = new Map(), representative = new Map();
faces.forEach(face => { for (let k = 0; k < 3; k++) representative.set(M(face[k]), face[k]); });
for (const [key, list] of edgeFaces) if (list.length === 1 && faces.includes(faces[list[0]])) { const [a, b] = key.split('_').map(Number); (boundary.get(a) ?? boundary.set(a, []).get(a)).push(b); (boundary.get(b) ?? boundary.set(b, []).get(b)).push(a); }
const seen = new Set(), loops = [];
for (const start of boundary.keys()) {
  if (seen.has(start)) continue; const loop = [], stack = [start];
  while (stack.length) { const v = stack.pop(); if (seen.has(v)) continue; seen.add(v); loop.push(v); for (const w of boundary.get(v)) if (!seen.has(w)) stack.push(w); }
  loops.push(loop);
}
const extraPositions = [], extraUvs = [], fillFaces = [];
// With separate parts kept, the openings under them are covered by those parts; filling them would show through.
for (const loop of keepParts || process.env.FILL === '0' ? [] : loops.filter(l => l.length >= 6).sort((x, y) => y.length - x.length).slice(0, 4)) {
  const verts = loop.map(m => representative.get(m)).filter(v => v !== undefined);
  const centre = [0, 0, 0], centreUv = [0, 0];
  for (const v of verts) { const p = P(v); centre[0] += p[0] / verts.length; centre[1] += p[1] / verts.length; centre[2] += p[2] / verts.length; centreUv[0] += uv[v * 2] / verts.length; centreUv[1] += uv[v * 2 + 1] / verts.length; }
  // Order around the loop's average normal, then fan from the centre.
  let n = [0, 0, 0];
  verts.forEach((v, k) => { const a = P(v).map((x, i) => x - centre[i]), b = P(verts[(k + 1) % verts.length]).map((x, i) => x - centre[i]); n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]; });
  const len = Math.hypot(...n) || 1; n = n.map(x => x / len);
  const ref = Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const u = [n[1] * ref[2] - n[2] * ref[1], n[2] * ref[0] - n[0] * ref[2], n[0] * ref[1] - n[1] * ref[0]], ul = Math.hypot(...u); u.forEach((x, i) => u[i] = x / ul);
  const w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const ordered = verts.map(v => { const d = P(v).map((x, i) => x - centre[i]); return { v, angle: Math.atan2(d[0] * w[0] + d[1] * w[1] + d[2] * w[2], d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) }; }).sort((x, y) => x.angle - y.angle).map(o => o.v);
  const centreIndex = count + extraPositions.length / 3; extraPositions.push(...centre); extraUvs.push(...centreUv);
  for (let k = 0; k < ordered.length; k++) fillFaces.push([centreIndex, ordered[k], ordered[(k + 1) % ordered.length]]);
  console.log(`filled hole of ${verts.length} vertices at`, centre.map(v => v.toFixed(2)).join(', '));
}
// Fans must face outward too: compare with the head's outward direction at the loop.
const allPos = Float32Array.from([...pos, ...extraPositions]);
const Q = i => [allPos[i * 3], allPos[i * 3 + 1], allPos[i * 3 + 2]];
{
  let cx = 0, cy = 0, cz = 0, n = 0; for (const [a] of faces) { const p = P(a); cx += p[0]; cy += p[1]; cz += p[2]; n++; } cx /= n; cy /= n; cz /= n;
  for (let f = 0; f < fillFaces.length; f++) { const [a, b, c] = fillFaces[f], A = Q(a), B = Q(b), C = Q(c); const e1 = B.map((x, i) => x - A[i]), e2 = C.map((x, i) => x - A[i]); const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; if (nx * (A[0] - cx) + ny * (A[1] - cy) + nz * (A[2] - cz) < 0) fillFaces[f] = [a, c, b]; }
}

// ---- Smooth normals shared across UV seams (accumulate per merged vertex, area weighted).
const totalCount = count + extraPositions.length / 3;
const mergedAll = Uint32Array.from({ length: totalCount }, (_, i) => i < count ? merged[i] : mergedCount + (i - count));
const accum = new Float32Array((mergedCount + extraPositions.length / 3) * 3);
for (const [a, b, c] of [...faces, ...fillFaces]) {
  const A = Q(a), B = Q(b), C = Q(c), e1 = B.map((x, i) => x - A[i]), e2 = C.map((x, i) => x - A[i]);
  const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
  for (const v of [a, b, c]) { const m = mergedAll[v] * 3; accum[m] += nx; accum[m + 1] += ny; accum[m + 2] += nz; }
}

// ---- Compact the used vertices, normalise size and position.
const used = new Map(); const remap = i => { if (!used.has(i)) used.set(i, used.size); return used.get(i); };
const mainIndex = faces.flatMap(f => f.map(remap)), fillIndex = fillFaces.flatMap(f => f.map(remap));
const vertexCount = used.size;
const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
const allUv = Float32Array.from([...uv, ...extraUvs]);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const [i] of used) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], allPos[i * 3 + k]); max[k] = Math.max(max[k], allPos[i * 3 + k]); }
const scale = HEIGHT / (max[1] - min[1]), centre = min.map((lo, k) => (lo + max[k]) / 2);
for (const [i, j] of used) {
  for (let k = 0; k < 3; k++) positions[j * 3 + k] = (allPos[i * 3 + k] - centre[k]) * scale;
  const m = mergedAll[i] * 3, l = Math.hypot(accum[m], accum[m + 1], accum[m + 2]) || 1;
  normals[j * 3] = accum[m] / l; normals[j * 3 + 1] = accum[m + 1] / l; normals[j * 3 + 2] = accum[m + 2] / l;
  uvs[j * 2] = allUv[i * 2]; uvs[j * 2 + 1] = allUv[i * 2 + 1];
}
console.log(`output: ${vertexCount} vertices, ${mainIndex.length / 3} + ${fillIndex.length / 3} triangles, size ${[0, 1, 2].map(k => ((max[k] - min[k]) * scale).toFixed(2)).join(' x ')}`);

// ---- Base colour texture, shrunk with sips.
const material = doc.materials[prim.material], imageId = doc.textures[material.pbrMetallicRoughness.baseColorTexture.index].source;
const imageView = doc.bufferViews[doc.images[imageId].bufferView];
const temp = await mkdtemp(join(tmpdir(), 'clay-head-'));
let jpeg;
try {
  const ext = doc.images[imageId].mimeType === 'image/png' ? 'png' : 'jpg';
  await writeFile(join(temp, `albedo.${ext}`), bin.subarray(imageView.byteOffset || 0, (imageView.byteOffset || 0) + imageView.byteLength));
  execFileSync('sips', ['-Z', String(TEXTURE_SIZE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', join(temp, `albedo.${ext}`), '--out', join(temp, 'albedo-small.jpg')], { stdio: 'ignore' });
  jpeg = await readFile(join(temp, 'albedo-small.jpg'));
} finally { await rm(temp, { recursive: true, force: true }); }

// ---- Write the GLB by hand.
const chunks = [], views = []; let offset = 0;
const add = (data, target) => { const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength), padded = Buffer.alloc((bytes.length + 3) & ~3); bytes.copy(padded); views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) }); chunks.push(padded); offset += padded.length; return views.length - 1; };
const positionMin = [Infinity, Infinity, Infinity], positionMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < vertexCount; i++) for (let k = 0; k < 3; k++) { positionMin[k] = Math.min(positionMin[k], positions[i * 3 + k]); positionMax[k] = Math.max(positionMax[k], positions[i * 3 + k]); }
const gltf = {
  asset: { version: '2.0', generator: 'myPortfolio prepare-clay-head' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'OmarHead' }],
  meshes: [{ name: 'OmarHead', primitives: [
    { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
    ...(fillIndex.length ? [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 4, material: 1 }] : []),
  ] }],
  accessors: [
    { bufferView: add(positions, 34962), componentType: 5126, count: vertexCount, type: 'VEC3', min: positionMin, max: positionMax },
    { bufferView: add(normals, 34962), componentType: 5126, count: vertexCount, type: 'VEC3' },
    { bufferView: add(uvs, 34962), componentType: 5126, count: vertexCount, type: 'VEC2' },
    { bufferView: add(Uint32Array.from(mainIndex), 34963), componentType: 5125, count: mainIndex.length, type: 'SCALAR' },
    ...(fillIndex.length ? [{ bufferView: add(Uint32Array.from(fillIndex), 34963), componentType: 5125, count: fillIndex.length, type: 'SCALAR' }] : []),
  ],
  materials: [
    { name: 'Clay', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: .85 } },
    // Double-sided: a fan's facing is a guess on a concave slit, and a culled fill lets the corona glow through the eyes.
    { name: 'Dark', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [.045, .03, .025, 1], metallicFactor: 0, roughnessFactor: .9 } },
  ],
  textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ mimeType: 'image/jpeg', bufferView: add(jpeg) }],
  bufferViews: views, buffers: [{ byteLength: offset }],
};
const json = Buffer.from(JSON.stringify(gltf)), jsonPadded = Buffer.alloc((json.length + 3) & ~3, 32); json.copy(jsonPadded);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + offset, 8); header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
binHeader.writeUInt32LE(offset, 0); binHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(output, Buffer.concat([header, jsonPadded, binHeader, ...chunks]));
console.log(`wrote ${output}: ${Math.round((28 + jsonPadded.length + offset) / 1024)} KB (texture ${Math.round(jpeg.length / 1024)} KB)`);
