import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DESTINATIONS, newFlight, type DestinationId } from './flight';
import { SECTIONS, TITLES } from './content';
import type { Controls, Mode } from './World';
import SpaceLoader, { type LoadStage } from './SpaceLoader';
const World = lazy(()=>import('./World'));
class SpaceBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed ? null : this.props.children;}
}
function Star({className=''}:{className?:string}){return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 0 3.6 12.4L32 16l-12.4 3.6L16 32l-3.6-12.4L0 16l12.4-3.6Z" fill="currentColor"/></svg>;}
function Arrow(){return <span aria-hidden="true">↗</span>;}
export default function App(){
 const [mode,setMode]=useState<Mode>('welcome');
 const [loadStage,setLoadStage]=useState<LoadStage>('systems'),[loadProgress,setLoadProgress]=useState<number|null>(null);
 const [launched,setLaunched]=useState(false),[slow,setSlow]=useState(false),[zoom,setZoom]=useState(1);
 const [interest,setInterest]=useState('Software');
 const [panel,setPanel]=useState<DestinationId|'guide'|null>(null);
 // Where the autopilot is heading, and which planet the reading camera frames.
 const [target,setTarget]=useState<DestinationId>('home');
 const [reset,setReset]=useState(0), [near,setNear]=useState<DestinationId|null>(null), [nearest,setNearest]=useState<DestinationId>('home');
 const labels=useRef<Partial<Record<DestinationId,HTMLElement|null>>>({});
 const [failed,setFailed]=useState(false);
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const controls=useRef<Controls>({keys:new Set(),touch:{x:0,z:0},boost:false});
 const flight=useRef(newFlight()); const dialog=useRef<HTMLDialogElement>(null);
 const previousMode=useRef<Mode>('welcome'); const returnFocus=useRef<HTMLElement|null>(null);
 const clearControls=useCallback(()=>{controls.current.keys.clear();controls.current.touch={x:0,z:0};controls.current.boost=false;},[]);
 const openPanel=useCallback((next:DestinationId|'guide')=>{
  if(next!=='guide')setTarget(next);
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  previousMode.current=mode==='arriving'?'departing':mode==='docking'?'flying':mode;
  clearControls();setPanel(next);
 },[mode,clearControls]);
 const closePanel=useCallback(()=>{dialog.current?.close();setPanel(null);setMode(previousMode.current==='reading'?'flying':previousMode.current);clearControls();returnFocus.current?.focus();},[clearControls]);
 const start=useCallback(()=>{setMode('flying');clearControls();},[clearControls]);
 const travel=useCallback((id:DestinationId)=>{if(failed||panel)openPanel(id);else if(loadStage==='ready'){clearControls();setTarget(id);setMode('docking');}},[failed,panel,loadStage,openPanel,clearControls]);
 // From an open panel straight onto the autopilot towards another destination.
 const flyNext=useCallback((id:DestinationId)=>{dialog.current?.close();setPanel(null);clearControls();setTarget(id);setMode('docking');returnFocus.current=null;},[clearControls]);
 const respawn=useCallback(()=>{flight.current=newFlight();setReset(r=>r+1);setMode('flying');clearControls();},[clearControls]);
 const onLoad=useCallback((stage:'model'|'renderer'|'ready',progress?:number)=>{setLoadStage(stage);setLoadProgress(progress??null);},[]);
 const onFailure=useCallback(()=>{setFailed(true);clearControls();},[clearControls]);
 const onArrive=useCallback(()=>setMode('arriving'),[]);
 const onDepart=useCallback(()=>setMode('flying'),[]);
 const launch=()=>{setLaunched(true);setMode('welcome');clearControls();};
 useEffect(()=>{if(loadStage==='ready'||failed)return;const timeout=window.setTimeout(()=>setSlow(true),15000);return()=>window.clearTimeout(timeout);},[loadStage,failed]);
 const telemetry=useCallback((_speed:number,n:DestinationId|null,closest:DestinationId)=>{setNear(n);setNearest(closest);},[]);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close();},[panel]);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{
   if(!launched||failed||panel||!['welcome','flying'].includes(mode)||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
   const key=e.key.toLowerCase();
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){
    e.preventDefault();controls.current.keys.add(key);if(mode==='welcome')setMode('flying');
   }
   if(key==='e')travel(nearest); // E always flies somewhere: the planet nearest the rocket
   if(key==='r')respawn();
  };
  const up=(e:KeyboardEvent)=>controls.current.keys.delete(e.key.toLowerCase());
  const visibility=()=>{if(document.hidden)clearControls();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clearControls);document.removeEventListener('visibilitychange',visibility);};
 },[mode,panel,nearest,travel,respawn,clearControls,launched,failed]);
 const touch=(x:number,z:number)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current.touch={x,z};if(mode==='welcome')setMode('flying');},onPointerUp:()=>controls.current.touch={x:0,z:0},onPointerCancel:()=>controls.current.touch={x:0,z:0},onLostPointerCapture:()=>controls.current.touch={x:0,z:0}});
 const reading=panel&&panel!=='guide'?panel:null;
 const index=(id:DestinationId)=>String(DESTINATIONS.findIndex(d=>d.id===id)+1).padStart(2,'0');
 const showNavigation=launched&&!failed&&!panel&&mode!=='arriving';
 return <main className={`universe ${mode==='welcome'?'is-welcome':'is-flying'} ${failed?'no-webgl':''} ${reading?'reading-planet':''} ${!launched?'prelaunch':''}`}>
  <a className="skip-link" href="#introduction" onClick={e=>{e.preventDefault();openPanel('home');}}>Read about Omar</a>
  <div className="world" aria-hidden="true"><SpaceBoundary onFailure={onFailure}><Suspense fallback={null}><World mode={reading?'reading':panel||!launched?'paused':mode} destination={target} labels={labels} onTravel={travel} controls={controls} flight={flight} reset={reset} reduced={reduced} zoom={zoom} onArrive={onArrive} onDock={()=>openPanel(target)} onDepart={onDepart} onTelemetry={telemetry} onLoad={onLoad} onFailure={onFailure}/></Suspense></SpaceBoundary></div>
  <div className="experience-ui" inert={!launched||failed}>
  <header className="header">
   <button className="brand" onClick={()=>{respawn();setMode('welcome');}} aria-label="Return to welcome"><Star/><span>omar<span className="brand-dot">.</span></span></button>
   <nav aria-label="Help"><button onClick={()=>openPanel('guide')} aria-label="Flight guide"><span className="guide-symbol">?</span></button></nav>
  </header>
  <div className={`planet-labels ${showNavigation?'':'is-hidden'}`}>
   {DESTINATIONS.map(d=><button key={d.id} ref={element=>{labels.current[d.id]=element;}} tabIndex={-1} className={`planet-tag ${near===d.id&&mode==='flying'?'is-near':''} ${target===d.id&&mode==='docking'?'is-target':''}`} onClick={()=>travel(d.id)}>
    <span className="planet-tag-dot"/>{TITLES[d.id]}{nearest===d.id&&mode!=='docking'&&<kbd>E</kbd>}
   </button>)}
  </div>
  {showNavigation&&<nav className="destinations" aria-label="Destinations">
   {DESTINATIONS.map(d=><button key={d.id} aria-current={target===d.id&&mode==='docking'?'true':undefined} onClick={()=>travel(d.id)}><span className="index">{index(d.id)}</span>{TITLES[d.id]}</button>)}
  </nav>}
  {mode==='docking'&&!panel&&<div className="travel-status"><span className="status-dot"/> Flying to {TITLES[target]} <button onClick={start}>Cancel</button></div>}
  {showNavigation&&mode!=='docking'&&<div className="flight-keys"><kbd>W A S D</kbd><span>fly</span><kbd>SHIFT</kbd><span>boost</span><button onClick={respawn} aria-label="Reset rocket position"><kbd>R</kbd> reset</button></div>}
  {mode==='flying'&&!panel&&<div className="touch-controls" aria-label="Touch flight controls"><div className="dpad"><button aria-label="Fly forward" {...touch(0,-1)}>↑</button><button aria-label="Fly left" {...touch(-1,0)}>←</button><button aria-label="Fly backward" {...touch(0,1)}>↓</button><button aria-label="Fly right" {...touch(1,0)}>→</button></div><button className="touch-boost" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current.boost=true;}} onPointerUp={()=>controls.current.boost=false} onPointerCancel={()=>controls.current.boost=false} onLostPointerCapture={()=>controls.current.boost=false}>Boost ↗</button></div>}
  {showNavigation&&<div className="zoom-controls" aria-label="Camera zoom"><button aria-label="Zoom out" disabled={zoom>=1.3||!['welcome','flying'].includes(mode)} onClick={()=>setZoom(z=>Math.min(1.3,Math.round((z+.1)*100)/100))}>−</button><button aria-label="Zoom in" disabled={zoom<=.75||!['welcome','flying'].includes(mode)} onClick={()=>setZoom(z=>Math.max(.75,Math.round((z-.1)*100)/100))}>+</button></div>}
  </div>
  {(!launched||failed)&&!panel&&<SpaceLoader stage={loadStage} progress={loadProgress} failed={failed} slow={slow} onDone={launch} onRead={()=>openPanel('home')}/>}
  <dialog className={reading?'about-dialog':''} ref={dialog} onCancel={e=>{e.preventDefault();closePanel();}} onClick={e=>{if(e.target===dialog.current)closePanel();}} aria-labelledby="dialog-title">
   <article className="panel" id="introduction">
    <button className="close" aria-label="Close panel" onClick={closePanel}>×</button>
    {reading==='home'&&<><div className="panel-kicker"><Star/> {index('home')} / {TITLES.home.toUpperCase()}</div><h2 id="dialog-title">Hey, I’m <em>Omar.</em></h2><p className="panel-lead">Creative ideas.<br/>Complex problems. Useful software.</p><p>I’m a software developer who enjoys building creative, complex apps that are useful to the people using them.</p><p>Outside software, my orbit includes boxing, music, cinema, painting, and philosophy. Different ways to move, feel, see, and ask questions.</p><div className="interest-picker" aria-label="Things in my orbit">{['Software','Boxing','Music','Cinema','Painting','Philosophy'].map(label=><button key={label} aria-pressed={interest===label} onClick={()=>setInterest(label)}>{label}</button>)}</div><p className="interest-detail" aria-live="polite">{{Software:'I enjoy the challenge of making something creative and complex genuinely useful.',Boxing:'Boxing is part of my world beyond the screen.',Music:'Music belongs in my orbit—art you can feel as much as hear.',Cinema:'Cinema is another way I explore art and storytelling.',Painting:'Painting is part of my interest in art and visual expression.',Philosophy:'Philosophy belongs here too: a place for questions, ideas, and different ways of seeing.'}[interest]}</p></>}
    {reading&&reading!=='home'&&<><div className="panel-kicker"><Star/> {index(reading)} / {TITLES[reading].toUpperCase()}</div><h2 id="dialog-title">{SECTIONS[reading].heading}</h2><p className="panel-lead">{SECTIONS[reading].lead}</p>
     <ul className="entries">{SECTIONS[reading].entries.map(entry=><li key={entry.title}><div className="entry-head"><h3>{entry.title}</h3>{entry.meta&&<span>{entry.meta}</span>}</div>{entry.text&&<p>{entry.text}</p>}{entry.link&&<a href={entry.link.href} target={entry.link.href.startsWith('http')?'_blank':undefined} rel="noreferrer">{entry.link.label} <Arrow/></a>}</li>)}</ul></>}
    {reading&&<div className="panel-next">
     {(()=>{const i=DESTINATIONS.findIndex(d=>d.id===reading),next=DESTINATIONS[(i+1)%DESTINATIONS.length];return <button className="primary" onClick={()=>failed||!launched?openPanel(next.id):flyNext(next.id)}>Next: {TITLES[next.id]} <Arrow/></button>;})()}
     <button className="text-button" onClick={closePanel}>{!launched?'Back to launch':'Back to the universe'}</button>
    </div>}
    {panel==='guide'&&<><div className="panel-kicker"><Star/> A QUICK FLIGHT BRIEFING</div><h2 id="dialog-title">Find your <em>orbit.</em></h2><p className="panel-lead">Every planet holds part of the story.</p><dl className="guide-list"><div><dt>Click a planet or its title</dt><dd>Fly there on autopilot</dd></div><div><dt><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd></dt><dd>Fly yourself</dd></div><div><dt><kbd>SHIFT</kbd></dt><dd>Hold for a little extra thrust</dd></div><div><dt><kbd>E</kbd></dt><dd>Land on the planet you’re next to</dd></div><div><dt><kbd>R</kbd></dt><dd>Return to your starting point</dd></div><div><dt><kbd>ESC</kbd></dt><dd>Close an open panel</dd></div></dl><p className="guide-note">The bar at the bottom lists every destination. On touch screens, use the directional buttons and Boost.</p><button className="primary" onClick={closePanel}>Got it. Let’s go <Arrow/></button></>}
   </article>
  </dialog>
  <div className="sr-only" role="status" aria-live="polite">{mode==='docking'?`Autopilot engaged. Flying to ${TITLES[target]}.`:near&&mode==='flying'?`${TITLES[near]} is nearby. Press E to land.`:''}</div>
 </main>;
}
