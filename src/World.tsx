import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DockBeacon, EngineTrail } from './Effects';
import Interests from './Interests';
import Sky from './Sky';
import Planets from './Planets';
import { cameraPose } from './camera';
import * as THREE from 'three';
import { DESTINATIONS, HOME, OVERVIEW, SATELLITE, destination, dockPoint, nearbyDestination, nearestDestination, newFlight, stepDock, stepFlight, type DestinationId, type Flight } from './flight';
export type Mode = 'welcome' | 'flying' | 'docking' | 'arriving' | 'reading' | 'departing' | 'paused';
export type Controls = { keys: Set<string>; touch: {x:number;z:number}; boost: boolean };
type Props = {
 mode: Mode; controls: React.RefObject<Controls>; flight: React.RefObject<Flight>;
 reset: number; reduced: boolean; zoom: number; onArrive:()=>void; onDock:()=>void; onDepart:()=>void;
 /** Where the autopilot is heading, and which planet the reading camera frames. */
 destination: DestinationId; onTravel:(id:DestinationId)=>void;
 /** Planet title elements (rendered by App); positioned over their planets every frame. */
 labels: React.RefObject<Partial<Record<DestinationId,HTMLElement|null>>>;
 onTelemetry:(speed:number,near:DestinationId|null,nearest:DestinationId)=>void;
 onLoad:(stage:'model'|'renderer'|'ready',progress?:number)=>void; onFailure:()=>void;
};
function Orbit({ radius, color='#4a666d', opacity=.25, position=[HOME.x,-1.8,HOME.z] }: {radius:number;color?:string;opacity?:number;position?:[number,number,number]}) {
 const geometry=useMemo(()=>new THREE.BufferGeometry().setFromPoints(Array.from({length:161},(_,i)=>new THREE.Vector3(Math.cos(i/160*Math.PI*2)*radius,0,Math.sin(i/160*Math.PI*2)*radius))),[radius]);
 return <lineLoop geometry={geometry} position={position}><lineBasicMaterial color={color} transparent opacity={opacity}/></lineLoop>;
}
/** One turn about every 40 seconds. */
const HEAD_SPIN=.16;
function Head({character,reduced,flight,facing,onClick}:{character:THREE.Group;reduced:boolean;flight:React.RefObject<Flight>;facing:boolean;onClick:()=>void}) {
 const group=useRef<THREE.Group>(null),spin=useRef(0);
 useFrame(({clock},delta)=>{
  const g=group.current;if(!g)return;
  const dt=Math.min(delta,.05);
  g.rotation.z=reduced?-.025:Math.sin(clock.elapsedTime*.35)*.025;
  if(facing||reduced){
   // Turn to face the camera the short way round, keeping a slight glance towards the rocket.
   const glance=THREE.MathUtils.clamp((flight.current.x-HOME.x)*.012,-.12,.12);
   const front=Math.round((spin.current-glance)/(Math.PI*2))*Math.PI*2+glance;
   spin.current=THREE.MathUtils.damp(spin.current,front,2.2,dt);
  } else spin.current=(spin.current+dt*HEAD_SPIN)%(Math.PI*2);
  // Inside the tilt towards the camera, so the head turns on its own axis.
  g.rotation.y=spin.current;
 });
 return <group position={[HOME.x,.5,HOME.z]}>
  <mesh onClick={onClick} onPointerOver={()=>document.body.style.cursor='pointer'} onPointerOut={()=>document.body.style.cursor='auto'}><sphereGeometry args={[3.9,12,8]}/><meshBasicMaterial visible={false}/></mesh>
  <group ref={group} rotation={[-.42,0,-.025]} scale={1.08}><primitive object={character}/></group>
 </group>;
}
/** Pins each planet's title just above it on screen. Writes styles directly, so nothing re-renders per frame. */
function LabelProjector({labels}:{labels:Props['labels']}){
 const point=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(({camera,gl})=>{
  const map=labels.current;if(!map)return;
  const canvas=gl.domElement.getBoundingClientRect();let parent:DOMRect|undefined;
  for(const d of DESTINATIONS){
   const element=map[d.id];if(!element)continue;
   parent??=(element.offsetParent??document.body).getBoundingClientRect();
   point.set(d.x,d.id==='home'?5.6:d.radius*1.95+.6,d.z).project(camera); // above the head, or above each planet's toy
   const visible=point.z<1&&Math.abs(point.x)<1.05&&Math.abs(point.y)<1.05;
   const x=canvas.left-parent.left+(point.x*.5+.5)*canvas.width,y=canvas.top-parent.top+(-point.y*.5+.5)*canvas.height;
   element.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
   element.style.visibility=visible?'visible':'hidden';
  }
 });
 return null;
}
function Rocket({thrust,reduced}:{thrust:React.RefObject<number>;reduced:boolean}) {
 const flame=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(flame.current){flame.current.scale.y=.3+thrust.current*(1+(reduced?0:Math.sin(clock.elapsedTime*32)*.13));flame.current.visible=thrust.current>.05;}});
 return <group rotation={[-Math.PI/2,0,0]} scale={.7}>
  <mesh><capsuleGeometry args={[.42,1.1,8,24]}/><meshStandardMaterial color="#eee7d8" roughness={.4}/></mesh>
  <mesh position={[0,1,0]}><coneGeometry args={[.42,.65,24]}/><meshStandardMaterial color="#db7c61" roughness={.6}/></mesh>
  <mesh position={[0,.3,.4]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.23,.23,.08,32]}/><meshStandardMaterial color="#24434b" metalness={.6} roughness={.2}/></mesh>
  <mesh position={[0,.3,.45]}><torusGeometry args={[.23,.045,8,32]}/><meshStandardMaterial color="#e7b38a" metalness={.6}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*.47,-.55,0]} rotation={[0,0,side*-.3]}><boxGeometry args={[.2,.75,.55]}/><meshStandardMaterial color="#cf745e"/></mesh>)}
  <mesh position={[0,-.92,0]}><cylinderGeometry args={[.3,.36,.24,20]}/><meshStandardMaterial color="#576771" metalness={.7}/></mesh>
  <mesh ref={flame} position={[0,-1.35,0]} rotation={[0,0,Math.PI]}><coneGeometry args={[.23,.9,16]}/><meshBasicMaterial color="#ffb478" transparent opacity={.85}/></mesh>
 </group>;
}
function Scene(props:Props) {
 // The clay head is prepared by scripts/prepare-clay-head.mjs: already centred, 7.3 units tall, ring and holes removed.
 // Toy-style head generated in Meshy (Smart Topology, from docs/art/meshy/toy/front.png) and prepared with
 // PARTS=0.004 node scripts/prepare-clay-head.mjs docs/art/meshy/toy/meshy-toy-raw.glb public/models/omar-meshy-toy.glb
 const gltf=useLoader(GLTFLoader,'/models/omar-meshy-toy.glb',undefined,event=>props.onLoad('model',event.lengthComputable?event.loaded/event.total:undefined));
 const character=useMemo(()=>{
  const model=gltf.scene.clone(true);
  model.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)mesh.raycast=()=>{};});
  return model;
 },[gltf]);
 const {gl,scene,camera}=useThree();
 const callbacks=useRef({onLoad:props.onLoad,onFailure:props.onFailure});
 callbacks.current={onLoad:props.onLoad,onFailure:props.onFailure};
 const compiled=useRef(false),readySent=useRef(false);
 useEffect(()=>{
  let cancelled=false;
  callbacks.current.onLoad('renderer');
  gl.compileAsync(scene,camera).then(()=>{if(!cancelled)compiled.current=true;}).catch(()=>{if(!cancelled)callbacks.current.onFailure();});
  const lost=(event:Event)=>{event.preventDefault();callbacks.current.onFailure();};
  gl.domElement.addEventListener('webglcontextlost',lost);
  return()=>{cancelled=true;gl.domElement.removeEventListener('webglcontextlost',lost);};
 },[gl,scene,camera]);
 const rocket=useRef<THREE.Group>(null),thrust=useRef(0),lastReset=useRef(props.reset),ticker=useRef(0);
 const compactViewport=useRef(window.matchMedia('(max-width: 760px)'));
 const cameraTarget=useMemo(()=>new THREE.Vector3(OVERVIEW.x,0,OVERVIEW.z),[]);
 const desiredCamera=useMemo(()=>new THREE.Vector3(),[]),desiredTarget=useMemo(()=>new THREE.Vector3(),[]);
 useFrame((_,delta)=>{
  const dt=Math.min(delta,.05);const {controls,flight,mode}=props;
  if(compiled.current&&!readySent.current){readySent.current=true;requestAnimationFrame(()=>callbacks.current.onLoad('ready'));}
  if(lastReset.current!==props.reset){flight.current=newFlight();lastReset.current=props.reset;}
  const keys=controls.current.keys;
  const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))+controls.current.touch.x;
  const z=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))+controls.current.touch.z;
  const boost=keys.has('shift')||controls.current.boost;
  if(mode==='flying')flight.current=stepFlight(flight.current,{x,z,boost},dt);
  const target=destination(props.destination);
  if(mode==='docking'){
   flight.current=stepDock(flight.current,dt,target);
   const dock=dockPoint(target);
   if(Math.hypot(flight.current.x-dock.x,flight.current.z-dock.z)<.08)props.onArrive();
  }
  thrust.current=mode==='docking'?.7:mode==='flying'&&!!(x||z)?(boost?1.6:1):0;
  const f=flight.current;
  if(rocket.current){rocket.current.position.set(f.x,.3,f.z);const diff=Math.atan2(Math.sin(f.angle-rocket.current.rotation.y),Math.cos(f.angle-rocket.current.rotation.y));rocket.current.rotation.y+=diff*(1-Math.exp(-9*dt));}
  if(mode!=='paused'){
   const view=mode==='arriving'||mode==='reading'?'planet':mode==='welcome'?'overview':'flight';
   const pose=cameraPose(view,f,compactViewport.current.matches,props.zoom,boost&&!props.reduced,target);
   desiredCamera.set(pose.position.x,pose.position.y,pose.position.z);desiredTarget.set(pose.target.x,pose.target.y,pose.target.z);
   const blend=props.reduced?1:1-Math.exp(-3*dt);
   camera.position.lerp(desiredCamera,blend);cameraTarget.lerp(desiredTarget,blend);camera.lookAt(cameraTarget);
   const perspective=camera as THREE.PerspectiveCamera;
   perspective.fov=THREE.MathUtils.lerp(perspective.fov,pose.fov,blend);perspective.updateProjectionMatrix();
   const settled=camera.position.distanceTo(desiredCamera)<.15&&cameraTarget.distanceTo(desiredTarget)<.15;
   if(settled&&mode==='arriving')props.onDock();
   if(settled&&mode==='departing')props.onDepart();
  }
  ticker.current+=dt;
  if(ticker.current>.12){props.onTelemetry(Math.hypot(f.vx,f.vz),nearbyDestination(f),nearestDestination(f));ticker.current=0;}
 },-1); // camera first, so everything else this frame sees the updated view
 return <>
  <color attach="background" args={['#03050a']}/>
  <ambientLight intensity={1.2}/><directionalLight position={[-12,15,18]} intensity={2} color="#fff1e0"/><directionalLight position={[15,5,-12]} intensity={.8} color="#b7d6df"/>
  <pointLight position={[HOME.x,.5,HOME.z]} intensity={30} decay={1.6} color="#ffe2c2"/>
  <Sky reduced={props.reduced}/><Orbit radius={9} opacity={.16}/><Orbit radius={16} opacity={.12}/><Orbit radius={23} opacity={.08}/>
  <DockBeacon target={destination(props.destination)} active={props.mode==='docking'||props.mode==='arriving'||props.mode==='reading'} reduced={props.reduced}/><Head character={character} flight={props.flight} reduced={props.reduced} facing={props.mode==='paused'||(props.destination==='home'&&['docking','arriving','reading'].includes(props.mode))} onClick={()=>props.onTravel('home')}/><Interests reduced={props.reduced}/>
  <Planets reduced={props.reduced} onSelect={props.onTravel}/><LabelProjector labels={props.labels}/>
  <group position={[...SATELLITE.position]} rotation={[.1,.2,-.35]}>
   <mesh><boxGeometry args={[.6,.6,.65]}/><meshStandardMaterial color="#dec9a4" metalness={.45}/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*.95,0,0]}><boxGeometry args={[1.1,.07,.65]}/><meshStandardMaterial color="#496b82" metalness={.5}/></mesh>)}
   <mesh position={[0,.5,0]}><cylinderGeometry args={[.025,.025,.7,8]}/><meshStandardMaterial color="#d6c3a1"/></mesh>
  </group>
  <group ref={rocket}><Rocket thrust={thrust} reduced={props.reduced}/></group><EngineTrail flight={props.flight} thrust={thrust} enabled={props.mode==='flying'||props.mode==='docking'} reduced={props.reduced} reset={props.reset}/>
 </>;
}
/** Frame statistics overlay, shown with ?perf in the URL. */
function FrameStats({onStats}:{onStats:(value:string)=>void}){
 const {gl}=useThree();
 const frames=useRef(0),elapsed=useRef(0);
 useFrame((_,dt)=>{frames.current++;elapsed.current+=dt;if(elapsed.current>1){onStats(`${Math.round(frames.current/elapsed.current)} fps · ${gl.info.render.triangles.toLocaleString()} triangles · ${gl.info.render.calls} draw calls`);frames.current=0;elapsed.current=0;}});
 return null;
}
export default function World(props:Props){
 const [stats,setStats]=useState('');
 const showStats=new URLSearchParams(window.location.search).has('perf');
 return <><Canvas camera={{position:[OVERVIEW.x,24,OVERVIEW.z+34],fov:44,near:.1,far:220}} onCreated={({camera})=>camera.lookAt(OVERVIEW.x,0,OVERVIEW.z)} dpr={[1,1.75]} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}>{showStats&&<FrameStats onStats={setStats}/>}<Suspense fallback={null}><Scene {...props}/></Suspense></Canvas>{showStats&&<output style={{position:'fixed',bottom:4,left:4,zIndex:100,fontSize:11,color:'white',background:'#000c',padding:5}}>{stats}</output>}</>;
}
