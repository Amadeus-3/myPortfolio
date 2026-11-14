import { OVERVIEW, SPAWN, type Destination, type Flight } from './flight.ts';
export type CameraView = 'overview' | 'flight' | 'planet';
export function cameraPose(view: CameraView, flight: Flight, compact: boolean, zoom: number, boost: boolean, focus?: Destination) {
  if (view === 'planet' && focus) {
    // Frame the destination to the left of the desktop side panel; small planets get a closer camera than the head.
    const scale = focus.id === 'home' ? 1 : Math.min(.92, Math.max(.72, (focus.ring ?? focus.radius) / 2.6));
    const target = { x: focus.x + (compact ? 0 : 4.4 * scale), y: focus.id === 'home' ? .8 : 0, z: focus.z };
    return { target, position: { x: target.x, y: (compact ? 12.5 : 11) * scale, z: focus.z + (compact ? 22 : 19) * scale }, fov: 42 };
  }
  const target = view === 'overview'
    ? { x: OVERVIEW.x, y: 0, z: OVERVIEW.z }
    : { x: compact ? flight.x : OVERVIEW.x + (flight.x - SPAWN.x) * .65, y: 0, z: OVERVIEW.z + (flight.z - SPAWN.z) * .6 };
  // Phones are tall and narrow: pull back so the planets either side of the head stay in frame.
  const distance = (Math.min(1.3, Math.max(.75, zoom)) + (view === 'flight' && boost ? .08 : 0)) * (compact ? 2.1 : 1);
  return { target, position: { x: target.x, y: 24 * distance, z: target.z + 34 * distance }, fov: 44 };
}
