import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HOME, type Destination, type Flight } from './flight';

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}`;
const noRaycast = () => null;
type Target = THREE.WebGLRenderTarget;
const blurVertex = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const blurFragment = `uniform sampler2D tex; uniform vec2 step; varying vec2 vUv; void main(){ vec4 c=texture2D(tex,vUv)*.2270270; c+=(texture2D(tex,vUv+step*1.3846154)+texture2D(tex,vUv-step*1.3846154))*.3162162; c+=(texture2D(tex,vUv+step*3.2307692)+texture2D(tex,vUv-step*3.2307692))*.0702703; gl_FragColor=c; }`;
const glowVertex = `varying vec2 vUv; void main(){ vUv=position.xy*.5+.5; gl_Position=vec4(position.xy,1.0,1.0); }`;
const glowFragment = `uniform sampler2D mask; uniform sampler2D tight; uniform sampler2D wide; uniform float time; uniform vec2 center; uniform float aspect; varying vec2 vUv; ${noise}
void main(){
 float m=texture2D(mask,vUv).r, t=texture2D(tight,vUv).r, w=texture2D(wide,vUv).r;
 vec2 d=(vUv-center)*vec2(aspect,1.0); float r=length(d); vec2 dir=d/max(r,1e-4);
 float streak=fbm(dir*2.6+vec2(time*.04,-time*.03)-r*vec2(1.2,.8));
 streak=pow(smoothstep(.36,.84,streak),1.3);
 float churn=.8+.4*fbm(vUv*vec2(aspect,1.0)*5.0-vec2(0.0,time*.09));
 float glow=(t*1.2+w*(.95+1.5*streak))*churn;
 glow*=1.0-.8*m;
 vec3 col=mix(vec3(.8,.26,.1),vec3(1.0,.58,.27),smoothstep(0.0,.5,glow));
 col=mix(col,vec3(1.0,.9,.7),smoothstep(.5,1.3,glow));
 gl_FragColor=vec4(col*min(glow,1.5),1.0);
}`;
/** The home sun: the head itself is the star. Its silhouette (everything on layer 1) is rendered to a small mask, blurred
 *  twice (a tight rim and a wide corona) and added back over the frame, so the light hugs the face, ears and curls
 *  instead of forming a disc or sphere around them. Costs one quarter-resolution render of the head plus twelve tiny blur passes. */
export function SunGlow({reduced}:{reduced:boolean}){
 const {gl,scene,camera,size}=useThree();
 const rig=useMemo(()=>{
  const make=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false});
  const blur=new THREE.ShaderMaterial({vertexShader:blurVertex,fragmentShader:blurFragment,uniforms:{tex:{value:null},step:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false});
  const quad=new THREE.Scene(); quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),blur));
  return {mask:make(),tightA:make(),tightB:make(),wideA:make(),wideB:make(),blur,quad,quadCamera:new THREE.OrthographicCamera(-1,1,1,-1,0,1),override:new THREE.MeshBasicMaterial({color:'#ffffff',fog:false,side:THREE.DoubleSide}),clearColor:new THREE.Color(),point:new THREE.Vector3()};
 },[]);
 useEffect(()=>{
  const dpr=gl.getPixelRatio(),w=Math.max(2,Math.floor(size.width*dpr/4)),h=Math.max(2,Math.floor(size.height*dpr/4));
  for(const target of [rig.mask,rig.tightA,rig.tightB])target.setSize(w,h);
  for(const target of [rig.wideA,rig.wideB])target.setSize(Math.ceil(w/2),Math.ceil(h/2));
 },[gl,size,rig]);
 useEffect(()=>()=>{for(const target of [rig.mask,rig.tightA,rig.tightB,rig.wideA,rig.wideB])target.dispose();rig.blur.dispose();rig.override.dispose();},[rig]);
 const uniforms=useMemo(()=>({mask:{value:rig.mask.texture},tight:{value:rig.tightA.texture},wide:{value:rig.wideA.texture},time:{value:5},center:{value:new THREE.Vector2(.5,.5)},aspect:{value:1}}),[rig]);
 useFrame(({clock})=>{
  if(!reduced)uniforms.time.value=5+clock.elapsedTime;
  uniforms.aspect.value=size.width/size.height;
  rig.point.set(HOME.x,.5,HOME.z).project(camera);uniforms.center.value.set(rig.point.x*.5+.5,rig.point.y*.5+.5);
  // Silhouette mask: only layer 1 (the head), flat white, no fog or background.
  const background=scene.background,fog=scene.fog,override=scene.overrideMaterial,layers=camera.layers.mask;
  gl.getClearColor(rig.clearColor);const clearAlpha=gl.getClearAlpha();
  scene.background=null;scene.fog=null;scene.overrideMaterial=rig.override;camera.layers.set(1);
  gl.setClearColor(0x000000,0);gl.setRenderTarget(rig.mask);gl.render(scene,camera);
  scene.background=background;scene.fog=fog;scene.overrideMaterial=override;camera.layers.mask=layers;
  gl.setClearColor(rig.clearColor,clearAlpha);
  const pass=(from:Target,to:Target,x:number,y:number)=>{rig.blur.uniforms.tex.value=from.texture;rig.blur.uniforms.step.value.set(x/from.width,y/from.height);gl.setRenderTarget(to);gl.render(rig.quad,rig.quadCamera);};
  pass(rig.mask,rig.tightB,1,0);pass(rig.tightB,rig.tightA,0,1);pass(rig.tightA,rig.tightB,2,0);pass(rig.tightB,rig.tightA,0,2);
  pass(rig.tightA,rig.wideB,2,0);pass(rig.wideB,rig.wideA,0,2);pass(rig.wideA,rig.wideB,4,0);pass(rig.wideB,rig.wideA,0,4);pass(rig.wideA,rig.wideB,7,0);pass(rig.wideB,rig.wideA,0,7);pass(rig.wideA,rig.wideB,10,0);pass(rig.wideB,rig.wideA,0,10);
  gl.setRenderTarget(null);
 });
 const triangle=useMemo(()=>new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),[]);
 return <mesh frustumCulled={false} renderOrder={20} raycast={noRaycast}><bufferGeometry><bufferAttribute attach="attributes-position" args={[triangle,3]}/></bufferGeometry><shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} uniforms={uniforms} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>;
}
export function DockBeacon({target,active,reduced}:{target:Destination;active:boolean;reduced:boolean}) {
 const ring=useRef<THREE.Mesh>(null);
 useFrame(({clock})=>{if(ring.current){const material=ring.current.material as THREE.MeshBasicMaterial;material.opacity=active?(reduced?.55:.35+Math.sin(clock.elapsedTime*2.5)*.16):.1;const s=active&&!reduced?1+Math.sin(clock.elapsedTime*2.5)*.025:1;ring.current.scale.setScalar(s);}});
 return <mesh ref={ring} position={[target.x,target.id==='home'?-1.2:-.5,target.z]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[target.dockRadius-.27,target.dockRadius-.22,128]}/><meshBasicMaterial color="#a5d7b5" transparent opacity={.1} side={THREE.DoubleSide} depthWrite={false}/></mesh>;
}
export function EngineTrail({flight,thrust,enabled,reduced,reset}:{flight:React.RefObject<Flight>;thrust:React.RefObject<number>;enabled:boolean;reduced:boolean;reset:number}) {
 const points=useRef<THREE.Points>(null),cursor=useRef(0),previousReset=useRef(reset),accumulator=useRef(0);
 const particles=useMemo(()=>({positions:new Float32Array(120*3),life:new Float32Array(120),sizes:new Float32Array(120),velocities:new Float32Array(120*3)}),[]);
 useFrame((_,delta)=>{
  const dt=Math.min(delta,.05);
  if(previousReset.current!==reset||!enabled||reduced){particles.life.fill(0);previousReset.current=reset;}
  if(enabled&&!reduced&&thrust.current>.1){
   accumulator.current+=dt;let spawns=0;
   while(accumulator.current>1/45&&spawns++<4){
    accumulator.current-=1/45;const i=cursor.current++%120,p=i*3,f=flight.current;
    particles.positions[p]=f.x+Math.sin(f.angle)*1.05+(Math.random()-.5)*.12;
    particles.positions[p+1]=.3+(Math.random()-.5)*.12;
    particles.positions[p+2]=f.z+Math.cos(f.angle)*1.05+(Math.random()-.5)*.12;
    particles.velocities[p]=Math.sin(f.angle)*(1+thrust.current)+(Math.random()-.5)*.5;
    particles.velocities[p+1]=(Math.random()-.5)*.25;
    particles.velocities[p+2]=Math.cos(f.angle)*(1+thrust.current)+(Math.random()-.5)*.5;
    particles.life[i]=1;particles.sizes[i]=.6+Math.random()*.7;
   }
  } else accumulator.current=0;
  for(let i=0;i<120;i++){particles.life[i]=Math.max(0,particles.life[i]-dt*.85);for(let j=0;j<3;j++)particles.positions[i*3+j]+=particles.velocities[i*3+j]*dt;}
  if(points.current){points.current.geometry.attributes.position.needsUpdate=true;points.current.geometry.attributes.life.needsUpdate=true;points.current.geometry.attributes.particleSize.needsUpdate=true;}
 });
 return <points ref={points} frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" args={[particles.positions,3]}/><bufferAttribute attach="attributes-life" args={[particles.life,1]}/><bufferAttribute attach="attributes-particleSize" args={[particles.sizes,1]}/></bufferGeometry><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`attribute float life; attribute float particleSize; varying float vLife; void main(){vLife=life;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(210.0*particleSize*life/max(1.0,-mv.z),0.0,24.0);}`} fragmentShader={`varying float vLife; void main(){float r=length(gl_PointCoord-.5)*2.0;float alpha=(1.0-smoothstep(.15,1.0,r))*vLife;gl_FragColor=vec4(mix(vec3(.9,.36,.2),vec3(1.0,.85,.55),vLife),alpha*.8);}`}/></points>;
}
