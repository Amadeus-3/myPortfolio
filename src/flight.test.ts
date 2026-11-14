import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFlight, stepFlight, stepDock, HOME, DOCK, DESTINATIONS, OBSTACLES, ROCKET_CLEARANCE, dockPoint, nearbyDestination, nearestDestination, SPAWN } from './flight.ts';
const clear = (f: { x: number; z: number }) => OBSTACLES.every(body => Math.hypot(f.x - body.x, f.z - body.z) >= body.radius + ROCKET_CLEARANCE - .0001);
test('momentum decays when controls are released', () => {
 let f = stepFlight(newFlight(), {x:1,z:0,boost:false}, .05);
 const speed = f.vx;
 for(let i=0;i<60;i++) f = stepFlight(f,{x:0,z:0,boost:false},1/60);
 assert.ok(f.vx < speed * .25);
});
test('diagonal controls do not move faster and boost increases speed', () => {
 const a = stepFlight(newFlight(),{x:1,z:0,boost:false},.05);
 const b = stepFlight(newFlight(),{x:1,z:1,boost:false},.05);
 const c = stepFlight(newFlight(),{x:1,z:0,boost:true},.05);
 assert.ok(Math.abs(Math.hypot(a.vx,a.vz)-Math.hypot(b.vx,b.vz)) < .0001);
 assert.ok(c.vx > a.vx);
});
test('planet and world boundaries stay solid, even after long frames', () => {
 let f = {...newFlight(), x:HOME.x, z:HOME.z, vx:0,vz:-20};
 f=stepFlight(f,{x:0,z:-1,boost:true},10);
 assert.ok(Math.hypot(f.x-HOME.x,f.z-HOME.z)>=5.5);
 f=stepFlight({...f,x:29.99,vx:100},{x:1,z:0,boost:true},.05);
 assert.equal(f.x,30); assert.equal(f.vx,0);
});
test('autopilot goes around the head from behind and arrives at its dock', () => {
 let f = {...newFlight(),x:HOME.x,z:HOME.z-14};
 for(let i=0;i<600;i++) { f=stepDock(f,1/60); assert.ok(clear(f)); }
 assert.ok(Math.hypot(f.x-DOCK.x,f.z-DOCK.z)<.01);
});
test('every planet and the satellite stop boosted approaches from all directions', () => {
 for (const body of OBSTACLES) {
  for (let heading = 0; heading < 16; heading++) {
   const angle = heading * Math.PI / 8;
   const x = Math.cos(angle), z = Math.sin(angle);
   let f = { ...newFlight(), x: body.x + x * (body.radius + ROCKET_CLEARANCE + 1), z: body.z + z * (body.radius + ROCKET_CLEARANCE + 1) };
   for (let frame = 0; frame < 120; frame++) {
    f = stepFlight(f, { x: -x, z: -z, boost: true }, 1 / 60);
    assert.ok(Math.hypot(f.x-body.x,f.z-body.z)>=body.radius+ROCKET_CLEARANCE-.0001);
   }
  }
 }
});
test('an already embedded rocket is pushed out, including while idle', () => {
 for (const body of OBSTACLES) {
  const f = stepFlight({ ...newFlight(), x: body.x, z: body.z }, { x: 0, z: 0, boost: false }, 1 / 60);
  assert.ok(Math.hypot(f.x-body.x,f.z-body.z)>=body.radius+ROCKET_CLEARANCE-.0001);
 }
});
test('every dock is reachable: outside all bodies and inside the world', () => {
 for (const d of DESTINATIONS) {
  const dock = dockPoint(d);
  assert.ok(clear(dock), `${d.id} dock clears every body`);
  assert.ok(Math.abs(dock.x) <= 30 && Math.abs(dock.z) <= 26, `${d.id} dock is inside the world`);
  assert.equal(nearbyDestination(dock), d.id, `${d.id} is the nearby destination at its own dock`);
 }
});
test('autopilot reaches every destination from across the world without touching a body', () => {
 for (const d of DESTINATIONS) {
  const dock = dockPoint(d);
  for (const x of [-28, -8, 7, 18, 28]) {
   for (const z of [-24, -20, -4, 11, 24]) {
    let f = { ...newFlight(), x, z };
    if (!clear(f)) continue;
    for (let frame = 0; frame < 900; frame++) {
     f = stepDock(f, 1 / 60, d);
     assert.ok(clear(f), `flying to ${d.id} from ${x}, ${z}`);
    }
    assert.ok(Math.hypot(f.x-dock.x,f.z-dock.z)<.01, `reaching ${d.id} from ${x}, ${z}`);
   }
  }
 }
});
test('autopilot can hop from any dock to any other', () => {
 for (const from of DESTINATIONS) for (const to of DESTINATIONS) {
  if (from === to) continue;
  let f = { ...newFlight(), ...dockPoint(from) };
  for (let frame = 0; frame < 900; frame++) { f = stepDock(f, 1 / 60, to); assert.ok(clear(f)); }
  const dock = dockPoint(to);
  assert.ok(Math.hypot(f.x-dock.x,f.z-dock.z)<.01, `${from.id} -> ${to.id}`);
 }
});
test('E always has somewhere to go: the nearest destination, from anywhere', () => {
 assert.equal(nearestDestination(SPAWN), 'home');
 for (const d of DESTINATIONS) assert.equal(nearestDestination(dockPoint(d)), d.id, `${d.id} is nearest at its own dock`);
 assert.equal(nearestDestination({ x: 29, z: -25 }), 'projects');
 assert.equal(nearestDestination({ x: -29, z: 25 }), 'education');
});
