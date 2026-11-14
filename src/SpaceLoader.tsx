import { useEffect, useRef, useState } from 'react';
import { Mark } from './Logo';

export type LoadStage = 'systems' | 'model' | 'renderer' | 'ready';
type Props = { stage: LoadStage; progress: number | null; failed: boolean; slow: boolean; onDone: () => void; onRead: () => void };

const MIN_SHOW_MS = 2200; // long enough to enjoy the flight in, even on a fast connection
const WARP_MS = 900, FADE_MS = 650;

/**
 * The opening screen: flying through a starfield while the universe loads behind it. When the 3D scene, the head
 * and the fonts are all ready, the stars stretch into a short jump and the loader fades away into the universe.
 */
export default function SpaceLoader({ stage, progress, failed, slow, onDone, onRead }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), bar = useRef<HTMLDivElement>(null);
  const [fontsReady, setFontsReady] = useState(false), [leaving, setLeaving] = useState(false);
  const shown = useRef(performance.now()), warpStart = useRef<number | null>(null);
  const target = useRef(0);
  target.current = stage === 'ready' ? 1 : stage === 'renderer' ? .86 : stage === 'model' ? .12 + .64 * (progress ?? .4) : .08;
  const done = useRef(onDone); done.current = onDone;

  useEffect(() => { document.fonts.ready.then(() => setFontsReady(true)); }, []);

  // Everything ready: wait out the minimum time, jump to warp, then fade and hand over.
  useEffect(() => {
    if (stage !== 'ready' || !fontsReady || failed || leaving) return;
    const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - shown.current));
    const timer = window.setTimeout(() => {
      warpStart.current = performance.now(); setLeaving(true);
      window.setTimeout(() => done.current(), WARP_MS + FADE_MS);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [stage, fontsReady, failed, leaving]);

  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const context = element.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = 650, stars = Array.from({ length: count }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random(), tint: Math.random() }));
    let width = 0, height = 0, frame = 0, last = performance.now(), shownProgress = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = element.clientWidth; height = element.clientHeight;
      element.width = width * ratio; element.height = height * ratio; context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize(); window.addEventListener('resize', resize);
    const draw = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const warp = warpStart.current === null ? 0 : Math.min(1, (now - warpStart.current) / WARP_MS);
      const speed = reduced ? 0 : .16 + warp * warp * 2.6; // a calm cruise, then the jump
      shownProgress += (target.current - shownProgress) * (1 - Math.exp(-dt * 4));
      if (bar.current) bar.current.style.transform = `scaleX(${shownProgress.toFixed(3)})`;
      // Background: deep space with a faint warm glow ahead.
      const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * .7);
      glow.addColorStop(0, `rgba(44,32,96,${.5 + warp * .35})`); glow.addColorStop(.45, 'rgba(9,10,30,1)'); glow.addColorStop(1, 'rgba(4,5,16,1)');
      context.fillStyle = glow; context.fillRect(0, 0, width, height);
      const focal = Math.min(width, height) * .55;
      for (const star of stars) {
        const previousZ = star.z;
        star.z -= speed * dt;
        if (star.z <= .02) { star.x = Math.random() * 2 - 1; star.y = Math.random() * 2 - 1; star.z = 1; continue; }
        const sx = width / 2 + star.x / star.z * focal, sy = height / 2 + star.y / star.z * focal;
        const px = width / 2 + star.x / previousZ * focal, py = height / 2 + star.y / previousZ * focal;
        if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) { star.z = 1; continue; }
        const light = Math.min(1, (1 - star.z) * 1.4), size = (1 - star.z) * 2.1 + .3;
        const color = star.tint < .2 ? '196,184,255' : star.tint < .45 ? '190,208,255' : '242,244,255';
        context.strokeStyle = `rgba(${color},${light})`; context.lineWidth = size; context.lineCap = 'round';
        context.beginPath(); context.moveTo(px, py); context.lineTo(sx + (sx - px) * warp * 6, sy + (sy - py) * warp * 6); context.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  const status = failed ? 'The 3D universe couldn’t load.' : stage === 'ready' ? 'Ready.' : 'Loading the universe…';
  return <section className={`space-loader ${leaving ? 'is-leaving' : ''}`} aria-label="Loading">
    <canvas ref={canvas} className="space-loader-stars" aria-hidden="true"/>
    <div className="space-loader-center">
      <div className="space-loader-mark"><Mark/>OMAR</div>
      {!failed && <div className="space-loader-track" aria-hidden="true"><div ref={bar} className="space-loader-bar"/></div>}
      {failed && <div className="space-loader-failed"><p>The 3D universe couldn’t load on this device.</p><div><button className="primary" onClick={onRead}>Read about Omar ↗</button><button className="text-button" onClick={() => window.location.reload()}>Try again</button></div></div>}
      {slow && !failed && stage !== 'ready' && <button className="space-loader-slow" onClick={onRead}>Taking a while? Read about Omar instead</button>}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{status}</p>
  </section>;
}
