import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME } from './flight';
function Glove(){return <group scale={.6}><mesh scale={[.65,.8,.55]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color="#d98267" roughness={.8}/></mesh><mesh position={[-.55,-.25,.1]} scale={[.27,.43,.35]}><sphereGeometry args={[1,20,12]}/><meshStandardMaterial color="#d98267"/></mesh><mesh position={[0,-.85,0]}><cylinderGeometry args={[.42,.4,.45,24]}/><meshStandardMaterial color="#e9c49b"/></mesh></group>;}
function Record(){return <group rotation={[.3,0,-.3]}><mesh><cylinderGeometry args={[.65,.65,.08,40]}/><meshStandardMaterial color="#262d36" roughness={.5}/></mesh><mesh position={[0,.045,0]}><cylinderGeometry args={[.23,.23,.015,32]}/><meshStandardMaterial color="#e4b68a"/></mesh>{[.4,.5,.6].map(r=><mesh key={r} rotation={[Math.PI/2,0,0]} position={[0,.05,0]}><torusGeometry args={[r,.008,4,40]}/><meshStandardMaterial color="#58616b"/></mesh>)}</group>;}
function Book(){return <group rotation={[.2,0,.15]}><mesh><boxGeometry args={[.75,.98,.23]}/><meshStandardMaterial color="#83a995"/></mesh><mesh position={[.04,0,.03]}><boxGeometry args={[.66,.88,.23]}/><meshStandardMaterial color="#e8d9b8"/></mesh><mesh position={[0,0,.17]}><boxGeometry args={[.75,.98,.06]}/><meshStandardMaterial color="#83a995"/></mesh><mesh position={[.15,-.55,.14]}><boxGeometry args={[.12,.25,.02]}/><meshStandardMaterial color="#d68b71"/></mesh></group>;}
function Clapper(){return <group scale={.9}><mesh><boxGeometry args={[1,.66,.14]}/><meshStandardMaterial color="#d0bc95"/></mesh><group position={[0,.48,0]} rotation={[0,0,.2]}><mesh><boxGeometry args={[1,.18,.15]}/><meshStandardMaterial color="#e1ccaa"/></mesh>{[-.35,0,.35].map(x=><mesh key={x} position={[x,0,.08]} rotation={[0,0,-.3]}><boxGeometry args={[.16,.2,.02]}/><meshStandardMaterial color="#32373b"/></mesh>)}</group></group>;}
function Palette(){return <group rotation={[.35,0,-.3]}><mesh scale={[.7,.5,.1]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color="#d6b083"/></mesh>{['#c37965','#78a899','#c5b46e'].map((color,i)=><mesh key={color} position={[-.32+i*.3,.16,.1]} scale={[.11,.1,.05]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color={color}/></mesh>)}</group>;}
function Laptop(){return <group><mesh rotation={[-.15,0,0]}><boxGeometry args={[1.1,.7,.06]}/><meshStandardMaterial color="#839da1"/></mesh><mesh position={[0,.02,.04]}><boxGeometry args={[.95,.55,.03]}/><meshStandardMaterial color="#1d3542"/></mesh><mesh position={[0,-.4,.3]}><boxGeometry args={[1.1,.07,.7]}/><meshStandardMaterial color="#adbdb4"/></mesh>{[-.15,.1].map((y,i)=><mesh key={i} position={[-.12,y,.065]}><boxGeometry args={[i?.35:.55,.025,.01]}/><meshBasicMaterial color="#a4d5b8"/></mesh>)}</group>;}
const objects=[Glove,Record,Book,Clapper,Palette,Laptop];
export default function Interests({reduced}:{reduced:boolean}){
 const group=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(group.current){group.current.children.forEach((child,i)=>{const t=i/6*Math.PI*2+(reduced?0:clock.elapsedTime*.035);
   // A tilted orbit: the side nearest the camera (+z) dips below the chin and the far side rises behind the hair,
   // so the objects frame the face instead of passing over the eyes.
   child.position.set(Math.cos(t)*5.9,-.2-Math.sin(t)*3.3,Math.sin(t)*5.9);child.rotation.y=reduced?-.2:Math.sin(clock.elapsedTime*.3+i)*.25;});}});
 return <group ref={group} position={[HOME.x,.5,HOME.z]}>{objects.map((Object,i)=><group key={i}><Object/></group>)}</group>;
}
