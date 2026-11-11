/*
 * The pantry's pictures of the seasonings (the owner's, 2026-11-12: the one pot drawn nine times was too plain): each its own vessel, drawn in the
 * same cute, neat cartoon as ui/CuteFood (one thick warm-brown ink line, its colour lit from the top left, a white gleam), no face on any of
 * them: the salt shaker, the soy bottle, the tube of condensed milk, the bag of roasted soybean flour, the tub of miso, the tube of wasabi,
 * the shichimi tin, the jar of yuzu pepper with its fruit, the lemon with its slice. Drawn on a 64 square.
 */
import type { ReactNode } from 'react'
import type { Seasoning } from '@/data/recipes'

const INK = '#4b3426'
const W = 2.2

/** a vertical gradient, lighter at the top left to deeper at the bottom */
const Grad = ({ id, a, b }: { id: string; a: string; b: string }) => (
  <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
)
const Gleam = ({ x, y, rx = 2.2, ry = 5, rot = 10 }: { x: number; y: number; rx?: number; ry?: number; rot?: number }) =>
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#ffffff" opacity="0.8" transform={`rotate(${rot} ${x} ${y})`} />
const Shadow = ({ cx = 32, rx = 18 }: { cx?: number; rx?: number }) => <ellipse cx={cx} cy="59" rx={rx} ry="2.4" fill="#1d2a36" opacity="0.18" />
const Holes = ({ x, y, n = 3, gap = 4 }: { x: number; y: number; n?: number; gap?: number }) => (
  <>{Array.from({ length: n }, (_, i) => <circle key={i} cx={x + (i - (n - 1) / 2) * gap} cy={y} r="1" fill={INK} opacity="0.75" />)}</>
)

function Art({ k, id }: { k: Seasoning; id: string }): ReactNode {
  switch (k) {
    case 'salt': return <g>
      <defs><Grad id={`${id}a`} a="#ffffff" b="#cfe0ea" /><Grad id={`${id}b`} a="#d8dde4" b="#8f98a4" /></defs>
      <Shadow />
      <path d="M19 26 H45 L47 52 Q47 57 41 57 H23 Q17 57 17 52 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M19.6 38 Q32 34 44.4 38 L46 52 Q46 56 41 56 H23 Q18 56 18 52 Z" fill="#ffffff" opacity="0.95" />
      <rect x="17" y="12" width="30" height="15" rx="6" fill={`url(#${id}b)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Holes x={32} y={19} n={4} gap={5} />
      <Gleam x={22} y={44} rx={1.8} ry={6} />
    </g>
    case 'soy': return <g>
      <defs><Grad id={`${id}a`} a="#7a4f33" b="#2c150b" /></defs>
      <Shadow rx={15} />
      <path d="M21 56 V32 Q21 25 27 23 V15 H37 V23 Q43 25 43 32 V56 Q43 58 40 58 H24 Q21 58 21 56 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <rect x="25" y="5" width="14" height="11" rx="3.5" fill="#e0473a" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <rect x="21.8" y="34" width="20.4" height="16" rx="2" fill="#f6efe0" stroke={INK} strokeWidth="1.6" />
      <circle cx="32" cy="42" r="5" fill="#d23a2a" />
      <path d="M32 38.6 Q35.4 42 32 45.4 Q28.6 42 32 38.6 Z" fill="#fff" />
      <Gleam x={24.5} y={29} rx={1.4} ry={3.6} />
    </g>
    case 'milk': return <g>
      <defs><Grad id={`${id}a`} a="#ffffff" b="#e8dfc8" /></defs>
      <Shadow rx={13} />
      <rect x="25" y="50" width="14" height="8" rx="2.4" fill="#4f86c8" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M21 17 H43 L39 51 H25 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M22.4 30 H41.6 L40.4 41 H23.6 Z" fill="#4f86c8" />
      <circle cx="32" cy="35.5" r="3.2" fill="#fff" />
      <rect x="20" y="9" width="24" height="9" rx="2.4" fill="#f6f0e0" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M24 11.5 V15.5 M28 11.5 V15.5 M32 11.5 V15.5 M36 11.5 V15.5 M40 11.5 V15.5" stroke={INK} strokeWidth="1.1" opacity="0.5" />
      <Gleam x={26.5} y={25} rx={1.4} ry={3.4} rot={8} />
    </g>
    case 'peanut': return <g>
      <defs><Grad id={`${id}a`} a="#e6c08a" b="#b8844a" /></defs>
      <Shadow rx={16} />
      <path d="M19 20 L45 20 L47 56 Q47 58 44 58 H20 Q17 58 17 56 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M17.6 20 L46.4 20 L45.6 12 H18.4 Z" fill="#c99c63" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M19 15 H45" stroke={INK} strokeWidth="1.1" strokeDasharray="2.4 2.4" opacity="0.5" />
      <circle cx="32" cy="38" r="10" fill="#f7efdc" stroke={INK} strokeWidth="1.6" />
      <g transform="rotate(-25 32 38)">
        <ellipse cx="28.5" cy="38" rx="4.6" ry="3.6" fill="#d9a866" stroke={INK} strokeWidth="1.3" />
        <ellipse cx="35.5" cy="38" rx="4.6" ry="3.6" fill="#d9a866" stroke={INK} strokeWidth="1.3" />
      </g>
      <Gleam x={22} y={34} rx={1.2} ry={5} rot={6} />
    </g>
    case 'miso': return <g>
      <defs><Grad id={`${id}a`} a="#e0b678" b="#a8743a" /></defs>
      <Shadow rx={22} />
      <path d="M9 26 V46 Q9 58 32 58 Q55 58 55 46 V26 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M9.6 36 Q32 42 54.4 36 M10.2 47 Q32 53 53.8 47" stroke="#6b4423" strokeWidth="2" fill="none" opacity="0.8" />
      <ellipse cx="32" cy="26" rx="23" ry="8.5" fill="#d9a05a" stroke={INK} strokeWidth={W} />
      <ellipse cx="32" cy="26.6" rx="18.5" ry="6" fill="#b5793a" />
      <path d="M22 25 Q27 22.6 33 23.6" stroke="#f0cf96" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.8" />
      <g transform="rotate(32 40 24)"><rect x="38" y="4" width="4.4" height="25" rx="2.2" fill="#e2c28e" stroke={INK} strokeWidth="1.8" /></g>
      <Gleam x={14} y={38} rx={1.6} ry={5} rot={-4} />
    </g>
    case 'wasabi': return <g>
      <defs><Grad id={`${id}a`} a="#b5dc7c" b="#6f9f40" /></defs>
      <Shadow rx={20} />
      <ellipse cx="46" cy="55" rx="10" ry="3.6" fill="#a9d36e" stroke={INK} strokeWidth="1.6" />
      <g transform="rotate(-28 32 34)">
        <path d="M6 28 L12 26 V42 L6 40 Z" fill="#8dbb58" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
        <rect x="12" y="25" width="30" height="18" rx="3" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
        <rect x="19" y="25.8" width="14" height="16.4" fill="#f6f0e0" />
        <circle cx="26" cy="34" r="4.4" fill="#79ad45" />
        <rect x="42" y="27" width="10" height="14" rx="3" fill="#f4f0e4" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
        <path d="M14 28 H18" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      </g>
    </g>
    case 'shichimi': return <g>
      <defs><Grad id={`${id}a`} a="#f06a3c" b="#b73a1c" /><Grad id={`${id}b`} a="#f2e2b4" b="#c8ad74" /></defs>
      <Shadow rx={15} />
      <path d="M19 26 H45 L46 54 Q46 58 41 58 H23 Q18 58 18 54 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <rect x="18.8" y="36" width="26.4" height="9" fill="#f6efdc" stroke={INK} strokeWidth="1.4" />
      {[23, 28, 33, 38, 42].map((x, i) => <circle key={i} cx={x} cy={40.5} r="1.2" fill={['#c0442a', '#3d7a3a', '#e0a82a', '#4a3426', '#c0442a'][i]} />)}
      <rect x="17" y="12" width="30" height="15" rx="5" fill={`url(#${id}b)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <Holes x={32} y={19.5} n={5} gap={4.6} />
      <Gleam x={23} y={32} rx={1.4} ry={3} />
    </g>
    case 'yuzu': return <g>
      <defs><Grad id={`${id}a`} a="#ffe66a" b="#e0a418" /><Grad id={`${id}b`} a="#e6f0d0" b="#b8c898" /></defs>
      <Shadow rx={22} />
      <path d="M9 32 H35 L36 53 Q36 58 31 58 H13 Q8 58 8 53 Z" fill={`url(#${id}b)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <path d="M9.8 38 Q22 34 34.2 38 L35 53 Q35 57 31 57 H13 Q9 57 9 53 Z" fill="#b9c64a" />
      <rect x="9" y="23" width="26" height="10" rx="3.4" fill="#f6efdc" stroke={INK} strokeWidth={W} strokeLinejoin="round" />
      <circle cx="46" cy="42" r="12" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} />
      <path d="M46 30 Q50 25 55 27 Q52 32 46 31 Z" fill="#6fae3f" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="40" cy="44" r="0.9" fill="#c8860c" opacity="0.7" /><circle cx="50" cy="47" r="0.9" fill="#c8860c" opacity="0.7" /><circle cx="46" cy="39" r="0.9" fill="#c8860c" opacity="0.7" />
      <Gleam x={40.5} y={37} rx={2} ry={3.4} rot={30} />
      <Gleam x={14} y={46} rx={1.3} ry={4.4} />
    </g>
    case 'lemon': return <g>
      <defs><Grad id={`${id}a`} a="#fff07a" b="#e6bd1c" /></defs>
      <Shadow rx={22} />
      <g transform="rotate(-18 28 32)">
        <path d="M5 34 L11 31 Q16 16 31 17 Q46 17 50 31 L56 34 L50 37 Q45 52 30 51 Q15 51 11 37 Z" fill={`url(#${id}a)`} stroke={INK} strokeWidth={W} strokeLinejoin="round" />
        <path d="M32 17 Q38 10 46 12 Q42 19 32 18 Z" fill="#6fae3f" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
      </g>
      <circle cx="46" cy="46" r="11" fill="#fff7c0" stroke={INK} strokeWidth={W} />
      <circle cx="46" cy="46" r="8" fill="#fbe55a" />
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M46 46 L${46 + 8 * Math.cos((i * Math.PI) / 3)} ${46 + 8 * Math.sin((i * Math.PI) / 3)}`} stroke="#fff7c0" strokeWidth="1.5" />)}
      <Gleam x={21} y={29} rx={5} ry={2.4} rot={-30} />
    </g>
  }
}

/** a seasoning's picture; `u` keeps its gradients' ids its own on a page that draws it more than once */
export function SeasoningArt({ k, className }: { k: Seasoning; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" strokeLinecap="round">
      <Art k={k} id={`sa-${k}`} />
    </svg>
  )
}
