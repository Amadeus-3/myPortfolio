import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DESTINATIONS, newFlight, type DestinationId } from './flight';
import { AIR, SECTIONS, TITLES, type Entry } from './content';
import type { Controls, Mode } from './World';
import SpaceLoader, { type LoadStage } from './SpaceLoader';
const World = lazy(()=>import('./World'));
class SpaceBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed ? null : this.props.children;}
}
function Arrow(){return <span aria-hidden="true">↗</span>;}
/** Entry haze timing: the planet's air floods the screen, the scene switches at WARP_SWAP, and it clears by WARP_END. */
const WARP_SWAP=480,WARP_END=1200;
const nextOf=(id:DestinationId)=>DESTINATIONS[(DESTINATIONS.findIndex(d=>d.id===id)+1)%DESTINATIONS.length].id;
const index=(id:DestinationId)=>String(DESTINATIONS.findIndex(d=>d.id===id)+1).padStart(2,'0');
const pad=(n:number)=>String(n).padStart(2,'0');
function EntryBody({entry}:{entry:Entry}){
 return <>{entry.meta&&<span className="entry-meta">{entry.meta}</span>}<h3>{entry.title}</h3>{entry.text&&<p>{entry.text}</p>}
  {entry.points&&<ul className="entry-points">{entry.points.map(point=><li key={point}>{point}</li>)}</ul>}
  {entry.tags&&<ul className="entry-tags" aria-label="Tools">{entry.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
  {entry.link&&<a href={entry.link.href} target={entry.link.href.startsWith('http')?'_blank':undefined} rel="noreferrer">{entry.link.label} <Arrow/></a>}</>;
}
export default function App(){
 const [mode,setMode]=useState<Mode>('welcome');
 const [loadStage,setLoadStage]=useState<LoadStage>('systems'),[loadProgress,setLoadProgress]=useState<number|null>(null);
 const [launched,setLaunched]=useState(false),[slow,setSlow]=useState(false),[zoom,setZoom]=useState(1);
 // Dialog: the flight guide, or a planet's content when 3D is unavailable.
 const [panel,setPanel]=useState<DestinationId|'guide'|null>(null);
 // Where the autopilot is heading; and the planet you're standing on, if any.
 const [target,setTarget]=useState<DestinationId>('home'),[landed,setLanded]=useState<DestinationId|null>(null),[warp,setWarp]=useState(false);
 const [reset,setReset]=useState(0), [near,setNear]=useState<DestinationId|null>(null), [nearest,setNearest]=useState<DestinationId>('home');
 const labels=useRef<Partial<Record<DestinationId,HTMLElement|null>>>({}),stopTags=useRef<(HTMLElement|null)[]>([]);
 // On a planet: the stop whose board is open (if any), the stops visited so far, and whether the rover has reached the
 // ground yet. You drive the rover yourself; the board's HTML is pinned onto the 3D board each frame.
 const [board,setBoard]=useState<number|null>(null),[visited,setVisited]=useState<number[]>([]),[touchedDown,setTouchedDown]=useState(false);
 // The station the rover is pulled up beside, and the one whose board you asked to read (E, or the prompt).
 const [atStop,setAtStop]=useState<number|null>(null),[readStop,setReadStop]=useState<number|null>(null);
 const boardElement=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const controls=useRef<Controls>({keys:new Set(),touch:{x:0,z:0},boost:false});
 const flight=useRef(newFlight()); const dialog=useRef<HTMLDialogElement>(null);
 const returnFocus=useRef<HTMLElement|null>(null),warping=useRef(false);
 const clearControls=useCallback(()=>{controls.current.keys.clear();controls.current.touch={x:0,z:0};controls.current.boost=false;},[]);
 const openPanel=useCallback((next:DestinationId|'guide')=>{
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  clearControls();setPanel(next);
 },[clearControls]);
 const closePanel=useCallback(()=>{dialog.current?.close();setPanel(null);clearControls();returnFocus.current?.focus();},[clearControls]);
 /** Flood the screen, switch scenes under it, then clear. */
 const runWarp=useCallback((swap:()=>void)=>{
  if(warping.current)return;warping.current=true;setWarp(true);clearControls();
  window.setTimeout(swap,reduced?0:WARP_SWAP);
  window.setTimeout(()=>{setWarp(false);warping.current=false;},reduced?120:WARP_END);
 },[clearControls,reduced]);
 const land=useCallback((id:DestinationId)=>runWarp(()=>{stopTags.current=[];setBoard(null);setVisited([]);setAtStop(null);setReadStop(null);setTouchedDown(false);setLanded(id);setMode('surface');}),[runWarp]);
 const onNear=useCallback((at:number|null)=>{setAtStop(at);setReadStop(open=>open!==null&&open!==at?null:open);},[]);
 const toggleReading=useCallback(()=>{if(atStop!==null)setReadStop(open=>open===null?atStop:null);},[atStop]);
 const onBoard=useCallback((at:number|null)=>{setBoard(at);if(at!==null)setVisited(seen=>seen.includes(at)?seen:[...seen,at]);},[]);
 const onLanded=useCallback(()=>setTouchedDown(true),[]);
 /** The first stop not yet visited: the road's guide light leads there. */
 const nextStop=landed?SECTIONS[landed].entries.findIndex((_,i)=>!visited.includes(i)):-1,next=nextStop<0?null:nextStop;
 /** Leave the planet: back out into space, or straight on to the next destination. */
 const leave=useCallback((next?:DestinationId)=>runWarp(()=>{setLanded(null);setBoard(null);setAtStop(null);setReadStop(null);if(next){setTarget(next);setMode('docking');}else setMode('departing');}),[runWarp]);
 const start=useCallback(()=>{setMode('flying');clearControls();},[clearControls]);
 const travel=useCallback((id:DestinationId)=>{
  if(failed)openPanel(id);
  else if(landed)leave(id);
  else if(loadStage==='ready'){clearControls();setTarget(id);setMode('docking');}
 },[failed,landed,loadStage,openPanel,leave,clearControls]);
 const respawn=useCallback(()=>{flight.current=newFlight();setReset(r=>r+1);setMode('flying');clearControls();},[clearControls]);
 const onLoad=useCallback((stage:'model'|'renderer'|'ready',progress?:number)=>{setLoadStage(stage);setLoadProgress(progress??null);},[]);
 const onFailure=useCallback(()=>{setFailed(true);clearControls();},[clearControls]);
 const onArrive=useCallback(()=>setMode('arriving'),[]);
 const onDepart=useCallback(()=>setMode('flying'),[]);
 const onDock=useCallback(()=>land(target),[land,target]);
 const launch=()=>{setLaunched(true);setMode('welcome');clearControls();};
 useEffect(()=>{if(loadStage==='ready'||failed)return;const timeout=window.setTimeout(()=>setSlow(true),15000);return()=>window.clearTimeout(timeout);},[loadStage,failed]);
 const telemetry=useCallback((_speed:number,n:DestinationId|null,closest:DestinationId)=>{setNear(n);setNearest(closest);},[]);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close();},[panel]);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{
   if(!launched||failed||panel||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
   const key=e.key.toLowerCase();
   if(landed){
    if(key==='escape'){e.preventDefault();if(readStop!==null)setReadStop(null);else leave();}
    else if(key==='e'||key==='enter'){if(atStop!==null){e.preventDefault();toggleReading();}}
    else if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();controls.current.keys.add(key);}
    return;
   }
   if(!['welcome','flying'].includes(mode))return;
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
 },[mode,panel,landed,atStop,readStop,toggleReading,nearest,travel,leave,respawn,clearControls,launched,failed]);
 const touch=(x:number,z:number)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current.touch={x,z};if(mode==='welcome')setMode('flying');},onPointerUp:()=>controls.current.touch={x:0,z:0},onPointerCancel:()=>controls.current.touch={x:0,z:0},onLostPointerCapture:()=>controls.current.touch={x:0,z:0}});
 const reading=panel&&panel!=='guide'?panel:null;
 const showNavigation=launched&&!failed&&!panel&&!landed&&mode!=='arriving';
 return <main className={`universe ${mode==='welcome'?'is-welcome':'is-flying'} ${failed?'no-webgl':''} ${landed?'is-landed':''} ${!launched?'prelaunch':''}`}>
  <a className="skip-link" href="#introduction" onClick={e=>{e.preventDefault();openPanel('home');}}>Read about Omar</a>
  <div className="world" aria-hidden="true"><SpaceBoundary onFailure={onFailure}><Suspense fallback={null}><World mode={panel||!launched?'paused':mode} destination={target} landed={landed} next={next} highlight={board??atStop??next} open={readStop} stopTags={stopTags} board={boardElement} onNear={onNear} onBoard={onBoard} onLanded={onLanded} labels={labels} onTravel={travel} controls={controls} flight={flight} reset={reset} reduced={reduced} zoom={zoom} onArrive={onArrive} onDock={onDock} onDepart={onDepart} onTelemetry={telemetry} onLoad={onLoad} onFailure={onFailure}/></Suspense></SpaceBoundary></div>
  <div className="experience-ui" inert={!launched||failed}>
  <header className="header">
   <button className="brand" onClick={()=>{if(landed)leave();else{respawn();setMode('welcome');}}} aria-label="Back to the start"><span>OMAR</span></button>
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
  {landed&&(()=>{
   const section=SECTIONS[landed],entries=section.entries,open=board!==null?entries[board]:null,upcoming=next!==null?entries[next]:null;
   const axis=(a:'x'|'z',value:number)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);controls.current.touch[a]=value;},onPointerUp:()=>{controls.current.touch[a]=0;},onPointerCancel:()=>{controls.current.touch[a]=0;},onLostPointerCapture:()=>{controls.current.touch[a]=0;}});
   return <section className="surface-ui" aria-labelledby="surface-title">
    <header className="surface-header">
     <span className="surface-kicker">{index(landed)} · {TITLES[landed]}</span>
     <h1 id="surface-title">{section.heading}</h1>
     <p>{section.lead}</p>
    </header>
    {/* Signposts over each station; you drive there yourself. */}
    <div className="stop-tags" aria-hidden="true">
     {entries.map((entry,i)=><span key={`${landed}-${i}`} ref={element=>{stopTags.current[i]=element;}} className={`stop-tag ${i===next?'is-current':''} ${visited.includes(i)?'is-visited':''}`}>
      <span className="stop-tag-index">{visited.includes(i)?'✓':pad(i+1)}</span>{entry.label??entry.title}
     </span>)}
    </div>
    {/* The hovering board's content, pinned onto the board in the scene by Surface. */}
    <div className="board" ref={boardElement} aria-live="polite">
     {open&&board!==null&&<div className="board-inner" key={`${landed}-${board}`}><span className="board-kicker">Stop {pad(board+1)} / {pad(entries.length)}</span><EntryBody entry={open}/></div>}
    </div>
    {touchedDown&&atStop!==null&&<button className="read-prompt" onClick={toggleReading}>
     <kbd>E</kbd><span className="read-tap">Tap</span>{readStop===null?<>Read · {pad(atStop+1)} {entries[atStop].label??entries[atStop].title}</>:'Close'}
    </button>}
    {!open&&atStop===null&&<div className="drive-status"><span className="status-dot"/>{!touchedDown?`Touching down on ${TITLES[landed]}`:upcoming?<><span className="drive-hint"><kbd>W A S D</kbd> drive · </span>Follow the road to {pad((next??0)+1)} · {upcoming.label??upcoming.title}</>:'Every stop visited'}</div>}
    <div className="drive-pad" aria-label="Rover controls">
     <div><button aria-label="Steer left" {...axis('x',-1)}>←</button><button aria-label="Steer right" {...axis('x',1)}>→</button></div>
     <div><button aria-label="Drive forward" {...axis('z',-1)}>↑</button><button aria-label="Reverse" {...axis('z',1)}>↓</button></div>
    </div>
    <nav className="surface-nav" aria-label="Leave this planet">
     <button className="ghost-button" onClick={()=>leave()}><span aria-hidden="true">←</span> Space</button>
     <div className="stops-progress" role="img" aria-label={`${visited.length} of ${entries.length} stops visited`}>
      {entries.map((_,i)=><span key={i} className={`step ${visited.includes(i)?'is-visited':''} ${i===(board??next)?'is-current':''}`}/>)}
     </div>
     <button className="primary" onClick={()=>leave(nextOf(landed))}><span className="primary-label">Fly to </span>{TITLES[nextOf(landed)]} <Arrow/></button>
    </nav>
   </section>;
  })()}
  </div>
  <div className={`warp ${warp?'is-on':''}`} style={{'--air':AIR[landed??target]} as React.CSSProperties} aria-hidden="true"/>
  {(!launched||failed)&&!panel&&<SpaceLoader stage={loadStage} progress={loadProgress} failed={failed} slow={slow} onDone={launch} onRead={()=>openPanel('home')}/>}
  <dialog className={reading?'about-dialog':''} ref={dialog} onCancel={e=>{e.preventDefault();closePanel();}} onClick={e=>{if(e.target===dialog.current)closePanel();}} aria-labelledby="dialog-title">
   <article className="panel" id="introduction">
    <button className="close" aria-label="Close panel" onClick={closePanel}>×</button>
    {reading&&<><div className="panel-kicker">{index(reading)} · {TITLES[reading].toUpperCase()}</div><h2 id="dialog-title">{SECTIONS[reading].heading}</h2><p className="panel-lead">{SECTIONS[reading].lead}</p>
     <ul className="entries">{SECTIONS[reading].entries.map(entry=><li key={entry.title}><EntryBody entry={entry}/></li>)}</ul>
     <div className="panel-next"><button className="primary" onClick={()=>openPanel(nextOf(reading))}>Next: {TITLES[nextOf(reading)]} <Arrow/></button><button className="text-button" onClick={closePanel}>Close</button></div></>}
    {panel==='guide'&&<><div className="panel-kicker">A QUICK FLIGHT BRIEFING</div><h2 id="dialog-title">Find your orbit</h2><p className="panel-lead">Every planet holds part of the story.</p><dl className="guide-list"><div><dt>Click a planet or its title</dt><dd>Fly there and land</dd></div><div><dt><kbd>W A S D</kbd> / <kbd>↑ ← ↓ →</kbd></dt><dd>Fly yourself</dd></div><div><dt><kbd>SHIFT</kbd></dt><dd>Hold for a little extra thrust</dd></div><div><dt><kbd>E</kbd></dt><dd>Fly to the nearest planet</dd></div><div><dt><kbd>R</kbd></dt><dd>Return to your starting point</dd></div><div><dt>On a planet: <kbd>W A S D</kbd></dt><dd>Drive the rover; follow the road to each stop</dd></div><div><dt><kbd>E</kbd></dt><dd>Read a stop’s board when you’re beside it</dd></div><div><dt><kbd>ESC</kbd></dt><dd>Leave a planet, or close this</dd></div></dl><p className="guide-note">The bar at the bottom lists every destination. On touch screens, use the directional buttons and Boost.</p><button className="primary" onClick={closePanel}>Got it. Let’s go <Arrow/></button></>}
   </article>
  </dialog>
  <div className="sr-only" role="status" aria-live="polite">{landed?`Landed on ${TITLES[landed]}.${board!==null?` Stop ${board+1}: ${SECTIONS[landed].entries[board]?.title}.`:''}`:mode==='docking'?`Autopilot engaged. Flying to ${TITLES[target]}.`:near&&mode==='flying'?`${TITLES[near]} is nearby. Press E to land.`:''}</div>
 </main>;
}
