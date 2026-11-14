export const HOME = { x: 0, z: 0 };
export const OVERVIEW = { x: 0, z: 3 }; // centred: the universe fills the screen, no text column to make room for
export const SPAWN = { x: -2, z: 12 };
// Includes the nose and fins in every heading, plus a small visual gap.
export const ROCKET_CLEARANCE = 1.65;
export const HOME_OUTER_RADIUS = 5.85;
export const DOCK_RADIUS = HOME_OUTER_RADIUS + ROCKET_CLEARANCE + 1.5;
export const DOCK = { x: HOME.x, z: HOME.z + DOCK_RADIUS };
export const DOCK_APPROACH_RADIUS = DOCK_RADIUS + 2;

/** Every place the rocket can fly to. Content for each lives in src/content.ts. */
export type DestinationId = 'home' | 'experience' | 'projects' | 'education' | 'skills' | 'contact';
export type Destination = {
  id: DestinationId; x: number; z: number;
  /** Visual radius of the planet (home: the head's outer radius). */
  radius: number;
  /** Outer radius of a ring, if the planet has one; also its collision radius. */
  ring?: number;
  /** Distance from the centre where the rocket parks, on the side facing the camera. */
  dockRadius: number;
  /** Within this distance, E docks and the title shows the prompt. */
  approachRadius: number;
};
const planet = (id: DestinationId, x: number, z: number, radius: number, ring?: number): Destination => {
  const dockRadius = (ring ?? radius) + ROCKET_CLEARANCE + 1.3;
  return { id, x, z, radius, ring, dockRadius, approachRadius: dockRadius + 2 };
};
export const DESTINATIONS: Destination[] = [
  { id: 'home', ...HOME, radius: HOME_OUTER_RADIUS, dockRadius: DOCK_RADIUS, approachRadius: DOCK_APPROACH_RADIUS },
  planet('experience', -16, -9, 3.1),
  planet('projects', 16, -9, 2.5, 4.4),
  planet('education', -14, 8.5, 2.8),
  planet('skills', 14, 8.5, 2.9),
  planet('contact', 0, -21, 2.4),
];
export const destination = (id: DestinationId) => DESTINATIONS.find(d => d.id === id)!;
export const dockPoint = (d: Destination) => ({ x: d.x, z: d.z + d.dockRadius });
/** The destination the rocket is close enough to visit, if any (the nearest one wins). */
export function nearbyDestination(f: { x: number; z: number }): DestinationId | null {
  let best: Destination | null = null, bestDistance = Infinity;
  for (const d of DESTINATIONS) {
    const distance = Math.hypot(f.x - d.x, f.z - d.z);
    if (distance < d.approachRadius && distance < bestDistance) { best = d; bestDistance = distance; }
  }
  return best?.id ?? null;
}

/** The destination whose surface is closest to the rocket, at any distance: what E flies to. */
export function nearestDestination(f: { x: number; z: number }): DestinationId {
  let best = DESTINATIONS[0], bestGap = Infinity;
  for (const d of DESTINATIONS) {
    const gap = Math.hypot(f.x - d.x, f.z - d.z) - (d.ring ?? d.radius);
    if (gap < bestGap) { best = d; bestGap = gap; }
  }
  return best.id;
}

export const SATELLITE = { position: [-26, 1, 3] as const, radius: 1.65 };
export const OBSTACLES = [
  ...DESTINATIONS.map(d => ({ x: d.x, z: d.z, radius: d.ring ?? d.radius })),
  { x: SATELLITE.position[0], z: SATELLITE.position[2], radius: SATELLITE.radius },
];
export type Flight = { x: number; z: number; vx: number; vz: number; angle: number };
export const newFlight = (): Flight => ({ ...SPAWN, vx: 0, vz: 0, angle: 0 });

function keepClear(f: Flight): Flight {
  const next = { ...f };
  for (const body of OBSTACLES) {
    const distance = Math.hypot(next.x - body.x, next.z - body.z);
    const clearance = body.radius + ROCKET_CLEARANCE;
    if (distance >= clearance) continue;
    const nx = distance > .001 ? (next.x - body.x) / distance : 0;
    const nz = distance > .001 ? (next.z - body.z) / distance : 1;
    next.x = body.x + nx * clearance;
    next.z = body.z + nz * clearance;
    // Remove inward momentum while retaining movement along the surface.
    const inward = Math.min(0, next.vx * nx + next.vz * nz);
    next.vx -= inward * nx;
    next.vz -= inward * nz;
  }
  return next;
}

/**
 * Autopilot towards a destination's dock. Heads straight for it, and when the straight line would clip a planet,
 * curves along that planet's edge on the side nearer the goal. Fast across open space, easing in at the end.
 */
export function stepDock(f: Flight, delta: number, target: Destination = DESTINATIONS[0]): Flight {
  const dt = Math.min(Math.max(delta, 0), 0.05);
  const goal = dockPoint(target);
  const dx = goal.x - f.x, dz = goal.z - f.z, distance = Math.hypot(dx, dz);
  const speed = Math.min(24, 1.5 + distance * 2.6), step = speed * dt;
  if (distance <= step) return { x: goal.x, z: goal.z, vx: 0, vz: 0, angle: f.angle };
  const ux = dx / distance, uz = dz / distance;
  let mx = ux, mz = uz;
  for (const body of OBSTACLES) {
    const cx = body.x - f.x, cz = body.z - f.z, centre = Math.hypot(cx, cz);
    const along = cx * ux + cz * uz;
    if (along <= 0 || along > distance + body.radius) continue; // behind us, or beyond the goal
    const lateral = Math.abs(cx * uz - cz * ux), need = body.radius + ROCKET_CLEARANCE + .7;
    if (lateral >= need) continue;
    // Tangent to the body, on the side that keeps heading towards the goal.
    let tx = -cz / centre, tz = cx / centre;
    if (tx * ux + tz * uz < 0 || (Math.abs(tx * ux + tz * uz) < 1e-6 && tx < 0)) { tx = -tx; tz = -tz; }
    const closeness = Math.min(1, Math.max(0, (need * 1.9 - centre) / (need * .9)));
    const weight = Math.max(closeness, (need - lateral) / need * .45);
    mx = mx * (1 - weight) + tx * weight; mz = mz * (1 - weight) + tz * weight;
    const length = Math.hypot(mx, mz) || 1; mx /= length; mz /= length;
  }
  const next = keepClear({ x: f.x + mx * step, z: f.z + mz * step, vx: mx * speed, vz: mz * speed, angle: f.angle });
  next.angle = Math.atan2(-mx, -mz);
  return next;
}

export function stepFlight(f: Flight, input: { x: number; z: number; boost: boolean }, delta: number): Flight {
  const dt = Math.min(Math.max(delta, 0), 0.05);
  const length = Math.hypot(input.x, input.z) || 1;
  const acceleration = input.boost ? 19 : 11;
  const vx = (f.vx + input.x / length * acceleration * dt) * Math.exp(-1.6 * dt);
  const vz = (f.vz + input.z / length * acceleration * dt) * Math.exp(-1.6 * dt);
  const next = keepClear({ ...f, vx, vz, x: f.x + vx * dt, z: f.z + vz * dt });
  if (Math.abs(next.x) > 30) { next.x = Math.sign(next.x) * 30; next.vx = 0; }
  if (Math.abs(next.z) > 26) { next.z = Math.sign(next.z) * 26; next.vz = 0; }
  next.angle = Math.hypot(next.vx, next.vz) > .15 ? Math.atan2(-next.vx, -next.vz) : f.angle;
  return next;
}
