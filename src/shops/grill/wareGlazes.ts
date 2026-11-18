// The shop's ware in its glazes (item 278, the owner's, 2026-11-17: 「這兩瓷器供你做參考，你是資深遊戲設計師，目前碗盤的樣子還不OK」, after a
// crackled white bowl with a splash of green and iron-painted leaves, and an oil-spot tenmoku): each kind of piece its own glaze, as a shop
// puts its ware together (器の取り合わせ), a set and not all alike. The round plates a white glaze crazed all over (貫入), grasses and leaves
// brushed in iron (鉄絵) and a pour of Oribe green over one side; the long fish plates Oribe, green over one end, an iron-painted pattern on
// the cream; the little plates Kiseto, a soft yellow with copper-green spots. (The soy dishes stay 染付, wareDesigns; the rice bowls are
// tenmoku, blender/sidebowls.py; the soup bowls lacquer.) Each picture top-down for the plate's shape (wareGeometry's, the plate's rim the
// picture's edge), drawn on first use; the brown of the glaze thinning over the rim (口紅) all round.
import * as THREE from 'three'
import { forPhone } from './ware'

/** a seeded random sequence, so each design is the same every time */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
/** the iron's brown, brushed */
const IRON = '#4e2612'
/** the rim's brown where the glaze runs thin over it */
const LIP = [118, 70, 40] as const

/** smooth value noise, about 0..1, `cell` px a step */
function noiseOf(seed: number) {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s) }
  return (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

/** the crackle (貫入) as a darkening 0..1 a pixel: the edges of cells about `cell` px across (a jittered grid's Voronoi), and finer ones
 * inside them fainter; made once for a picture's size and shared by its designs */
const CRACKS = new Map<string, Float32Array>()
function cracksOf(W: number, H: number, cell: number, seed: number) {
  const key = `${W}x${H}|${cell}|${seed}`
  let out = CRACKS.get(key)
  if (out) return out
  out = new Float32Array(W * H)
  for (const [c, k, w] of [[cell, 1, 1.3], [cell * 0.42, 0.45, 0.9]] as const) {
    const nx = Math.ceil(W / c) + 2, ny = Math.ceil(H / c) + 2
    const rnd = seeded(seed + Math.round(c * 7))
    const sx = new Float32Array(nx * ny), sy = new Float32Array(nx * ny)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { sx[j * nx + i] = (i - 1 + 0.1 + 0.8 * rnd()) * c; sy[j * nx + i] = (j - 1 + 0.1 + 0.8 * rnd()) * c }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ci = Math.floor(x / c) + 1, cj = Math.floor(y / c) + 1
      let d1 = 1e9, d2 = 1e9
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        const q = j * nx + i, dx = sx[q] - x, dy = sy[q] - y, dd = dx * dx + dy * dy
        if (dd < d1) { d2 = d1; d1 = dd } else if (dd < d2) d2 = dd
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1)
      if (e < w) out[y * W + x] = Math.max(out[y * W + x], k * (1 - e / w))
    }
  }
  CRACKS.set(key, out)
  return out
}

/** the glaze's unevenness for a picture's size, two scales of noise, made once and shared by its designs (each reads it shifted by its own
 * amount): 8 sines a pixel each time made it a third of a second at the shop's opening */
const UNEVEN = new Map<string, Float32Array>()
function unevenOf(W: number, H: number) {
  const key = `${W}x${H}`
  let out = UNEVEN.get(key)
  if (out) return out
  out = new Float32Array(W * H)
  const n1 = noiseOf(5), n2 = noiseOf(22)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[y * W + x] = 0.65 * n1(x / 90, y / 90) + 0.35 * n2(x / 23, y / 23)
  UNEVEN.set(key, out)
  return out
}
/** the glaze laid over the picture, pixel by pixel: its colour a little uneven (where it ran thicker and thinner), crazed by `crack` (k how
 * dark the cracks read), the rim's brown where `rim` says (0..1) */
function glaze(g: CanvasRenderingContext2D, W: number, H: number, base: readonly number[], uneven: number, crack: Float32Array | null, k: number,
  seed: number, rim: ((x: number, y: number) => number) | null) {
  const img = g.getImageData(0, 0, W, H), d = img.data
  const un = unevenOf(W, H), sx = (seed * 97) % W, sy = (seed * 61) % H
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4
    const v = 1 - uneven / 2 + uneven * un[((y + sy) % H) * W + ((x + sx) % W)]
    let r = base[0] * v, gg = base[1] * v, b = base[2] * (v * 0.98 + 0.02)
    // (the brown where the glaze thins over the rim, fading in)
    const t = rim ? rim(x, y) : 0
    if (t > 0) { r += (LIP[0] - r) * t; gg += (LIP[1] - gg) * t; b += (LIP[2] - b) * t }
    const c = crack ? crack[y * W + x] * k : 0
    d[p] = r * (1 - c * 0.5); d[p + 1] = gg * (1 - c * 0.56); d[p + 2] = b * (1 - c * 0.62); d[p + 3] = 255
  }
  g.putImageData(img, 0, 0)
}

/** a brush stroke along `pts`, from `w0` wide to `w1`, its ends pointed: as the iron's brushed, a little uneven */
function stroke(g: CanvasRenderingContext2D, pts: [number, number][], w0: number, w1: number, colour = IRON, alpha = 0.92) {
  if (pts.length < 2) return
  const left: [number, number][] = [], right: [number, number][] = []
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
    let nx = -(by - ay), ny = bx - ax
    const l = Math.hypot(nx, ny) || 1
    nx /= l; ny /= l
    const t = i / (pts.length - 1)
    const w = (w0 + (w1 - w0) * t) * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) * 0.5
    left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w])
  })
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = colour
  g.beginPath()
  g.moveTo(...left[0])
  for (const p of left.slice(1)) g.lineTo(...p)
  for (const p of right.reverse()) g.lineTo(...p)
  g.closePath()
  g.fill()
  g.restore()
}
/** points along a quadratic curve */
const curve = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n = 14): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1] })
/** a leaf brushed in one press: a fat teardrop from its stem end, turned `a` */
function leaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, a: number, alpha = 0.9) {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  g.globalAlpha = alpha
  g.fillStyle = IRON
  g.beginPath()
  g.moveTo(0, 0)
  g.bezierCurveTo(len * 0.3, -len * 0.42, len * 0.85, -len * 0.3, len, 0)
  g.bezierCurveTo(len * 0.8, len * 0.36, len * 0.25, len * 0.34, 0, 0)
  g.fill()
  g.restore()
}

/**
 * The iron painting on a round plate's side (its middle left for the food): `motif` 0 a spray of leaves and a flower (as the reference),
 * 1 autumn grasses (秋草) with their seeds, 2 a willow's hanging twigs, 3 horsetail (木賊) in a stand; centred at angle `at` round the
 * plate, `S` the picture's size
 */
function ironMotif(g: CanvasRenderingContext2D, S: number, motif: number, at: number, rnd: () => number) {
  const c = S / 2, R = S * 0.34
  const ox = c + Math.cos(at) * R, oy = c + Math.sin(at) * R
  g.save()
  g.translate(ox, oy)
  g.rotate(at + Math.PI / 2)
  // (as big as reads on the plate at the bar, from the room's cameras: the reference's leaves span a third of the bowl)
  const u = (S / 768) * 2.0
  if (motif === 0) {
    // (a stem arching, five leaves off it, a four-petalled flower at its end, and a ladder of grass across beside it)
    const stem = curve(-60 * u, 30 * u, -10 * u, -30 * u, 55 * u, 10 * u)
    stroke(g, stem, 5 * u, 2 * u)
    ;[[0.15, -1.9], [0.32, 1.2], [0.5, -2.2], [0.68, 1.0], [0.84, -1.6]].forEach(([t, a]) => {
      const [x, y] = stem[Math.round(t * (stem.length - 1))]
      leaf(g, x, y, (20 + rnd() * 8) * u, a + (rnd() - 0.5) * 0.4)
    })
    for (let k = 0; k < 4; k++) leaf(g, 62 * u, 8 * u, 15 * u, k * Math.PI / 2 + 0.4, 0.95)
    g.fillStyle = '#e9e1cf'; g.beginPath(); g.arc(62 * u, 8 * u, 3.5 * u, 0, Math.PI * 2); g.fill()
    const ladder = curve(-80 * u, -38 * u, -40 * u, -60 * u, 10 * u, -52 * u, 10)
    stroke(g, ladder, 3 * u, 1.5 * u, IRON, 0.85)
    ladder.slice(1, -1).forEach(([x, y], i) => { if (i % 2 === 0) stroke(g, [[x - 2 * u, y - 7 * u], [x + 2 * u, y + 7 * u]], 4 * u, 2 * u, IRON, 0.85) })
    for (let k = 0; k < 6; k++) { g.globalAlpha = 0.85; g.fillStyle = IRON; g.beginPath(); g.arc((-30 + rnd() * 90) * u, (-20 + rnd() * 50) * u, (1.5 + rnd() * 2) * u, 0, Math.PI * 2); g.fill() }
  } else if (motif === 1) {
    // (grasses rising from the plate's edge and bending, seed heads as dots along the top ones)
    for (let k = 0; k < 7; k++) {
      const x0 = (-60 + k * 20 + rnd() * 8) * u, h = (60 + rnd() * 50) * u, bend = (rnd() - 0.3) * 50 * u
      stroke(g, curve(x0, 40 * u, x0 + bend * 0.2, 40 * u - h * 0.6, x0 + bend, 40 * u - h), (4 + rnd() * 2) * u, 0.6 * u, IRON, 0.88)
      if (k % 2 === 0) for (let j = 0; j < 5; j++) { g.fillStyle = IRON; g.beginPath(); g.arc(x0 + bend * (0.7 + j * 0.06) + 4 * u, 40 * u - h * (0.72 + j * 0.06), 2 * u, 0, Math.PI * 2); g.fill() }
    }
  } else if (motif === 2) {
    // (a willow branch along the rim, its twigs hanging, a few long leaves on each)
    const br = curve(-90 * u, -20 * u, 0, -45 * u, 90 * u, -15 * u, 18)
    stroke(g, br, 5 * u, 2 * u)
    br.forEach(([x, y], i) => {
      if (i % 3 !== 1) return
      const tw = curve(x, y, x + 6 * u, y + 30 * u, x + (rnd() - 0.5) * 12 * u, y + (55 + rnd() * 25) * u, 10)
      stroke(g, tw, 2 * u, 0.8 * u, IRON, 0.8)
      tw.forEach(([tx, ty], j) => { if (j % 3 === 2) leaf(g, tx, ty, 10 * u, Math.PI / 2 + (j % 2 ? 0.5 : -0.5), 0.85) })
    })
  } else {
    // (horsetail: tall stems in a clump, a dark joint every so often)
    for (let k = 0; k < 6; k++) {
      const x0 = (-40 + k * 16 + rnd() * 6) * u, h = (70 + rnd() * 40) * u
      stroke(g, [[x0, 45 * u], [x0 + (rnd() - 0.5) * 6 * u, 45 * u - h]], 6 * u, 4 * u, IRON, 0.8)
      for (let y = 45 * u - 14 * u; y > 45 * u - h + 6 * u; y -= (12 + rnd() * 6) * u) { g.fillStyle = '#2e140a'; g.fillRect(x0 - 3.5 * u, y, 7 * u, 2 * u) }
    }
  }
  g.restore()
}

/** a pour of green glaze (織部) over the picture: `path` its outline, run darker where it pooled along its edge and in its low places, its
 * edge soft, a few runs (drips) down from it; drawn on its own canvas and laid on with one blur */
function greenPour(g: CanvasRenderingContext2D, W: number, H: number, path: (q: CanvasRenderingContext2D) => void, rnd: () => number,
  drips: [number, number, number, number][] = []) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const q = c.getContext('2d')!
  q.fillStyle = '#4f7a3a'
  path(q); q.fill()
  // (the glaze pooled: darker in blotches and along its edge)
  q.save()
  path(q); q.clip()
  for (let k = 0; k < 40; k++) {
    const x = rnd() * W, y = rnd() * H, r = (0.02 + rnd() * 0.06) * Math.max(W, H)
    const gr = q.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, rnd() < 0.5 ? 'rgba(28, 64, 30, 0.55)' : 'rgba(120, 160, 90, 0.35)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    q.fillStyle = gr
    q.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  q.lineWidth = Math.max(W, H) * 0.012
  q.strokeStyle = 'rgba(24, 56, 26, 0.7)'
  path(q); q.stroke()
  q.restore()
  // (its runs: a narrow tongue down from its edge, darker at its end)
  for (const [x, y, dx, dy] of drips) {
    q.fillStyle = 'rgba(52, 96, 46, 0.9)'
    q.beginPath(); q.ellipse(x + dx / 2, y + dy / 2, Math.hypot(dx, dy) / 2, Math.max(W, H) * 0.008, Math.atan2(dy, dx), 0, Math.PI * 2); q.fill()
    q.fillStyle = 'rgba(26, 60, 28, 0.9)'
    q.beginPath(); q.arc(x + dx, y + dy, Math.max(W, H) * 0.009, 0, Math.PI * 2); q.fill()
  }
  g.save()
  g.filter = `blur(${Math.max(1, Math.round(Math.max(W, H) * 0.002))}px)`
  g.globalAlpha = 0.92
  g.drawImage(c, 0, 0)
  g.restore()
  // (the glaze's gloss: a few pale specks where it's thinnest)
  g.save()
  path(g); g.clip()
  for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(200, 230, 170, 0.35)'; g.beginPath(); g.arc(rnd() * W, rnd() * H, Math.max(W, H) * 0.0025, 0, Math.PI * 2); g.fill() }
  g.restore()
}

const tex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(forPhone(c))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** how many round plates' designs: the iron's four motifs, each with its green poured on a different side */
export const ROUND_GLAZES = 8
const madeRound: (THREE.CanvasTexture | null)[] = []
/** the n-th round plate (any whole number: it wraps): white crackled glaze, its iron painting on one side, a pour of green over another */
export function roundGlaze(n: number): THREE.CanvasTexture | null {
  const i = ((Math.floor(n) % ROUND_GLAZES) + ROUND_GLAZES) % ROUND_GLAZES
  if (madeRound[i] !== undefined) return madeRound[i]
  if (typeof document === 'undefined') return (madeRound[i] = null)
  const S = 768, c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const rnd = seeded(401 + i * 61)
  const mid = S / 2
  // (the rim's brown from 0.47 of the picture out (the plate's lip), stronger to its edge)
  // (a cool white: warm, under the shop's lamps it read pink)
  glaze(g, S, S, [242, 239, 230], 0.07, cracksOf(S, S, 34, 7), 0.6, 3 + i, (x, y) => {
    const r = Math.hypot(x - mid, y - mid) / S
    return r < 0.462 ? 0 : Math.min(1, (r - 0.462) / 0.02)
  })
  const at = i * 2.39
  ironMotif(g, S, i % 4, at, rnd)
  // (the green poured over the rim on the other side, running in toward the middle in a tongue)
  const ga = at + Math.PI * (0.8 + 0.4 * rnd())
  greenPour(g, S, S, (q) => {
    q.beginPath()
    const span = 1.0 + rnd() * 0.4
    for (let k = 0; k <= 48; k++) {
      const a = ga - span / 2 + (span * k) / 48
      q.lineTo(mid + Math.cos(a) * S * 0.52, mid + Math.sin(a) * S * 0.52)
    }
    // (its inner edge a slow flowing line, as glaze poured runs: one tongue reaching in, a gentle swell either side)
    for (let k = 48; k >= 0; k--) {
      const a = ga - span / 2 + (span * k) / 48, t = k / 48
      const reach = 0.36 - 0.12 * Math.sin(t * Math.PI) ** 1.5 - 0.012 * Math.sin(t * 7 + i)
      q.lineTo(mid + Math.cos(a) * S * reach, mid + Math.sin(a) * S * reach)
    }
    q.closePath()
  }, rnd, [[mid + Math.cos(ga) * S * 0.27, mid + Math.sin(ga) * S * 0.27, -Math.cos(ga) * S * 0.05, -Math.sin(ga) * S * 0.05]])
  return (madeRound[i] = tex(c))
}

/** how many little plates' designs */
export const MAME_GLAZES = 3
const madeMame: (THREE.CanvasTexture | null)[] = []
/** the n-th little plate (any whole number: it wraps): Kiseto, a soft yellow, burnt warmer toward the rim, two or three copper-green spots
 * (胆礬) soaked into it, a few lines incised and touched with iron */
export function mameGlaze(n: number): THREE.CanvasTexture | null {
  const i = ((Math.floor(n) % MAME_GLAZES) + MAME_GLAZES) % MAME_GLAZES
  if (madeMame[i] !== undefined) return madeMame[i]
  if (typeof document === 'undefined') return (madeMame[i] = null)
  const S = 512, c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const rnd = seeded(701 + i * 29)
  const mid = S / 2
  glaze(g, S, S, [214, 190, 118], 0.16, null, 0, 11 + i, (x, y) => {
    const r = Math.hypot(x - mid, y - mid) / S
    return r < 0.455 ? 0 : Math.min(1, (r - 0.455) / 0.03)
  })
  // (burnt warmer toward the rim, as Kiseto is where the fire reached it)
  const burn = g.createRadialGradient(mid, mid, S * 0.2, mid, mid, S * 0.5)
  burn.addColorStop(0, 'rgba(160, 90, 30, 0)')
  burn.addColorStop(1, 'rgba(160, 90, 30, 0.28)')
  g.fillStyle = burn
  g.fillRect(0, 0, S, S)
  // (the copper-green spots, soaked in: soft, darker at the heart)
  const spots = 2 + (i % 2)
  for (let k = 0; k < spots; k++) {
    const a = rnd() * Math.PI * 2, r = S * (0.08 + rnd() * 0.24)
    const x = mid + Math.cos(a) * r, y = mid + Math.sin(a) * r, s = S * (0.045 + rnd() * 0.035)
    const gr = g.createRadialGradient(x, y, 0, x, y, s)
    gr.addColorStop(0, 'rgba(46, 104, 66, 0.9)')
    gr.addColorStop(0.55, 'rgba(84, 140, 84, 0.6)')
    gr.addColorStop(1, 'rgba(120, 160, 90, 0)')
    g.fillStyle = gr
    g.fillRect(x - s, y - s, 2 * s, 2 * s)
  }
  // (incised and ironed: a radish with its leaves, or two lines across, or a leaf)
  const u = S / 512
  g.save()
  g.translate(mid, mid)
  g.rotate(i * 1.3)
  if (i === 0) {
    stroke(g, curve(-60 * u, 20 * u, 0, 40 * u, 50 * u, 10 * u), 26 * u, 6 * u, IRON, 0.35)
    stroke(g, curve(-60 * u, 20 * u, 0, 40 * u, 50 * u, 10 * u), 3 * u, 1 * u, IRON, 0.9)
    for (const a of [-0.6, -0.2, 0.25]) stroke(g, curve(50 * u, 10 * u, 70 * u, -10 * u, 50 * u + Math.cos(a) * 60 * u, 10 * u + Math.sin(a) * 60 * u - 30 * u), 7 * u, 1 * u, IRON, 0.85)
  } else if (i === 1) {
    for (const off of [-14, 14]) stroke(g, curve(-120 * u, off * u, 0, (off - 12) * u, 120 * u, off * u), 3 * u, 3 * u, IRON, 0.8)
  } else {
    leaf(g, -50 * u, 10 * u, 110 * u, -0.3, 0.85)
    stroke(g, curve(-50 * u, 10 * u, 0, -10 * u, 50 * u, -25 * u), 2 * u, 1 * u, '#e7d6a0', 0.9)
  }
  g.restore()
  return (madeMame[i] = tex(c))
}

/**
 * The long plates (長角皿) in Oribe: the cream glaze lightly crazed, green poured over one end (its edge waved, pooled dark along it, a
 * run or two), on the cream an iron-painted pattern, Oribe's own: a lattice with rings in it, plum blossoms in outline on a branch, or
 * lines of waves; the brown lip all round and a fine iron line inside it. 1024 by 392 (the plate's 0.30 by 0.115 m), u along it.
 */
export const LONG_GLAZES = 4
const madeLong: (THREE.CanvasTexture | null)[] = []
export function oribeLong(n: number): THREE.CanvasTexture | null {
  const i = ((Math.floor(n) % LONG_GLAZES) + LONG_GLAZES) % LONG_GLAZES
  if (madeLong[i] !== undefined) return madeLong[i]
  if (typeof document === 'undefined') return (madeLong[i] = null)
  const W = 1024, H = Math.round(W * 0.383), px = W / 0.3
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const rnd = seeded(907 + i * 41)
  // (the lip: the outline in to 7 mm, rounded at its corners; brown there)
  const lipAt = (x: number, y: number) => {
    const d = Math.min(x, W - x, y, H - y) / px
    return d > 0.007 ? 0 : Math.min(1, (0.007 - d) / 0.004)
  }
  glaze(g, W, H, [234, 224, 200], 0.08, cracksOf(W, H, 40, 9), 0.4, 21 + i, lipAt)
  // (the green always over the end at the customer's left, where a fish's head lies (item 272): their right front is the garnish's, on the
  // cream (on the green a shiso leaf was lost); the canvas's left is the plate's -x, the customer's right)
  const left = false
  // (the green over one end: from the end in about a third, its edge a slow wave)
  greenPour(g, W, H, (q) => {
    q.beginPath()
    const x0 = left ? -10 : W + 10
    q.moveTo(x0, -10)
    for (let k = 0; k <= 40; k++) {
      const y = -10 + ((H + 20) * k) / 40
      const reach = W * (0.3 + 0.045 * Math.sin(k * 0.36 + i) + 0.012 * Math.sin(k * 1.1))
      q.lineTo(left ? reach : W - reach, y)
    }
    q.lineTo(x0, H + 10)
    q.closePath()
  }, rnd, [[left ? W * 0.31 : W * 0.69, H * 0.55, left ? W * 0.04 : -W * 0.04, H * 0.05]])
  // (the iron pattern on the cream, the other end and the middle's edge (the fish lies along the middle))
  const xs = left ? [W * 0.42, W * 0.95] : [W * 0.05, W * 0.58]
  g.save()
  g.beginPath(); g.rect(xs[0], H * 0.08, xs[1] - xs[0], H * 0.84); g.clip()
  if (i < 2) {
    // (a lattice, a ring in every other square)
    g.strokeStyle = IRON; g.globalAlpha = 0.85; g.lineWidth = px * 0.0012
    const step = px * 0.016
    const xa = left ? W - px * 0.012 - step * 5 : px * 0.012, xb = xa + step * 5
    for (let k = 0; k <= 5; k++) { g.beginPath(); g.moveTo(xa + k * step, H * 0.12); g.lineTo(xa + k * step, H * 0.88); g.stroke() }
    for (let y = H * 0.12; y <= H * 0.88 + 1; y += step) { g.beginPath(); g.moveTo(xa, y); g.lineTo(xb, y); g.stroke() }
    for (let k = 0; k < 5; k++) for (let y = H * 0.12, r = 0; y < H * 0.88 - 1; y += step, r++) {
      if ((k + r) % 2) continue
      g.beginPath(); g.arc(xa + (k + 0.5) * step, y + step / 2, step * 0.28, 0, Math.PI * 2); g.stroke()
    }
  } else {
    // (a plum branch, its blossoms in outline, buds as dots)
    const x0 = left ? W * 0.97 : W * 0.03, dir = left ? -1 : 1
    const br = curve(x0, H * 0.85, x0 + dir * W * 0.12, H * 0.5, x0 + dir * W * 0.2, H * 0.2, 14)
    stroke(g, br, px * 0.004, px * 0.0015, IRON, 0.9)
    g.strokeStyle = IRON; g.lineWidth = px * 0.0011; g.globalAlpha = 0.9
    for (const t of [0.3, 0.6, 0.9]) {
      const [x, y] = br[Math.round(t * (br.length - 1))]
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + t
        g.beginPath(); g.arc(x + Math.cos(a) * px * 0.006, y + Math.sin(a) * px * 0.006, px * 0.0045, 0, Math.PI * 2); g.stroke()
      }
    }
    for (let k = 0; k < 6; k++) { g.fillStyle = IRON; g.beginPath(); g.arc(x0 + dir * W * (0.04 + rnd() * 0.18), H * (0.2 + rnd() * 0.6), px * 0.0018, 0, Math.PI * 2); g.fill() }
  }
  g.restore()
  // (a fine iron line round the well, inside the lip)
  g.strokeStyle = IRON; g.globalAlpha = 0.7; g.lineWidth = px * 0.0009
  const d = 0.0115 * px, r = Math.max(0.002, 0.026 - 0.0115) * px
  g.beginPath(); g.roundRect(d, d, W - 2 * d, H - 2 * d, r); g.stroke()
  g.globalAlpha = 1
  return (madeLong[i] = tex(c))
}
