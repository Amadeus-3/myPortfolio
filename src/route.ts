// The road on a planet's surface: from where the rocket lands, through every stop in order. The rover drives along it
// and parks at each stop. Pure maths on the ground plane (x, z relative to the landing scene's origin), so it runs in
// Node tests as well as in the scene.

export type Point = { x: number; z: number };
/** Where the rover rolls out, at the foot of the landed rocket. */
export const LANDING: Point = { x: 0, z: 10 };
export const ROCKET_PAD: Point = { x: -3, z: 12.5 };
export const ROAD_HALF_WIDTH = 1.4;
/** Each stop's station stands this far to the left of the road. */
export const STATION_OFFSET = 3.3;
const STEPS = 28; // samples per stretch of road

export type Sample = Point & { s: number };
export type Route = {
  samples: Sample[];
  total: number;
  /** Distance along the road of each stop. */
  stops: number[];
  /** Where each stop's station stands, beside the road. */
  stations: Point[];
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
function catmull(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) };
}

/** A winding road that heads away from the rocket and sways left and right, one stop roughly every 11 units. */
export function makeRoute(count: number): Route {
  const keys: Point[] = [LANDING, ...Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * 1.75 + .8) * 6, z: LANDING.z - 13 - i * 11.5 }))];
  const first = keys[0], second = keys[1], last = keys[keys.length - 1], beforeLast = keys[keys.length - 2];
  const ends = [{ x: 2 * first.x - second.x, z: 2 * first.z - second.z }, { x: 2 * last.x - beforeLast.x, z: 2 * last.z - beforeLast.z }];
  const points = [ends[0], ...keys, ends[1]];
  const samples: Sample[] = [], keyAt: number[] = [];
  for (let segment = 0; segment < keys.length - 1; segment++) {
    keyAt.push(samples.length);
    for (let k = 0; k < STEPS; k++) {
      const point = catmull(points[segment], points[segment + 1], points[segment + 2], points[segment + 3], k / STEPS);
      samples.push({ ...point, s: samples.length ? samples[samples.length - 1].s + dist(samples[samples.length - 1], point) : 0 });
    }
  }
  keyAt.push(samples.length);
  samples.push({ ...last, s: samples[samples.length - 1].s + dist(samples[samples.length - 1], last) });
  const stops = keyAt.slice(1).map(i => samples[i].s);
  const stations = stops.map(s => { const p = pointAt({ samples } as Route, s); return { x: p.x + p.tz * STATION_OFFSET, z: p.z - p.tx * STATION_OFFSET }; });
  return { samples, total: samples[samples.length - 1].s, stops, stations };
}

/** Position and direction of travel (unit tangent) at a distance along the road. */
export function pointAt(route: Pick<Route, 'samples'>, s: number) {
  const { samples } = route;
  const d = Math.max(0, Math.min(samples[samples.length - 1].s, s));
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].s <= d) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi], span = b.s - a.s || 1, t = (d - a.s) / span, len = dist(a, b) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len };
}

/** Shortest distance from a point to the road. */
export function roadDistance(route: Route, p: Point) {
  let best = Infinity;
  for (const sample of route.samples) best = Math.min(best, dist(sample, p));
  return best;
}

/** A small seeded random generator, so every planet's scenery is the same on every visit. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Scenery = {
  props: (Point & { scale: number; spin: number; kind: number })[];
  rocks: (Point & { size: number; spin: number })[];
  craters: (Point & { size: number })[];
  /** Earth-like planets only: lakes (centre and radius) and trees (size, shape and shade). */
  lakes: (Point & { r: number })[];
  trees: (Point & { size: number; conifer: boolean; shade: number; spin: number })[];
  landmark: Point;
};
/** Themed models, rocks and craters scattered over the ground, kept off the road, the stations and the landing pad.
 *  An Earth-like planet gets lakes and trees instead of craters, and fewer models among the trees. */
export function scatter(route: Route, seed: number, earth = false): Scenery {
  const rand = seeded(seed), endZ = Math.min(...route.samples.map(p => p.z));
  const landmark = { x: -17, z: (LANDING.z + endZ) / 2 - 4 };
  const area = () => ({ x: (rand() - .5) * 56, z: LANDING.z + 12 - rand() * (LANDING.z + 26 - endZ) });
  const lakes: Scenery['lakes'] = [];
  for (let tries = 0; earth && lakes.length < 5 && tries < 400; tries++) {
    const p = area(), r = 2.6 + rand() * 4;
    if (roadDistance(route, p) > r + 2.6 && route.stations.every(s => dist(s, p) > r + 3) && dist(p, ROCKET_PAD) > r + 4 && dist(p, landmark) > r + 4 && lakes.every(l => dist(l, p) > l.r + r + 2)) lakes.push({ ...p, r });
  }
  const dry = (p: Point, margin: number) => lakes.every(l => dist(l, p) > l.r * 1.15 + margin);
  const open = (p: Point, margin: number) => roadDistance(route, p) > ROAD_HALF_WIDTH + margin
    && route.stations.every(s => dist(s, p) > 2.6 + margin) && dist(p, ROCKET_PAD) > 3 + margin && dist(p, landmark) > 4.5 + margin && dry(p, margin);
  const props: Scenery['props'] = [];
  for (let tries = 0; props.length < (earth ? 24 : 46) && tries < 1200; tries++) {
    const p = area();
    if (!open(p, 1.6) || props.some(q => dist(p, q) < 2.6)) continue;
    props.push({ ...p, scale: .85 + rand() * .75, spin: rand() * Math.PI * 2, kind: props.length });
  }
  const rocks: Scenery['rocks'] = [];
  for (let tries = 0; rocks.length < (earth ? 60 : 140) && tries < 1500; tries++) {
    const p = area();
    if (open(p, .2)) rocks.push({ ...p, size: .1 + rand() * .32, spin: rand() * 6 });
  }
  const craters: Scenery['craters'] = [];
  for (let tries = 0; !earth && craters.length < 14 && tries < 400; tries++) {
    const p = area(), size = 1 + rand() * 1.8;
    if (open(p, size) && craters.every(c => dist(c, p) > c.size + size + 1)) craters.push({ ...p, size });
  }
  const trees: Scenery['trees'] = [];
  for (let tries = 0; earth && trees.length < 150 && tries < 3000; tries++) {
    const p = area();
    if (!open(p, 1.1) || props.some(q => dist(p, q) < 1.6) || trees.some(t => dist(p, t) < 1.2)) continue;
    trees.push({ ...p, size: .75 + rand() * .7, conifer: rand() < .4, shade: rand(), spin: rand() * Math.PI * 2 });
  }
  return { props, rocks, craters, lakes, trees, landmark };
}

// ── Driving ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// The rover is driven by hand: throttle and steering, like a small car. Heading 0 faces −z; forward is (sin h, −cos h)
// and steering left lowers the heading.

export type Rover = { x: number; z: number; heading: number; speed: number };
export type Obstacle = Point & { r: number };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export const ROVER = { radius: .55, accel: 5, brake: 9, coast: 3, top: 6, reverse: 2.4, steer: 2.3 };

export const forwardOf = (heading: number) => ({ x: Math.sin(heading), z: -Math.cos(heading) });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** What the rover can't drive through: stations, the scenery models, the landmark, the rocket, lakes and trees. */
export function obstaclesFor(route: Route, scene: Scenery): Obstacle[] {
  return [
    ...route.stations.map(s => ({ ...s, r: 1.3 })),
    ...scene.props.map(p => ({ x: p.x, z: p.z, r: .25 + .45 * p.scale })),
    { ...scene.landmark, r: 2.4 },
    { ...ROCKET_PAD, r: 1.25 },
    ...scene.lakes.map(l => ({ x: l.x, z: l.z, r: l.r * .95 })), // the rover stays on dry land
    ...scene.trees.map(t => ({ x: t.x, z: t.z, r: .3 * t.size })),
  ];
}
/** The drivable area: the scenery's footprint around the road. */
export function boundsFor(route: Route): Bounds {
  const endZ = Math.min(...route.samples.map(p => p.z));
  return { minX: -30, maxX: 30, minZ: endZ - 16, maxZ: LANDING.z + 14 };
}

/** One step of driving. `throttle` and `steer` run from −1 to 1. Obstacles and the edge of the area are solid. */
export function stepRover(r: Rover, input: { throttle: number; steer: number }, dt: number, obstacles: Obstacle[], bounds: Bounds): Rover {
  let speed = r.speed;
  const t = Math.max(-1, Math.min(1, input.throttle)), s = Math.max(-1, Math.min(1, input.steer));
  if (t !== 0 && Math.sign(t) !== Math.sign(speed) && Math.abs(speed) > .05) speed += t * ROVER.brake * dt; // braking
  else if (t !== 0) speed += t * ROVER.accel * dt;
  else speed -= Math.sign(speed) * Math.min(Math.abs(speed), ROVER.coast * dt);
  speed = Math.max(-ROVER.reverse, Math.min(ROVER.top, speed));
  // Steering bites harder with speed, but the rover can still turn slowly on the spot; reversing turns the other way.
  const grip = .35 + .65 * Math.min(1, Math.abs(speed) / 2.5);
  const heading = wrap(r.heading + s * ROVER.steer * grip * (speed < -.05 ? -1 : 1) * dt);
  const f = forwardOf(heading);
  let x = r.x + f.x * speed * dt, z = r.z + f.z * speed * dt;
  for (const o of obstacles) {
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), min = o.r + ROVER.radius;
    if (d < min) {
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
      x = o.x + nx * min; z = o.z + nz * min;
      if ((f.x * nx + f.z * nz) * speed < 0) speed *= .4; // driving into it: bump and slow down
    }
  }
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) {
    x = Math.max(bounds.minX, Math.min(bounds.maxX, x)); z = Math.max(bounds.minZ, Math.min(bounds.maxZ, z)); speed *= .4;
  }
  return { x, z, heading, speed };
}

/** The nearest point of the road: its distance along the road, and how far away it is. */
export function nearestOnRoad(route: Route, p: Point) {
  let best = 0, bestD = Infinity;
  route.samples.forEach((sample, i) => { const d = dist(sample, p); if (d < bestD) { bestD = d; best = i; } });
  return { s: route.samples[best].s, d: bestD };
}

/** Where the rover parks for a stop: on the road, beside its station. */
export const bayOf = (route: Route, stop: number) => pointAt(route, route.stops[stop]);
