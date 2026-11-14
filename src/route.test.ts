import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANDING, ROAD_HALF_WIDTH, ROCKET_PAD, ROVER, bayOf, boundsFor, forwardOf, makeRoute, nearestOnRoad, obstaclesFor, pointAt, roadDistance, scatter, stepRover, type Rover } from './route.ts';

const counts = [1, 2, 3, 4, 5, 6];
const inside = (r: Rover, obstacles: { x: number; z: number; r: number }[]) => obstacles.some(o => Math.hypot(r.x - o.x, r.z - o.z) < o.r + ROVER.radius - .02);

test('the road starts at the rocket and reaches every stop in order', () => {
  for (const n of counts) {
    const route = makeRoute(n);
    assert.equal(route.stops.length, n);
    assert.deepEqual(pointAt(route, 0).x, LANDING.x);
    for (let i = 1; i < n; i++) assert.ok(route.stops[i] - route.stops[i - 1] > 8, `stops ${i - 1} and ${i} too close`);
    assert.ok(Math.abs(route.stops[n - 1] - route.total) < 1e-9);
  }
});

test('stations stand beside the road, never on it', () => {
  for (const n of counts) {
    const route = makeRoute(n);
    for (const station of route.stations) assert.ok(roadDistance(route, station) > 3, `station at ${station.x.toFixed(1)}, ${station.z.toFixed(1)}`);
  }
});

test('scenery keeps the road, the stations and the landing pad clear', () => {
  for (const n of counts) {
    const route = makeRoute(n), scene = scatter(route, n * 7 + 1);
    assert.ok(scene.props.length > 25);
    for (const p of [...scene.props, ...scene.rocks]) {
      assert.ok(roadDistance(route, p) > ROAD_HALF_WIDTH, 'something on the road');
      assert.ok(Math.hypot(p.x - ROCKET_PAD.x, p.z - ROCKET_PAD.z) > 3, 'something on the pad');
    }
    for (const p of scene.props) for (const s of route.stations) assert.ok(Math.hypot(p.x - s.x, p.z - s.z) > 2.6);
    assert.deepEqual(scatter(route, n * 7 + 1), scene, 'scenery is deterministic');
  }
});

test('driving by hand: throttle, coasting to a stop, steering, and solid obstacles', () => {
  const route = makeRoute(3), scene = scatter(route, 9), obstacles = obstaclesFor(route, scene), bounds = boundsFor(route);
  let r: Rover = { x: LANDING.x, z: LANDING.z, heading: 0, speed: 0 };
  for (let i = 0; i < 120; i++) r = stepRover(r, { throttle: 1, steer: 0 }, 1 / 60, obstacles, bounds);
  assert.ok(r.speed > 4 && r.z < LANDING.z - 3, 'drives forward');
  for (let i = 0; i < 240; i++) r = stepRover(r, { throttle: 0, steer: 0 }, 1 / 60, obstacles, bounds);
  assert.equal(r.speed, 0, 'coasts to a stop');
  const before = r.heading;
  for (let i = 0; i < 30; i++) r = stepRover(r, { throttle: 1, steer: -1 }, 1 / 60, obstacles, bounds);
  assert.ok(r.heading < before, 'steering left turns left');
  // Ram a station head-on: the rover stops at its edge.
  const station = route.stations[1], f = forwardOf(0);
  r = { x: station.x - f.x * 6, z: station.z - f.z * 6, heading: 0, speed: 0 };
  for (let i = 0; i < 300; i++) { r = stepRover(r, { throttle: 1, steer: 0 }, 1 / 60, obstacles, bounds); assert.ok(!inside(r, obstacles)); }
  // And the edge of the area holds.
  r = { x: bounds.maxX - 1, z: 0, heading: Math.PI / 2, speed: 0 };
  for (let i = 0; i < 200; i++) r = stepRover(r, { throttle: 1, steer: 0 }, 1 / 60, obstacles, bounds);
  assert.ok(r.x <= bounds.maxX);
});

test('an Earth-like planet gets lakes and trees, all clear of the road, the stations, the pad and each other', () => {
  for (const n of [3, 4, 5]) {
    const route = makeRoute(n), scene = scatter(route, n * 7 + 1, true);
    assert.ok(scene.lakes.length >= 2 && scene.trees.length > 80 && scene.craters.length === 0);
    for (const lake of scene.lakes) {
      assert.ok(roadDistance(route, lake) > lake.r + 2, 'lake on the road');
      for (const s of route.stations) assert.ok(Math.hypot(lake.x - s.x, lake.z - s.z) > lake.r + 2.5, 'lake on a station');
    }
    for (const thing of [...scene.trees, ...scene.props, ...scene.rocks]) {
      assert.ok(roadDistance(route, thing) > ROAD_HALF_WIDTH, 'something on the road');
      for (const lake of scene.lakes) assert.ok(Math.hypot(thing.x - lake.x, thing.z - lake.z) > lake.r * 1.15, 'something in a lake');
    }
    assert.deepEqual(scatter(route, n * 7 + 1, true), scene, 'deterministic');
  }
});

test('the nearest point of the road is found from anywhere, including each stop', () => {
  const route = makeRoute(5);
  for (const [i, s] of route.stops.entries()) {
    const bay = bayOf(route, i), near = nearestOnRoad(route, bay);
    assert.ok(Math.abs(near.s - s) < .6 && near.d < .3, `stop ${i}`);
  }
  const off = nearestOnRoad(route, { x: 25, z: 0 });
  assert.ok(off.d > 10 && off.s >= 0 && off.s <= route.total);
});
