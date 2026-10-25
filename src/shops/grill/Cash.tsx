// The money at the till: yen notes (1000 blue, 5000 violet, 10000 brown, the 2024 series) and coins (1, 5, 10, 50, 100, 500), drawn
// the way they are in the drawer: stacks of notes, piles of coins, each with its own printed face.

import { useMemo } from 'react'
import * as THREE from 'three'

/** a canvas texture drawn by `draw` */
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export type Note = 1000 | 5000 | 10000
export type CoinKind = 1 | 5 | 10 | 50 | 100 | 500
/** a note's size (the real ones are 150 x 76, 156 x 76 and 160 x 76 mm), in the till's units */
export const NOTE_W = 0.12, NOTE_D = 0.062

/**
 * The notes as the 2024 series has them: the figure large at the top left, 日本銀行券 along the top, the portrait in engraving at the right with
 * the watermark beside it, the striped hologram at the left edge, the governor's red seal, the serial numbers top left and bottom right, the
 * amount in characters at the foot. Each in its colour: 10000 brown with green, 5000 violet, 1000 blue. (The portraits are drawn as a figure
 * in a frock coat, not the real faces.)
 */
const NOTES: Record<Note, { paper: string; tint: string; ink: string; deep: string; han: string; w: number }> = {
  1000: { paper: '#dfe6ee', tint: '#9db6d4', ink: '#2e4d78', deep: '#1d3354', han: '千円', w: 150 },
  5000: { paper: '#ebe4ee', tint: '#bfa6cf', ink: '#5a3d7c', deep: '#3a2654', han: '五千円', w: 156 },
  10000: { paper: '#ece6d6', tint: '#c3ad7c', ink: '#5e4a26', deep: '#3d3016', han: '壱万円', w: 160 },
}
const noteFace = (kind: Note) => {
  const n = NOTES[kind]
  const W = 512, H = 256
  return tex(W, H, (g) => {
    // (the paper, with its colour washed across from the right, and a fine guilloche over it)
    g.fillStyle = n.paper
    g.fillRect(0, 0, W, H)
    const wash = g.createLinearGradient(0, 0, W, 0)
    wash.addColorStop(0, n.paper); wash.addColorStop(0.45, n.tint); wash.addColorStop(1, n.paper)
    g.globalAlpha = 0.75
    g.fillStyle = wash
    g.fillRect(0, 0, W, H)
    if (kind === 10000) {
      // (the 10000's green underprint)
      g.globalAlpha = 0.25
      g.fillStyle = '#7f9a68'
      g.beginPath(); g.ellipse(250, 150, 150, 80, 0, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 0.2
    g.strokeStyle = n.ink
    g.lineWidth = 0.7
    for (let k = 0; k < 46; k++) {
      g.beginPath()
      for (let x = 0; x <= W; x += 6) {
        const y = 40 + k * 4.4 + Math.sin(x / 23 + k * 0.7) * 6 + Math.sin(x / 61 + k) * 4
        if (x) g.lineTo(x, y); else g.moveTo(x, y)
      }
      g.stroke()
    }
    g.globalAlpha = 1
    // (the frame: a fine double line)
    g.strokeStyle = n.ink
    g.lineWidth = 2.5
    g.strokeRect(8, 8, W - 16, H - 16)
    g.lineWidth = 0.8
    g.strokeRect(14, 14, W - 28, H - 28)
    // (the hologram: a striped band down the left, its colours shifting)
    const holo = g.createLinearGradient(0, 30, 0, 226)
    for (const [t, c] of [[0, '#d9d2c4'], [0.2, '#b8d6e8'], [0.4, '#e6c8e0'], [0.6, '#cfe6c2'], [0.8, '#efe0b0'], [1, '#d9d2c4']] as [number, string][]) holo.addColorStop(t, c)
    g.fillStyle = holo
    g.fillRect(34, 22, 30, 212)
    g.strokeStyle = 'rgba(120,120,120,0.6)'
    g.lineWidth = 0.6
    for (let y = 26; y < 232; y += 5) { g.beginPath(); g.moveTo(34, y); g.lineTo(64, y + 3); g.stroke() }
    g.beginPath(); g.ellipse(49, 128, 10, 14, 0, 0, Math.PI * 2); g.stroke()
    // (the figure, large, top left; 日本銀行券 along the top)
    g.fillStyle = n.deep
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    g.font = `900 ${kind === 10000 ? 64 : 70}px "Arial Black", "Helvetica Neue", sans-serif`
    g.fillText(String(kind), 78, 86)
    g.font = 'bold 26px "Noto Serif JP", "Yu Mincho", serif'
    g.textAlign = 'center'
    g.fillText('日本銀行券', 262, 46)
    // (the amount in characters, at the foot, and the bank's name small beneath)
    g.font = 'bold 36px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText(n.han, 210, 196)
    g.font = '13px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText('日本銀行', 210, 222)
    // (the serial numbers, brown, top left under the figure and bottom right)
    g.font = 'bold 15px "Courier New", monospace'
    g.fillStyle = '#7a3a18'
    g.textAlign = 'left'
    g.fillText('AB 123456 C', 82, 112)
    g.textAlign = 'right'
    g.fillText('AB 123456 C', 488, 236)
    // (the watermark: a pale oval of the same face, left of the portrait)
    g.globalAlpha = 0.16
    g.fillStyle = '#ffffff'
    g.beginPath(); g.ellipse(332, 128, 30, 42, 0, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 1
    // (the portrait at the right: an engraved bust in an oval vignette)
    const px = 428, py = 128
    g.save()
    g.beginPath(); g.ellipse(px, py, 62, 92, 0, 0, Math.PI * 2); g.clip()
    g.fillStyle = n.tint
    g.fillRect(px - 70, py - 100, 140, 200)
    g.strokeStyle = n.deep
    g.globalAlpha = 0.35
    g.lineWidth = 0.6
    for (let y = py - 100; y < py + 100; y += 2.5) { g.beginPath(); g.moveTo(px - 70, y); g.lineTo(px + 70, y + 8); g.stroke() }
    g.globalAlpha = 1
    g.fillStyle = n.deep
    // (shoulders in a dark coat, a white collar)
    g.beginPath(); g.ellipse(px, py + 98, 58, 52, 0, Math.PI, Math.PI * 2); g.fill()
    g.fillStyle = n.paper
    g.beginPath(); g.moveTo(px - 12, py + 46); g.lineTo(px, py + 70); g.lineTo(px + 12, py + 46); g.closePath(); g.fill()
    // (the head: the face lit, hair dark, shaded in hatching)
    g.fillStyle = n.paper
    g.beginPath(); g.ellipse(px, py - 8, 26, 34, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = n.ink
    g.lineWidth = 0.7
    g.globalAlpha = 0.5
    for (let y = py - 40; y < py + 26; y += 3) { g.beginPath(); g.moveTo(px + 6, y); g.lineTo(px + 26, y + 4); g.stroke() }
    g.globalAlpha = 1
    g.fillStyle = n.deep
    g.beginPath(); g.ellipse(px, py - 30, 27, 16, 0, Math.PI, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(px, py + 34, 10, 8, 0, 0, Math.PI * 2); g.fill()
    g.lineWidth = 1.4; g.strokeStyle = n.deep
    g.beginPath(); g.ellipse(px, py - 8, 26, 34, 0, 0, Math.PI * 2); g.stroke()
    g.restore()
    g.strokeStyle = n.ink; g.lineWidth = 1.5
    g.beginPath(); g.ellipse(px, py, 62, 92, 0, 0, Math.PI * 2); g.stroke()
    // (the governor's seal: red, square, the characters in it)
    g.fillStyle = '#c0392b'
    g.fillRect(330, 176, 34, 34)
    g.fillStyle = '#f6e2d8'
    g.font = 'bold 13px "Noto Serif JP", "Yu Mincho", serif'
    g.textAlign = 'center'
    g.fillText('総裁', 347, 191)
    g.fillText('之印', 347, 206)
    // (the tactile marks for the blind, at the edges)
    g.fillStyle = n.deep
    for (let k = 0; k < (kind === 1000 ? 1 : kind === 5000 ? 2 : 3); k++) g.fillRect(20, 40 + k * 14, 8, 8)
  })
}
/** each note's length against the 10000's (they're 150, 156 and 160 mm long) */
export const NOTE_LEN = (kind: Note) => NOTES[kind].w / 160

/**
 * The coins: each its metal and its design. 500 the two-colour one (a gold-coloured ring round a lighter centre, paulownia), 100 cherry
 * blossoms, 50 chrysanthemums round its hole, 10 the Phoenix Hall, 5 a rice ear round its hole, 1 a young tree. The milled edges drawn as
 * a ring of ticks.
 */
const COINS: Record<CoinKind, { base: string; edge: string; ink: string; r: number; hole: boolean }> = {
  1: { base: '#dcdedf', edge: '#9a9c9e', ink: '#6a6c6e', r: 0.0085, hole: false },
  5: { base: '#d2b25a', edge: '#8e7230', ink: '#6f5522', r: 0.0095, hole: true },
  10: { base: '#c0764a', edge: '#7e4624', ink: '#6a3a1c', r: 0.0105, hole: false },
  50: { base: '#d4d6d8', edge: '#8c8e90', ink: '#5e6062', r: 0.0095, hole: true },
  100: { base: '#d9dbdc', edge: '#96989a', ink: '#5e6062', r: 0.0108, hole: false },
  500: { base: '#d0b768', edge: '#8c7634', ink: '#5e4a1a', r: 0.0125, hole: false },
}
const petal = (g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number) => {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2
    g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, r * 0.45, a, 0, Math.PI * 2); g.fill()
  }
}
const coinFace = (kind: CoinKind) => {
  const c = COINS[kind]
  return tex(128, 128, (g) => {
    g.fillStyle = c.base
    g.fillRect(0, 0, 128, 128)
    if (kind === 500) {
      // (the centre a paler alloy than the ring)
      g.fillStyle = '#d8d3bd'
      g.beginPath(); g.arc(64, 64, 38, 0, Math.PI * 2); g.fill()
      g.strokeStyle = c.edge; g.lineWidth = 1.5
      g.beginPath(); g.arc(64, 64, 38, 0, Math.PI * 2); g.stroke()
    }
    // (the design, faint, embossed)
    g.fillStyle = c.ink
    g.strokeStyle = c.ink
    g.globalAlpha = 0.35
    if (kind === 100) { petal(g, 64, 44, 7, 5); petal(g, 46, 70, 6, 5); petal(g, 82, 72, 6, 5) }
    if (kind === 50) for (let k = 0; k < 3; k++) petal(g, 64 + Math.cos(k * 2.1 - 1.6) * 30, 64 + Math.sin(k * 2.1 - 1.6) * 30, 6, 12)
    if (kind === 500) { g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(64 + k * 12, 50, 4, 12, k * 0.3, 0, Math.PI * 2); g.stroke() } g.fillRect(52, 66, 24, 3) }
    if (kind === 10) { g.fillRect(36, 70, 56, 6); g.beginPath(); g.moveTo(30, 70); g.lineTo(64, 46); g.lineTo(98, 70); g.fill(); g.fillRect(44, 76, 4, 12); g.fillRect(80, 76, 4, 12) }
    if (kind === 5) { g.lineWidth = 3; for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(64 + Math.cos(k * 0.5 - 2.9) * 32, 64 + Math.sin(k * 0.5 - 2.9) * 32, 3, 6, k * 0.5, 0, Math.PI * 2); g.stroke() } }
    if (kind === 1) { g.lineWidth = 2.5; g.beginPath(); g.moveTo(64, 84); g.lineTo(64, 52); g.stroke(); petal(g, 64, 48, 6, 2) }
    g.globalAlpha = 1
    const sheen = g.createLinearGradient(0, 0, 128, 128)
    sheen.addColorStop(0, 'rgba(255,255,255,0.3)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.18)')
    g.fillStyle = sheen
    g.fillRect(0, 0, 128, 128)
    // (the raised rim, and the milled edge's ticks for the ones that have them)
    g.strokeStyle = c.edge; g.lineWidth = 5
    g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke()
    if (kind === 100 || kind === 50 || kind === 500) {
      g.lineWidth = 1
      for (let k = 0; k < 90; k++) {
        const a = (k / 90) * Math.PI * 2
        g.beginPath(); g.moveTo(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55); g.lineTo(64 + Math.cos(a) * 61, 64 + Math.sin(a) * 61); g.stroke()
      }
    }
    g.fillStyle = c.ink
    g.textAlign = 'center'; g.textBaseline = 'middle'
    if (c.hole) {
      g.fillStyle = '#2c2a26'
      g.beginPath(); g.arc(64, 64, 13, 0, Math.PI * 2); g.fill()
      g.fillStyle = c.ink
      g.font = 'bold 22px sans-serif'
      g.fillText(String(kind), 64, 100)
    } else {
      g.font = `bold ${kind >= 100 ? 34 : 40}px sans-serif`
      g.fillText(String(kind), 64, kind === 10 || kind === 1 ? 104 : 90)
    }
  })
}

const noteTex = new Map<Note, THREE.Texture>()
const coinTex = new Map<CoinKind, THREE.Texture>()
const noteMats = (kind: Note) => {
  if (!noteTex.has(kind)) noteTex.set(kind, noteFace(kind))
  const edge = new THREE.MeshToonMaterial({ color: '#e9e4d0' })
  return [edge, edge, new THREE.MeshToonMaterial({ color: '#ffffff', map: noteTex.get(kind) }), edge, edge, edge]
}
const coinMats = (kind: CoinKind) => {
  if (!coinTex.has(kind)) coinTex.set(kind, coinFace(kind))
  const side = new THREE.MeshToonMaterial({ color: COINS[kind].edge })
  return [side, new THREE.MeshToonMaterial({ color: '#ffffff', map: coinTex.get(kind) }), side]
}
const NOTE_GEO = new THREE.BoxGeometry(NOTE_W, 1, NOTE_D)
const COIN_GEO: Partial<Record<CoinKind, THREE.CylinderGeometry>> = {}
const coinGeo = (kind: CoinKind) => (COIN_GEO[kind] ??= new THREE.CylinderGeometry(COINS[kind].r, COINS[kind].r, 1, 20))

/** a stack of `n` notes lying flat (its long side along x), its base at the group's y = 0 */
export function NoteStack({ kind, n = 1, ...rest }: { kind: Note; n?: number } & Record<string, unknown>) {
  const mats = useMemo(() => noteMats(kind), [kind])
  const h = 0.0012 * n + 0.001
  return <group {...rest}><mesh geometry={NOTE_GEO} material={mats} scale={[NOTE_LEN(kind), h, 1]} position-y={h / 2} castShadow /></group>
}
/** a stack of `n` coins, its base at the group's y = 0 */
export function CoinStack({ kind, n = 1, ...rest }: { kind: CoinKind; n?: number } & Record<string, unknown>) {
  const mats = useMemo(() => coinMats(kind), [kind])
  const h = 0.0016 * n
  return <group {...rest}><mesh geometry={coinGeo(kind)} material={mats} scale={[1, h, 1]} position-y={h / 2} castShadow /></group>
}

/** a sum made up from the fewest notes and coins, biggest first */
export function changeOf(sum: number): (Note | CoinKind)[] {
  const out: (Note | CoinKind)[] = []
  for (const d of [10000, 5000, 1000, 500, 100, 50, 10, 5, 1] as const) {
    while (sum >= d && out.length < 9) { out.push(d); sum -= d }
  }
  return out
}
export const isNote = (v: number): v is Note => v >= 1000

/**
 * Coins lying loose in a cup, as they do in a till: `n` of them heaped in a `w` x `d` patch, flat or a little tipped, piling up toward the
 * cup's middle; one instanced mesh, so a full cup is one draw. The same `seed` gives the same heap.
 */
export function CoinPile({ kind, n, w, d, seed = 1, ...rest }: { kind: CoinKind; n: number; w: number; d: number; seed?: number } & Record<string, unknown>) {
  const mats = useMemo(() => coinMats(kind), [kind])
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(coinGeo(kind), mats, n)
    let r = seed * 9301 + kind * 49297
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
    const o = new THREE.Object3D()
    const t = 0.0016
    const rad = COINS[kind].r
    const placed: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      // (each coin dropped somewhere in the cup, more toward the middle, resting on whatever's under it there)
      const x = (rnd() + rnd() - 1) * (w / 2 - rad)
      const z = (rnd() + rnd() - 1) * (d / 2 - rad)
      const under = placed.filter((p) => Math.hypot(p.x - x, p.z - z) < rad * 1.6).reduce((a, p) => Math.max(a, p.y + t), 0)
      o.position.set(x, under + t / 2, z)
      o.rotation.set((rnd() - 0.5) * 0.24, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.24)
      o.scale.set(1, t, 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      placed.push(o.position.clone())
    }
    m.castShadow = true
    return m
  }, [kind, n, w, d, seed, mats])
  return <group {...rest}><primitive object={mesh} /></group>
}
