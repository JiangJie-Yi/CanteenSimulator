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
 * A stick on the fire, as a pair of textures that share their cracks: the charred surface (near-black, broken across into blocks by deep fractures,
 * pale ash dust here and there) and the glow that shows through those fractures (orange, a hot yellow at their middles, a little along the edges),
 * used as the emissive map, so it's the cracks that light up and the faces between them stay black.
 */
export function burningMaps() {
  if (burning || typeof document === 'undefined') return burning
  const W = 128, H = 256
  let seed = 41
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  // (the fractures, drawn the same on both: each a jagged line across the stick, some with a branch running down it)
  type Crack = { pts: [number, number][]; branch: [number, number][] | null }
  const cracks: Crack[] = []
  // (a few short, thin fractures here and there on the stick, each a broken, wandering run along it, with a hairline off it now and then: not stripes)
  for (let n = 0; n < 7; n++) {
    const x0 = 8 + rnd() * (W - 16)
    const y0 = rnd() * (H - 70), len = 40 + rnd() * 80
    const pts: [number, number][] = []
    let x = x0
    for (let y = y0; y <= y0 + len; y += 8 + rnd() * 10) { x += (rnd() - 0.5) * 9; pts.push([x, y]) }
    let branch: [number, number][] | null = null
    if (rnd() < 0.5) {
      const bx = x, by = y0 + len * (0.3 + rnd() * 0.4)
      branch = [[bx, by], [bx + (rnd() - 0.5) * 18, by + 4 + rnd() * 6], [bx + (rnd() - 0.5) * 26, by + 10 + rnd() * 10]]
    }
    cracks.push({ pts, branch })
  }
  const draw = (g: CanvasRenderingContext2D, color: string, width: number, blur: number, glow: string | null) => {
    g.lineCap = 'round'; g.lineJoin = 'round'
    g.strokeStyle = color; g.lineWidth = width
    if (glow) { g.shadowColor = glow; g.shadowBlur = blur } else g.shadowBlur = 0
    for (const c of cracks) {
      g.beginPath(); c.pts.forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); g.stroke()
      if (c.branch) { g.beginPath(); c.branch.forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); g.stroke() }
    }
    g.shadowBlur = 0
  }
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  // the charred face
  const dc = document.createElement('canvas'); dc.width = W; dc.height = H
  const d = dc.getContext('2d')!
  d.fillStyle = '#25221f'; d.fillRect(0, 0, W, H)
  for (let i = 0; i < 26; i++) {
    d.fillStyle = rnd() < 0.6 ? `rgba(8,7,6,${0.2 + rnd() * 0.3})` : `rgba(80,74,68,${0.06 + rnd() * 0.1})`
    d.fillRect(rnd() * W, 0, 2 + rnd() * 9, H)
  }
  draw(d, 'rgba(4,3,3,0.95)', 3, 0, null)
  for (let i = 0; i < 700; i++) {
    d.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(170,164,156,0.14)'
    d.fillRect(rnd() * W, rnd() * H, 1, 1 + rnd() * 2)
  }
  for (let i = 0; i < 12; i++) {
    const x = rnd() * W, yy = rnd() * H
    const gr = d.createRadialGradient(x, yy, 0, x, yy, 5 + rnd() * 11)
    gr.addColorStop(0, `rgba(190,186,178,${0.14 + rnd() * 0.14})`); gr.addColorStop(1, 'rgba(190,186,178,0)')
    d.fillStyle = gr; d.fillRect(x - 20, yy - 20, 40, 40)
  }
  // the light through the fractures
  const gc = document.createElement('canvas'); gc.width = W; gc.height = H
  const g = gc.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  draw(g, 'rgba(255,90,20,0.8)', 4, 8, '#ff5a14')
  draw(g, 'rgba(255,170,60,1)', 1.8, 3, '#ffa03c')
  draw(g, 'rgba(255,235,150,1)', 0.7, 0, null)
  // (a dull red along some of the edges of the blocks: the heat inside showing at their corners)
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W, yy = rnd() * H
    const gr = g.createRadialGradient(x, yy, 0, x, yy, 6 + rnd() * 9)
    gr.addColorStop(0, `rgba(255,70,15,${0.25 + rnd() * 0.3})`); gr.addColorStop(1, 'rgba(255,70,15,0)')
    g.fillStyle = gr; g.fillRect(x - 16, yy - 16, 32, 32)
  }
  burning = { dark: mk(dc, true), glow: mk(gc, true) }
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
