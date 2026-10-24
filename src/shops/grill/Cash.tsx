// The money at the till: yen notes (1000 blue-grey, 5000 violet, 10000 brown) and coins (1, 5, 10, 50, 100, 500), drawn the way
// they are in the drawer: stacks of notes, rolls of coins, each with its own printed face.

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

const NOTES: Record<Note, { base: string; light: string; accent: string; han: string }> = {
  1000: { base: '#7f9fc4', light: '#b7cce4', accent: '#35577f', han: '壹千圓' },
  5000: { base: '#a88ec4', light: '#d3c3e6', accent: '#5f3f8a', han: '五千圓' },
  10000: { base: '#b79a62', light: '#e0cc9a', accent: '#6b4c1e', han: '壱万圓' },
}
const noteFace = (kind: Note) => {
  const n = NOTES[kind]
  return tex(300, 150, (g) => {
    const grad = g.createLinearGradient(0, 0, 300, 150)
    grad.addColorStop(0, n.light)
    grad.addColorStop(0.5, n.base)
    grad.addColorStop(1, n.light)
    g.fillStyle = grad
    g.fillRect(0, 0, 300, 150)
    // (the fine engraved lines: arcs of concentric rings, crossing)
    g.strokeStyle = n.accent
    g.globalAlpha = 0.16
    g.lineWidth = 0.8
    for (let r = 14; r < 330; r += 7) { g.beginPath(); g.arc(230, 150, r, Math.PI, Math.PI * 1.5); g.stroke() }
    for (let r = 14; r < 200; r += 7) { g.beginPath(); g.arc(60, 0, r, 0, Math.PI * 0.5); g.stroke() }
    g.globalAlpha = 1
    // (the border: a heavy frame with a thin line inside it)
    g.strokeStyle = n.accent
    g.lineWidth = 5
    g.strokeRect(5, 5, 290, 140)
    g.lineWidth = 1.2
    g.strokeRect(13, 13, 274, 124)
    // (the portrait oval, left, with a shoulder line; the watermark oval at the right is paler)
    g.fillStyle = n.light
    g.beginPath(); g.ellipse(70, 78, 40, 52, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = n.accent; g.lineWidth = 1.5; g.stroke()
    g.fillStyle = n.accent
    g.globalAlpha = 0.55
    g.beginPath(); g.arc(70, 66, 15, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(70, 112, 28, 20, 0, Math.PI, Math.PI * 2); g.fill()
    g.globalAlpha = 0.18
    g.beginPath(); g.ellipse(228, 82, 32, 44, 0, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 1
    // (the figures, large, and the words)
    g.fillStyle = n.accent
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `bold ${kind === 10000 ? 56 : 62}px "Times New Roman", serif`
    g.fillText(String(kind), 188, 60)
    g.font = 'bold 17px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText('日本銀行券', 170, 24)
    g.font = 'bold 20px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText(n.han, 232, 112)
    g.font = '9px "Courier New", monospace'
    g.textAlign = 'left'
    g.fillText('AB 123456 C', 124, 132)
    // (the foil patch at the edge: a pale stripe)
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.fillRect(268, 22, 14, 52)
  })
}

const COINS: Record<CoinKind, { base: string; edge: string; ink: string; r: number; hole: boolean }> = {
  1: { base: '#dcdedf', edge: '#9a9c9e', ink: '#6a6c6e', r: 0.0085, hole: false },
  5: { base: '#d2b25a', edge: '#8e7230', ink: '#6f5522', r: 0.0095, hole: true },
  10: { base: '#c0764a', edge: '#7e4624', ink: '#6a3a1c', r: 0.0105, hole: false },
  50: { base: '#d4d6d8', edge: '#8c8e90', ink: '#5e6062', r: 0.0095, hole: true },
  100: { base: '#d9dbdc', edge: '#96989a', ink: '#5e6062', r: 0.0108, hole: false },
  500: { base: '#d0b768', edge: '#8c7634', ink: '#5e4a1a', r: 0.0125, hole: false },
}
const coinFace = (kind: CoinKind) => {
  const c = COINS[kind]
  return tex(64, 64, (g) => {
    g.fillStyle = c.base
    g.fillRect(0, 0, 64, 64)
    // (the metal's sheen: a soft light from one side; the 500 yen's two metals, a gold ring round a silver centre)
    if (kind === 500) {
      g.fillStyle = '#e1e1dc'
      g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.fill()
      g.strokeStyle = c.edge; g.lineWidth = 1.2
      g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.stroke()
    }
    const sheen = g.createLinearGradient(0, 0, 64, 64)
    sheen.addColorStop(0, 'rgba(255,255,255,0.28)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.18)')
    g.fillStyle = sheen
    g.fillRect(0, 0, 64, 64)
    g.strokeStyle = c.edge; g.lineWidth = 3
    g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke()
    g.lineWidth = 1
    g.beginPath(); g.arc(32, 32, 23, 0, Math.PI * 2); g.stroke()
    g.fillStyle = c.ink
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `bold ${kind >= 100 ? 20 : 24}px sans-serif`
    if (c.hole) {
      g.fillStyle = '#2c2a26'
      g.beginPath(); g.arc(32, 32, 7, 0, Math.PI * 2); g.fill()
      g.fillStyle = c.ink
      g.font = 'bold 12px sans-serif'
      g.fillText(String(kind), 32, 50)
    } else g.fillText(String(kind), 32, 33)
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
  return <group {...rest}><mesh geometry={NOTE_GEO} material={mats} scale={[1, h, 1]} position-y={h / 2} castShadow /></group>
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
