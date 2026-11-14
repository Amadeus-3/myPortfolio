import { useId } from 'react';

/** The mark: a small ringed planet in violet and blue. The back of the ring is drawn behind the planet, the front over it. */
export function Mark() {
  const id = useId();
  return <svg viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-planet`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c3b8ff"/><stop offset=".55" stopColor="#7e6aff"/><stop offset="1" stopColor="#3b4fd8"/></linearGradient>
      <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8b78ff" stopOpacity=".25"/><stop offset=".5" stopColor="#b9afff"/><stop offset="1" stopColor="#8b78ff" stopOpacity=".25"/></linearGradient>
    </defs>
    <path d="M2.88 26.56 A18 6 -18 0 1 37.12 15.44" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="20" cy="20" r="10" fill={`url(#${id}-planet)`}/>
    <path d="M2.88 26.56 A18 6 -18 0 0 37.12 15.44" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="1.7" strokeLinecap="round"/>
    <circle cx="33.5" cy="8" r="1.6" fill="#c3b8ff"/>
  </svg>;
}
