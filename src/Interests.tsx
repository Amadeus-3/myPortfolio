import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME } from './flight';
import { Bust, Easel, FilmCamera, Gramophone, Guitar, Microphone } from './props';
// The things in Omar's orbit, after the philosophers, musicians, painters and filmmakers who inspire him; the models
// live with the other props. They stand on y = 0, so each is lowered to float centred on its place in the orbit.
const objects=[Guitar,Gramophone,Bust,FilmCamera,Easel,Microphone];
export default function Interests({reduced}:{reduced:boolean}){
 const group=useRef<THREE.Group>(null);
 useFrame(({clock})=>{if(group.current){group.current.children.forEach((child,i)=>{const t=i/6*Math.PI*2+(reduced?0:clock.elapsedTime*.035);
   // A tilted orbit: the side nearest the camera (+z) dips below the chin and the far side rises behind the hair,
   // so the objects frame the face instead of passing over the eyes.
   child.position.set(Math.cos(t)*5.9,-.2-Math.sin(t)*3.3,Math.sin(t)*5.9);child.rotation.y=reduced?-.2:Math.sin(clock.elapsedTime*.3+i)*.25;});}});
 return <group ref={group} position={[HOME.x,.5,HOME.z]}>{objects.map((Object,i)=><group key={i}><group position={[0,-.6,0]}><Object/></group></group>)}</group>;
}
