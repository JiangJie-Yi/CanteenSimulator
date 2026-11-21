/*
 * The pantry's pictures of the foods (the owner's, 2026-11-12: cute and neat, cartoon; none with a face or an eye: food doesn't grow eyes
 * because it's cute). Drawn again (item 453, the owner's, 2026-11-21: 「庫存的SVG圖品質還是不行，也沒色彩，看起來也不乾淨」「香魚的基底造型
 * 還可以，但要在更往上」, after item 435 drew them in one ink, their colours told by hatching and dots, grey and smudged at the pantry's size):
 * their colours back, clean: each form one confident ink line round it, filled with its colour lit softly from the top left, the lines in
 * it (scales, fin rays, the lateral line, a fillet's fat) drawn fine in a deeper shade of the colour they lie on, never hatched or dotted;
 * a white gleam. Every fish drawn as itself as the ayu is (its own build, fins, tail and markings: the horse mackerel's scutes, the
 * sardine's row of spots, the shishamo's belly full of roe, the hokke's bands and long dorsal, the nodoguro's red and spiny dorsal); the
 * fillets cut slabs with their thickness, their skin along the back, their own grain. Drawn on a 128 square, the food in the middle of it,
 * about 100 across.
 */
import type { ReactNode } from 'react'

const INK = '#3b2a1e'
const LINE = 3.2
const FINE = 2
/** a colour lighter (k > 0) or darker (k < 0) */
const tone = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `#${[ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
/** an ellipse as a path */
const ell = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`
/** a rounded rectangle as a path */
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`

type Ctx = { u: string; n: number }
/** a form: its outline filled with its colour lit from the top left, inked */
function Blob({ c, d, k, at, sw = LINE, tf }: { c: Ctx; d: string; k: string; at?: [number, number]; sw?: number; tf?: string }) {
  const id = `${c.u}g${c.n++}`
  const [cx, cy] = at ?? [35, 30]
  return (
    <>
      <defs>
        <radialGradient id={id} cx={`${cx}%`} cy={`${cy}%`} r="85%">
          <stop offset="0" stopColor={tone(k, 0.34)} /><stop offset="0.52" stopColor={k} /><stop offset="1" stopColor={tone(k, -0.2)} />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#${id})`} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" transform={tf} />
    </>
  )
}
/** a white gleam */
const Gleam = ({ x, y, rx = 6, ry = 3.4, rot = -30, o = 0.85 }: { x: number; y: number; rx?: number; ry?: number; rot?: number; o?: number }) =>
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#ffffff" opacity={o} transform={`rotate(${rot} ${x} ${y})`} />
/** a bamboo skewer from one end to the other, inked */
const Stick = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <g strokeLinecap="round">
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="7" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2c48e" strokeWidth="3.6" />
  </g>
)
const line = (d: string, color = INK, w = FINE, key?: string | number) => <path key={key} d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />

/**
 * Every fish drawn as itself (items 316, 354, 453): its own build (how long, how deep, a pointed snout or a round one, where its back is
 * highest), its own fins (a tall dorsal, a spiny one, a long one down its back, the ayu's and the shishamo's little adipose fin, the finlets
 * before a saury's or a mackerel's tail), its tail forked as its own is, rays in its fins, a pectoral fin behind the gill, fine scales over
 * its back and its lateral line, and its own markings; still cute (the chunky ink line, soft light from the top left, no eye)
 */
type FinAt = { at: number; w: number; h: number; spiny?: boolean }
type Fish2 = { back: string; belly: string; fin: string; len: number; deep: number; nose: number; hump: number; fork: number; tailW: number
  dorsal: FinAt[]; anal?: FinAt; adipose?: number; finlets?: number; spot?: string; flank?: string; beak?: string; sheen?: string; worms?: string; sharp?: boolean
  /** (item 354) a golden middle between back and belly; fine scales over the back; the lateral line; the dorsal's dark leading edge and the
   * tail's dark trailing edge; the little mouth at the snout */
  mid?: string; scales?: string; lateral?: string; edge?: string; mouth?: boolean
  /** (item 453) the horse mackerel's scutes along the lateral line's back half; the sardine's row of dark spots; the shishamo's belly full
   * of roe; the hokke's dark bands */
  zengo?: string; dots?: string; roe?: string; bands?: string }
const FISH2: Record<string, Fish2> = {
  // (ayu: slender, olive down through a golden middle to the cream belly, its tall dorsal dark along its front and the little adipose fin,
  // the yellow spot behind the gill glowing (no bright dot in it: it read as an eye), yellowed fins, fine scales over its back, its lateral
  // line, its tail's fork edged dark, the little mouth (items 316, 354; its build kept, the owner's 「香魚的基底造型還可以」))
  ExtraFish: { back: '#557f52', mid: '#bdb768', belly: '#f8f3de', fin: '#efc860', len: 1.06, deep: 0.7, nose: 0.5, hump: 0.38, fork: 0.58, tailW: 0.98,
    dorsal: [{ at: 0.4, w: 0.25, h: 0.98 }], anal: { at: 0.72, w: 0.14, h: 0.44 }, adipose: 0.83, spot: '#f9c62f', flank: '#efd27a',
    scales: '#3f6a43', lateral: '#8ea46c', edge: '#6a5528', mouth: true },
  // (saury: long and thin as a blade, its snout pointed and its lower jaw out yellow, blue over silver cut sharp, a silver line along it,
  // its little fins far back, finlets above and below before its small deep-forked tail)
  Saury: { back: '#2b5d9e', belly: '#eef3fa', fin: '#9fb6d4', len: 1.05, deep: 0.5, nose: 0.9, hump: 0.5, fork: 0.85, tailW: 1.5,
    dorsal: [{ at: 0.77, w: 0.09, h: 0.8 }], anal: { at: 0.75, w: 0.09, h: 0.7 }, finlets: 5, beak: '#f2b43a', sheen: '#eaf2fb', sharp: true,
    scales: '#1f4a82', lateral: '#5c84bc' },
  // (mackerel: a full spindle, teal over silver, the dark wavy markings down its back, a spiny first dorsal and a second, finlets, a deep fork)
  Mackerel: { back: '#2f8088', belly: '#f0f5f4', fin: '#9fc2c2', len: 1.06, deep: 0.95, nose: 0.45, hump: 0.42, fork: 0.9, tailW: 1,
    dorsal: [{ at: 0.3, w: 0.15, h: 0.55, spiny: true }, { at: 0.6, w: 0.1, h: 0.45 }], anal: { at: 0.62, w: 0.1, h: 0.42 }, finlets: 4, worms: '#14444b',
    lateral: '#5fa0a4' },
  // (horse mackerel (aji): a spindle, blue-grey over a yellowish middle to a silver belly, a spiny first dorsal and a long soft second, the
  // row of hard scutes (zengo) along the back half of its lateral line, yellowish fins, a deep fork)
  Aji: { back: '#5d8790', mid: '#c4c69a', belly: '#f3f4ec', fin: '#dccf8c', len: 1.0, deep: 0.8, nose: 0.55, hump: 0.4, fork: 0.92, tailW: 1.1,
    dorsal: [{ at: 0.3, w: 0.12, h: 0.55, spiny: true }, { at: 0.6, w: 0.3, h: 0.42 }], anal: { at: 0.64, w: 0.26, h: 0.36 },
    scales: '#44676f', lateral: '#7d9aa0', zengo: '#3d5b62' },
  // (sardine (maiwashi): slim, round-nosed, deep blue over a bright silver belly, one small dorsal at its middle, the row of seven dark
  // spots along its flank, its silver line, a forked tail)
  Iwashi: { back: '#2e5a96', belly: '#eef3f9', fin: '#a9bfd8', len: 0.96, deep: 0.64, nose: 0.38, hump: 0.45, fork: 0.85, tailW: 1.1,
    dorsal: [{ at: 0.46, w: 0.13, h: 0.6 }], anal: { at: 0.8, w: 0.08, h: 0.32 }, sheen: '#e4eef9', dots: '#1a2a4c',
    scales: '#21477d', lateral: '#5a80b4' },
  // (shishamo: slender and soft, olive-silver over a pale belly swollen with roe (its eggs seen through it), a small dorsal at its middle,
  // the little adipose fin, a shallow fork)
  Shishamo: { back: '#8f8f6a', mid: '#c9c4a2', belly: '#f6efdc', fin: '#dcd3b0', len: 0.94, deep: 0.62, nose: 0.48, hump: 0.42, fork: 0.62, tailW: 1.0,
    dorsal: [{ at: 0.46, w: 0.12, h: 0.62 }], anal: { at: 0.7, w: 0.18, h: 0.34 }, adipose: 0.8, roe: '#f2a94a',
    scales: '#6d6d4d', lateral: '#a9a784' },
  // (hokke: long, olive-brown banded dark across its back and flanks, one long dorsal down nearly all its back, a long anal fin, a forked tail)
  Hokke: { back: '#6f6c48', mid: '#b2aa7a', belly: '#f1eadb', fin: '#bdae7c', len: 1.02, deep: 0.74, nose: 0.5, hump: 0.4, fork: 0.72, tailW: 1.05,
    dorsal: [{ at: 0.47, w: 0.64, h: 0.36 }], anal: { at: 0.66, w: 0.36, h: 0.3 }, bands: '#3f3b24',
    scales: '#4f4c32', lateral: '#8c875e' },
  // (nodoguro (rosy seabass): deep and full, rosy red over a pink belly, a spiny first dorsal and a soft second, its tail nearly square)
  Nodoguro: { back: '#d4433a', mid: '#ee8268', belly: '#fde5da', fin: '#f08c74', len: 0.94, deep: 1.0, nose: 0.36, hump: 0.38, fork: 0.22, tailW: 1.12,
    dorsal: [{ at: 0.34, w: 0.2, h: 0.72, spiny: true }, { at: 0.6, w: 0.18, h: 0.52 }], anal: { at: 0.66, w: 0.14, h: 0.44 },
    scales: '#a8302a', lateral: '#e9927e' },
}
function Fish2Art({ c, f }: { c: Ctx; f: Fish2 }) {
  const L = 44 * f.len, D = 26 * f.deep, T = 17 + 5 * f.fork, W = D * f.tailW
  const beak = f.beak ? 8 : 0
  // (the whole of it, snout or jaw to the tail's tips, in the middle of the square)
  const cx = 64 + (0.18 * L + f.nose * 5 + beak - T) / 2, cy = 64
  const sx = cx - L - f.nose * 5, sy = cy + f.nose * 1.5, hx = cx - L + 2 * L * f.hump, tx = cx + 0.82 * L
  const id = `${c.u}f${c.n++}`
  const body = `M${sx} ${sy} C${sx + L * 0.05} ${sy - D * (0.8 - 0.5 * f.nose)} ${hx - L * 0.35} ${cy - D} ${hx} ${cy - D} `
    + `C${hx + L * 0.45} ${cy - D} ${tx - L * 0.25} ${cy - D * 0.35} ${tx} ${cy - D * 0.2} L${tx} ${cy + D * 0.2} `
    + `C${tx - L * 0.25} ${cy + D * 0.42} ${hx + L * 0.5} ${cy + D * 0.95} ${hx + L * 0.05} ${cy + D * 0.95} `
    + `C${hx - L * 0.4} ${cy + D * 0.95} ${sx + L * 0.05} ${sy + D * (0.62 - 0.42 * f.nose)} ${sx} ${sy} Z`
  const notch = tx + T * (1 - f.fork * 0.8)
  const tail = `M${tx - 2} ${cy - D * 0.2} C${tx + T * 0.3} ${cy - D * 0.3} ${tx + T * 0.6} ${cy - W * 0.8} ${tx + T} ${cy - W} `
    + `C${tx + T * 0.92} ${cy - W * 0.45} ${notch + 2} ${cy - 2} ${notch} ${cy} C${notch + 2} ${cy + 2} ${tx + T * 0.92} ${cy + W * 0.45} ${tx + T} ${cy + W} `
    + `C${tx + T * 0.6} ${cy + W * 0.8} ${tx + T * 0.3} ${cy + D * 0.3} ${tx - 2} ${cy + D * 0.2} Z`
  const along = (k: number) => sx + (tx - sx) * k
  const finDark = tone(f.fin, -0.32)
  // (the lateral line: from behind the gill, arching a little over the flank, to the tail's root; its height where it passes x)
  const latA = cx - L * 0.46, latB = tx - 3
  const latY = (x: number) => { const t = Math.min(1, Math.max(0, (x - latA) / (latB - latA))); return cy - D * (0.06 * (1 - t) * (1 - t) + 2 * 0.16 * t * (1 - t) + 0.02 * t * t) }
  // (the body's top (up) or bottom edge where it passes x: from the snout to its deepest, down to the tail's root)
  const edgeY = (x: number, up: boolean) => {
    const he = up ? hx : hx + L * 0.05, deep = up ? 1 : 0.95, sg = up ? -1 : 1
    if (x <= he) return cy + sg * D * deep * Math.sin((Math.max(0, Math.min(1, (x - sx) / (he - sx))) * Math.PI) / 2)
    return cy + sg * D * (0.2 + (deep - 0.2) * Math.cos((Math.max(0, Math.min(1, (x - he) / (tx - he))) * Math.PI) / 2))
  }
  // (a long fin down the back or under the belly (the hokke's): its edge a steady height off the body's own curve, rising at its front,
  // lower toward the tail; its foot inside the body)
  const longFin = (g: FinAt, up: boolean) => {
    const x0 = along(g.at - g.w / 2), x1 = along(g.at + g.w / 2), s = up ? -1 : 1, H = g.h * D * 0.55, n = 12
    let d = ''
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, rise = Math.min(1, i / 1.4) * (1 - (0.4 * i) / n)
      d += `${i ? ' L' : 'M'}${x.toFixed(1)} ${(edgeY(x, up) + s * H * rise).toFixed(1)}`
    }
    return `${d} L${x1} ${edgeY(x1, up) - s * 4} L${x0} ${edgeY(x0, up) - s * 4} Z`
  }
  // (a fin on the back (up) or the belly (down): its foot well inside the body (the body's drawn over it), leaning back, rounded; its rays)
  const finD = (g: FinAt, up: boolean) => {
    if (g.w > 0.3) return longFin(g, up)
    const x0 = along(g.at - g.w / 2), x1 = along(g.at + g.w / 2), s = up ? -1 : 1
    const base = cy + s * D * 0.55, top = cy + s * (D * (up ? 1 : 0.95) + g.h * D * 0.75)
    const w = x1 - x0
    if (g.spiny) {
      // (its spines' tips standing a little clear of the web between them, the first the tallest, lower toward the back)
      const n = 4
      let d = `M${x0} ${base} L${x0 + w * 0.06} ${top}`
      for (let k = 1; k < n; k++) {
        const x = x0 + w * (0.06 + (0.84 * k) / (n - 1)), t = top - s * k * g.h * D * 0.16, xm = x - (w * 0.84) / (n - 1) / 2
        d += ` Q${xm} ${t - s * D * 0.16} ${x} ${t}`
      }
      return `${d} Q${x1 + w * 0.08} ${base - s * D * 0.25} ${x1} ${base} Z`
    }
    // (a sail: its front edge leaning back to a rounded tip, its back edge sweeping down)
    return `M${x0} ${base} Q${x0 + w * 0.06} ${top} ${x0 + w * 0.42} ${top} Q${x1 + w * 0.12} ${top + s * g.h * D * 0.2} ${x1 + w * 0.06} ${base} Z`
  }
  const rays = (g: FinAt, up: boolean) => {
    const x0 = along(g.at - g.w / 2), x1 = along(g.at + g.w / 2), s = up ? -1 : 1
    if (g.w > 0.3) return Array.from({ length: 9 }, (_, i) => {
      const x = x0 + ((x1 - x0) * (i + 0.8)) / 10, rise = (1 - (0.4 * (i + 0.8)) / 10) * g.h * D * 0.55
      return line(`M${x} ${edgeY(x, up)} L${x + 1.6} ${edgeY(x, up) + s * rise * 0.85}`, finDark, 1, `${up}${i}`)
    })
    const top = cy + s * (D * (up ? 1 : 0.95) + g.h * D * 0.6)
    return [0.3, 0.55, 0.8].map((k) => line(`M${x0 + (x1 - x0) * k * 0.8} ${cy + s * D * 0.9} L${x0 + (x1 - x0) * (k * 0.8 + 0.12)} ${top}`, finDark, 1.1, `${up}${k}`))
  }
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {f.mid
            ? <><stop offset="0" stopColor={tone(f.back, 0.1)} /><stop offset="0.36" stopColor={f.back} /><stop offset="0.54" stopColor={f.mid} /><stop offset="0.7" stopColor={tone(f.belly, -0.04)} /><stop offset="1" stopColor={f.belly} /></>
            : f.sharp
            ? <><stop offset="0" stopColor={tone(f.back, 0.14)} /><stop offset="0.44" stopColor={f.back} /><stop offset="0.5" stopColor={tone(f.belly, -0.08)} /><stop offset="1" stopColor={f.belly} /></>
            : <><stop offset="0" stopColor={tone(f.back, 0.12)} /><stop offset="0.42" stopColor={f.back} /><stop offset="0.6" stopColor={tone(f.belly, -0.05)} /><stop offset="1" stopColor={f.belly} /></>}
        </linearGradient>
        <clipPath id={`${id}c`}><path d={body} /></clipPath>
        {f.spot && <radialGradient id={`${id}s`}><stop offset="0" stopColor={tone(f.spot, 0.4)} /><stop offset="0.5" stopColor={f.spot} /><stop offset="1" stopColor={f.spot} stopOpacity="0" /></radialGradient>}
        {f.roe && <radialGradient id={`${id}r`} cx="50%" cy="40%" r="60%"><stop offset="0" stopColor={tone(f.roe, 0.3)} /><stop offset="0.7" stopColor={f.roe} /><stop offset="1" stopColor={f.roe} stopOpacity="0" /></radialGradient>}
      </defs>
      {/* (behind the body: the tail and its rays, the fins on the back and under it, the adipose fin, the finlets) */}
      <Blob c={c} k={f.fin} d={tail} at={[20, 30]} />
      {[-0.55, 0, 0.55].map((k) => line(`M${tx + 2} ${cy + k * D * 0.25} L${tx + T * 0.82} ${cy + k * W * 0.95}`, finDark, 1.1, `t${k}`))}
      {f.edge && <path d={`M${tx + T} ${cy - W} C${tx + T * 0.92} ${cy - W * 0.45} ${notch + 2} ${cy - 2} ${notch} ${cy} C${notch + 2} ${cy + 2} ${tx + T * 0.92} ${cy + W * 0.45} ${tx + T} ${cy + W}`}
        fill="none" stroke={f.edge} strokeWidth="2.2" strokeOpacity="0.75" strokeLinecap="round" />}
      {f.dorsal.map((g, i) => <g key={`d${i}`}><Blob c={c} k={f.fin} d={finD(g, true)} sw={2.4} />{!g.spiny && rays(g, true)}
        {f.edge && (() => { const x0 = along(g.at - g.w / 2), w = along(g.at + g.w / 2) - x0, top = cy - (D + g.h * D * 0.75)
          return <path d={`M${x0 + 1.5} ${cy - D * 0.62} Q${x0 + w * 0.08} ${top + 1} ${x0 + w * 0.42} ${top + 1.2}`} fill="none" stroke={f.edge} strokeWidth="2" strokeOpacity="0.8" strokeLinecap="round" /> })()}</g>)}
      {f.anal && <g><Blob c={c} k={f.fin} d={finD(f.anal, false)} sw={2.4} />{rays(f.anal, false)}</g>}
      {f.adipose !== undefined && <Blob c={c} k={f.fin} d={`M${along(f.adipose) - 4} ${cy - D * 0.4} Q${along(f.adipose)} ${cy - D * 0.4 - 9} ${along(f.adipose) + 5} ${cy - D * 0.4} Z`} sw={2} />}
      {f.finlets && [-1, 1].map((s) => Array.from({ length: f.finlets! }, (_, k) => {
        const x = tx - L * 0.32 + (L * 0.3 * k) / f.finlets!, yb = cy + s * D * (0.42 - 0.2 * (k / f.finlets!))
        return <path key={`${s}${k}`} d={`M${x} ${yb} L${x + 2.6} ${yb + s * 4.2} L${x + 4.4} ${yb} Z`} fill={f.fin} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      }))}
      {/* (the body, its colour lit from above; what's on it drawn inside its outline, and the outline drawn again over all of it) */}
      <path d={body} fill={`url(#${id})`} />
      <g clipPath={`url(#${id}c)`}>
        {/* (the hokke's bands: soft-edged, a little wavy, across its back and down its flanks) */}
        {f.bands && <g opacity="0.62">{[0, 1, 2, 3, 4].map((k) => {
          const x = cx - L * 0.5 + k * L * 0.3
          return <path key={`bd${k}`} d={`M${x - 3} ${cy - D * 1.1} Q${x + 4} ${cy - D * 0.45} ${x - 1} ${cy + D * 0.3} L${x + 6} ${cy + D * 0.3} Q${x + 11} ${cy - D * 0.45} ${x + 5} ${cy - D * 1.1} Z`} fill={f.bands} />
        })}</g>}
        {/* (the shishamo's belly full of roe, its eggs seen through it) */}
        {f.roe && <g>
          <ellipse cx={cx + L * 0.04} cy={cy + D * 0.66} rx={L * 0.44} ry={D * 0.46} fill={`url(#${id}r)`} />
          {Array.from({ length: 13 }, (_, k) => {
            const row = k < 7 ? 0 : 1, i = row ? k - 7 : k
            return <circle key={`r${k}`} cx={cx - L * 0.28 + i * L * 0.1 + row * L * 0.05} cy={cy + D * (row ? 0.74 : 0.5)} r={2.3}
              fill={tone(f.roe ?? '#f2a94a', 0.32)} stroke={tone(f.roe ?? '#f2a94a', -0.22)} strokeWidth="0.8" />
          })}
        </g>}
        {/* (the fine scales over the back (item 354)) */}
        {f.scales && <g opacity="0.45">
          {Array.from({ length: 4 }, (_, r) => Array.from({ length: 13 }, (_, k) => {
            const x = cx - L * 0.36 + k * L * 0.1 + (r % 2) * L * 0.05, y = cy - D * (0.82 - r * 0.2)
            return <path key={`s${r}${k}`} d={`M${x} ${y} q${L * 0.05} ${D * 0.14} ${L * 0.1} 0`} fill="none" stroke={f.scales} strokeWidth="0.9" />
          }))}
        </g>}
        {/* (the mackerel's dark wavy markings down its back) */}
        {f.worms && Array.from({ length: 7 }, (_, k) => {
          const x = cx - L * 0.38 + k * L * 0.17
          return line(`M${x} ${cy - D * 0.9} q3.2 ${D * 0.14} 0 ${D * 0.28} t0 ${D * 0.28} t0 ${D * 0.2}`, f.worms, 2.1, `w${k}`)
        })}
      </g>
      <path d={body} fill="none" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {/* (its markings) */}
      {f.flank && <g opacity={f.mid ? 0.55 : 1}>{line(`M${cx - L * 0.5} ${cy + D * 0.45} Q${cx} ${cy + D * 0.52} ${tx - 4} ${cy + D * 0.14}`, f.flank, f.mid ? 1.8 : 3, 'fl')}</g>}
      {f.sheen && line(`M${cx - L * 0.52} ${cy + D * 0.02} Q${cx} ${cy - D * 0.04} ${tx - 2} ${cy}`, f.sheen, 1.8, 'sh')}
      {f.lateral && line(`M${latA} ${cy - D * 0.06} Q${cx} ${cy - D * 0.16} ${latB} ${cy - D * 0.02}`, f.lateral, 1.2, 'lat')}
      {/* (the horse mackerel's scutes: a row of little hard scales pointing to the tail along the lateral line's back half) */}
      {f.zengo && Array.from({ length: 9 }, (_, k) => {
        const x = cx - L * 0.02 + k * ((latB - 4 - (cx - L * 0.02)) / 8), y = latY(x)
        return line(`M${x - 1.2} ${y - 2.4} L${x + 1.4} ${y} L${x - 1.2} ${y + 2.4}`, f.zengo, 1.3, `z${k}`)
      })}
      {/* (the sardine's row of dark spots along its flank) */}
      {f.dots && Array.from({ length: 7 }, (_, k) => {
        const x = cx - L * 0.4 + k * L * 0.14
        return <circle key={`dt${k}`} cx={x} cy={latY(x) + D * 0.2} r={2.2} fill={f.dots} />
      })}
      {f.spot && (f.mid
        ? <><ellipse cx={cx - L * 0.44} cy={cy - D * 0.14} rx={11} ry={7.5} fill={`url(#${id}s)`} /><ellipse cx={cx - L * 0.44} cy={cy - D * 0.14} rx={4.4} ry={3} fill={f.spot} /></>
        : <><ellipse cx={cx - L * 0.46} cy={cy - D * 0.16} rx={9} ry={6} fill={f.spot} opacity={0.35} /><ellipse cx={cx - L * 0.46} cy={cy - D * 0.16} rx={5.2} ry={3.6} fill={f.spot} /></>)}
      {f.mouth && line(`M${sx + 1.2} ${sy + 1.4} q${L * 0.05} ${D * 0.1} ${L * 0.12} ${D * 0.02}`, tone(f.back, -0.45), 1.4, 'mo')}
      {f.beak && <path d={`M${sx + 4} ${sy - 0.4} L${sx - beak} ${sy + 2.4} L${sx + 5} ${sy + 4.8} Z`} fill={f.beak} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />}
      {/* (the gill cover's curve, and the pectoral fin behind it, a little lighter, its ray) */}
      {line(`M${cx - L * 0.62} ${cy - D * 0.66} Q${cx - L * 0.48} ${cy} ${cx - L * 0.62} ${cy + D * 0.66}`, tone(f.back, -0.35), 2)}
      <path d={`M${cx - L * 0.55} ${cy + D * 0.12} Q${cx - L * 0.38} ${cy + D * 0.05} ${cx - L * 0.3} ${cy + D * 0.42} Q${cx - L * 0.44} ${cy + D * 0.46} ${cx - L * 0.55} ${cy + D * 0.12} Z`}
        fill={tone(f.fin, 0.2)} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      {line(`M${cx - L * 0.52} ${cy + D * 0.17} L${cx - L * 0.36} ${cy + D * 0.36}`, finDark, 1, 'pr')}
      <Gleam x={cx - L * 0.12} y={cy - D * 0.62} rx={L * (f.mid ? 0.2 : 0.26)} ry={f.mid ? 1.9 : 2.6} rot={-4} o={f.mid ? 0.5 : 0.7} />
    </g>
  )
}
/**
 * A fillet (切り身), seen from above and a little in front (item 453: a rounded slab before, a strip of skin along its top): its cut face
 * lit from the top left, its thickness below its front edge a shade deeper, its skin along its back edge; and its own grain: the salmon's
 * white lines of fat in the curves of its muscle, the yellowtail's dark red blood line (chiai) along its skin with paler fat, the black
 * cod's white flesh in big flakes under its black skin
 */
function Fillet({ c, flesh, skin, fat, kind }: { c: Ctx; flesh: string; skin: string; fat: string; kind: 'salmon' | 'buri' | 'gindara' }) {
  const id = `${c.u}fl${c.n++}`
  // (its cut face: a piece cut square across the fillet, leaning as it lies: its two cut ends straight and slanted, its corners eased; its skin
  // side the gently rounded top edge, its belly side the bottom; its thickness under the bottom edge and on the right end's face)
  const top = 'M25 44 C48 40 80 39 101 42 Q108 43 106 50 L98 75 Q96 80 89 80 C66 82 42 82 21 81 Q14 81 15 74 L20 50 Q21 45 25 44 Z'
  const side = 'M15 74 Q14 81 21 81 C42 82 66 82 89 80 Q96 80 98 75 L106 50 Q108 45 108 52 L108 60 L100 84 Q98 89 90 89 C66 91 42 91 21 90 Q14 90 15 83 Z'
  const skinD = 'M22 46 C45 40 80 39 102 41 Q109 42 107 48 C90 45 52 45 23 50 Q19 49 22 46 Z'
  return (
    <g>
      <defs>
        <radialGradient id={`${id}t`} cx="32%" cy="28%" r="85%"><stop offset="0" stopColor={tone(flesh, 0.3)} /><stop offset="0.55" stopColor={flesh} /><stop offset="1" stopColor={tone(flesh, -0.14)} /></radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone(flesh, -0.2)} /><stop offset="1" stopColor={tone(flesh, -0.34)} /></linearGradient>
        <linearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone(skin, 0.28)} /><stop offset="1" stopColor={skin} /></linearGradient>
        <clipPath id={`${id}c`}><path d={top} /></clipPath>
      </defs>
      <path d={side} fill={`url(#${id}s)`} stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d={top} fill={`url(#${id}t)`} />
      <g clipPath={`url(#${id}c)`}>
        {/* (the salmon's white lines of fat, each a curve of its muscle from the skin down to the belly's edge) */}
        {kind === 'salmon' && [0, 1, 2, 3, 4].map((k) => {
          const x = 30 + k * 15.5
          const d = `M${x + 8} 44 C${x} 53 ${x + 6} 61 ${x} 69 C${x - 3} 74 ${x + 1} 78 ${x - 3} 83`
          return <g key={`m${k}`}>{line(d, fat, 3, `f${k}`)}{line(d, '#ffffff', 1.1, `g${k}`)}</g>
        })}
        {/* (the yellowtail's dark red blood line along under its skin, a crescent; its fat in a few faint curves) */}
        {kind === 'buri' && <g>
          <path d="M18 54 C34 47 60 45 84 45 C96 45 104 47 108 51 C96 53 84 54 66 55 C48 56 30 57 18 54 Z" fill="#a8383a" />
          <path d="M28 54 C44 51 62 50 80 50" fill="none" stroke="#c75a52" strokeWidth="1.4" strokeLinecap="round" />
          {[0, 1, 2, 3].map((k) => line(`M${38 + k * 17} 60 C${33 + k * 17} 67 ${38 + k * 17} 73 ${33 + k * 17} 81`, fat, 2, `b${k}`))}
        </g>}
        {/* (the black cod's white flesh in big flakes) */}
        {kind === 'gindara' && <g>
          {[0, 1, 2, 3].map((k) => line(`M${38 + k * 17} 47 C${32 + k * 17} 58 ${38 + k * 17} 69 ${32 + k * 17} 81`, tone(flesh, -0.13), 1.4, `k${k}`))}
          {[0, 1, 2, 3].map((k) => line(`M${45 + k * 17} 57 q4 5 0 10`, tone(flesh, -0.08), 1.1, `q${k}`))}
        </g>}
      </g>
      <path d={top} fill="none" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      <path d={skinD} fill={`url(#${id}k)`} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      {line('M30 44 C50 41 78 40 98 42', tone(skin, 0.6), 1.3, 'ks')}
      <Gleam x={40} y={62} rx={9} ry={2.6} rot={-6} o={0.7} />
    </g>
  )
}

/** what each food looks like (null: not drawn) */
function draw(id: string, c: Ctx): ReactNode {
  if (FISH2[id]) return <Fish2Art c={c} f={FISH2[id]} />
  switch (id) {
    case 'Salmon': return <Fillet c={c} flesh="#f4865a" skin="#8a96a6" fat="#ffe6d2" kind="salmon" />
    case 'Buri': return <Fillet c={c} flesh="#eba595" skin="#56687c" fat="#fde6de" kind="buri" />
    case 'Gindara': return <Fillet c={c} flesh="#f6eee2" skin="#2c2c34" fat="#ffffff" kind="gindara" />
    case 'ShrimpSkewer': return <g>
      <Stick x1={10} y1={98} x2={116} y2={34} />
      {[[44, 74], [80, 52]].map(([x, y], k) => (
        <g key={k} transform={`rotate(-30 ${x} ${y})`}>
          <Blob c={c} k="#f2694a" d={`M${x - 20} ${y + 2} C${x - 20} ${y - 14} ${x + 14} ${y - 18} ${x + 20} ${y - 2} C${x + 22} ${y + 6} ${x + 14} ${y + 10} ${x + 8} ${y + 6} C${x + 4} ${y - 4} ${x - 10} ${y - 4} ${x - 12} ${y + 6} Z`} />
          {[-8, 0, 8].map((dx) => line(`M${x + dx} ${y - 12} q3 6 0 10`, '#c94a30', 1.8, dx))}
          <path d={`M${x - 20} ${y + 2} l-8 -4 l2 8 Z`} fill="#f2694a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x + 14} cy={y - 5} r="2" fill={INK} />
        </g>
      ))}
    </g>
    case 'Squid': return <g>
      {[0, 1, 2, 3, 4].map((k) => line(`M${46 + k * 9} 84 C${44 + k * 9} 96 ${50 + k * 9} 104 ${48 + k * 9} 112`, INK, 7, `i${k}`))}
      {[0, 1, 2, 3, 4].map((k) => line(`M${46 + k * 9} 84 C${44 + k * 9} 96 ${50 + k * 9} 104 ${48 + k * 9} 112`, '#f3e2d2', 3.4, `t${k}`))}
      <Blob c={c} k="#f6e6d6" d="M64 16 C80 26 88 48 86 70 C85 80 78 86 64 86 C50 86 43 80 42 70 C40 48 48 26 64 16 Z" />
      <Blob c={c} k="#f1d8c4" d="M64 16 C72 20 84 26 92 24 C90 32 84 36 78 34 Z" sw={2.6} />
      <Blob c={c} k="#f1d8c4" d="M64 16 C56 20 44 26 36 24 C38 32 44 36 50 34 Z" sw={2.6} />
      {[0, 1, 2].map((k) => line(`M${52} ${42 + k * 10} l24 4`, '#e2b8a0', 1.8, k))}
      <Gleam x={56} y={36} rx={4} ry={8} rot={10} />
    </g>
    case 'Scallop': return <g>
      <Stick x1={12} y1={96} x2={116} y2={36} />
      {[[40, 78], [76, 58]].map(([x, y], k) => (
        <g key={k}>
          <Blob c={c} k="#f8eedc" d={ell(x, y, 16, 13)} />
          <path d={ell(x, y + 7, 15, 5)} fill="#efd9b6" opacity="0.7" />
          <Gleam x={x - 7} y={y - 6} rx={4} ry={2} />
        </g>
      ))}
    </g>
    case 'Yakitori': case 'PorkBelly': case 'BloodCake': {
      const piece = id === 'Yakitori' ? '#e8a05a' : id === 'PorkBelly' ? '#f2b8a2' : '#4a2a2e'
      return <g>
        <Stick x1={10} y1={98} x2={118} y2={34} />
        {[[30, 86], [56, 71], [82, 56]].map(([x, y], k) => (
          <g key={k}>
            {id === 'Yakitori' && k === 1
              ? <Blob c={c} k="#f2f2d8" d={rrect(x - 8, y - 13, 16, 26, 7)} tf={`rotate(-30 ${x} ${y})`} />
              : <Blob c={c} k={piece} d={rrect(x - 12, y - 13, 24, 26, 9)} tf={`rotate(-30 ${x} ${y})`} />}
            {id === 'PorkBelly' && line(`M${x - 10} ${y + 2} q10 -6 20 -12`, '#ffffff', 2.6)}
            {id === 'BloodCake' && [0, 1, 2].map((j) => <circle key={j} cx={x - 5 + j * 5} cy={y - 4 + (j % 2) * 6} r="1.4" fill="#f6f0e8" opacity="0.7" />)}
          </g>
        ))}
        {id === 'Yakitori' && <path d="M53 58 q4 -6 8 -4" fill="none" stroke="#7fb24a" strokeWidth="3" strokeLinecap="round" />}
        <Gleam x={76} y={48} rx={4} ry={2} />
      </g>
    }
    case 'Sausage': return <g>
      {/* (its casing twisted off at both ends) */}
      <Blob c={c} k="#b8442e" d={ell(18, 68, 5, 4)} sw={2.4} />
      <Blob c={c} k="#b8442e" d={ell(112, 70, 5, 4)} sw={2.4} />
      <Blob c={c} k="#c9573e" d="M22 70 C20 56 36 48 64 50 C92 52 110 56 108 70 C106 82 90 88 64 86 C36 84 24 82 22 70 Z" />
      {[44, 64, 84].map((x) => line(`M${x - 4} 54 l8 6`, '#8a2f20', 2.2, x))}
      <Gleam x={42} y={56} rx={10} ry={3} rot={-6} />
    </g>
    case 'GrilledCorn': return <g>
      <Blob c={c} k="#8cbf4e" d="M18 76 C30 58 54 50 70 54 L50 92 C36 92 22 88 18 76 Z" sw={2.8} />
      <Blob c={c} k="#f4c844" d="M30 64 C40 40 76 30 100 40 C116 48 114 70 98 82 C78 96 44 96 34 86 C26 80 26 72 30 64 Z" />
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((k) => <ellipse key={`${r}${k}`} cx={44 + k * 11 - r * 1.5} cy={48 + r * 9} rx="3.6" ry="3" fill="#fbe08a" stroke="#d9a53a" strokeWidth="1" />))}
      <Blob c={c} k="#9ccc5a" d="M24 82 C38 86 58 88 76 94 C58 100 34 98 24 82 Z" sw={2.8} />
      <Gleam x={60} y={44} rx={10} ry={3} rot={-14} />
    </g>
    case 'GrilledShiitake': return <g>
      <Blob c={c} k="#efe1c6" d={rrect(54, 64, 20, 34, 8)} />
      <Blob c={c} k="#9a6a44" d="M18 66 C18 38 42 24 64 24 C86 24 110 38 110 66 C98 74 30 74 18 66 Z" />
      {line('M46 40 L82 56 M82 40 L46 56', '#f4e6cc', 3.4)}
      <Gleam x={42} y={38} rx={9} ry={3.4} rot={-24} />
    </g>
    case 'KingOyster': return <g>
      <Blob c={c} k="#f3ead8" d="M44 46 C44 70 40 96 48 106 C58 112 74 112 82 104 C90 94 84 70 84 46 Z" />
      <Blob c={c} k="#b48a5e" d="M30 50 C30 30 46 20 64 20 C82 20 98 30 98 50 C86 56 42 56 30 50 Z" />
      <Gleam x={46} y={32} rx={8} ry={3} rot={-20} />
    </g>
    case 'Shishito': return <g>
      <Blob c={c} k="#5aa040" d="M20 62 C30 48 64 46 92 50 C104 52 110 58 108 64 C104 72 76 80 50 80 C32 80 16 74 20 62 Z" />
      <path d="M106 58 C112 52 116 46 118 40" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M106 58 C112 52 116 46 118 40" fill="none" stroke="#6aa848" strokeWidth="3" strokeLinecap="round" />
      <Gleam x={46} y={56} rx={10} ry={3} rot={-6} />
    </g>
    case 'Okra': return <g>
      <Blob c={c} k="#6cae4a" d="M22 64 C34 50 70 44 98 52 L108 60 L98 70 C72 80 34 78 22 64 Z" />
      {line('M36 58 L98 56 M36 70 L96 64', '#4a8a30', 2)}
      <Blob c={c} k="#8cc05e" d={rrect(100, 52, 14, 18, 5)} sw={2.8} />
      <Gleam x={46} y={56} rx={9} ry={2.4} rot={-6} />
    </g>
    case 'Asparagus': return <g>
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`rotate(${-18 + k * 4} 64 64)`}>
          <Blob c={c} k="#7cb84e" d={rrect(14, 52 + k * 12, 92, 10, 5)} sw={2.8} />
          <Blob c={c} k="#5e9a3a" d={`M100 ${52 + k * 12} C110 ${50 + k * 12} 116 ${55 + k * 12} 116 ${57 + k * 12} C116 ${59 + k * 12} 110 ${64 + k * 12} 100 ${62 + k * 12} Z`} sw={2.8} />
          {[34, 56, 78].map((x) => line(`M${x} ${55 + k * 12} l4 2`, '#4a7e2c', 1.6, x))}
        </g>
      ))}
    </g>
    case 'Potato': return <g>
      <Blob c={c} k="#d9b47a" d="M22 66 C20 44 42 34 66 36 C92 38 110 50 108 70 C106 88 84 96 62 94 C38 92 24 84 22 66 Z" />
      {[[40, 50], [86, 52], [92, 78], [36, 80]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.6" ry="1.6" fill="#9a7444" />)}
      <Gleam x={44} y={46} rx={9} ry={3.4} rot={-18} />
    </g>
    case 'SweetPotato': return <g>
      <Blob c={c} k="#b03e5e" d="M14 70 C24 52 50 44 72 44 C96 44 114 56 116 66 C110 78 92 88 66 88 C42 88 24 82 14 70 Z" />
      {line('M30 62 q8 4 14 2 M78 54 q8 4 14 2 M84 80 q6 -3 12 -2', '#7e2440', 1.8)}
      <Gleam x={48} y={56} rx={10} ry={3} rot={-10} />
    </g>
    case 'Onion': return <g>
      <Blob c={c} k="#e0a050" d="M64 24 C70 34 98 44 100 70 C102 92 84 102 64 102 C44 102 26 92 28 70 C30 44 58 34 64 24 Z" />
      {line('M64 30 C56 50 52 76 56 100 M64 30 C72 50 76 76 72 100', '#b8762e', 1.8)}
      <path d="M64 24 L62 14 M64 24 L68 15" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <Gleam x={46} y={58} rx={4} ry={9} rot={18} />
    </g>
    case 'Negi': return <g transform="rotate(-20 64 64)">
      <Blob c={c} k="#f6f6e6" d={rrect(14, 54, 66, 20, 9)} />
      <Blob c={c} k="#8ccf5c" d="M76 54 C92 46 108 46 118 50 L118 58 C108 56 96 58 84 64 L84 74 C96 70 108 72 118 76 L116 82 C102 80 90 80 76 74 Z" sw={2.8} />
      {line('M20 58 v12', '#cfd4b4', 1.6)}
      <Gleam x={30} y={58} rx={8} ry={2.4} rot={0} />
    </g>
    case 'Carrot': return <g>
      <Blob c={c} k="#5ea83c" d="M88 34 C92 22 100 16 106 14 C104 22 100 30 94 38 Z" sw={2.6} />
      <Blob c={c} k="#5ea83c" d="M92 38 C102 30 114 28 120 30 C114 36 104 40 96 42 Z" sw={2.6} />
      <Blob c={c} k="#f08a2c" d="M16 104 C30 86 66 54 86 36 C94 32 100 38 98 46 C80 66 46 96 22 108 C18 110 14 108 16 104 Z" />
      {line('M46 76 l6 5 M62 62 l6 5 M74 50 l5 4', '#c4641a', 2)}
      <Gleam x={78} y={44} rx={6} ry={2} rot={-40} />
    </g>
    case 'Gobo': return <g transform="rotate(-24 64 64)">
      {[0, 1].map((k) => <Blob key={k} c={c} k="#8a6a48" d={rrect(10, 52 + k * 16, 108, 13, 6)} sw={2.8} />)}
      {[30, 54, 78, 98].map((x) => line(`M${x} 55 v8 M${x + 6} 71 v8`, '#5e4428', 1.6, x))}
    </g>
    case 'Daikon': return <g>
      <Blob c={c} k="#7ab84c" d="M52 30 C46 18 50 10 58 8 C60 18 62 24 64 30 Z" sw={2.6} />
      <Blob c={c} k="#7ab84c" d="M64 30 C66 18 74 10 82 12 C80 20 74 26 70 32 Z" sw={2.6} />
      <Blob c={c} k="#f6f4ea" d="M44 34 C56 28 76 28 86 34 C90 56 86 84 70 104 C66 110 60 110 56 104 C42 84 40 56 44 34 Z" />
      <Gleam x={52} y={50} rx={3.6} ry={10} rot={6} />
    </g>
    // ---- the summer vegetables (the owner's, 2026-11-12)
    case 'Tomato': return <g>
      <Blob c={c} k="#ec3a2c" d="M24 64 C24 42 42 32 64 32 C86 32 104 42 104 64 C104 88 86 100 64 100 C42 100 24 88 24 64 Z" />
      <Blob c={c} k="#5ea83c" d="M64 30 L56 40 L64 38 L70 44 L72 36 L82 36 L72 30 L74 22 L66 28 L58 22 Z" sw={2.4} />
      <Gleam x={44} y={48} rx={9} ry={4} rot={-30} />
    </g>
    case 'Cucumber': return <g transform="rotate(-18 64 64)">
      <Blob c={c} k="#3f8a34" d="M14 66 C14 54 30 50 64 50 C98 50 114 54 114 66 C114 78 98 82 64 82 C30 82 14 78 14 66 Z" />
      {[[30, 58], [52, 56], [76, 57], [98, 60], [40, 74], [66, 76], [90, 72]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#cfe6a8" />)}
      <path d="M112 64 l6 -3" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <Gleam x={40} y={56} rx={12} ry={2.6} rot={0} />
    </g>
    case 'Eggplant': return <g>
      <Blob c={c} k="#5a2a6e" d="M34 42 C44 30 62 34 74 48 C88 60 106 70 106 88 C106 102 92 108 78 104 C62 100 48 84 40 68 C34 58 30 48 34 42 Z" />
      <Blob c={c} k="#3e7a34" d="M28 36 C34 28 46 28 52 34 C48 40 44 46 38 50 C34 46 30 42 28 36 Z" sw={2.6} />
      <path d="M32 34 L22 24" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M32 34 L22 24" stroke="#3e7a34" strokeWidth="2.4" strokeLinecap="round" />
      <Gleam x={60} y={52} rx={10} ry={3.6} rot={36} />
    </g>
    case 'Piman': return <g>
      <Blob c={c} k="#2f8a26" d="M30 44 C38 32 54 34 64 38 C74 34 90 32 98 44 C106 58 100 84 88 96 C80 102 72 98 64 94 C56 98 48 102 40 96 C28 84 22 58 30 44 Z" />
      {line('M64 40 C60 60 60 80 64 94', '#1f6a18', 2)}
      <Blob c={c} k="#5ea83c" d={rrect(58, 26, 12, 14, 4)} sw={2.6} />
      <Gleam x={44} y={52} rx={4} ry={10} rot={14} />
    </g>
    case 'Paprika': return <g>
      {([['#f2b414', 40, 66], ['#e23a22', 84, 62]] as [string, number, number][]).map(([k, x, y], j) => (
        <g key={j}>
          <Blob c={c} k={k} d={`M${x - 24} ${y - 16} C${x - 16} ${y - 28} ${x} ${y - 26} ${x} ${y - 24} C${x} ${y - 26} ${x + 16} ${y - 28} ${x + 24} ${y - 16} C${x + 30} ${y} ${x + 24} ${y + 28} ${x} ${y + 30} C${x - 24} ${y + 28} ${x - 30} ${y} ${x - 24} ${y - 16} Z`} />
          <Blob c={c} k="#5ea83c" d={rrect(x - 5, y - 34, 10, 12, 3)} sw={2.4} />
          <Gleam x={x - 12} y={y - 10} rx={3.4} ry={8} rot={14} />
        </g>
      ))}
    </g>
    case 'Onigiri': return <g>
      <Blob c={c} k="#fffdf6" d="M64 20 C76 20 106 70 104 88 C102 102 26 102 24 88 C22 70 52 20 64 20 Z" />
      <path d="M38 74 H90 L94 100 Q64 104 34 100 Z" fill="#26342c" stroke={INK} strokeWidth={LINE} strokeLinejoin="round" />
      {line('M50 76 v24 M64 76 v26 M78 76 v24', '#3c5044', 1.6)}
      <Gleam x={48} y={42} rx={8} ry={3} rot={-50} />
    </g>
    case 'NetMochi': return <g>
      {[[44, 70], [84, 66]].map(([x, y], k) => (
        <g key={k}>
          <Blob c={c} k="#fbf6ea" d={`M${x - 20} ${y + 10} C${x - 22} ${y - 8} ${x - 8} ${y - 22} ${x + 4} ${y - 18} C${x + 16} ${y - 14} ${x + 22} ${y} ${x + 20} ${y + 12} C${x + 10} ${y + 18} ${x - 10} ${y + 18} ${x - 20} ${y + 10} Z`} />
          <ellipse cx={x + 4} cy={y + 10} rx="10" ry="3" fill="#e7b76a" opacity="0.6" />
        </g>
      ))}
      <Gleam x={36} y={56} rx={6} ry={2.6} />
    </g>
    case 'MisoSoup': return <g>
      <Blob c={c} k="#b02a20" d="M18 56 H110 C110 80 92 100 64 100 C36 100 18 80 18 56 Z" />
      <Blob c={c} k="#d8a35a" d={ell(64, 56, 46, 12)} />
      {[[48, 54], [70, 58], [80, 52]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 4} y={y - 3} width="8" height="6" rx="1.6" fill="#fffaf0" stroke={INK} strokeWidth="1.4" />)}
      {[[56, 58], [92, 56]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#5ea83c" stroke={INK} strokeWidth="1.2" />)}
      {line('M44 40 q-6 -10 0 -18 M64 38 q-6 -10 0 -18 M84 40 q-6 -10 0 -18', '#c8c0b4', 2.4)}
      <Gleam x={34} y={70} rx={4} ry={8} rot={20} />
    </g>
    case 'Sake': return <g>
      <Blob c={c} k="#dfece6" d="M54 14 H74 V30 C74 40 92 46 92 62 V104 C92 110 88 112 84 112 H44 C40 112 36 110 36 104 V62 C36 46 54 40 54 30 Z" />
      <Blob c={c} k="#c8342a" d={rrect(52, 10, 24, 10, 3)} sw={2.6} />
      <Blob c={c} k="#fbf5e6" d={rrect(42, 62, 44, 34, 4)} sw={2.6} />
      <text x="64" y="86" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2a2a2a" fontFamily="serif">酒</text>
      <Gleam x={46} y={54} rx={2.6} ry={10} rot={0} o={0.75} />
    </g>
    case 'Nori': return <g>
      <Blob c={c} k="#2c3a30" d={rrect(22, 30, 84, 68, 6)} />
      {[0, 1, 2, 3, 4].map((k) => line(`M${30 + k * 16} 34 v60`, '#3e5244', 1.4, k))}
      <Gleam x={36} y={40} rx={10} ry={2.6} rot={0} o={0.35} />
    </g>
    case 'RiceBag': return <g>
      <Blob c={c} k="#f2ead6" d="M28 30 C40 24 88 24 100 30 L104 102 C90 108 38 108 24 102 Z" />
      <path d="M28 30 C40 36 88 36 100 30" fill="none" stroke={INK} strokeWidth="2.4" />
      <text x="64" y="76" textAnchor="middle" fontSize="28" fontWeight="700" fill="#2a2a2a" fontFamily="serif">米</text>
      <circle cx="88" cy="90" r="6" fill="#d04558" />
      <Gleam x={38} y={48} rx={3} ry={10} rot={4} o={0.7} />
    </g>
    default: return null
  }
}
/** the foods there's a cute picture of */
export const CUTE_IDS = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Hokke', 'Nodoguro', 'Salmon', 'Buri', 'Gindara',
  'ShrimpSkewer', 'Squid', 'Scallop', 'Yakitori', 'PorkBelly', 'BloodCake', 'Sausage', 'GrilledCorn', 'GrilledShiitake', 'KingOyster', 'Shishito',
  'Okra', 'Asparagus', 'Potato', 'SweetPotato', 'Onion', 'Negi', 'Carrot', 'Gobo', 'Daikon', 'Tomato', 'Cucumber', 'Eggplant', 'Piman', 'Paprika',
  'Onigiri', 'NetMochi', 'MisoSoup', 'Sake', 'Nori', 'RiceBag'])
/** a food's cute picture, on the 128 square (`u`: the ids of its gradients, unique to this picture) */
export function CuteFood({ id, u }: { id: string; u: string }) {
  return <g>{draw(id, { u, n: 0 })}</g>
}
