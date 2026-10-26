// A stick of binchotan as it is: dark grey-black, the bark's rough ridges and long cracks running down it, a little dusty with ash, each one a
// different thickness, bent and cut off square at both ends. One texture and one way of making the shape, for the crate's sticks, the one in
// the hand and those thrown on the fire.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

let map: THREE.CanvasTexture | null = null
/** the stick's surface: charcoal grey with long streaks and cracks down it, pale ash dust here and there, specks, and short cross cracks */
export function binchotanMap() {
  if (map || typeof document === 'undefined') return map
  const W = 128, H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  let seed = 17
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = '#5b5e63'
  g.fillRect(0, 0, W, H)
  // (broad tonal bands down the stick: some darker, some lighter, like the grain of the wood it was)
  for (let i = 0; i < 22; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(24,26,29,${0.16 + rnd() * 0.22})` : `rgba(150,154,160,${0.08 + rnd() * 0.14})`
    g.fillRect(rnd() * W, 0, 3 + rnd() * 10, H)
  }
  // (long thin cracks and ridges, wavering a little)
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W
    g.strokeStyle = rnd() < 0.62 ? `rgba(14,15,17,${0.45 + rnd() * 0.4})` : `rgba(150,154,160,${0.12 + rnd() * 0.2})`
    g.lineWidth = 0.5 + rnd() * 1.6
    g.beginPath()
    g.moveTo(x, rnd() * 60)
    g.bezierCurveTo(x + (rnd() - 0.5) * 8, 90, x + (rnd() - 0.5) * 8, 170, x + (rnd() - 0.5) * 6, H - rnd() * 60)
    g.stroke()
  }
  // (short cross cracks, where the bark has split)
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = rnd() * H
    g.strokeStyle = `rgba(6,7,8,${0.4 + rnd() * 0.4})`
    g.lineWidth = 0.8 + rnd()
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 5); g.stroke()
  }
  // (ash dust: pale grey patches, thicker toward the cracks, and fine speckle all over)
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = rnd() * H
    const grad = g.createRadialGradient(x, y, 0, x, y, 6 + rnd() * 14)
    grad.addColorStop(0, `rgba(176,180,186,${0.16 + rnd() * 0.16})`)
    grad.addColorStop(1, 'rgba(176,180,186,0)')
    g.fillStyle = grad
    g.fillRect(x - 24, y - 24, 48, 48)
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(200,204,210,0.2)'
    g.fillRect(rnd() * W, rnd() * H, 1, 1 + rnd() * 2)
  }
  map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 4
  return map
}

let burning: { dark: THREE.CanvasTexture; glow: THREE.CanvasTexture } | null = null
/**
 * A stick on the fire, as a pair of textures that share their cracks, after the way binchotan burns: its skin crazes into blocks (rings of
 * cracks around the stick, short ones along it between them, staggered like brickwork, every line jagged), the cracks open and glow from the
 * fire inside (a wide orange bloom, orange, a hot yellow core), the blocks' corners and edges catch a dull red, and their faces go grey with ash
 * in patches, darker where the char shows through. The glow is the emissive map, so it's the cracks that light up.
 */
export function burningMaps() {
  if (burning || typeof document === 'undefined') return burning
  const W = 256, H = 512
  let seed = 41
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // (the cracks: each ring round the stick (across the texture) and each short run along it, a jagged polyline)
  const lines: [number, number][][] = []
  const jag = (x0: number, y0: number, x1: number, y1: number, amp: number) => {
    const pts: [number, number][] = []
    const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1
      const o = i === 0 || i === n ? 0 : (rnd() - 0.5) * amp
      pts.push([x0 + (x1 - x0) * t + (nx / l) * o, y0 + (y1 - y0) * t + (ny / l) * o])
    }
    return pts
  }
  const rings: number[] = []
  for (let y = 10 + rnd() * 12; y < H; y += 26 + rnd() * 22) rings.push(y)
  rings.forEach((y) => lines.push(jag(-4, y, W + 4, y + (rnd() - 0.5) * 10, 7)))
  for (let r = 0; r < rings.length - 1; r++) {
    // (between two rings, a few cracks along the stick, staggered from the row before)
    let x = (r % 2 ? 0.5 : 0) * 40 + rnd() * 20
    while (x < W) {
      lines.push(jag(x, rings[r], x + (rnd() - 0.5) * 8, rings[r + 1], 5))
      x += 28 + rnd() * 40
    }
  }
  const stroke = (g: CanvasRenderingContext2D, style: string, width: number, blur = 0, glow = '') => {
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = style; g.lineWidth = width
    g.shadowColor = glow; g.shadowBlur = blur
    for (const l of lines) {
      for (const dx of [-W, 0, W]) {
        g.beginPath()
        l.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y)))
        g.stroke()
      }
    }
    g.shadowBlur = 0
  }
  const mk = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  // the face: char black, the blocks' faces silvered with ash in soft patches and specks, darker toward the cracks; the cracks deep black
  const dc = document.createElement('canvas'); dc.width = W; dc.height = H
  const d = dc.getContext('2d')!
  d.fillStyle = '#1d1a18'; d.fillRect(0, 0, W, H)
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H, r = 6 + rnd() * 26
    const gr = d.createRadialGradient(x, y, 0, x, y, r)
    const a = 0.12 + rnd() * 0.3
    gr.addColorStop(0, `rgba(176,170,162,${a})`); gr.addColorStop(1, 'rgba(176,170,162,0)')
    d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 2600; i++) {
    d.fillStyle = rnd() < 0.55 ? `rgba(205,200,192,${0.08 + rnd() * 0.18})` : `rgba(0,0,0,${0.15 + rnd() * 0.25})`
    d.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 2.5)
  }
  // (the grain of the wood it was, still in the char: faint lines along the stick)
  for (let i = 0; i < 40; i++) { d.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.12})`; d.fillRect(rnd() * W, 0, 1 + rnd() * 2, H) }
  stroke(d, 'rgba(10,8,7,0.6)', 7)
  stroke(d, 'rgba(0,0,0,0.95)', 3)
  // the glow through the cracks
  const gc = document.createElement('canvas'); gc.width = W; gc.height = H
  const g = gc.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  stroke(g, 'rgba(200,40,6,0.55)', 10, 14, '#c8280a')
  stroke(g, 'rgba(255,96,18,0.95)', 4.5, 6, '#ff6012')
  stroke(g, 'rgba(255,190,80,1)', 1.8, 2, '#ffbe50')
  stroke(g, 'rgba(255,245,190,1)', 0.6)
  // (the heat showing at some blocks' corners and in patches of their faces, a dull red)
  for (let i = 0; i < 40; i++) {
    const x = rnd() * W, y = rnd() * H, r = 5 + rnd() * 16
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, `rgba(255,70,14,${0.2 + rnd() * 0.35})`); gr.addColorStop(1, 'rgba(255,70,14,0)')
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  burning = { dark: mk(dc), glow: mk(gc) }
  return burning
}

/** how thick the hollow is, as a part of the stick's radius */
const BORE = 0.46
/**
 * A stick `len` long and about `r` thick, ridged, a little bent and a little thicker at one end; `seed` makes each one its own. Hollow: a bore runs
 * down it from end to end (the way a bamboo-charcoal tube is), the ends are rings, the bore's wall faces in.
 */
export function binchotanGeo(len: number, r: number, seed = 0) {
  // (sizes in steps, so the many random sticks share a few shapes)
  const L = Math.round(len / 0.02) * 0.02, R = Math.round(r / 0.002) * 0.002
  const key = `${L.toFixed(3)}|${R.toFixed(4)}|${seed % 8}`
  const hit = cache.get(key)
  if (hit) return hit
  const outer = new THREE.CylinderGeometry(R, R * 1.07, L, 11, 14, true)
  const inner = new THREE.CylinderGeometry(R * BORE, R * 1.07 * BORE, L, 11, 14, true)
  // (the bore's wall turned inside out, to face the hollow)
  const idx = inner.index!
  for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t) }
  const nrm = inner.attributes.normal
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i))
  const ring = (y: number, ro: number, ri: number, up: boolean) => {
    const g = new THREE.RingGeometry(ri, ro, 11, 1)
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2)
    g.translate(0, y, 0)
    return g
  }
  const g = mergeGeometries([outer, inner, ring(L / 2, R, R * BORE, true), ring(-L / 2, R * 1.07, R * 1.07 * BORE, false)])
  const p = g.attributes.position
  const ph = (seed % 8) * 1.7
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const t = y / L + 0.5
    const a = Math.atan2(z, x)
    // (the ridges of the bark: wide ones and fine ones, running down the stick with a slow twist, the surface rough at a finer grain still; the bore only a little)
    const inBore = Math.hypot(x, z) < R * 0.75
    const bump = inBore ? 1 + 0.04 * Math.sin(a * 4 + y * 30 + ph) : 1 + 0.11 * Math.sin(a * 3 + ph + t * 2) + 0.07 * Math.sin(a * 6 - ph + t * 5) + 0.035 * Math.sin(a * 11 + y * 40 + ph) + 0.03 * Math.sin(y * 23 + a * 2)
    // (a stick isn't straight: a gentle bow along it)
    const bow = 0.035 * L * Math.sin(t * Math.PI) * Math.cos(ph)
    const bowZ = 0.03 * L * Math.sin(t * Math.PI) * Math.sin(ph)
    p.setXYZ(i, x * bump + bow, y, z * bump + bowZ)
  }
  g.computeVertexNormals()
  cache.set(key, g)
  return g
}

const cache = new Map<string, THREE.BufferGeometry>()
