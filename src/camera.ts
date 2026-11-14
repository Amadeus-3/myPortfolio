import { OVERVIEW, SPAWN, type Destination, type Flight } from './flight.ts';
export type CameraView = 'overview' | 'flight' | 'planet';
export function cameraPose(view: CameraView, flight: Flight, compact: boolean, zoom: number, boost: boolean, focus?: Destination) {
  if (view === 'planet' && focus) {
    // Arrival: dive in towards the planet, centred, just before the warp takes you down to its surface.
    const scale = focus.id === 'home' ? 1.05 : Math.min(1.25, Math.max(.75, (focus.ring ?? focus.radius) / 3));
    const target = { x: focus.x, y: focus.id === 'home' ? .8 : focus.radius * .3, z: focus.z };
    return { target, position: { x: target.x, y: (compact ? 7.5 : 5.6) * scale, z: focus.z + (compact ? 13 : 9.5) * scale }, fov: 46 };
  }
  const target = view === 'overview'
    ? { x: OVERVIEW.x, y: 0, z: OVERVIEW.z }
    : { x: compact ? flight.x : OVERVIEW.x + (flight.x - SPAWN.x) * .65, y: 0, z: OVERVIEW.z + (flight.z - SPAWN.z) * .6 };
  // Phones are tall and narrow: pull back so the planets either side of the head stay in frame.
  const distance = (Math.min(1.3, Math.max(.75, zoom)) + (view === 'flight' && boost ? .08 : 0)) * (compact ? 2.1 : 1.1);
  return { target, position: { x: target.x, y: 24 * distance, z: target.z + 34 * distance }, fov: 44 };
}
