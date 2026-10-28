// The flat grill's pictures (Grill2D), in the same hand-inked cel style as the staff portraits (ui/Avatar): dark brown
// ink round everything, two or three flat tones a piece, a glint. All of it is plain SVG with shared <defs>; what never
// changes (the table, the stones, the ash, the charcoal) is made once here, at module level, so React leaves it alone
// between frames, and each food's picture is memoised on how done it is (rounded) and what's on it.
import { memo, type ReactNode } from 'react'
import type { Lang } from '@/data/i18n'
import { DRINKS, type DrinkId } from './bar'
import { tl } from '@/data/i18n'

export const INK = '#3b2a20'
/** the whole picture, in the SVG's own units: the cook's table on the left, the fridge on the right */
export const VIEW_W = 492, VIEW_H = 220
/** the fire pit's middle, and its rings: the ash bed, the stones round it, the coals in the middle */
export const PIT_X = 200, PIT_Y = 86, COAL_X = 66, COAL_Y = 26
const PIT = { cx: PIT_X, cy: PIT_Y, ashX: 150, ashY: 64, coalX: COAL_X, coalY: COAL_Y }

const CHAR_START = 1.15
const CHAR_FULL = 3
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const n1 = (v: number) => Math.round(v * 10) / 10
/** a number from 0 to 1 always the same for (i, salt) — the stones' and the coals' shapes */
const rnd = (i: number, salt: number) => {
  let h = Math.imul(i ^ Math.imul(salt + 1, 0x9e3779b1), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000
}
/** a lumpy closed shape round (0, 0): n points at about rx, ry, joined by smooth curves */
function blob(rx: number, ry: number, seed: number, n = 9, j = 0.2) {
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2, f = 1 - j + 2 * j * rnd(k, seed)
    return [Math.cos(a) * rx * f, Math.sin(a) * ry * f]
  })
  const mid = (p: number[], q: number[]) => `${n1((p[0] + q[0]) / 2)} ${n1((p[1] + q[1]) / 2)}`
  let d = `M${mid(pts[n - 1], pts[0])}`
  for (let k = 0; k < n; k++) d += `Q${n1(pts[k][0])} ${n1(pts[k][1])} ${mid(pts[k], pts[(k + 1) % n])}`
  return d + 'Z'
}
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
/** one colour toward another (hex in, hex out) */
function mixHex(a: string, b: string, t: number) {
  const x = hex(a), y = hex(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
/** a colour cooked: browned toward done, then charred toward black (as the 3D food) */
function cooked(c: string, r: number) {
  const v = hex(c)
  const brown = [172, 104, 42], black = [40, 26, 18]
  const b = smooth(0.3, 1.2, r) * 0.48, k = smooth(CHAR_START, CHAR_FULL, r) * 0.85
  const out = v.map((x, i) => (x * (1 - b) + brown[i] * b) * (1 - k) + black[i] * k)
  return `rgb(${out.map((x) => Math.round(x)).join(',')})`
}

// ---- shared defs: gradients and patterns every frame draws with
export const DEFS = (
  <defs>
    <pattern id="g2-grain" width="90" height="18" patternUnits="userSpaceOnUse">
      <path d="M0 4q22-3 45 0t45 0M0 11q18 2 40-1t50 1M12 15q10-1.6 22 0" fill="none" stroke="#8a5a30" strokeWidth=".7" opacity=".32" />
      <path d="M60 7q5-2.5 10 0q-5 2.5-10 0z" fill="none" stroke="#7a4a24" strokeWidth=".6" opacity=".35" />
    </pattern>
    <pattern id="g2-speck" width="11" height="9" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r=".55" fill="#9a9084" opacity=".5" /><circle cx="7.5" cy="5" r=".45" fill="#7a7064" opacity=".45" />
      <circle cx="4" cy="7.5" r=".4" fill="#b0a698" opacity=".6" /><circle cx="9.5" cy="1" r=".35" fill="#fff" opacity=".8" />
    </pattern>
    <pattern id="g2-scale" width="3" height="2.4" patternUnits="userSpaceOnUse">
      <path d="M0 2.4q1.5-2 3 0" fill="none" stroke="#fff" strokeWidth=".35" opacity=".55" />
    </pattern>
    <pattern id="g2-kernel" width="3.2" height="3" patternUnits="userSpaceOnUse">
      <rect x=".25" y=".25" width="2.7" height="2.5" rx="1" fill="#fff" fillOpacity=".22" stroke="#b07a10" strokeWidth=".35" strokeOpacity=".6" />
    </pattern>
    <pattern id="g2-rice" width="4" height="3.4" patternUnits="userSpaceOnUse">
      <ellipse cx="1.2" cy="1" rx=".9" ry=".5" fill="none" stroke="#c8c0ae" strokeWidth=".3" transform="rotate(30 1.2 1)" />
      <ellipse cx="3" cy="2.6" rx=".9" ry=".5" fill="none" stroke="#c8c0ae" strokeWidth=".3" transform="rotate(-25 3 2.6)" />
    </pattern>
    <pattern id="g2-wire" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0H5M0 0V5" stroke="#3a3430" strokeWidth=".45" opacity=".85" />
    </pattern>
    <pattern id="g2-seigaiha" width="8" height="4" patternUnits="userSpaceOnUse">
      <rect width="8" height="4" fill="#f4f1e8" />
      <path d="M0 4a4 4 0 0 1 8 0M1.6 4a2.4 2.4 0 0 1 4.8 0M-4 0a4 4 0 0 1 8 0M4 0a4 4 0 0 1 8 0M-2.4 0a2.4 2.4 0 0 1 4.8 0M5.6 0a2.4 2.4 0 0 1 4.8 0"
        fill="none" stroke="#2f5a9a" strokeWidth=".55" />
    </pattern>
    <radialGradient id="g2-ash" cx="50%" cy="46%" r="55%">
      <stop offset="0" stopColor="#f8f5ee" /><stop offset=".7" stopColor="#ebe5d9" /><stop offset="1" stopColor="#cbc1b2" />
    </radialGradient>
    <radialGradient id="g2-scorch">
      <stop offset="0" stopColor="#6a5244" stopOpacity=".85" /><stop offset=".55" stopColor="#8a7464" stopOpacity=".45" />
      <stop offset="1" stopColor="#a89888" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="g2-bed" cx="50%" cy="45%">
      <stop offset="0" stopColor="#6a2412" /><stop offset=".7" stopColor="#3a1a10" /><stop offset="1" stopColor="#1e130e" />
    </radialGradient>
    <radialGradient id="g2-glow">
      <stop offset="0" stopColor="#ffe08a" /><stop offset=".35" stopColor="#ff9a3a" stopOpacity=".9" />
      <stop offset=".75" stopColor="#d8401a" stopOpacity=".55" /><stop offset="1" stopColor="#a02010" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="g2-halo">
      <stop offset="0" stopColor="#ff9a40" stopOpacity=".45" /><stop offset=".6" stopColor="#ff7a30" stopOpacity=".16" />
      <stop offset="1" stopColor="#ff7a30" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="g2-char" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#a8a29a" /><stop offset=".32" stopColor="#5e5752" /><stop offset=".75" stopColor="#2e2826" /><stop offset="1" stopColor="#1a1412" />
    </linearGradient>
    {[['#9a948c', '#79736b', '#565049'], ['#a49380', '#83725f', '#5c4e40'], ['#8e939c', '#6d727c', '#4c515a']].map(([a, b, c], i) => (
      <radialGradient key={i} id={`g2-stone${i}`} cx="38%" cy="30%" r="80%">
        <stop offset="0" stopColor={a} /><stop offset=".55" stopColor={b} /><stop offset="1" stopColor={c} />
      </radialGradient>
    ))}
    <linearGradient id="g2-foil" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f6f7f8" /><stop offset=".45" stopColor="#c4c9ce" /><stop offset=".6" stopColor="#eef0f2" />
      <stop offset="1" stopColor="#9aa0a6" />
    </linearGradient>
    <linearGradient id="g2-tray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#b98654" /><stop offset="1" stopColor="#a0703f" />
    </linearGradient>
    <radialGradient id="g2-glaze" cx="45%" cy="40%" r="60%">
      <stop offset="0" stopColor="#ffffff" /><stop offset=".8" stopColor="#f2efe6" /><stop offset="1" stopColor="#dcd8cc" />
    </radialGradient>
    <radialGradient id="g2-lacquer" cx="40%" cy="35%">
      <stop offset="0" stopColor="#d0402e" /><stop offset=".7" stopColor="#9a2018" /><stop offset="1" stopColor="#5a0e0a" />
    </radialGradient>
    <radialGradient id="g2-miso" cx="45%" cy="40%">
      <stop offset="0" stopColor="#d8a560" /><stop offset="1" stopColor="#a8702e" />
    </radialGradient>
    <linearGradient id="g2fr-body" x1="0" x2="1">
      <stop offset="0" stopColor="#7a140e" /><stop offset=".18" stopColor="#d23a2a" /><stop offset=".5" stopColor="#c0281e" />
      <stop offset="1" stopColor="#6a100a" />
    </linearGradient>
    <linearGradient id="g2fr-in" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfe6f4" />
    </linearGradient>
    <linearGradient id="g2fr-gleam" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".4" stopColor="#fff" stopOpacity="0" />
      <stop offset=".46" stopColor="#fff" stopOpacity=".55" /><stop offset=".56" stopColor="#fff" stopOpacity=".1" />
      <stop offset=".62" stopColor="#fff" stopOpacity=".35" /><stop offset=".66" stopColor="#fff" stopOpacity="0" />
    </linearGradient>
    <radialGradient id="g2fr-halo">
      <stop offset="0" stopColor="#ffe070" stopOpacity=".75" /><stop offset="1" stopColor="#ffd040" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="g2fr-chrome" x1="0" x2="1">
      <stop offset="0" stopColor="#8a9098" /><stop offset=".4" stopColor="#f4f6f8" /><stop offset="1" stopColor="#7a8088" />
    </linearGradient>
  </defs>
)

// ---- the cook's table, the stones round the fire pit, the ash, the charcoal: drawn once

const STONE_N = 26
const STONES = Array.from({ length: STONE_N }, (_, k) => {
  const a = (k / STONE_N) * Math.PI * 2 + (rnd(k, 3) - 0.5) * 0.12
  const rx = 12 + rnd(k, 5) * 5, ry = 8.5 + rnd(k, 7) * 3
  return { k, x: PIT.cx + Math.cos(a) * 160, y: PIT.cy + Math.sin(a) * 71, rx, ry, rot: (rnd(k, 9) - 0.5) * 30, d: blob(rx, ry, k + 40, 9, 0.16), tone: Math.floor(rnd(k, 11) * 3) }
}).sort((a, b) => a.y - b.y)

/** the binchotan in the middle: long grey-black sticks laid criss-cross on the embers */
const COALS = [
  { x: -36, y: -8, l: 34, w: 7.5, a: -12 }, { x: 2, y: -12, l: 40, w: 8, a: 6 }, { x: 36, y: -6, l: 32, w: 7, a: 16 },
  { x: -46, y: 6, l: 28, w: 7, a: 28 }, { x: -14, y: 3, l: 38, w: 8.2, a: -4 }, { x: 22, y: 6, l: 36, w: 7.6, a: -18 },
  { x: 48, y: 8, l: 24, w: 6.6, a: 40 }, { x: -28, y: 14, l: 30, w: 7, a: 8 }, { x: 8, y: 15, l: 32, w: 7.2, a: 2 },
  { x: -4, y: -4, l: 22, w: 6.8, a: 62 },
]

export const TABLE = (
  <g>
    {/* its shadow, the planks, their grain and seams, an inked edge with a lit bevel */}
    <rect x={5} y={6} width={392} height={213} rx={12} fill={INK} opacity={0.28} />
    <rect x={3} y={3} width={392} height={213} rx={12} fill="#c99a62" />
    <rect x={3} y={3} width={392} height={213} rx={12} fill="url(#g2-grain)" />
    <path d="M4 56H394M4 112H394M4 166H394" stroke="#7a4e28" strokeWidth={1.1} opacity={0.55} />
    <path d="M4 57.2H394M4 113.2H394M4 167.2H394" stroke="#e8c48c" strokeWidth={0.7} opacity={0.6} />
    <ellipse cx={30} cy={196} rx={4} ry={1.6} fill="none" stroke="#7a4a24" strokeWidth={0.7} opacity={0.5} />
    <ellipse cx={372} cy={140} rx={3.4} ry={1.4} fill="none" stroke="#7a4a24" strokeWidth={0.7} opacity={0.5} />
    <rect x={5.5} y={5.5} width={387} height={208} rx={10} fill="none" stroke="#efcb93" strokeWidth={1.4} opacity={0.6} />
    <rect x={3} y={3} width={392} height={213} rx={12} fill="none" stroke={INK} strokeWidth={1.8} />
  </g>
)

export const PIT_ART = (
  <g>
    {/* the ash bed: pale and fine-speckled, raked in rings, scorched toward the fire */}
    <ellipse cx={PIT.cx} cy={PIT.cy + 3} rx={PIT.ashX + 4} ry={PIT.ashY + 4} fill={INK} opacity={0.25} />
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={PIT.ashX} ry={PIT.ashY} fill="url(#g2-ash)" />
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={PIT.ashX} ry={PIT.ashY} fill="url(#g2-speck)" />
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={128} ry={54} fill="none" stroke="#d2c9ba" strokeWidth={0.8} strokeDasharray="9 5" />
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={112} ry={47} fill="none" stroke="#d8d0c2" strokeWidth={0.7} strokeDasharray="6 7" />
    <ellipse cx={PIT.cx} cy={PIT.cy + 2} rx={92} ry={40} fill="url(#g2-scorch)" />
    {/* the stones' shadows on the ash, then the stones themselves, back to front */}
    {STONES.map((s) => <path key={`s${s.k}`} d={s.d} transform={`translate(${n1(s.x + 1.5)} ${n1(s.y + 3)}) rotate(${n1(s.rot)})`} fill={INK} opacity={0.3} />)}
    {STONES.map((s) => (
      <g key={s.k} transform={`translate(${n1(s.x)} ${n1(s.y)}) rotate(${n1(s.rot)})`}>
        <path d={s.d} fill={`url(#g2-stone${s.tone})`} stroke={INK} strokeWidth={1.1} />
        <path d={`M${n1(-s.rx * 0.55)} ${n1(-s.ry * 0.2)}Q${n1(-s.rx * 0.3)} ${n1(-s.ry * 0.68)} ${n1(s.rx * 0.25)} ${n1(-s.ry * 0.62)}`}
          fill="none" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0.42} />
        <path d={`M${n1(-s.rx * 0.6)} ${n1(s.ry * 0.5)}Q0 ${n1(s.ry * 0.95)} ${n1(s.rx * 0.6)} ${n1(s.ry * 0.45)}`} fill="none" stroke={INK}
          strokeWidth={1.4} opacity={0.18} />
        {s.k % 3 === 0 && <path d={`M${n1(s.rx * 0.1)} ${n1(-s.ry * 0.1)}l3 2.4 1.6-.4`} fill="none" stroke={INK} strokeWidth={0.6} opacity={0.5} />}
        <circle cx={n1(s.rx * 0.3)} cy={n1(s.ry * 0.15)} r={0.6} fill={INK} opacity={0.35} />
        <circle cx={n1(-s.rx * 0.2)} cy={n1(s.ry * 0.35)} r={0.5} fill="#fff" opacity={0.4} />
      </g>
    ))}
    {/* the coal bed under the charcoal */}
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={PIT.coalX + 3} ry={PIT.coalY + 3} fill="#5a4a40" opacity={0.6} />
    <ellipse cx={PIT.cx} cy={PIT.cy} rx={PIT.coalX} ry={PIT.coalY} fill="url(#g2-bed)" stroke={INK} strokeWidth={1} />
  </g>
)

/** the charcoal sticks themselves (their glowing cracks come apart, in COAL_GLOW, so the fire can turn them up) */
export const COAL_STICKS = (
  <g transform={`translate(${PIT.cx} ${PIT.cy})`}>
    {COALS.map((c, i) => (
      <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a})`}>
        <rect x={-c.l / 2} y={-c.w / 2 + 1.6} width={c.l} height={c.w} rx={2.2} fill="#000" opacity={0.4} />
        <rect x={-c.l / 2} y={-c.w / 2} width={c.l} height={c.w} rx={2.2} fill="url(#g2-char)" stroke="#0e0b0a" strokeWidth={0.8} />
        <path d={`M${-c.l / 2 + 3} ${-c.w / 2 + 1.3}H${c.l / 2 - 4}`} stroke="#d8d2ca" strokeWidth={0.8} opacity={0.6} strokeLinecap="round" />
        {/* the white ash coat binchotan burns under, in patches */}
        <ellipse cx={-c.l * 0.2} cy={-c.w * 0.18} rx={c.l * 0.14} ry={c.w * 0.18} fill="#e8e2da" opacity={0.45} />
        <ellipse cx={c.l * 0.22} cy={-c.w * 0.12} rx={c.l * 0.09} ry={c.w * 0.14} fill="#e8e2da" opacity={0.35} />
        {/* the cut end, its rings */}
        <ellipse cx={c.l / 2 - 1.2} cy={0} rx={1.6} ry={c.w / 2 - 0.4} fill="#4a4542" stroke="#0e0b0a" strokeWidth={0.6} />
        <ellipse cx={c.l / 2 - 1.2} cy={0} rx={0.7} ry={c.w / 4} fill="none" stroke="#2a2624" strokeWidth={0.4} />
      </g>
    ))}
  </g>
)

/** the cracks in the charcoal and the embers between, glowing as hot as the fire */
export const COAL_GLOW = (
  <g transform={`translate(${PIT.cx} ${PIT.cy})`}>
    {COALS.map((c, i) => {
      const cracks = Array.from({ length: Math.floor(c.l / 9) }, (_, k) => -c.l / 2 + 6 + k * 8.5 + rnd(k, i) * 2)
      return (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a})`}>
          <path d={`M${-c.l / 2 + 2} ${c.w / 2 - 0.8}H${c.l / 2 - 2}`} stroke="#ff5a10" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <path d={`M${-c.l / 2 + 3} ${c.w / 2 - 1}H${c.l / 2 - 3}`} stroke="#ffc060" strokeWidth={0.6} strokeLinecap="round" />
          <path d={cracks.map((x) => `M${n1(x)} ${n1(-c.w / 2 + 1)}l.8 ${n1(c.w * 0.45)}-.6 ${n1(c.w * 0.45)}`).join('')}
            fill="none" stroke="#ff7a1a" strokeWidth={1.5} strokeLinecap="round" />
          <path d={cracks.map((x) => `M${n1(x + 0.3)} ${n1(-c.w / 2 + 1.6)}l.6 ${n1(c.w * 0.4)}-.4 ${n1(c.w * 0.3)}`).join('')}
            fill="none" stroke="#ffe08a" strokeWidth={0.7} strokeLinecap="round" />
          <path d={`M${n1(-c.l / 4)} ${n1(-c.w * 0.1)}h${n1(c.l / 3)}`} stroke="#ff7a22" strokeWidth={0.7} opacity={0.6} strokeLinecap="round" />
        </g>
      )
    })}
    {[[-56, 4], [-20, -14], [16, -2], [52, -4], [-40, 18], [30, 18], [0, 22], [-60, -6], [58, 12]].map(([x, y], i) => (
      <g key={i}><ellipse cx={x} cy={y} rx={3.4} ry={1.9} fill="#ff7a22" /><ellipse cx={x} cy={y - 0.3} rx={1.6} ry={0.9} fill="#ffe08a" /></g>
    ))}
  </g>
)

/** sparks and smoke over the fire (the CSS lifts them), as many as the fire is hot */
export const FIRE_LIFE = (
  <g transform={`translate(${PIT.cx} ${PIT.cy})`}>
    {[[-30, -4, 0], [12, -10, 0.7], [40, 0, 1.4], [-8, 6, 2.1], [-50, 2, 1], [26, 8, 2.6], [0, -16, 1.8]].map(([x, y, d], i) => (
      <circle key={i} className="g2-spark" cx={x} cy={y} r={0.9 + (i % 3) * 0.3} fill={i % 2 ? '#ffd27a' : '#ff8a2a'}
        style={{ animationDelay: `${d}s`, ['--dx' as string]: `${(i % 3 - 1) * 6}px` }} />
    ))}
    {[[-24, 0], [14, 1.5], [44, 3]].map(([x, d], i) => (
      <path key={i} className="g2-smoke" d={`M${x} -6c-5-6 5-10 0-17s4-9 1-13`} fill="none" stroke="#fff" strokeWidth={4.5}
        strokeLinecap="round" style={{ animationDelay: `${d}s` }} />
    ))}
  </g>
)

/** the grill net (焼き網) laid over the middle of the coals, its wire frame and two loop handles */
export const NET = (
  <g transform={`translate(${PIT.cx} ${PIT.cy})`}>
    <rect x={-44} y={-19} width={88} height={40} rx={7} fill={INK} opacity={0.25} transform="translate(1.5 2.5)" />
    <rect x={-44} y={-19} width={88} height={40} rx={7} fill="url(#g2-wire)" />
    <rect x={-44} y={-19} width={88} height={40} rx={7} fill="none" stroke="#2a2420" strokeWidth={2.2} />
    <rect x={-44} y={-19} width={88} height={40} rx={7} fill="none" stroke="#9a9692" strokeWidth={0.7} transform="translate(-.4 -.5)" />
    <path d="M-44 -4c-7 0-7 10 0 10M44 -4c7 0 7 10 0 10" fill="none" stroke="#2a2420" strokeWidth={1.6} />
  </g>
)

/** the wooden tray (番重) the raw skewers wait on, its lip, and the paper slip that says what it's for */
export function Tray({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x + 1.5} y={y + 3} width={w} height={h} rx={5} fill={INK} opacity={0.3} />
      <rect x={x} y={y} width={w} height={h} rx={5} fill="#8a5a30" stroke={INK} strokeWidth={1.4} />
      <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={2.5} fill="url(#g2-tray)" stroke="#6a4222" strokeWidth={0.8} />
      <rect x={x + 5} y={y + 5} width={w - 10} height={h - 10} rx={2.5} fill="url(#g2-grain)" />
      <path d={`M${x + 6} ${y + 6.4}H${x + w - 6}`} stroke={INK} strokeWidth={1.6} opacity={0.22} />
      <path d={`M${x + 3} ${y + 1.6}H${x + w - 3}`} stroke="#d8a874" strokeWidth={0.9} opacity={0.8} />
      <g transform={`translate(${x + 8} ${y - 4}) rotate(-2)`}>
        <rect width={label.length * 7.2 + 8} height={11} rx={1} fill="#fbf3df" stroke={INK} strokeWidth={0.7} />
        <text x={4} y={8.2} className="g2-label">{label}</text>
      </g>
    </g>
  )
}

/** the blue-and-white oval plate (長皿) things come off the fire onto: waves round the rim, a sprig of hajikami */
export function Plate({ cx, cy, rx, ry, label }: { cx: number; cy: number; rx: number; ry: number; label: string }) {
  return (
    <g>
      <ellipse cx={cx + 1.5} cy={cy + 3.5} rx={rx} ry={ry} fill={INK} opacity={0.3} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#g2-seigaiha)" stroke={INK} strokeWidth={1.4} />
      <ellipse cx={cx} cy={cy} rx={rx - 0.8} ry={ry - 0.8} fill="none" stroke="#2f5a9a" strokeWidth={1.2} />
      <ellipse cx={cx} cy={cy + 1} rx={rx - 12} ry={ry - 7} fill="url(#g2-glaze)" stroke="#2f5a9a" strokeWidth={0.9} />
      <ellipse cx={cx} cy={cy + 1} rx={rx - 14} ry={ry - 8.6} fill="none" stroke="#2f5a9a" strokeWidth={0.4} strokeDasharray="1.4 2" />
      <path d={`M${cx - rx * 0.55} ${cy - ry + 5}q${rx * 0.3} -3 ${rx * 0.6} -2.6`} fill="none" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
      {/* the pickled ginger shoot laid at the end */}
      <g transform={`translate(${cx + rx - 22} ${cy + ry - 9}) rotate(-24)`}>
        <path d="M0 0h12" stroke="#e86a8a" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M0 0h6" stroke="#f6e2c8" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M-1.2 0h14" stroke={INK} strokeWidth={0.5} fill="none" opacity={0.4} />
      </g>
      <g transform={`translate(${cx - label.length * 3.6 - 4} ${cy - ry - 6})`}>
        <rect width={label.length * 7.2 + 8} height={11} rx={1} fill="#fbf3df" stroke={INK} strokeWidth={0.7} />
        <text x={4} y={8.2} className="g2-label g2-label-dark">{label}</text>
      </g>
    </g>
  )
}

/** a lacquered miso soup bowl seen from above (tofu and wakame in it), or the warm sake: a tokkuri and its cup */
export function Soup({ id, left, of }: { id: string; left: number; of: number }) {
  const f = left / of
  if (id === 'Sake') return (
    <g>
      <ellipse cx={1} cy={8} rx={18} ry={4.5} fill={INK} opacity={0.25} />
      {/* the little lacquer tray, the tokkuri with its blue band, the cup with what's left in it */}
      <rect x={-17} y={-1} width={34} height={11} rx={3} fill="#2a1a14" stroke={INK} strokeWidth={1} />
      <rect x={-15.5} y={0.4} width={31} height={8} rx={2} fill="#4a2a1e" />
      <path d="M-7.6 -11.6H-4.4L-4.8 -10Q-4.8 -8 -2.4 -4.6Q0 -1 0 1.6Q0 5.4 -4 5.6H-8Q-12 5.4 -12 1.6Q-12 -1 -9.6 -4.6Q-7.2 -8 -7.2 -10Z"
        fill="#f4efe4" stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <path d="M-11.6 .4H-.4" stroke="#2f5a9a" strokeWidth={1.3} />
      <path d="M-10.6 -1.4Q-9 -4.6 -7.6 -6.4" stroke="#fff" strokeWidth={1} fill="none" strokeLinecap="round" />
      <path d="M-2.2 4.4Q-1.2 3 -1.2 1.2" stroke={INK} strokeWidth={1} fill="none" opacity={0.2} />
      <path d="M4 1H12Q11.6 6 8 6.4Q4.4 6 4 1Z" fill="#f4efe4" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
      <ellipse cx={8} cy={1} rx={4} ry={1.4} fill={f ? '#e8eef0' : '#fbf8f0'} stroke={INK} strokeWidth={0.6} />
      {f > 0 && <ellipse cx={8} cy={1.1} rx={3.2 * f} ry={1 * f} fill="#d8e4ea" />}
      <path d="M4.6 3.4Q8 4.6 11.4 3.4" stroke="#2f5a9a" strokeWidth={0.6} fill="none" />
    </g>
  )
  return (
    <g>
      <ellipse cx={1} cy={3} rx={14} ry={10.5} fill={INK} opacity={0.25} />
      <ellipse rx={13.5} ry={10} fill="#1a0e0a" stroke={INK} strokeWidth={1} />
      <ellipse rx={12} ry={8.8} fill="url(#g2-lacquer)" />
      <path d="M-9 -4a10 7 0 0 1 8-4" stroke="#fff" strokeWidth={1.1} opacity={0.5} fill="none" strokeLinecap="round" />
      {f > 0 ? (
        <g transform={`scale(${n1(0.45 + 0.55 * f)})`}>
          <ellipse rx={10} ry={7.2} fill="url(#g2-miso)" stroke="#6a3a14" strokeWidth={0.5} />
          <path d="M-6 -1q3-2.4 6 0t5 0" fill="none" stroke="#f0d09a" strokeWidth={0.7} opacity={0.7} />
          <rect x={-5} y={-3} width={3.2} height={3.2} rx={0.5} fill="#fbf6ea" stroke={INK} strokeWidth={0.4} transform="rotate(12 -3.4 -1.4)" />
          <rect x={2} y={0} width={3} height={3} rx={0.5} fill="#fbf6ea" stroke={INK} strokeWidth={0.4} transform="rotate(-20 3.5 1.5)" />
          <path d="M-2 2.6q1.6-1.4 3.2.2-1.4 1.4-3.2-.2zM3.6 -3.4q1.6-1 2.8.6-1.6.8-2.8-.6z" fill="#2f5a2a" />
          <path d="M-4.5 4q1-1.2 2.4 0" stroke="#7aa848" strokeWidth={0.8} fill="none" strokeLinecap="round" />
        </g>
      ) : <ellipse rx={9} ry={6.4} fill="#5a160e" />}
    </g>
  )
}

// ---- the food

/** a whole fish: how long and deep it is, its back, belly and fins, and its markings */
type FishSpec = { len: number; h: number; back: string; belly: string; fin: string; mark: 'ayu' | 'saury' | 'saba' | 'aji' | 'iwashi' | 'hokke' | 'nodo' | 'shishamo' }
const AYU: FishSpec = { len: 34, h: 6.4, back: '#6e7a58', belly: '#e8e8dc', fin: '#a0a07a', mark: 'ayu' }
const FISH: Record<string, FishSpec> = {
  Fish: AYU, ExtraFish: AYU,
  Saury: { len: 40, h: 4.2, back: '#34466a', belly: '#dfe5ec', fin: '#56607a', mark: 'saury' },
  Mackerel: { len: 36, h: 6.6, back: '#3a6e74', belly: '#e8ecee', fin: '#5a7a80', mark: 'saba' },
  Aji: { len: 33, h: 6.6, back: '#687a94', belly: '#eef0ec', fin: '#c8b060', mark: 'aji' },
  Iwashi: { len: 29, h: 5.2, back: '#2e4878', belly: '#e6ecf2', fin: '#6a7890', mark: 'iwashi' },
  Hokke: { len: 36, h: 7.4, back: '#7e6e50', belly: '#f0e6d2', fin: '#a08a5a', mark: 'hokke' },
  Nodoguro: { len: 33, h: 7.2, back: '#d0402e', belly: '#f6cdbd', fin: '#e06a50', mark: 'nodo' },
}
const SHISHAMO: FishSpec = { len: 15, h: 3.3, back: '#9a8a68', belly: '#f2dca8', fin: '#c8b48a', mark: 'shishamo' }

type Tone = (c: string) => string
/** a fish in profile from x0 (its snout) to x0 + len (its tail), on the line y = 0 */
function fishArt(s: FishSpec, x0: number, tone: Tone, r: number, salted: boolean, key?: string) {
  const L = s.len, H = s.h, x1 = x0 + L, xa = x0 + 0.3 * L, xp = x1 - 0.17 * L
  const body = `M${x0} .4C${n1(x0 + 0.02 * L)} ${n1(-H * 0.8)} ${n1(x0 + 0.16 * L)} ${-H} ${n1(xa)} ${-H}C${n1(x0 + 0.62 * L)} ${-H} ${n1(xp - 3)} ${n1(-H * 0.45)} ${n1(xp)} ${n1(-H * 0.3)}`
    + `L${n1(x1)} ${n1(-H * 0.95)}Q${n1(x1 - 2.2)} 0 ${n1(x1)} ${n1(H * 0.95)}L${n1(xp)} ${n1(H * 0.3)}C${n1(xp - 3)} ${n1(H * 0.45)} ${n1(x0 + 0.62 * L)} ${H} ${n1(xa)} ${H}`
    + `C${n1(x0 + 0.16 * L)} ${H} ${n1(x0 + 0.02 * L)} ${n1(H * 0.8)} ${x0} .4Z`
  const back = `M${x0 + 0.6} 0C${n1(x0 + 0.02 * L)} ${n1(-H * 0.8)} ${n1(x0 + 0.16 * L)} ${-H} ${n1(xa)} ${-H}C${n1(x0 + 0.62 * L)} ${-H} ${n1(xp - 3)} ${n1(-H * 0.45)} ${n1(xp)} ${n1(-H * 0.3)}`
    + `L${n1(xp)} ${n1(-H * 0.06)}C${n1(x0 + 0.6 * L)} ${n1(-H * 0.2)} ${n1(x0 + 0.25 * L)} ${n1(-H * 0.02)} ${x0 + 0.6} 0Z`
  const tail = `M${n1(xp)} ${n1(-H * 0.3)}L${n1(x1)} ${n1(-H * 0.95)}Q${n1(x1 - 2.2)} 0 ${n1(x1)} ${n1(H * 0.95)}L${n1(xp)} ${n1(H * 0.3)}Z`
  const dorsal = s.mark === 'ayu'
    ? `M${n1(x0 + 0.36 * L)} ${n1(-H * 0.96)}Q${n1(x0 + 0.42 * L)} ${n1(-H * 1.75)} ${n1(x0 + 0.56 * L)} ${n1(-H * 1.5)}L${n1(x0 + 0.6 * L)} ${n1(-H * 0.85)}Z`
    : `M${n1(x0 + 0.42 * L)} ${n1(-H * 0.95)}L${n1(x0 + 0.5 * L)} ${n1(-H * 1.45)}L${n1(x0 + 0.62 * L)} ${n1(-H * 0.8)}Z`
  const fin = salted ? '#fbfaf6' : tone(s.fin)
  const eyeR = H * (s.mark === 'nodo' ? 0.3 : 0.23), ex = x0 + 0.1 * L, ey = -H * 0.22
  const m = smooth(0.5, 1.05, r) * 0.75
  return (
    <g key={key}>
      <path d={dorsal} fill={fin} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
      {s.mark === 'saury' && <path d={`M${n1(xp - 6)} ${n1(-H * 0.5)}l1 -1.6 1 1.2M${n1(xp - 2.5)} ${n1(-H * 0.4)}l1 -1.4 1 1`} fill="none" stroke={INK} strokeWidth={0.5} />}
      <path d={body} fill={tone(s.belly)} />
      <path d={back} fill={tone(s.back)} />
      <path d={tail} fill={fin} />
      {s.mark === 'ayu' && <ellipse cx={n1(x0 + 0.27 * L)} cy={n1(-H * 0.1)} rx={2.4} ry={1.1} fill={tone('#e8c440')} />}
      {s.mark === 'saury' && <path d={`M${x0} .4l3.2-1.1v1.6z`} fill={tone('#e8c440')} />}
      {s.mark === 'saba' && <path d={`M${n1(x0 + 0.3 * L)} ${n1(-H * 0.6)}q1.5 1.2 3 0t3 0 3 0 3 0 3 0M${n1(x0 + 0.34 * L)} ${n1(-H * 0.35)}q1.5 1.2 3 0t3 0 3 0 3 0`}
        fill="none" stroke={tone('#1e3a40')} strokeWidth={0.7} />}
      {s.mark === 'aji' && <path d={`M${n1(x0 + 0.42 * L)} -.4L${n1(xp + 1)} -.2`} stroke={tone('#d8d4c4')} strokeWidth={1.3} strokeDasharray="1 .8" />}
      {s.mark === 'iwashi' && <path d={Array.from({ length: 5 }, (_, k) => `M${n1(x0 + 0.3 * L + k * 3.4)} ${n1(-H * 0.08)}h.1`).join('')}
        stroke={tone('#203050')} strokeWidth={1.6} strokeLinecap="round" />}
      {s.mark === 'hokke' && <path d={Array.from({ length: 4 }, (_, k) => `M${n1(x0 + 0.34 * L + k * 0.11 * L)} ${n1(-H * 0.85)}v${n1(H * 0.65)}`).join('')}
        stroke={tone('#4a3a24')} strokeWidth={2} opacity={0.55} />}
      {s.mark === 'shishamo' && <path d={`M${n1(x0 + 0.25 * L)} ${n1(H * 0.45)}Q${n1(x0 + 0.5 * L)} ${n1(H * 1.2)} ${n1(x0 + 0.72 * L)} ${n1(H * 0.4)}`} fill={tone('#f0b060')} opacity={0.9} />}
      {/* scales catching the light, the side line, a shadow along the belly */}
      <path d={back} fill="url(#g2-scale)" opacity={0.6 * (1 - smooth(0.6, 1.4, r))} />
      <path d={`M${n1(x0 + 0.22 * L)} ${n1(-H * 0.12)}Q${n1(x0 + 0.6 * L)} ${n1(-H * 0.22)} ${n1(xp)} -.2`} fill="none" stroke={INK} strokeWidth={0.4} opacity={0.4} />
      <path d={`M${n1(x0 + 0.18 * L)} ${n1(H * 0.72)}Q${n1(x0 + 0.45 * L)} ${n1(H * 1.05)} ${n1(xp)} ${n1(H * 0.3)}`} fill="none" stroke={INK} strokeWidth={1.2} opacity={0.15} />
      <path d={`M${n1(x0 + 0.25 * L)} ${n1(H * 0.2)}l${n1(0.12 * L)} ${n1(H * 0.38)}-${n1(0.04 * L)} -${n1(H * 0.58)}z`} fill={fin} stroke={INK} strokeWidth={0.45} />
      <path d={`M${n1(x0 + 0.2 * L)} ${n1(-H * 0.72)}Q${n1(x0 + 0.26 * L)} 0 ${n1(x0 + 0.2 * L)} ${n1(H * 0.72)}`} fill="none" stroke={INK} strokeWidth={0.6} />
      <path d={`M${n1(xp + 1)} ${n1(-H * 0.2)}l${n1(0.12 * L)} ${n1(-H * 0.4)}M${n1(xp + 1)} ${n1(H * 0.2)}l${n1(0.12 * L)} ${n1(H * 0.4)}`} stroke={INK} strokeWidth={0.35} opacity={0.5} />
      {/* grill marks, browning in */}
      {m > 0.02 && <path d={[0.36, 0.52, 0.68].map((t) => `M${n1(x0 + t * L - 1.4)} ${n1(-H * 0.7)}L${n1(x0 + t * L + 1.4)} ${n1(H * 0.7)}`).join('')}
        stroke="#2a160c" strokeWidth={1.5} strokeLinecap="round" opacity={m} />}
      <path d={`M${n1(x0 + 0.16 * L)} ${n1(-H * 0.72)}Q${n1(xa)} ${n1(-H * 1.02)} ${n1(x0 + 0.55 * L)} ${n1(-H * 0.82)}`} fill="none" stroke="#fff"
        strokeWidth={0.8} strokeLinecap="round" opacity={0.55 * (1 - smooth(1.2, 2.2, r))} />
      <path d={body} fill="none" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={`M${x0} .4l${n1(0.06 * L)} .9`} stroke={INK} strokeWidth={0.5} />
      {/* the eye: dark and glinting raw, gone white when cooked through */}
      <circle cx={n1(ex)} cy={n1(ey)} r={n1(eyeR)} fill={r > 0.7 ? '#e8e2d2' : '#fff'} stroke={INK} strokeWidth={0.55} />
      <circle cx={n1(ex)} cy={n1(ey)} r={n1(eyeR * 0.58)} fill={r > 0.7 ? '#b8b0a0' : '#1a1410'} />
      {r <= 0.7 && <circle cx={n1(ex + eyeR * 0.25)} cy={n1(ey - eyeR * 0.3)} r={n1(eyeR * 0.22)} fill="#fff" />}
    </g>
  )
}

/** a bamboo skewer along y = 0, from its point (x0) to the end you hold (x1) */
const stick = (x0: number, x1 = 20) => (
  <g key="stick">
    <path d={`M${x0} 0H${x1}`} stroke={INK} strokeWidth={2.7} strokeLinecap="round" />
    <path d={`M${x0} 0H${x1}`} stroke="#e4c48c" strokeWidth={1.4} strokeLinecap="round" />
    <path d={`M${x1 - 6} -.35H${x1}`} stroke="#fff" strokeWidth={0.4} opacity={0.6} />
  </g>
)
/** chunks threaded on a skewer, each its own lumpy shape */
const CHUNK = [blob(5.4, 7, 11, 8, 0.12), blob(5.4, 6.8, 12, 8, 0.14), blob(5.2, 7.2, 13, 8, 0.12), blob(5.4, 6.9, 14, 8, 0.13)]
const marks = (xs: number[], h: number, m: number) => m > 0.02 && (
  <path key="marks" d={xs.map((x) => `M${n1(x - 1.6)} ${n1(-h)}L${n1(x + 1.6)} ${n1(h)}`).join('')} stroke="#2a160c" strokeWidth={1.4}
    strokeLinecap="round" opacity={m} />
)

/** specks of each seasoning on, over a box from x0 to x1, h either side of the middle */
const SPECKS = Array.from({ length: 30 }, (_, k) => [rnd(k, 71), rnd(k, 73) * 2 - 1])
const DAB_KEYS = ['salt', 'soy', 'milk', 'peanut', 'miso', 'wasabi', 'shichimi', 'yuzu', 'lemon'] as const
function dabArt(dk: string, x0: number, x1: number, h: number) {
  const at = (k: number) => [n1(x0 + SPECKS[k % 30][0] * (x1 - x0)), n1(SPECKS[k % 30][1] * h)]
  const out: ReactNode[] = []
  DAB_KEYS.forEach((name, i) => {
    const n = +dk[i] || 0
    if (!n) return
    const many = Math.min(3, n)
    if (name === 'salt' || name === 'peanut' || name === 'shichimi') {
      const c = name === 'salt' ? ['#ffffff', '#f4f4f0'] : name === 'peanut' ? ['#d8a860', '#e8c488'] : ['#d8401c', '#3a2414', '#f08a2a']
      out.push(<g key={name}>{Array.from({ length: 5 + many * 4 }, (_, k) => {
        const [x, y] = at(k * 3 + i * 7)
        return <circle key={k} cx={x} cy={y} r={name === 'salt' ? 0.6 : 0.5} fill={c[k % c.length]} stroke={name === 'salt' ? '#9a948a' : 'none'} strokeWidth={0.2} />
      })}</g>)
    } else if (name === 'milk') {
      out.push(<path key={name} d={`M${x0 + 2} ${-h * 0.4}` + Array.from({ length: 5 }, (_, k) => `L${n1(x0 + 2 + ((k + 1) * (x1 - x0 - 4)) / 5)} ${n1(k % 2 ? -h * 0.5 : h * 0.4)}`).join('')}
        fill="none" stroke="#fff4d8" strokeWidth={1.2 + many * 0.2} strokeLinecap="round" strokeLinejoin="round" />)
    } else if (name === 'miso' || name === 'soy') {
      // a glossy lick of glaze along the top
      out.push(<path key={name} d={`M${n1(x0 + 2)} ${n1(-h * 0.55)}Q${n1((x0 + x1) / 2)} ${n1(-h * 0.85)} ${n1(x1 - 2)} ${n1(-h * 0.5)}`} fill="none"
        stroke={name === 'miso' ? '#8a4a18' : '#3a1808'} strokeWidth={1.4} strokeLinecap="round" opacity={0.75} />)
      out.push(<path key={`${name}g`} d={`M${n1(x0 + 4)} ${n1(-h * 0.5)}Q${n1((x0 + x1) / 2)} ${n1(-h * 0.75)} ${n1(x1 - 5)} ${n1(-h * 0.45)}`} fill="none"
        stroke="#fff" strokeWidth={0.6} strokeLinecap="round" opacity={0.75} />)
    } else {
      const c = name === 'wasabi' ? '#8ac04a' : name === 'yuzu' ? '#c8d04a' : '#f6e85a'
      out.push(<g key={name}>{Array.from({ length: many + (name === 'lemon' ? 2 : 0) }, (_, k) => {
        const [x, y] = at(k * 5 + i * 3)
        return <g key={k}><circle cx={x} cy={y} r={name === 'lemon' ? 0.9 : 1.5} fill={c} stroke={INK} strokeWidth={0.35} />
          <circle cx={x - 0.4} cy={y - 0.4} r={0.4} fill="#fff" opacity={0.8} /></g>
      })}</g>)
    }
  })
  return out
}

/** what a seasoning's glaze turns the food's colour toward */
const GLAZE: Partial<Record<string, [string, number]>> = { soy: ['#6a3410', 0.32], miso: ['#a8682a', 0.28], milk: ['#fff2d0', 0.15] }

/** pick out the picture for a food: fish, chunks on a skewer, something on the net or in foil */
type Kind = 'fish' | 'shishamo' | 'fillet' | 'corn' | 'shiitake' | 'eringi' | 'shrimp' | 'sausage' | 'negima' | 'pork' | 'squid'
  | 'shishito' | 'asparagus' | 'okra' | 'scallop' | 'bloodcake' | 'onigiri' | 'mochi' | 'potato' | 'sweetpotato' | 'chunk'
const kindOf = (id: string): Kind => FISH[id] ? 'fish' : (({ Shishamo: 'shishamo', Salmon: 'fillet', Buri: 'fillet', Gindara: 'fillet',
  GrilledCorn: 'corn', GrilledShiitake: 'shiitake', KingOyster: 'eringi', ShrimpSkewer: 'shrimp', Sausage: 'sausage', Yakitori: 'negima',
  PorkBelly: 'pork', Squid: 'squid', Shishito: 'shishito', Asparagus: 'asparagus', Okra: 'okra', Scallop: 'scallop', BloodCake: 'bloodcake',
  Onigiri: 'onigiri', NetMochi: 'mochi', Potato: 'potato', SweetPotato: 'sweetpotato' } as Record<string, Kind>)[id] ?? 'chunk')
/** a fillet's cut: squarer than a chunk, each a little different */
const FILLET_CUT = ['M-5 -6.2L4.6 -6.6Q5.8 0 5 6.4L-4.8 6.6Q-5.8 0 -5 -6.2Z', 'M-5.2 -6.6L5 -6.2Q5.6 0 5.2 6.6L-5 6.2Q-5.6 0 -5.2 -6.6Z',
  'M-4.8 -6.4L5.2 -6.6Q5.8 .4 4.8 6.2L-5 6.6Q-5.6 -.4 -4.8 -6.4Z']
const FILLET: Record<string, { meat: string; skin: string; band: string }> = {
  Salmon: { meat: '#f0885a', skin: '#8a9098', band: '#fbe0d0' }, Buri: { meat: '#eab4a4', skin: '#3e4452', band: '#a8402f' },
  Gindara: { meat: '#f4eee2', skin: '#3a3a42', band: '#e4dccc' },
}

/**
 * A food's picture. A skewered one lies along y = 0 with its food from about x = -34 to 0 and the stick's end out to
 * x = 20; a loose one (on the net, in the ash) sits round (0, 0). r is how done (1 = just done), dk the seasonings
 * on it (one digit a seasoning, in DAB_KEYS order), foil: still wrapped.
 */
export const FoodArt = memo(function FoodArt({ id, r, dk, foil = false, fallback = '#d8b890' }: { id: string; r: number; dk: string; foil?: boolean; fallback?: string }) {
  const kind = kindOf(id)
  let glaze: [string, number] | null = null
  for (const [i, k] of DAB_KEYS.entries()) if (+dk[i] && GLAZE[k]) glaze = GLAZE[k]!
  const tone: Tone = (c) => cooked(glaze ? mixHex(c, glaze[0], glaze[1]) : c, r)
  const m = smooth(0.5, 1.05, r) * 0.75
  const salted = +dk[0] > 0
  const shine = (x0: number, x1: number, y: number) => (
    <path key="shine" d={`M${x0} ${y}H${x1}`} stroke="#fff" strokeWidth={0.9} strokeLinecap="round" opacity={(glaze ? 0.8 : 0.5) * (1 - smooth(1.2, 2.2, r))} />
  )
  const S = { stroke: INK, strokeWidth: 0.8, strokeLinejoin: 'round' as const }
  // a burnt piece smokes
  const smoke = r > 2.2 && <path key="smoke" className="g2-smoke g2-burnt" d="M-16 -5c-3-3 3-5 0-8s2-4 1-6" fill="none" stroke="#6a6460" strokeWidth={2.4} strokeLinecap="round" />
  switch (kind) {
    case 'fish': return <g>{stick(-38)}{fishArt(FISH[id], 2 - FISH[id].len, tone, r, salted)}{dabArt(dk, 2 - FISH[id].len + 6, -6, FISH[id].h * 0.6)}{smoke}</g>
    case 'shishamo': return (
      <g>{stick(-36)}
        {[-27, -16, -5].map((x, i) => <g key={x} transform={`translate(${x} ${i % 2 ? 0.8 : -0.8}) rotate(-90)`}>{fishArt(SHISHAMO, -7.5, tone, r, salted)}</g>)}
        {dabArt(dk, -32, 0, 6)}{smoke}</g>
    )
    case 'fillet': {
      const f = FILLET[id]
      return (
        <g>{stick(-36)}
          {[-27, -16, -5].map((x, i) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d={FILLET_CUT[i]} fill={tone(f.meat)} />
              <path d="M-5 -5.2Q0 -7.6 5 -5.4L5.2 -3.6Q0 -5.6 -5.2 -3.4Z" fill={tone(f.skin)} />
              {id !== 'Gindara' ? <path d="M-3.6 -2q3.6 1.6 7.2 0M-3.8 1.4q3.8 1.6 7.6 0M-3.2 4.4q3.2 1.2 6.4 0" fill="none" stroke={tone(f.band)} strokeWidth={id === 'Buri' ? 1.1 : 0.8} opacity={0.9} />
                : <path d="M-3 -1.5l2.4 1.4M.4 1l2.6 1.6M-2.4 3.4l2 1" fill="none" stroke="#c8bca8" strokeWidth={0.5} />}
              <path d="M-4.2 5.8Q0 7.4 4.2 5.6" fill="none" stroke={INK} strokeWidth={1.2} opacity={0.18} />
              <path d={FILLET_CUT[i]} fill="none" {...S} />
            </g>
          ))}
          {marks([-27, -16, -5], 5, m)}{shine(-30, -24, -3.6)}{dabArt(dk, -32, 0, 5)}{smoke}</g>
      )
    }
    case 'corn': return (
      <g>{stick(-37)}
        <rect x={-33} y={-7.5} width={32} height={15} rx={6} fill={tone('#f2cf48')} />
        <rect x={-33} y={-7.5} width={32} height={15} rx={6} fill="url(#g2-kernel)" opacity={1 - smooth(1.2, 2.4, r) * 0.6} />
        <path d="M-30 4.6Q-17 7.4 -4 4.6" fill="none" stroke="#a86a10" strokeWidth={1.6} opacity={0.3} />
        {marks([-26, -17, -8], 6.4, m)}
        <path d="M-30 -4.6H-6" stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.5 * (1 - smooth(1.2, 2.2, r))} />
        <rect x={-33} y={-7.5} width={32} height={15} rx={6} fill="none" {...S} />
        {dabArt(dk, -32, -2, 5.5)}{smoke}</g>
    )
    case 'shiitake': return (
      <g>{stick(-36)}
        {[-24, -9].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <circle r={8} fill={tone('#e8d6b8')} {...S} />
            <circle r={6.6} fill={tone('#8a5a36')} />
            <path d="M-4.6 -2.4a6 6 0 0 1 5.4-3.6" stroke={tone('#b98a5e')} strokeWidth={2} fill="none" strokeLinecap="round" />
            {/* the star cut in the cap (飾り包丁) */}
            <path d="M-4 0H4M-2 -3.5L2 3.5M2 -3.5L-2 3.5" stroke={tone('#f0e2c8')} strokeWidth={1.1} strokeLinecap="round" />
            <circle r={6.6} fill="none" stroke={INK} strokeWidth={0.5} opacity={0.6} />
          </g>
        ))}
        {marks([-24, -9], 6, m * 0.7)}{dabArt(dk, -32, -2, 5)}{smoke}</g>
    )
    case 'eringi': return (
      <g>{stick(-36)}
        {[-27, -17, -7].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <ellipse rx={4.6} ry={7.6} fill={tone('#c8a878')} {...S} />
            <ellipse rx={3.5} ry={6.4} fill={tone('#f0e6cc')} />
            <path d="M-2 -4l4 3.4M-2 -.6l4 3.4M2 -4l-4 3.4M2 -.6l-4 3.4" stroke={tone('#c8b088')} strokeWidth={0.5} />
          </g>
        ))}
        {marks([-27, -17, -7], 6, m)}{dabArt(dk, -32, -2, 5)}{smoke}</g>
    )
    case 'shrimp': {
      // grey and glassy raw, turning pink-orange as it cooks
      const shell = cooked(mixHex('#9aa8ae', '#f2784e', smooth(0.15, 0.85, r)), Math.max(0, r - 0.3))
      return (
        <g>{stick(-37)}
          <path d="M-2 -1.4l6 -5.4 1.2 6.8 -1.2 6.8 -6 -5.4z" fill={tone(mixHex('#8a98a0', '#e83a2a', smooth(0.15, 0.85, r)))} {...S} />
          <path d="M-34 -1Q-33 -6.6 -26 -6.4Q-12 -6 -2 -2V2Q-12 5.6 -26 5.4Q-33 5 -34 -1Z" fill={shell} />
          <path d="M-31 2.4Q-16 6.4 -3 1.6" fill="none" stroke="#fbe8dc" strokeWidth={1.6} opacity={0.6} />
          <path d="M-26 -6.2q1.6 5.8 0 11.4M-20.5 -6q1.6 5.8 0 11.2M-15 -5.4q1.4 5 0 10.2M-10 -4.4q1.2 4.2 0 8.4M-6 -3.4q1 3.4 0 6.8" fill="none" stroke={INK} strokeWidth={0.5} opacity={0.7} />
          <path d="M-29 5.4l-1 2.4M-25 5.6l-1 2.4M-21 5.4l-.8 2.4M-17 5l-.8 2.2" stroke={INK} strokeWidth={0.5} />
          <path d="M-33 -3.4q-6-5-8-9M-33.4 -2q-7-2-10-5" fill="none" stroke={INK} strokeWidth={0.45} />
          <path d="M-34 -1Q-33 -6.6 -26 -6.4Q-12 -6 -2 -2V2Q-12 5.6 -26 5.4Q-33 5 -34 -1Z" fill="none" {...S} />
          <circle cx={-31.4} cy={-3} r={1} fill={INK} />
          {marks([-24, -14], 4.6, m * 0.6)}{shine(-28, -14, -4.6)}{dabArt(dk, -32, -3, 4)}{smoke}</g>
      )
    }
    case 'sausage': return (
      <g>{stick(-37)}
        <rect x={-34} y={-6} width={33} height={12} rx={6} fill={tone('#c8604a')} />
        <path d="M-30 3.6H-5" stroke="#5a1a10" strokeWidth={2} opacity={0.22} strokeLinecap="round" />
        {/* the cuts, opening as it cooks */}
        <path d="M-26 -5l3 4.2M-18 -5l3 4.2M-10 -5l3 4.2" stroke={tone('#f2c4a4')} strokeWidth={0.6 + smooth(0.3, 1, r) * 1.2} strokeLinecap="round" />
        {shine(-30, -6, -3.6)}
        <rect x={-34} y={-6} width={33} height={12} rx={6} fill="none" {...S} />
        {dabArt(dk, -32, -3, 4)}{smoke}</g>
    )
    case 'negima': return (
      <g>{stick(-37)}
        {[-30, -13].map((x, i) => <g key={x} transform={`translate(${x} 0)`}><path d={CHUNK[i]} fill={tone('#f2d8bc')} {...S} />
          <path d="M-3 -3.6q2.4-1.6 5 0" fill="none" stroke="#fff" strokeWidth={0.8} opacity={0.55 * (1 - smooth(1.2, 2.2, r))} strokeLinecap="round" />
          <path d="M-3.6 4.4Q0 6.2 3.6 4.4" fill="none" stroke={INK} strokeWidth={1.2} opacity={0.18} /></g>)}
        {[-21.5, -4.5].map((x) => <g key={x} transform={`translate(${x} 0)`}>
          <rect x={-3.2} y={-5.6} width={6.4} height={11.2} rx={2} fill={tone('#eef2d8')} {...S} />
          <path d="M-3.2 -3.2h6.4M-3.2 3.2h6.4" stroke={tone('#a8c868')} strokeWidth={0.7} />
          <path d="M-1.6 -5v10" stroke="#fff" strokeWidth={0.8} opacity={0.6} /></g>)}
        {marks([-30, -13], 5.4, m)}{dabArt(dk, -34, -2, 5)}{smoke}</g>
    )
    case 'pork': return (
      <g>{stick(-36)}
        {[-27, -16, -5].map((x, i) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <path d={CHUNK[i + 1]} fill={tone('#e8968c')} />
            <path d="M-4.6 -3.4Q0 -2 4.6 -3.6M-4.8 1Q0 2.4 4.8 .8M-4 4.6Q0 5.4 4 4.4" fill="none" stroke={tone('#fbf0e6')} strokeWidth={1.4} />
            <path d={CHUNK[i + 1]} fill="none" {...S} />
          </g>
        ))}
        {marks([-27, -16, -5], 5.4, m)}{dabArt(dk, -32, -2, 5)}{smoke}</g>
    )
    case 'squid': return (
      <g>{stick(-38)}
        {/* the body (fins at its tip toward the fire), scored, the legs toward the stick's end */}
        <path d="M-6 -3c3 0 5-2 7-3M-6 -1c3 0 5 0 8-1M-6 1c3 0 5 1 8 2M-6 3c3 0 5 2 7 4" fill="none" stroke={tone('#e8c8b8')} strokeWidth={1.4} strokeLinecap="round" />
        <path d="M-6 -3c3 0 5-2 7-3M-6 -1c3 0 5 0 8-1M-6 1c3 0 5 1 8 2M-6 3c3 0 5 2 7 4" fill="none" stroke={INK} strokeWidth={0.3} />
        <path d="M-35 0L-28 -8.4L-27 -4.6Q-16 -5.6 -6 -4.6V4.6Q-16 5.6 -27 4.6L-28 8.4Z" fill={tone('#f4e8de')} {...S} />
        <path d="M-25 -3.4l4 6.8M-20 -3.8l4 7.4M-15 -3.8l4 7.4M-25 3.4l4 -6.8M-20 3.8l4 -7.4M-15 3.8l4 -7.4" stroke={tone('#d8b8a4')} strokeWidth={0.5} />
        <path d="M-26 -3.6Q-16 -4.4 -8 -3.6" stroke="#fff" strokeWidth={0.9} opacity={0.5 * (1 - smooth(1.2, 2.2, r))} fill="none" strokeLinecap="round" />
        {marks([-20, -12], 4.4, m * 0.7)}{dabArt(dk, -30, -6, 4)}{smoke}</g>
    )
    case 'shishito': case 'asparagus': case 'okra': {
      // threaded across the skewer, side by side
      const xs = kind === 'asparagus' ? [-30, -22, -14, -6] : [-28, -18, -8]
      const base = kind === 'okra' ? '#4a8a3a' : kind === 'asparagus' ? '#7aac48' : '#5aa03a'
      return (
        <g>{stick(-36)}
          {xs.map((x, i) => (
            <g key={x} transform={`translate(${x} ${i % 2 ? 0.8 : -0.6}) rotate(${(i % 2 ? 6 : -5)})`}>
              {kind === 'shishito' && <><path d="M0 -8Q-3.6 -4 -2.6 3Q-1.6 7.6 0 8.4Q2.6 6 2.6 0Q2.8 -5 0 -8Z" fill={tone(base)} {...S} />
                <path d="M-.4 -8l-1.4-2.6" stroke={tone('#3a6a2a')} strokeWidth={1.2} strokeLinecap="round" />
                <path d="M-1 -5Q-2 0 -1 5" stroke="#fff" strokeWidth={0.7} opacity={0.45} fill="none" /></>}
              {kind === 'asparagus' && <><rect x={-2} y={-7.6} width={4} height={15} rx={1.8} fill={tone(base)} {...S} />
                <path d="M-2 -5l2 -1.2 2 1.2M-2 -1.6l2-1 2 1M-2 1.8l2-1 2 1" fill="none" stroke={tone('#4a7a2a')} strokeWidth={0.5} />
                <path d="M-.8 -6v12" stroke="#fff" strokeWidth={0.6} opacity={0.4} /></>}
              {kind === 'okra' && <><path d="M0 8.6L-2.8 -4.6Q0 -6.6 2.8 -4.6Z" fill={tone(base)} {...S} />
                <path d="M-1.2 -5.2L0 8M1.2 -5.2L0 8" stroke={tone('#2a5a22')} strokeWidth={0.45} />
                <path d="M-2.6 -4.8Q0 -8.6 2.6 -4.8Q0 -3.6 -2.6 -4.8Z" fill={tone('#b8c878')} {...S} /></>}
            </g>
          ))}
          {m > 0.05 && <g opacity={m}>{xs.map((x, i) => <ellipse key={x} cx={x + 0.6} cy={(i % 2 ? 2.6 : -2.4)} rx={1.4} ry={1} fill="#2a1a0c" opacity={0.7} />)}</g>}
          {dabArt(dk, -32, -2, 5)}{smoke}</g>
      )
    }
    case 'scallop': return (
      <g>{stick(-36)}
        {[-27, -16, -5].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <ellipse rx={5.2} ry={6.8} fill={tone('#efdcc0')} {...S} />
            <ellipse cx={-0.6} cy={-0.6} rx={3.8} ry={5.2} fill={tone('#f8eedc')} />
            <path d="M-3.6 3.6Q0 5 3.6 3.6M-4 1Q0 2.4 4 1" fill="none" stroke={tone('#d8c0a0')} strokeWidth={0.4} />
            <ellipse cx={-1.8} cy={-3} rx={1.2} ry={1.8} fill="#fff" opacity={0.6 * (1 - smooth(1.2, 2.2, r))} />
          </g>
        ))}
        {marks([-27, -16, -5], 5.6, m)}{dabArt(dk, -32, -2, 5)}{smoke}</g>
    )
    case 'bloodcake': return (
      <g>{stick(-37)}
        <rect x={-33} y={-6.4} width={31} height={12.8} rx={2.2} fill={tone('#4a2c2e')} {...S} />
        <rect x={-33} y={-6.4} width={31} height={12.8} rx={2.2} fill="url(#g2-rice)" opacity={0.45} />
        <path d="M-31 -4.4H-5" stroke="#fff" strokeWidth={0.7} opacity={0.3} />
        {marks([-26, -18, -10], 5.6, m * 0.6)}{dabArt(dk, -32, -3, 5)}{smoke}</g>
    )
    case 'onigiri': return (
      <g>
        <path d="M0 -8.6Q2 -8.6 8.6 2.4Q10 6.6 6.4 6.8H-6.4Q-10 6.6 -8.6 2.4Q-2 -8.6 0 -8.6Z" fill={tone('#f8f4ea')} />
        <path d="M0 -8.6Q2 -8.6 8.6 2.4Q10 6.6 6.4 6.8H-6.4Q-10 6.6 -8.6 2.4Q-2 -8.6 0 -8.6Z" fill="url(#g2-rice)" opacity={1 - smooth(0.8, 1.8, r) * 0.7} />
        {/* the net's marks, toasted in */}
        {m > 0.02 && <path d="M-5 -2L3 6M-1 -6L7 2M5 -2L-3 6M1 -6L-7 2" stroke="#3a1e0c" strokeWidth={1} opacity={m * 0.8} />}
        <rect x={-4.6} y={1.4} width={9.2} height={5.6} rx={0.8} fill="#1e2a1e" stroke={INK} strokeWidth={0.6} />
        <path d="M-3.4 2.6h6.8" stroke="#5a6a4a" strokeWidth={0.5} />
        <path d="M0 -8.6Q2 -8.6 8.6 2.4Q10 6.6 6.4 6.8H-6.4Q-10 6.6 -8.6 2.4Q-2 -8.6 0 -8.6Z" fill="none" {...S} />
        <path d="M-2.4 -5.6Q-4.6 -2.6 -5.6 0" stroke="#fff" strokeWidth={0.9} opacity={0.7} fill="none" strokeLinecap="round" />
        {dabArt(dk, -6, 6, 3.6)}{smoke}</g>
    )
    case 'mochi': {
      // a square of kirimochi, puffing up as it toasts, browned in spots
      const puff = smooth(0.55, 1.15, r)
      return (
        <g>
          <rect x={-7.6} y={-6.4} width={15.2} height={12.8} rx={2} fill={cooked('#f8f4ea', r * 0.75)} {...S} />
          {puff > 0.05 && <path d={`M${n1(-2 - puff * 2)} -5.6Q${n1(-3 - puff * 2)} ${n1(-6 - puff * 4)} 1 ${n1(-6 - puff * 4)}Q${n1(5 + puff * 2)} ${n1(-6 - puff * 4)} ${n1(4 + puff * 2)} -5.6Z`}
            fill="#fdfbf4" {...S} />}
          <path d="M-5.6 -4.4h8" stroke="#fff" strokeWidth={1} opacity={0.8} strokeLinecap="round" />
          {m > 0.02 && <g opacity={m}><ellipse cx={-3} cy={1} rx={2.4} ry={1.4} fill="#c88a4a" /><ellipse cx={3} cy={3} rx={1.8} ry={1.1} fill="#b8783a" />
            <path d="M-6 -1L-1 6M-2 -5L5 4M4 -5L7 -1" stroke="#5a3010" strokeWidth={0.7} opacity={0.6} /></g>}
          {dabArt(dk, -6, 6, 4)}{smoke}</g>
      )
    }
    case 'potato': case 'sweetpotato':
      if (foil) return (
        // crumpled foil, sooting over as it chars
        <g>
          <path d="M-11 1Q-12 -6 -5 -7.4Q0 -9.6 5 -7.4Q12 -6 11 1Q11 7.6 3 8Q-4 8.8 -9 6.4Q-11.6 4 -11 1Z" fill="url(#g2-foil)" {...S} />
          <path d="M-7 -3l4 2 3-3 4 2.4M-8 3l5-1 2 3 5-2M2 -6l1 4M-3 5l1-3" fill="none" stroke="#fff" strokeWidth={0.6} opacity={0.9} />
          <path d="M-6 -2l3 3M4 0l3-2M-1 3l3 2" fill="none" stroke="#7a8088" strokeWidth={0.5} />
          <path d="M3 -7.4q2-3 4.6-2.6l-1 2.4" fill="#d8dce0" stroke={INK} strokeWidth={0.6} />
          <path d="M-11 1Q-12 -6 -5 -7.4Q0 -9.6 5 -7.4Q12 -6 11 1Q11 7.6 3 8Q-4 8.8 -9 6.4Q-11.6 4 -11 1Z" fill="#2a1e18" opacity={smooth(0.8, CHAR_FULL, r) * 0.55} />
        </g>
      )
      return kind === 'potato' ? (
        // opened up: the potato split, a pat of butter melting in
        <g>
          <path d="M-12 2Q-12 -6 -5 -8L4 -8Q12 -6 12 2Q12 8 0 8.6Q-12 8 -12 2Z" fill="#d8dce0" stroke={INK} strokeWidth={0.7} />
          <ellipse rx={9} ry={6.4} fill={tone('#a8783a')} {...S} />
          <ellipse cy={-0.4} rx={7.4} ry={5} fill={tone('#f0d890')} />
          <path d="M-4 -2.4L4 1.6M4 -2.4L-4 1.6" stroke={tone('#c8a050')} strokeWidth={0.9} />
          <rect x={-2.4} y={-2.4} width={4.6} height={3.6} rx={0.8} fill="#fff2a0" stroke="#c8a040" strokeWidth={0.5} />
          {dabArt(dk, -6, 6, 3)}</g>
      ) : (
        // a sweet potato split open, gold inside its purple skin
        <g>
          <path d="M-12 0Q-8 -7 0 -7.2Q9 -7 12.4 0Q9 7 0 7.2Q-8 7 -12 0Z" fill={tone('#8a2a40')} {...S} />
          <path d="M-9 0Q-6 -4.6 0 -4.8Q6 -4.6 9.4 0Q6 4.6 0 4.8Q-6 4.6 -9 0Z" fill={tone('#f2b840')} />
          <path d="M-6 -1q3-2 6-1t6 1" fill="none" stroke="#fff3c0" strokeWidth={0.8} opacity={0.7} />
          <path d="M-7 1.8l2 .4M2 2.6l2-.2" stroke="#c88a20" strokeWidth={0.6} />
          {dabArt(dk, -6, 6, 3)}</g>
      )
    default: return (
      <g>{stick(-36)}
        {[-27, -16, -5].map((x, i) => <path key={x} d={CHUNK[i]} transform={`translate(${x} 0)`} fill={tone(fallback)} {...S} />)}
        {marks([-27, -16, -5], 5.4, m)}{dabArt(dk, -32, -2, 5)}{smoke}</g>
    )
  }
})

/** a skewered food's tag: a little paper slip tied to the stick's end, its name and a pill for how done */
export function Tag({ name, label, color, x, y }: { name?: string; label: string; color: string; x: number; y: number }) {
  const pw = label.length * 8 + 7
  const w = Math.max(pw + 4, name ? name.length * 9.6 + 6 : 0)
  const h = name ? 23 : 11
  return (
    <g transform={`translate(${n1(x - w / 2)} ${n1(y - h / 2)})`} className="g2-tagslip">
      <rect x={1} y={1.6} width={w} height={h} rx={2} fill={INK} opacity={0.3} />
      <rect width={w} height={h} rx={2} fill="#fbf4e2" stroke={INK} strokeWidth={0.8} />
      {name && <text x={w / 2} y={9.6} textAnchor="middle" className="g2-tag">{name}</text>}
      <rect x={(w - pw) / 2} y={name ? 12 : 1.5} width={pw} height={8.4} rx={4.2} fill={color} />
      <text x={w / 2} y={name ? 18.6 : 8.1} textAnchor="middle" className="g2-pill">{label}</text>
    </g>
  )
}

// ---- the drinks fridge

/** the fridge's shelves, top down: what's on each (as the 3D fridge has them, bottom up) */
const FRIDGE_ROWS: DrinkId[][] = [['beer', 'sake'], ['highball', 'beerCan'], ['cola', 'oolong'], ['coffee', 'greenTea'], ['yakult', 'yakult']]
/** the bright colours of each drink's bottle or can, and its label */
const DRINK_ART: Record<string, { body: string; label: string; cap: string }> = {
  beer: { body: '#8a4a12', label: '#f2c430', cap: '#e8c040' }, sake: { body: '#e8f4f8', label: '#e8202a', cap: '#d01818' },
  highball: { body: '#1c3a8a', label: '#f2c430', cap: '#c8ccd2' }, beerCan: { body: '#f2d02a', label: '#e8202a', cap: '#c8ccd2' },
  cola: { body: '#e8141c', label: '#ffffff', cap: '#c8ccd2' }, oolong: { body: '#b8601a', label: '#1a7a3a', cap: '#1a7a3a' },
  coffee: { body: '#5a2a10', label: '#f2a020', cap: '#c8ccd2' }, greenTea: { body: '#2aa040', label: '#ffffff', cap: '#c8ccd2' },
  yakult: { body: '#fff4e4', label: '#e8202a', cap: '#e8202a' }, ramune: { body: '#5ac8f0', label: '#1a5ab8', cap: '#1a5ab8' },
}
/**
 * The drinks fridge, beside the cook's table: a red-lacquered cabinet with a lit glass door, its sign glowing on top,
 * five shelves of bright bottles and cans standing in ranks, a gleam across the glass. The shelf of whatever a customer
 * has just taken lights up.
 */
export const Fridge = memo(function Fridge({ x, taken, lang }: { x: number; taken: DrinkId | null; lang: Lang }) {
  const w = 82, h = 212
  const top = 26, inH = h - 52
  const sh = inH / FRIDGE_ROWS.length
  return (
    <g transform={`translate(${x} 4)`}>
      {/* its shadow; the sign, lit, its glow round it */}
      <rect x={3} y={22} width={w} height={h - 20} rx={7} fill={INK} opacity={0.3} />
      <ellipse cx={w / 2} cy={9} rx={w * 0.62} ry={14} fill="url(#g2fr-halo)" />
      <rect x={6} y={0} width={w - 12} height={17} rx={4} fill="#e8202a" stroke={INK} strokeWidth={1.2} />
      <rect x={8} y={1.6} width={w - 16} height={5} rx={2.5} fill="#fff" opacity={0.28} />
      <text x={w / 2} y={12.6} textAnchor="middle" className="g2-fridge-sign">{tl(lang, '飲料', 'ドリンク', 'Drinks')}</text>
      {/* the cabinet: lacquer red, a chrome trim, and its lit inside */}
      <rect x={0} y={19} width={w} height={h - 19} rx={7} fill="url(#g2fr-body)" stroke={INK} strokeWidth={1.6} />
      <path d={`M4 ${h - 4}V26Q4 22 8 22H${w - 8}`} fill="none" stroke="#ff8a7a" strokeWidth={1} opacity={0.6} />
      <rect x={5} y={top - 1} width={w - 10} height={inH + 2} rx={3.5} fill="url(#g2fr-chrome)" stroke={INK} strokeWidth={0.8} />
      <rect x={7} y={top + 1} width={w - 14} height={inH - 2} rx={2} fill="url(#g2fr-in)" />
      {FRIDGE_ROWS.map((row, r) => {
        const y = top + 1 + r * sh
        const lit = !!taken && row.includes(taken)
        return (
          <g key={r}>
            {lit && <rect x={7} y={y} width={w - 14} height={sh - 2} fill="#fff2a0" opacity={0.85} />}
            {row.flatMap((id, half) => {
              const n = id === 'yakult' ? 4 : 3
              const art = DRINK_ART[id]
              const shape = DRINKS.find((d) => d.id === id)?.shape ?? 'bottle'
              const bw = shape === 'small' ? 5.6 : shape === 'can' ? 7 : 6.4
              const bh = shape === 'small' ? sh * 0.5 : shape === 'can' ? sh * 0.62 : sh * 0.66
              return Array.from({ length: n }, (_, k) => {
                const cx = 10 + half * ((w - 20) / 2) + (k + 0.5) * ((w - 20) / 2 / n)
                const by = y + sh - 3.4
                return (
                  <g key={`${half}${k}`}>
                    {shape === 'bottle' && <path d={`M${cx - 1.5} ${by - bh + 1}V${by - bh - 4}h3V${by - bh + 1}`} fill={art.body} stroke={INK} strokeWidth={0.5} />}
                    <rect x={cx - bw / 2} y={by - bh} width={bw} height={bh} rx={shape === 'can' ? 1 : 2.2} fill={art.body} stroke={INK} strokeWidth={0.6} />
                    <rect x={cx - bw / 2 + 0.3} y={by - bh * 0.62} width={bw - 0.6} height={bh * 0.3} fill={art.label} />
                    <rect x={cx - (shape === 'bottle' ? 1.7 : bw / 2)} y={by - bh - (shape === 'bottle' ? 5.4 : 1.4)} width={shape === 'bottle' ? 3.4 : bw}
                      height={1.7} rx={0.5} fill={art.cap} stroke={INK} strokeWidth={0.3} />
                    <rect x={cx - bw / 2 + 0.9} y={by - bh + 1} width={1.1} height={bh - 2} rx={0.5} fill="#fff" opacity={0.5} />
                    <rect x={cx + bw / 2 - 1.4} y={by - bh + 1} width={0.8} height={bh - 2} fill={INK} opacity={0.18} />
                  </g>
                )
              })
            })}
            <rect x={7} y={y + sh - 3.4} width={w - 14} height={2.6} fill="#a8b4bc" />
            <rect x={7} y={y + sh - 3.4} width={w - 14} height={0.8} fill="#fff" opacity={0.7} />
          </g>
        )
      })}
      {/* the glass: a gleam across it, its frame, the long chrome handle */}
      <rect x={7} y={top + 1} width={w - 14} height={inH - 2} rx={2} fill="url(#g2fr-gleam)" />
      <rect x={6} y={top} width={w - 12} height={inH} rx={3} fill="none" stroke="#2a2c30" strokeWidth={2.2} />
      <rect x={w - 12.5} y={top + 40} width={3.4} height={64} rx={1.7} fill="url(#g2fr-chrome)" stroke={INK} strokeWidth={0.6} />
      {/* the grille at its foot, and its feet */}
      <rect x={9} y={h - 22} width={w - 18} height={14} rx={2} fill="#4a0e0a" stroke={INK} strokeWidth={0.7} />
      {[0, 1, 2].map((k) => <rect key={k} x={12} y={h - 19.5 + k * 3.8} width={w - 24} height={1.5} rx={0.7} fill="#1a0806" />)}
    </g>
  )
})

/** each seasoning's little picture on its chip */
export function ToolIcon({ k }: { k: string }) {
  const s = { stroke: INK, strokeWidth: 1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const body: Record<string, ReactNode> = {
    // a pinch of salt over a tiny dish
    salt: <><ellipse cx="10" cy="15" rx="6.5" ry="2.6" fill="#e8eef4" {...s} /><path d="M6.5 14.4q3.5-4.4 7 0z" fill="#fff" {...s} />
      <circle cx="9" cy="6" r=".8" fill="#fff" stroke={INK} strokeWidth=".4" /><circle cx="11.6" cy="8.4" r=".7" fill="#fff" stroke={INK} strokeWidth=".4" /><circle cx="8.6" cy="9.8" r=".6" fill="#fff" stroke={INK} strokeWidth=".4" /></>,
    // the soy brush (刷毛), dark with it
    soy: <><path d="M15.5 3.5l-6 7" stroke={INK} strokeWidth="3.2" strokeLinecap="round" /><path d="M15.5 3.5l-6 7" stroke="#c89a5a" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.6 10.4l-4.8 5.4 1.6 1.6 5-4.6z" fill="#5a2a10" {...s} /><path d="M4.8 15.8q-1 1.8 .4 2.4" fill="none" stroke="#5a2a10" strokeWidth="1.2" /></>,
    // the tube of condensed milk, squeezed
    milk: <><path d="M5 4h7l2 9H7z" fill="#f4f0e4" {...s} /><path d="M5.6 7h6.6" stroke="#2f5a9a" strokeWidth="1.6" /><path d="M8 13h4v2.4H8z" fill="#c8ccd2" {...s} />
      <path d="M10 15.4q0 2 -1.4 2.6" fill="none" stroke="#fff2d0" strokeWidth="1.8" /></>,
    // a little bowl of the powder
    peanut: <><path d="M3.5 10h13q-1 6-6.5 6t-6.5-6z" fill="#7a3a22" {...s} /><path d="M4.2 10q5.8-4.6 11.6 0z" fill="#e0b46a" {...s} />
      <circle cx="8" cy="8.6" r=".5" fill="#a87a3a" /><circle cx="11.4" cy="8.2" r=".5" fill="#a87a3a" /></>,
    // a wooden spoonful of miso
    miso: <><path d="M13 9l5.4-5.4" stroke={INK} strokeWidth="3" strokeLinecap="round" /><path d="M13 9l5.4-5.4" stroke="#d8b078" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="8.6" cy="12" rx="6" ry="4.4" fill="#d8b078" {...s} transform="rotate(-40 8.6 12)" /><circle cx="8.4" cy="12.2" r="3.2" fill="#a8662a" {...s} /></>,
    // a dollop of wasabi on a leaf
    wasabi: <><path d="M2.5 15Q6 5 17.5 4.5Q15 15 2.5 15z" fill="#4a8a3a" {...s} /><path d="M4 13.6L15 6" stroke="#2a5a22" strokeWidth=".6" />
      <path d="M7 12q-.6-4 3-4.6 3.4.6 2.6 4.6z" fill="#9ac85a" {...s} /><circle cx="9.2" cy="9.2" r=".7" fill="#fff" opacity=".8" /></>,
    // the gourd-shaped shichimi shaker
    shichimi: <><circle cx="10" cy="13" r="4.8" fill="#c4302a" {...s} /><circle cx="10" cy="6.6" r="3" fill="#c4302a" {...s} /><rect x="8.4" y="2" width="3.2" height="2.2" rx=".6" fill="#3a2414" {...s} />
      <path d="M8 12.2q2-1.4 4 0" stroke="#f2c430" strokeWidth="1" fill="none" /><circle cx="8.4" cy="11" r=".7" fill="#fff" opacity=".6" /></>,
    // a yuzu, its leaf, and the paste
    yuzu: <><circle cx="10" cy="11" r="6" fill="#e8d040" {...s} /><path d="M10 5q2-3 5.4-2.6-1.4 3.4-5.4 2.6z" fill="#4a8a3a" {...s} />
      <circle cx="7.6" cy="9" r="1" fill="#fff" opacity=".6" /><circle cx="12.6" cy="13.4" r="1.6" fill="#8aa83a" stroke={INK} strokeWidth=".5" /></>,
    // a wedge of lemon
    lemon: <><path d="M2.6 13A7.6 7.6 0 0 1 17.4 13z" fill="#f2e04a" {...s} /><path d="M4.6 12.4A5.6 5.6 0 0 1 15.4 12.4z" fill="#fbf2a0" stroke="#e8c830" strokeWidth=".6" />
      <path d="M10 12.4V7.2M10 12.4l-3.6-3.4M10 12.4l3.6-3.4" stroke="#e8c830" strokeWidth=".7" /></>,
    // a drop of water
    water: <><path d="M10 2.6Q15.4 9.6 15.4 12.4a5.4 5.4 0 0 1-10.8 0Q4.6 9.6 10 2.6z" fill="#8ad0f0" {...s} /><path d="M7.4 11.4q0 2.4 2 3" fill="none" stroke="#fff" strokeWidth="1.1" /></>,
  }
  return <svg className="g2-tool-icon" viewBox="0 0 20 20" aria-hidden="true">{body[k]}</svg>
}
