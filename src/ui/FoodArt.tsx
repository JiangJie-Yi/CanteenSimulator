import { memo, useId } from 'react'

/*
 * A food's picture for the pantry: a hand-inked illustration in SVG, drawn the way the workers' faces are (ui/Avatar). Flat colours,
 * cel-shaded: each form lit from the top left, its shade one crisp darker shape and its light a clean white highlight; one ink line round the
 * outside only, the details inside drawn in a deeper tone of their own colour, so nothing looks heavy; no shadow under it. Drawn on a
 * 128-unit square for fine lines and smooth curves. On a round tile tinted by where it's kept (the faces' faint dashed ring), or cropped close
 * across a card's band. And each has what makes it itself: a fish its curved fins and their rays, a soft scale pattern along its back, the
 * gill cover, a bright eye and its own markings; a fillet its flakes and skin; the corn its kernels, the shiitake its cross cut, the squid its
 * scoring...
 */
const INK = '#3b2a20'
/** the ink line round the outside, and the lines inside, on the 128 square */
const OUT = 2.4
const IN = 1.3
/** a colour a little lighter (k > 0) or darker (k < 0), as ui/Avatar shades */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

/** a fin on the back or the belly: from `a` to `b` along the body (0 the snout, 1 the tail's root), `h` its height (in the body's half
 * depth); `spiny`: the front dorsal of a mackerel or a horse mackerel, its spines' tips standing clear of the web between them */
type Fin = { a: number; b: number; h: number; spiny?: boolean }
type Fish = {
  back: string; belly: string; fin: string; len: number; deep: number
  /** where the body's deepest (0 snout, 1 tail root), how full the belly, how thin the tail's root (in half depths) */
  peak?: number; full?: number; ped?: number
  iris?: string; eye?: number
  /** the fins: dorsal ones, anal, whether there's a little adipose fin, finlets before the tail; the tail's fork (0 square, 1 deep) */
  dorsal: Fin[]; anal?: Fin; adipose?: boolean; finlets?: number; fork?: number; tailFin?: string
  /** markings */
  spot?: string; stripe?: string; bars?: string; zigzag?: string; dots?: string; scutes?: boolean; speckle?: string; roe?: boolean
  beak?: string; big?: boolean
  fillet?: { flesh: string; skin: string; line: string; kind: 'salmon' | 'cod' }
}
const FISH: Record<string, Fish> = {
  // (ayu: slender and olive, the golden spot behind the gill, a tall dorsal and a little adipose fin, its fins yellowed)
  ExtraFish: { back: '#5f8460', belly: '#f0ecd4', fin: '#dcc277', len: 1, deep: 0.3, peak: 0.36, full: 0.92, ped: 0.3, iris: '#e8c45a',
    dorsal: [{ a: 0.34, b: 0.56, h: 0.95 }], anal: { a: 0.64, b: 0.8, h: 0.5 }, adipose: true, fork: 0.5, spot: '#f2c34a' },
  // (saury: long and slim as a blade, blue over silver, the yellow tip of its jaw, its small fins far back and the finlets before the tail)
  Saury: { back: '#24508c', belly: '#eef2f8', fin: '#8aa2c0', len: 1.32, deep: 0.15, peak: 0.45, full: 0.95, ped: 0.38, iris: '#dfe3ea',
    dorsal: [{ a: 0.72, b: 0.81, h: 0.9 }], anal: { a: 0.7, b: 0.8, h: 0.8 }, finlets: 5, fork: 0.85, beak: '#f2b43a' },
  // (mackerel: a spindle, blue-green with dark wavy bars over the back, two dorsals, finlets, a deep fork)
  Mackerel: { back: '#2b6d76', belly: '#eef2f1', fin: '#8fb0b0', len: 1.05, deep: 0.27, peak: 0.42, full: 0.95, ped: 0.24, iris: '#dde0e2',
    dorsal: [{ a: 0.3, b: 0.43, h: 0.75, spiny: true }, { a: 0.6, b: 0.7, h: 0.55 }], anal: { a: 0.62, b: 0.71, h: 0.5 }, finlets: 5, fork: 0.8, zigzag: '#163e44' },
  // (horse mackerel: the row of bony scutes down its rear flank, a big eye, its fins yellowed)
  Aji: { back: '#5c7b8a', belly: '#f1f2ec', fin: '#d4c88e', len: 0.96, deep: 0.33, peak: 0.4, full: 1, ped: 0.22, iris: '#ead07a', eye: 1.25,
    dorsal: [{ a: 0.3, b: 0.42, h: 0.8, spiny: true }, { a: 0.46, b: 0.84, h: 0.45 }], anal: { a: 0.56, b: 0.84, h: 0.42 }, fork: 0.75, scutes: true, stripe: '#e8c45a' },
  // (sardine: blue over silver, a row of dark spots along its side, one small dorsal)
  Iwashi: { back: '#2f5590', belly: '#f2f5f8', fin: '#9fb3cb', len: 0.9, deep: 0.27, peak: 0.4, full: 0.95, ped: 0.26, iris: '#dde2ea',
    dorsal: [{ a: 0.42, b: 0.55, h: 0.75 }], anal: { a: 0.74, b: 0.85, h: 0.4 }, fork: 0.7, dots: '#1a2a48' },
  // (shishamo: slim and sandy, freckled, its belly full of roe showing through)
  Shishamo: { back: '#a28c5e', belly: '#f6e8c8', fin: '#d8c8a0', len: 0.86, deep: 0.26, peak: 0.45, full: 1.12, ped: 0.3, iris: '#dcca92',
    dorsal: [{ a: 0.4, b: 0.53, h: 0.75 }], anal: { a: 0.66, b: 0.82, h: 0.5 }, adipose: true, fork: 0.45, speckle: '#6a5636', roe: true },
  // (atka mackerel: dark bars across a brown back, a long dorsal down most of it)
  Hokke: { back: '#7e6d50', belly: '#f2e9d4', fin: '#bca67e', len: 1, deep: 0.33, peak: 0.38, full: 0.95, ped: 0.28, iris: '#dcca92',
    dorsal: [{ a: 0.24, b: 0.86, h: 0.55 }], anal: { a: 0.52, b: 0.86, h: 0.45 }, fork: 0.45, bars: '#4f4029' },
  // (yellowtail: a torpedo, blue over silver, the yellow stripe from eye to tail and a yellow tail)
  Buri: { back: '#31557c', belly: '#f1f3f2', fin: '#dcc25c', len: 1.05, deep: 0.31, peak: 0.42, full: 0.95, ped: 0.2, iris: '#dde0e2',
    dorsal: [{ a: 0.3, b: 0.4, h: 0.45, spiny: true }, { a: 0.44, b: 0.72, h: 0.55 }], anal: { a: 0.58, b: 0.74, h: 0.42 }, fork: 0.85,
    stripe: '#efc83c', tailFin: '#e8c43c' },
  // (blackthroat seaperch: rose red, deep in the body, its great eye)
  Nodoguro: { back: '#d4433a', belly: '#f8d3c4', fin: '#cf4636', len: 0.95, deep: 0.38, peak: 0.35, full: 1, ped: 0.32, iris: '#f0d27a', eye: 1.6, big: true,
    dorsal: [{ a: 0.28, b: 0.5, h: 0.75, spiny: true }, { a: 0.52, b: 0.74, h: 0.6 }], anal: { a: 0.6, b: 0.76, h: 0.5 }, fork: 0.25 },
  Salmon: { back: '', belly: '', fin: '', len: 1, deep: 0.5, dorsal: [], fillet: { flesh: '#f7926a', skin: '#8f9ea8', line: '#fde4d4', kind: 'salmon' } },
  Gindara: { back: '', belly: '', fin: '', len: 1, deep: 0.5, dorsal: [], fillet: { flesh: '#fbf5ea', skin: '#2d2d36', line: '#e8dbc2', kind: 'cod' } },
}

const ground = (store: string) => (store === 'frozen' ? ['#d6ecfb', '#9ec8ea'] : store === 'ambient' ? ['#fbecd2', '#e8c58e'] : ['#def4e8', '#a6d6b8'])

/** a smooth line through points (Catmull-Rom, as cubic curves) */
function smoothPath(pts: [number, number][], move = true) {
  let d = move ? `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}` : ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

/** a whole fish's frame on the 128 square: its body from x0 (the snout) to x1 (the tail's root), H its half depth, the tail's reach beyond */
function fishParts(f: Fish) {
  const Lb = 76 * f.len, H = 44 * f.deep, cy = 64
  const x0 = 64 - Lb * 0.56, x1 = x0 + Lb
  const tail = Math.max(H * 1.1, 13) * (0.9 + (f.fork ?? 0.5) * 0.3)
  return { Lb, H, cy, x0, x1, tail, T: Math.max(H * 1.05, 11) }
}

function FishArt({ f, u }: { f: Fish; u: string }) {
  const { Lb, H, cy, x0, x1, tail, T } = fishParts(f)
  const X = (k: number) => x0 + Lb * k
  const Y = (k: number) => cy + H * k
  const P = (x: number, y: number): [number, number] => [X(x), Y(y)]
  const peak = f.peak ?? 0.4, full = f.full ?? 1, ped = f.ped ?? 0.26
  const finDark = shade(f.fin, -0.3), finLight = shade(f.fin, 0.4)
  const tailC = f.tailFin ?? f.fin
  // (the body: the snout, the forehead rising to the back's highest, tapering to the tail's root; the belly fuller, round with roe)
  const upper: [number, number][] = [P(0, 0.06), P(0.035, -0.32), P(0.14, -0.78), P(peak, -1), P(0.66, -0.84), P(0.84, -0.46), P(0.95, -ped * 1.05), P(1, -ped)]
  const lower: [number, number][] = [P(1, ped), P(0.95, ped * 1.05), P(0.82, full * 0.55), P(Math.min(0.62, peak + 0.16), full), P(0.26, full * 0.88), P(0.08, 0.6), P(0, 0.06)]
  const body = `${smoothPath(upper)} L${lower[0][0].toFixed(2)} ${lower[0][1].toFixed(2)}${smoothPath(lower, false)} Z`
  // (the back's dark over the pale belly: a little wave in the line between them, lower toward the head)
  const split = smoothPath([P(-0.05, 0.12), P(0.25, -0.02), P(0.55, 0.02), P(0.8, -0.02), P(1.05, 0)])
  const backD = `${split} L${X(1.05)} ${Y(-1.6)} L${X(-0.05)} ${Y(-1.6)} Z`
  const er = Math.max(3.2, H * 0.21) * (f.eye ?? 1), ex = X(0.105), ey = Y(-0.2)
  const fin = (g: Fin, top: boolean) => {
    const s = top ? -1 : 1
    const baseY = (x: number) => (top ? -1 : full) * (x < peak ? 1 - ((peak - x) / peak) ** 2 * 0.7 : 1 - ((x - peak) / (1 - peak)) ** 1.6 * (1 - ped / (top ? 1 : full)))
    const a = g.a, b = g.b, m = a + (b - a) * (g.spiny ? 0.3 : 0.42)
    const tip = (x: number) => Y(s * Math.abs(baseY(x)) + s * g.h * (1 - Math.abs((x - m) / (b - a)) * 0.4))
    const pts: [number, number][] = g.spiny
      ? [[X(a), Y(baseY(a) * 1)], ...Array.from({ length: 5 }, (_, k): [number, number][] => {
          const x = a + ((b - a) * (k + 0.5)) / 5.5
          return [[X(x), tip(x)], [X(x + (b - a) / 11), Y(baseY(x) + s * g.h * 0.45)]]
        }).flat(), [X(b), Y(baseY(b))]]
      : [[X(a), Y(baseY(a))], [X(a + (b - a) * 0.12), tip(a + (b - a) * 0.12)], [X(m), tip(m) + s * 1.5], [X(b - (b - a) * 0.08), Y(baseY(b) + s * g.h * 0.35)], [X(b), Y(baseY(b))]]
    const d = g.spiny ? `M${pts.map((q) => q.map((v) => v.toFixed(2)).join(' ')).join(' L')} Z` : `${smoothPath(pts)} Z`
    const rays = Array.from({ length: Math.max(3, Math.round((b - a) * 22)) }, (_, k) => {
      const x = a + ((b - a) * (k + 0.6)) / (Math.max(3, Math.round((b - a) * 22)) + 0.4)
      return <path key={k} d={`M${X(x)} ${Y(baseY(x))} L${X(x + 0.02)} ${tip(x) - s * 1.2}`} stroke={finDark} strokeWidth="0.7" opacity="0.6" />
    })
    return (
      <g>
        <path d={d} fill={top ? f.fin : shade(f.fin, 0.12)} fillOpacity={0.92} stroke={INK} strokeWidth={OUT * 0.8} strokeLinejoin="round" />
        {rays}
      </g>
    )
  }
  // (finlets: a row of little fins before the tail, top and bottom)
  const finlets = f.finlets ? Array.from({ length: f.finlets }, (_, k) => {
    const x = 0.8 + (k * 0.15) / f.finlets!
    const w = 0.022
    const yt = Y(-Math.max(ped, 0.46 - k * 0.04) - 0.02), yb = Y(Math.max(ped, 0.46 - k * 0.04) + 0.02)
    return (
      <g key={k}>
        <path d={`M${X(x)} ${yt + 1} L${X(x + w * 1.6)} ${yt - H * 0.32} L${X(x + w)} ${yt + 1} Z`} fill={f.fin} stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
        <path d={`M${X(x)} ${yb - 1} L${X(x + w * 1.6)} ${yb + H * 0.32} L${X(x + w)} ${yb - 1} Z`} fill={f.fin} stroke={INK} strokeWidth="0.9" strokeLinejoin="round" />
      </g>
    )
  }) : null
  // (the tail: two lobes, forked as deep as the fish's own, its rays fanning out)
  const fk = f.fork ?? 0.5
  const tailD = `M${x1 - 2} ${Y(-ped * 0.9)} C${x1 + tail * 0.3} ${Y(-ped * 1.2)} ${x1 + tail * 0.7} ${cy - T * 0.8} ${x1 + tail} ${cy - T}
    C${x1 + tail * (1 - fk * 0.45)} ${cy - T * 0.45} ${x1 + tail * (1 - fk * 0.6)} ${cy - T * 0.12} ${x1 + tail * (1 - fk * 0.62)} ${cy}
    C${x1 + tail * (1 - fk * 0.6)} ${cy + T * 0.12} ${x1 + tail * (1 - fk * 0.45)} ${cy + T * 0.45} ${x1 + tail} ${cy + T}
    C${x1 + tail * 0.7} ${cy + T * 0.8} ${x1 + tail * 0.3} ${Y(ped * 1.2)} ${x1 - 2} ${Y(ped * 0.9)} Z`
  return (
    <g>
      <defs>
        <clipPath id={`${u}c`}><path d={body} /></clipPath>
        {/* (the flank's sheen, darker toward the back, a bright band along the middle, the belly pale) */}
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(f.back, -0.18)} />
          <stop offset="0.55" stopColor={f.back} />
          <stop offset="1" stopColor={shade(f.back, 0.18)} />
        </linearGradient>
        <linearGradient id={`${u}t`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(tailC, -0.1)} />
          <stop offset="1" stopColor={shade(tailC, 0.25)} />
        </linearGradient>
        <pattern id={`${u}s`} width="5" height="4.2" patternUnits="userSpaceOnUse">
          <path d="M0 4.2 A2.5 2.5 0 0 1 5 4.2 M-2.5 2.1 A2.5 2.5 0 0 1 2.5 2.1 M2.5 2.1 A2.5 2.5 0 0 1 7.5 2.1" fill="none" stroke={shade(f.back, 0.5)} strokeWidth="0.55" />
        </pattern>
      </defs>
      {/* the fins behind the body: tail, dorsal(s), anal, the pelvic under the middle, an adipose before the tail */}
      <path d={tailD} fill={`url(#${u}t)`} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {[-0.82, -0.55, -0.28, 0, 0.28, 0.55, 0.82].map((k) => <path key={k} d={`M${x1 + 1} ${cy + k * H * ped} Q${x1 + tail * 0.45} ${cy + k * T * 0.45} ${x1 + tail * (0.86 - (1 - Math.abs(k)) * fk * 0.5)} ${cy + k * T * 0.95}`} fill="none" stroke={shade(tailC, -0.32)} strokeWidth="0.75" opacity="0.65" />)}
      {f.dorsal.map((g, k) => <g key={k}>{fin(g, true)}</g>)}
      {f.anal && fin(f.anal, false)}
      <path d={`M${X(0.4)} ${Y(full * 0.94)} Q${X(0.44)} ${Y(full * 1.42)} ${X(0.56)} ${Y(full * 1.36)} Q${X(0.52)} ${Y(full * 1.06)} ${X(0.52)} ${Y(full * 0.9)} Z`} fill={shade(f.fin, 0.12)} stroke={INK} strokeWidth={OUT * 0.75} strokeLinejoin="round" />
      {f.adipose && <path d={`M${X(0.8)} ${Y(-0.5)} C${X(0.81)} ${Y(-0.82)} ${X(0.86)} ${Y(-0.82)} ${X(0.87)} ${Y(-0.42)} Z`} fill={f.fin} stroke={INK} strokeWidth={OUT * 0.75} strokeLinejoin="round" />}
      {finlets}
      {/* the body: the pale belly, the back's sheen over it, the scales along the back, the markings; its shade below, its light above */}
      <path d={body} fill={f.belly} />
      <g clipPath={`url(#${u}c)`}>
        {f.roe && <ellipse cx={X(0.55)} cy={Y(full * 0.62)} rx={Lb * 0.24} ry={H * 0.4} fill="#f6b878" opacity="0.6" />}
        <path d={backD} fill={`url(#${u}b)`} />
        <path d={backD} fill={`url(#${u}s)`} opacity="0.45" />
        {/* (a silver line where the back meets the belly) */}
        <path d={split} fill="none" stroke="#fff" strokeWidth="1.1" opacity="0.5" />
        {f.zigzag && [0.26, 0.36, 0.46, 0.56, 0.66, 0.76, 0.86].map((t) => <path key={t} d={`M${X(t)} ${Y(-1.05)} l${Lb * 0.03} ${H * 0.25} l${-Lb * 0.035} ${H * 0.22} l${Lb * 0.035} ${H * 0.24} l${-Lb * 0.02} ${H * 0.2}`} fill="none" stroke={f.zigzag} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />)}
        {f.bars && [0.3, 0.44, 0.58, 0.72, 0.86].map((t) => <path key={t} d={`M${X(t)} ${Y(-1.1)} C${X(t + 0.03)} ${Y(-0.5)} ${X(t - 0.02)} ${Y(0)} ${X(t + 0.01)} ${Y(0.35)}`} fill="none" stroke={f.bars} strokeWidth={Math.max(2.4, H * 0.22)} strokeLinecap="round" opacity="0.55" />)}
        {f.speckle && Array.from({ length: 26 }, (_, k) => <circle key={k} cx={X(0.2 + ((k * 37) % 70) / 100)} cy={Y(-0.9 + ((k * 53) % 60) / 100)} r="0.8" fill={f.speckle} opacity="0.55" />)}
        {f.stripe && <path d={smoothPath([P(0.12, -0.14), P(0.4, -0.2), P(0.7, -0.1), P(1.02, 0)])} fill="none" stroke={f.stripe} strokeWidth={Math.max(2.2, H * 0.17)} strokeLinecap="round" opacity="0.9" />}
        {/* (the shade along the underside, crisp; the light along the back, a long gleam) */}
        <path d={`${smoothPath([P(-0.05, 0.62), P(0.3, 0.8), P(0.7, 0.62), P(1.05, ped * 0.6)])} L${X(1.05)} ${Y(1.8)} L${X(-0.05)} ${Y(1.8)} Z`} fill={shade(f.belly, -0.16)} />
        <path d={smoothPath([P(0.2, -0.62), P(0.45, -0.72), P(0.7, -0.55), P(0.9, -0.3)])} fill="none" stroke="#fff" strokeWidth={Math.max(2.2, H * 0.17)} strokeLinecap="round" opacity="0.42" />
        {/* (the head a touch darker, the gill cover's edge curving down behind the eye, the gill slit behind it) */}
        <path d={`M${X(-0.05)} ${Y(-1.4)} L${X(0.22)} ${Y(-1.4)} C${X(0.27)} ${Y(-0.4)} ${X(0.27)} ${Y(0.4)} ${X(0.2)} ${Y(1.4)} L${X(-0.05)} ${Y(1.4)} Z`} fill="#000" opacity="0.07" />
      </g>
      <path d={smoothPath([P(0.21, -0.66), P(0.255, -0.2), P(0.25, 0.25), P(0.2, 0.66)])} fill="none" stroke={shade(f.back, -0.4)} strokeWidth={IN} strokeLinecap="round" />
      <path d={smoothPath([P(0.235, -0.52), P(0.275, -0.1), P(0.265, 0.3)])} fill="none" stroke="#c4586a" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      {/* lateral line; a horse mackerel's scutes along its rear; a sardine's spots; the ayu's golden spot */}
      <path d={smoothPath([P(0.27, -0.42), P(0.55, -0.4), P(0.82, -0.18), P(1, 0)])} fill="none" stroke={shade(f.back, -0.3)} strokeWidth="0.8" opacity="0.55" />
      {f.scutes && Array.from({ length: 9 }, (_, k) => { const t = 0.56 + k * 0.05; return <path key={k} d={`M${X(t)} ${Y(-0.3 + (t - 0.56) * 0.7)} l${Lb * 0.022} ${-H * 0.09} l${Lb * 0.022} ${H * 0.09}`} fill="none" stroke={shade(f.back, -0.35)} strokeWidth="1" strokeLinejoin="round" /> })}
      {f.dots && [0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82].map((t, k) => <circle key={t} cx={X(t)} cy={Y(-0.22 + k * 0.02)} r={Math.max(1.5, H * 0.1)} fill={f.dots} />)}
      {f.spot && <ellipse cx={X(0.34)} cy={Y(-0.3)} rx={Lb * 0.05} ry={H * 0.2} fill={f.spot} stroke={shade(f.spot, -0.3)} strokeWidth="0.8" />}
      {/* the outline over it all */}
      <path d={body} fill="none" stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {/* the pectoral fin behind the gill cover, laid back along the flank, see-through */}
      <path d={`M${X(0.27)} ${Y(0.12)} C${X(0.33)} ${Y(-0.1)} ${X(0.45)} ${Y(-0.06)} ${X(0.47)} ${Y(0.1)} C${X(0.44)} ${Y(0.3)} ${X(0.34)} ${Y(0.36)} ${X(0.27)} ${Y(0.12)} Z`}
        fill={finLight} fillOpacity="0.8" stroke={finDark} strokeWidth={IN} strokeLinejoin="round" />
      {[0.0, 0.1, 0.2].map((t) => <path key={t} d={`M${X(0.285)} ${Y(0.12)} L${X(0.45)} ${Y(t)}`} stroke={finDark} strokeWidth="0.65" opacity="0.7" />)}
      {/* the mouth, a saury's yellow jaw-tip, a seaperch's big mouth */}
      {f.beak && <path d={`M${X(0.01)} ${Y(0.02)} L${X(-0.09)} ${Y(0.2)} L${X(0.02)} ${Y(0.36)} Z`} fill={f.beak} stroke={INK} strokeWidth={IN} strokeLinejoin="round" />}
      <path d={`M${X(0.004)} ${Y(0.14)} q${Lb * (f.big ? 0.07 : 0.045)} ${H * 0.1} ${Lb * (f.big ? 0.1 : 0.07)} ${-H * 0.02}`} fill="none" stroke={INK} strokeWidth={IN} strokeLinecap="round" />
      {/* the eye: a pale ring, the iris, the dark pupil, the light caught twice */}
      <circle cx={ex} cy={ey} r={er} fill="#fbf6e8" stroke={INK} strokeWidth={IN} />
      <circle cx={ex + er * 0.05} cy={ey + er * 0.04} r={er * 0.74} fill={f.iris ?? '#d8dce0'} />
      <circle cx={ex + er * 0.08} cy={ey + er * 0.06} r={er * 0.47} fill="#1c1612" />
      <circle cx={ex - er * 0.2} cy={ey - er * 0.24} r={er * 0.22} fill="#fff" />
      <circle cx={ex + er * 0.3} cy={ey + er * 0.3} r={er * 0.1} fill="#fff" />
    </g>
  )
}

/** a fillet (切り身): a thick slab seen from above and a little in front, its cut face lit, its flesh's grain (a salmon's white fat in
 * chevrons, a cod's flakes), its skin a band along the back, its thickness below */
function FilletArt({ f, u }: { f: NonNullable<Fish['fillet']>; u: string }) {
  // (a steak cut across the fish (the owner's: rounder and thicker, the fat in white arcs): its outline full and soft, the belly's edge
  // a soft curve at the front; seen from a little in front, its thickness a band below)
  const top = 'M16 58 C14 40 36 28 64 28 C94 28 114 42 112 60 C111 72 100 80 84 81 C76 82 70 82 64 82 C58 82 52 82 44 81 C28 80 17 72 16 58 Z'
  const side = 'M16 58 C16 74 28 90 44 90 C54 90 59 91 64 91 C69 91 76 90 84 90 C102 90 112 79 112 66 L112 60 C111 72 100 80 84 81 C76 82 70 82 64 82 C58 82 52 82 44 81 C28 80 17 72 16 58 Z'
  // (the backbone's place, a little above the middle: the flesh's arcs round it, wider out to the skin)
  const bx = 64, by = 50
  const grain = f.kind === 'salmon'
    ? [12, 20, 28, 36, 44, 52].map((r, k) => <path key={r} d={`M${bx - r * 1.25} ${by + r * 0.55} C${bx - r * 1.3} ${by - r * 0.9} ${bx + r * 1.3} ${by - r * 0.9} ${bx + r * 1.25} ${by + r * 0.55}`} fill="none" stroke={f.line} strokeWidth={k < 2 ? 2 : 2.6} strokeLinecap="round" />)
    : [12, 22, 32, 42, 52].map((r) => <path key={r} d={`M${bx - r * 1.2} ${by + r * 0.5} C${bx - r * 1.2} ${by - r * 0.8} ${bx + r * 1.2} ${by - r * 0.8} ${bx + r * 1.2} ${by + r * 0.5}`} fill="none" stroke={f.line} strokeWidth="1.4" strokeLinecap="round" strokeDasharray="6 3" />)
  return (
    <g>
      <defs>
        <clipPath id={`${u}k`}><path d={top} /></clipPath>
        <radialGradient id={`${u}f`} cx="48%" cy="36%" r="72%"><stop offset="0" stopColor={shade(f.flesh, 0.22)} /><stop offset="0.6" stopColor={f.flesh} /><stop offset="1" stopColor={shade(f.flesh, -0.1)} /></radialGradient>
        <linearGradient id={`${u}d`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(f.flesh, -0.14)} /><stop offset="1" stopColor={shade(f.flesh, -0.34)} /></linearGradient>
      </defs>
      {/* (its thickness, the side below the face, the flesh's layers showing on it) */}
      <path d={side} fill={`url(#${u}d)`} stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
      {[28, 40, 52, 76, 88, 100].map((x) => <path key={x} d={`M${x} ${81 - Math.abs(x - 64) * 0.04} l1 7`} stroke={shade(f.line, -0.08)} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />)}
      <path d={top} fill={`url(#${u}f)`} />
      <g clipPath={`url(#${u}k)`}>
        {grain}
        {/* (the dark meat along the skin, the skin round the back (a cod's black, a salmon's silver), the backbone's little round) */}
        <path d="M8 62 C14 44 40 37 64 37 C90 37 116 45 120 62 L114 62 C108 50 90 42 64 42 C38 42 20 50 14 62 Z" fill={f.kind === 'salmon' ? '#d8625a' : '#e8d8c0'} opacity="0.55" />
        <path d="M8 58 C14 40 40 34 64 34 C90 34 116 42 120 58 L120 8 L8 8 Z" fill={f.skin} />
        <path d="M14 56 C20 42 40 36.6 64 36.6 C88 36.6 110 42 115 54" fill="none" stroke={shade(f.skin, 0.45)} strokeWidth="1.2" />
        <circle cx={bx} cy={by} r="3.4" fill={shade(f.flesh, 0.35)} stroke={shade(f.line, -0.2)} strokeWidth="1" />
        {/* (the face's shade toward the front, its gleam across the top) */}
        <path d="M10 66 C40 86 88 86 118 62 L118 96 L10 96 Z" fill="#000" opacity="0.08" />
        <path d="M32 46 C44 38 64 36 84 39" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" opacity="0.55" />
        <path d="M38 55 C44 52 50 51 56 51" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      </g>
      <path d={top} fill="none" stroke={INK} strokeWidth={OUT} strokeLinejoin="round" />
    </g>
  )
}

/** the rest, each its own small picture, on the 128 square */
function OtherArt({ id }: { id: string }) {
  const o = { stroke: INK, strokeWidth: OUT, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const line = (c: string, w = IN) => ({ fill: 'none', stroke: c, strokeWidth: w, strokeLinecap: 'round' as const })
  const hi = (d: string, w = 3.4) => <path d={d} fill="none" stroke="#fff" strokeWidth={w} strokeLinecap="round" opacity="0.6" />
  /** a bamboo skewer from lower left to upper right */
  const skewer = <g><path d="M16 104 L112 26" stroke={INK} strokeWidth="6.4" strokeLinecap="round" /><path d="M16 104 L112 26" stroke="#e2bc7c" strokeWidth="3.6" strokeLinecap="round" /></g>
  switch (id) {
    case 'GrilledCorn':
      return <g transform="rotate(-30 64 64)">
        <path d="M64 14 C84 18 90 42 90 64 C90 88 78 106 64 110 C50 106 38 88 38 64 C38 42 44 18 64 14 Z" fill="#f7cf48" {...o} />
        <path d="M64 14 C74 16 80 30 82 46 C74 40 70 28 64 14 Z M90 64 C90 88 78 106 64 110 C74 100 84 84 86 64 Z" fill="#e3a72c" />
        {Array.from({ length: 9 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
          const y = 24 + r * 9.4, w = Math.sqrt(Math.max(0, 1 - ((y - 62) / 50) ** 2)) * 25
          const x = 64 - w + (c + 0.5) * (2 * w / 5)
          return w > 6 ? <rect key={`${r}${c}`} x={x - w / 5 + 0.8} y={y - 4} width={2 * w / 5 - 1.6} height="8" rx="3" fill="#fde07a" stroke="#c88e22" strokeWidth="0.9" /> : null
        }))}
        <path d="M44 96 C28 82 24 56 34 32 C40 56 48 82 62 108 Z" fill="#82b04e" {...o} />
        <path d="M84 98 C98 86 102 66 98 46 C92 66 84 84 72 106 Z" fill="#9cc466" {...o} />
        <path d="M40 92 C34 76 34 58 38 44" {...line('#5c8a34')} />
        {hi('M52 28 C48 38 47 50 48 60')}
      </g>
    case 'GrilledShiitake':
      return <g>
        <path d="M53 66 L50 104 Q64 112 78 104 L75 66 Z" fill="#f4e8d0" {...o} />
        <path d="M66 68 L67 106 Q73 106 78 104 L75 66 Z" fill="#dcc8a4" />
        <path d="M14 68 C14 26 114 26 114 68 C100 76 28 76 14 68 Z" fill="#8a5630" {...o} />
        <path d="M76 34 C98 38 112 52 114 68 C104 72 90 74 78 74 C88 62 88 46 76 34 Z" fill="#6e4224" />
        <path d="M20 70 C38 80 90 80 108 70 C96 84 32 84 20 70 Z" fill="#ead8b6" {...o} />
        {[28, 40, 52, 64, 76, 88, 100].map((x) => <path key={x} d={`M${x} 74 L${64 + (x - 64) * 0.55} 80`} {...line('#c4aa80', 1)} />)}
        <path d="M44 44 L84 60 M84 44 L44 60" {...line('#f6e8cc', 5)} />
        <path d="M44 44 L84 60 M84 44 L44 60" {...line('#c8a878', 1)} opacity="0.5" />
        {[[30, 56], [96, 54], [62, 36], [74, 66], [40, 64]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" fill="#e8d0a8" />)}
        {hi('M28 52 C32 42 42 36 52 34')}
      </g>
    case 'KingOyster':
      return <g>
        <path d="M44 56 C40 84 42 104 64 110 C86 104 88 84 84 56 Z" fill="#f8f0e0" {...o} />
        <path d="M68 58 C72 80 72 98 66 108 C82 102 86 84 84 56 Z" fill="#e2d2b2" />
        {[54, 62, 70, 78].map((x) => <path key={x} d={`M${x} 66 C${x - 2} 82 ${x} 94 ${x - 1} 104`} {...line('#d8c8a4', 1)} />)}
        <path d="M26 58 C26 32 102 32 102 58 C102 66 26 66 26 58 Z" fill="#a37a50" {...o} />
        <path d="M74 40 C92 44 102 50 102 58 C102 62 90 64 76 64 C84 56 82 46 74 40 Z" fill="#86603a" />
        {hi('M38 50 C44 42 56 38 66 38')}
      </g>
    case 'Onigiri':
      return <g>
        <path d="M64 14 C80 14 108 74 102 94 C98 106 30 106 26 94 C20 74 48 14 64 14 Z" fill="#fefdf8" {...o} />
        <path d="M80 30 C92 52 106 82 102 94 C100 100 90 104 80 104 C92 84 90 54 80 30 Z" fill="#ebe6d6" />
        {[[46, 42, 20], [62, 30, 70], [78, 48, 140], [54, 60, 10], [72, 66, 100], [42, 74, 50], [86, 72, 160], [60, 76, 30]].map(([x, y, a]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3.4" ry="1.7" transform={`rotate(${a} ${x} ${y})`} fill="none" stroke="#d4ccb6" strokeWidth="1" />
        ))}
        <path d="M36 76 H92 L94 104 Q64 108 34 104 Z" fill="#22302a" {...o} />
        {[42, 52, 62, 72, 82].map((x) => <path key={x} d={`M${x} 78 L${x + 2} 104`} {...line('#3a4c40', 1)} />)}
        <circle cx="64" cy="52" r="6" fill="#d04558" stroke={shade('#d04558', -0.3)} strokeWidth="1" />
        {hi('M50 30 C46 38 42 46 40 54')}
      </g>
    case 'RiceBag':
      // (the rice as it's bought: a 10 kg kraft-paper sack of polished rice, its top folded and stitched, the brand in a red frame, a few
      // grains spilt before it)
      return <g>
        <path d="M30 30 C28 52 26 84 30 108 C52 114 76 114 98 108 C102 84 100 52 98 30 Z" fill="#e8cfa0" {...o} />
        <path d="M80 32 C88 54 90 86 86 110 C92 110 96 109 98 108 C102 84 100 52 98 30 Z" fill="#d2b47e" />
        <path d="M28 20 H100 L98 32 H30 Z" fill="#d9bc86" {...o} />
        <path d="M32 26 H96" stroke="#8a6a3a" strokeWidth="1.6" strokeDasharray="3 3" />
        <rect x="42" y="44" width="44" height="46" rx="3" fill="#fbf6ea" stroke="#c0392b" strokeWidth="2.6" />
        <rect x="46" y="48" width="36" height="38" rx="2" fill="none" stroke="#c0392b" strokeWidth="1" />
        <text x="64" y="74" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1e1a16" fontFamily="serif">米</text>
        <circle cx="64" cy="58" r="3" fill="#c0392b" />
        {[[40, 112, 20], [52, 116, 70], [80, 115, 140], [92, 112, 30]].map(([x, y, a]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx="3.4" ry="1.7" transform={`rotate(${a} ${x} ${y})`} fill="#fffdf6" stroke="#cfc6ad" strokeWidth="0.8" />
        ))}
        {hi('M36 40 C34 56 34 74 36 92', 4)}
      </g>
    case 'ShrimpSkewer':
      // (a prawn grilled on its skewer (the owner's: its curve, its segments, a little charred): curled, its back's shell in banded
      // segments over the curve, deeper at their edges and toasted, its fanned tail, its legs under it, its long feelers)
      return <g>{skewer}
        <defs><linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffa274" /><stop offset="1" stopColor="#e2603a" /></linearGradient></defs>
        <path d="M30 90 C16 70 26 40 56 32 C82 26 102 42 98 62 C95 76 80 80 74 70 C71 63 77 58 82 61" fill="url(#shg)" {...o} />
        <path d="M30 90 C24 76 28 60 38 52 C44 66 52 76 64 80 C52 84 42 88 30 90 Z" fill="#c84e2a" />
        {[[40, 44, 52, 70], [52, 37, 62, 64], [64, 33, 72, 60], [76, 33, 82, 58], [87, 39, 88, 56]].map(([a, b, c, d]) => (
          <g key={a}><path d={`M${a} ${b} Q${(a + c) / 2 + 5} ${(b + d) / 2} ${c} ${d}`} {...line('#9a3416', 2.2)} /><path d={`M${a + 1.6} ${b + 0.6} Q${(a + c) / 2 + 6.6} ${(b + d) / 2} ${c + 1.6} ${d}`} {...line('#ffc49a', 1)} /></g>
        ))}
        <path d="M30 90 C24 96 14 100 10 108 C18 108 26 106 32 100 C34 104 36 108 40 110 C40 102 38 96 34 92 Z" fill="#ec6a40" {...o} />
        <path d="M18 104 L30 96 M32 98 L36 106" {...line('#a8401e', 1.2)} />
        {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${46 + k * 7} ${72 + k} q-2 6 -5 10`} {...line('#c8502a', 1.4)} />)}
        <path d="M92 52 C106 40 114 24 118 10 M88 48 C100 32 106 18 104 6" {...line('#c8502a', 1.1)} />
        <circle cx="86" cy="48" r="3.2" fill="#1c1612" /><circle cx="84.8" cy="46.8" r="1" fill="#fff" />
        {hi('M40 46 C50 38 62 34 74 34')}
      </g>
    case 'Sausage':
      return <g>{skewer}<g transform="rotate(-38 66 62)">
        <rect x="26" y="46" width="80" height="32" rx="16" fill="#c95a3e" {...o} />
        <path d="M30 70 C50 78 86 78 104 68 C102 74 96 78 90 78 H42 C36 78 31 75 30 70 Z" fill="#9a3c26" />
        {[44, 60, 76, 92].map((x) => <path key={x} d={`M${x} 49 l-8 26`} {...line('#6e2414', 3)} />)}
        {hi('M38 54 H90', 3.6)}
      </g></g>
    case 'Potato':
      return <g>
        <path d="M24 64 C24 40 50 26 72 30 C98 34 108 56 102 74 C96 94 72 100 50 96 C32 92 24 80 24 64 Z" fill="#e2bc7c" {...o} />
        <path d="M100 58 C104 70 100 86 86 94 C72 100 54 98 42 94 C62 92 82 86 92 74 C98 68 100 62 100 58 Z" fill="#c49a58" />
        {[[44, 50], [76, 44], [62, 76], [90, 70], [36, 74]].map(([x, y]) => <g key={x}><path d={`M${x - 3.4} ${y} q3.4 -2.8 6.8 0`} {...line('#8a6430', 1.2)} /><circle cx={x} cy={y + 1.2} r="1.1" fill="#8a6430" /></g>)}
        {hi('M36 52 C42 40 54 34 66 34')}
      </g>
    case 'SweetPotato':
      return <g>
        <path d="M14 76 C28 44 78 26 106 40 C118 48 104 80 74 90 C48 98 22 94 14 76 Z" fill="#b04a6c" {...o} />
        <path d="M24 86 C46 92 74 88 92 76 C100 70 106 62 108 54 C110 66 98 82 74 90 C54 96 34 94 24 86 Z" fill="#863050" />
        <path d="M88 82 C96 76 104 66 106 56 L112 60 C110 72 102 82 94 86 Z" fill="#f6d684" {...o} />
        {[[34, 72, 58, 62], [54, 78, 78, 66], [44, 60, 66, 50]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} Q${(a + c) / 2} ${(b + d) / 2 - 4} ${c} ${d}`} {...line('#6a2240', 1.2)} />)}
        <path d="M106 40 L116 30 M14 76 L6 82" stroke={INK} strokeWidth={OUT} strokeLinecap="round" />
        {hi('M30 66 C48 50 72 42 94 42')}
      </g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake':
      return <g>{skewer}{[0, 1, 2].map((k) => {
        const cx = 38 + k * 24, cy = 86 - k * 19.5
        if (id === 'BloodCake') return <g key={k}><rect x={cx - 13} y={cy - 13} width="26" height="26" rx="5" fill="#4a2c2a" {...o} />
          <path d={`M${cx + 2} ${cy + 13} H${cx + 8} Q${cx + 13} ${cy + 13} ${cx + 13} ${cy + 8} V${cy - 6}`} {...line('#2a1414', 4)} />
          {[[-5, -4], [4, 2], [-2, 6], [6, -6]].map(([a, b]) => <circle key={a} cx={cx + a} cy={cy + b} r="1.6" fill="#f4ecd8" />)}</g>
        if (id === 'PorkBelly') return <g key={k}><rect x={cx - 15} y={cy - 13} width="30" height="26" rx="6" fill="#f2bea6" {...o} />
          <path d={`M${cx - 15} ${cy - 4} h30 M${cx - 15} ${cy + 5} h30`} {...line('#fff6ee', 3.4)} />
          <path d={`M${cx - 15} ${cy + 8} h30 Q${cx + 15} ${cy + 13} ${cx + 9} ${cy + 13} h-18 Q${cx - 15} ${cy + 13} ${cx - 15} ${cy + 8} Z`} fill="#d8927a" />
          <path d={`M${cx - 9} ${cy - 13} l6 26 M${cx + 4} ${cy - 13} l6 26`} {...line('#8a3e20', 2)} opacity="0.55" /></g>
        // (chicken thigh, and a length of leek between: ねぎま)
        return <g key={k}>{k === 1
          ? <g><rect x={cx - 12} y={cy - 10} width="24" height="20" rx="8" fill="#f0f6de" {...o} /><path d={`M${cx - 6} ${cy - 10} v20 M${cx + 1} ${cy - 10} v20`} {...line('#a2c070', 1.1)} /><path d={`M${cx + 4} ${cy - 10} h3 q5 0 5 5 v10 q0 5 -5 5 h-3 Z`} fill="#d6e4b4" /></g>
          : <g><path d={`M${cx - 15} ${cy} C${cx - 16} ${cy - 16} ${cx + 14} ${cy - 18} ${cx + 15} ${cy - 2} C${cx + 16} ${cy + 14} ${cx - 14} ${cy + 16} ${cx - 15} ${cy} Z`} fill="#d8944c" {...o} />
            <path d={`M${cx - 12} ${cy + 8} C${cx - 2} ${cy + 14} ${cx + 12} ${cy + 8} ${cx + 15} ${cy - 2} C${cx + 16} ${cy + 14} ${cx - 8} ${cy + 16} ${cx - 12} ${cy + 8} Z`} fill="#b06630" />
            <path d={`M${cx - 8} ${cy + 6} l6 -12 M${cx + 2} ${cy + 8} l6 -12`} {...line('#7a3612', 2.4)} />{hi(`M${cx - 8} ${cy - 8} l8 -3`, 2.6)}</g>}</g>
      })}</g>
    case 'Squid':
      // (grilled ika (the owner's: curved, its tentacles flowing): a soft torpedo of a mantle, its two fins rounded at the top, browned to a
      // caramel at its edges, its diamond scoring; big shining eyes; its tentacles curling out under it, two long ones, little suckers)
      return <g>
        <defs>
          <radialGradient id="sqg" cx="42%" cy="42%" r="70%"><stop offset="0" stopColor="#fdf3e6" /><stop offset="0.7" stopColor="#f2d2b0" /><stop offset="1" stopColor="#d9a070" /></radialGradient>
          <clipPath id="sqc"><path d="M64 14 C78 22 86 40 86 58 C86 72 78 82 64 84 C50 82 42 72 42 58 C42 40 50 22 64 14 Z" /></clipPath>
        </defs>
        {[-1, 1].map((sd) => <path key={sd} d={`M${64 + sd * 6} 20 C${64 + sd * 26} 18 ${64 + sd * 34} 30 ${64 + sd * 30} 44 C${64 + sd * 26} 40 ${64 + sd * 18} 38 ${64 + sd * 14} 40 Z`} fill="#eec29a" {...o} />)}
        {[[46, -10], [52, -6], [58, -2], [70, 2], [76, 6], [82, 10]].map(([x, b], k) => (
          <g key={x}>
            <path d={`M${x} 80 C${x + b * 0.4} 94 ${x + b} 102 ${x + b * 1.6} ${110 + (k % 2) * 4} C${x + b * 1.9} ${114 + (k % 2) * 4} ${x + b * 1.4} 118 ${x + b * 1.1} 116`} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
            <path d={`M${x} 80 C${x + b * 0.4} 94 ${x + b} 102 ${x + b * 1.6} ${110 + (k % 2) * 4} C${x + b * 1.9} ${114 + (k % 2) * 4} ${x + b * 1.4} 118 ${x + b * 1.1} 116`} fill="none" stroke="#f0caa6" strokeWidth="4" strokeLinecap="round" />
            {[0.35, 0.6, 0.82].map((t) => <circle key={t} cx={x + b * t * 1.4} cy={80 + t * 32} r="0.9" fill="#c98a5e" />)}
          </g>
        ))}
        <path d="M60 82 C52 98 36 104 24 108 M68 82 C76 98 92 104 104 108" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M60 82 C52 98 36 104 24 108 M68 82 C76 98 92 104 104 108" fill="none" stroke="#e8b88e" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M64 14 C78 22 86 40 86 58 C86 72 78 82 64 84 C50 82 42 72 42 58 C42 40 50 22 64 14 Z" fill="url(#sqg)" {...o} />
        <g clipPath="url(#sqc)">
          {[-24, -12, 0, 12, 24, 36].map((d) => <path key={d} d={`M30 ${44 + d} L98 ${76 + d - 36}`} {...line('#c98a5e', 1.1)} />)}
          {[-24, -12, 0, 12, 24, 36].map((d) => <path key={`b${d}`} d={`M30 ${40 + d - 36 + 36} L98 ${8 + d + 36}`} {...line('#c98a5e', 1.1)} />)}
          <path d="M76 24 C88 44 88 70 76 84 L96 84 L96 20 Z" fill="#b8703e" opacity="0.35" />
        </g>
        <circle cx="54" cy="70" r="4.4" fill="#1c1612" /><circle cx="74" cy="70" r="4.4" fill="#1c1612" />
        <circle cx="52.6" cy="68.4" r="1.5" fill="#fff" /><circle cx="72.6" cy="68.4" r="1.5" fill="#fff" />
        {hi('M54 26 C49 36 47 46 47 56')}
      </g>
    case 'Asparagus':
      return <g>{[0, 1, 2].map((k) => <g key={k} transform={`rotate(${-18 + k * 13} 64 108)`}>
        <path d="M59 108 L59 32 Q64 18 69 32 L69 108 Z" fill="#7cae46" {...o} />
        <path d="M65 34 L69 32 L69 108 L65 108 Z" fill="#5a8a30" />
        <path d="M59.5 32 Q64 20 68.5 32 Q64 28 59.5 32 Z" fill="#7a5a8c" />
        {[48, 62, 76, 90].map((y, j) => <path key={y} d={j % 2 ? `M69 ${y} l5 -6` : `M59 ${y} l-5 -6`} {...line('#3e6a24', 1.6)} />)}
        {hi('M62 40 V100', 1.8)}
      </g>)}</g>
    case 'Okra':
      return <g>
        <path d="M44 26 L58 18 L66 30 C82 50 90 78 86 104 C78 110 68 106 64 96 C52 72 44 50 44 26 Z" fill="#6ea840" {...o} />
        <path d="M70 34 C82 54 88 78 86 104 C80 106 76 104 74 100 C80 80 78 56 70 34 Z" fill="#4e8a2c" />
        {[[54, 30, 76, 102], [62, 28, 82, 100]].map(([a, b, c, d]) => <path key={a} d={`M${a} ${b} C${a + 10} ${(b + d) / 2} ${c} ${d - 20} ${c} ${d}`} {...line('#3a6a20', 1.2)} />)}
        <path d="M44 26 L58 18 L66 30 L56 26 Z" fill="#587a2a" {...o} />
        {[[60, 52], [70, 72], [66, 88]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1" fill="#d6eab4" />)}
        {hi('M50 38 C56 56 62 72 66 88', 2.8)}
      </g>
    case 'Shishito':
      return <g>
        <path d="M24 90 C28 62 58 36 90 30 C100 28 106 38 96 48 C82 64 60 88 34 98 C26 100 22 96 24 90 Z" fill="#5c9e38" {...o} />
        <path d="M32 96 C56 86 80 64 96 48 C100 44 102 40 101 36 C104 44 96 54 86 62 C70 78 52 92 34 98 Z" fill="#3e7a24" />
        <path d="M92 30 C96 26 100 26 102 30 L98 34 Z" fill="#4e6e24" {...o} />
        <path d="M100 28 C104 20 108 16 114 14" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d="M100 28 C104 20 108 16 114 14" stroke="#6a8a34" strokeWidth="2.4" strokeLinecap="round" />
        {hi('M38 80 C52 66 68 50 86 38')}
      </g>
    case 'Scallop':
      return <g>
        <path d="M64 106 L20 52 C28 20 100 20 108 52 Z" fill="#f6d0a6" {...o} />
        <path d="M64 106 L88 70 C96 58 104 54 108 52 Z" fill="#dea47a" />
        {[-32, -22, -11, 0, 11, 22, 32].map((d) => <path key={d} d={`M64 106 Q${64 + d * 0.7} 68 ${64 + d * 1.35} 28`} {...line('#bc7c52', 1.2)} />)}
        <path d="M48 106 h32 l-6 12 h-20 Z" fill="#e6aa7a" {...o} />
        <ellipse cx="64" cy="62" rx="20" ry="15" fill="#fffaf0" {...o} />
        <path d="M72 50 C82 54 86 62 82 70 C78 74 70 76 64 77 C76 70 78 58 72 50 Z" fill="#efe2c8" />
        <path d="M46 68 C52 80 76 80 82 68" fill="none" stroke="#f2a466" strokeWidth="4.4" strokeLinecap="round" />
        {hi('M54 54 C58 50 64 48 70 49', 3)}
      </g>
    case 'NetMochi':
      return <g>
        <rect x="22" y="44" width="84" height="48" rx="14" fill="#fffdf6" {...o} />
        <path d="M22 74 C42 60 82 58 106 70 V80 C106 87 100 92 92 92 H36 C28 92 22 87 22 80 Z" fill="#e8bc72" />
        <path d="M22 84 C42 76 82 76 106 82 V80 C106 87 100 92 92 92 H36 C28 92 22 87 22 84 Z" fill="#c8964c" />
        {[36, 52, 68, 84].map((x) => <path key={x} d={`M${x} 46 l12 44`} {...line('#8a5a2a', 2)} opacity="0.55" />)}
        <path d="M58 44 C58 32 72 32 72 42" fill="#fffdf6" {...o} />
        <rect x="22" y="44" width="84" height="48" rx="14" fill="none" {...o} />
        {hi('M32 54 H58', 3.6)}
      </g>
    case 'MisoSoup':
      return <g>
        <path d="M18 54 H110 C110 84 92 106 64 106 C36 106 18 84 18 54 Z" fill="#a8301e" {...o} />
        <path d="M80 56 H110 C110 84 92 106 64 106 C84 98 94 80 96 56 Z" fill="#7a1a0e" />
        <path d="M48 106 h32 v6 h-32 Z" fill="#3a0e08" {...o} />
        <ellipse cx="64" cy="54" rx="46" ry="13" fill="#d89c52" {...o} />
        <path d="M30 58 C46 64 82 64 98 58" {...line('#b8783a', 1.4)} />
        <rect x="44" y="47" width="10" height="10" rx="1.6" fill="#fffaf0" stroke="#d8c8a4" strokeWidth="1" />
        <rect x="70" y="51" width="10" height="10" rx="1.6" fill="#fffaf0" stroke="#d8c8a4" strokeWidth="1" />
        <path d="M56 58 C60 52 68 50 72 54" {...line('#2e5a1e', 4)} />
        {[36, 88, 62].map((x) => <circle key={x} cx={x} cy={x === 62 ? 46 : 54} r="2" fill="#4e8e2c" />)}
        <path d="M48 36 C44 28 52 24 48 16 M68 36 C64 28 72 24 68 16" {...line('#ffffff', 2.2)} opacity="0.7" />
        {hi('M26 64 C28 76 34 86 42 92', 3.4)}
      </g>
    case 'Sake':
      return <g>
        <path d="M54 12 H74 V24 C90 36 96 58 96 80 C96 102 82 114 64 114 C46 114 32 102 32 80 C32 58 38 36 54 24 Z" fill="#fdfcf7" {...o} />
        <path d="M74 26 C88 38 96 58 96 80 C96 100 84 112 68 114 C82 104 88 86 86 66 C84 48 80 34 74 26 Z" fill="#e6e2d6" />
        <path d="M54 12 H74 V18 H54 Z" fill="#2a4a8a" {...o} />
        <path d="M34 88 C52 94 76 94 94 88" {...line('#2a4a8a', 5)} />
        <rect x="52" y="44" width="24" height="32" rx="2" fill="#c82a20" {...o} />
        <text x="64" y="66" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="serif">酒</text>
        {hi('M42 52 C38 64 38 80 42 92', 4)}
      </g>
    default:
      return <circle cx="64" cy="64" r="24" fill="#d8b890" {...o} />
  }
}

/** the foods there's a picture of (the rest are drawn as a plain round) */
const OTHER = new Set(['RiceBag', 'Asparagus', 'BloodCake', 'GrilledCorn', 'GrilledShiitake', 'KingOyster', 'MisoSoup', 'NetMochi', 'Okra', 'Onigiri', 'PorkBelly', 'Potato', 'Sake', 'Sausage', 'Scallop', 'Shishito', 'ShrimpSkewer', 'Squid', 'SweetPotato', 'Yakitori'])
export const hasFoodArt = (id: string) => id in FISH || OTHER.has(id)

/** `band`: drawn across the top of a card (no round tile, the food cropped close to fill the band; the card's band behind it) */
// (drawn again only when its own props change: the menu's strips are redrawn with the app, several times a second while the shop's open, and
// each fish's outline is worked out afresh in a drawing)
export const FoodArt = memo(FoodArtImpl)
function FoodArtImpl({ id, store, size = 34, band = false }: { id: string; store: string; size?: number; band?: boolean }) {
  const u = `fa${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const f = FISH[id]
  const [g0, g1] = ground(store)
  // (cropped on a card's band to the food itself: a whole fish to its own outline, tail and fins and all)
  const fishView = (q: Fish) => {
    const { H, cy, x0, x1, tail, T } = fishParts(q)
    const a = x0 - (q.beak ? 10 : 4), b = x1 + tail + 3
    const top = Math.max(...q.dorsal.map((g) => g.h), 0.6) + 1.15
    const y0 = cy - Math.max(H * top, T) - 3, y1 = cy + Math.max(H * 1.5, T) + 3
    return `${a} ${y0} ${b - a} ${y1 - y0}`
  }
  const view = !band ? '0 0 128 128' : f ? (f.fillet ? '14 26 100 70' : fishView(f)) : '6 4 116 116'
  return (
    <svg className="food-art" width={band ? undefined : size} height={band ? undefined : size} viewBox={view} aria-hidden="true">
      {!band && <>
        <defs>
          <radialGradient id={`${u}g`} cx="50%" cy="28%" r="75%"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></radialGradient>
          <clipPath id={`${u}t`}><circle cx="64" cy="64" r="58" /></clipPath>
        </defs>
        <circle cx="64" cy="64" r="60" fill={`url(#${u}g)`} stroke={INK} strokeWidth="3" />
        <circle cx="64" cy="64" r="50" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="2" strokeDasharray="4 6" />
      </>}
      <g clipPath={band ? undefined : `url(#${u}t)`} transform={band ? undefined : 'translate(64 64) scale(0.86) translate(-64 -64)'}>
        {f ? (f.fillet ? <FilletArt f={f.fillet} u={u} /> : <FishArt f={f} u={u} />) : <OtherArt id={id} />}
      </g>
    </svg>
  )
}
