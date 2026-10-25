// The customers' plates: five more painted designs besides the bamboo and plum of ware.ts, each drawn top-down for a plate's lathe
// shape (wareGeometry): 唐草 (vine scroll) in indigo on white, 青海波 (deep-blue waves), 鯉 (a carp on speckled cream), 梅花 (white blossoms on
// blue) and a 風車 (pinwheel of patterns). Drawn on first use, one canvas each.
import * as THREE from 'three'
import { forPhone } from './ware'

const INK = '#1f3b7a'
const LIP = 'rgba(96, 56, 34, 0.9)'

type Paint = (g: CanvasRenderingContext2D, S: number, rnd: () => number) => void

/** a seeded random sequence, so each design is the same every time */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** a blossom of five round petals, outlined, in the colours given */
function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, fill: string, line: string, centre: string) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.fillStyle = fill
  g.strokeStyle = line
  g.lineWidth = Math.max(1, r * 0.08)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2
    g.beginPath()
    g.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.5, 0, Math.PI * 2)
    g.fill()
    g.stroke()
  }
  g.fillStyle = centre
  g.beginPath()
  g.arc(0, 0, r * 0.22, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

const DESIGNS: Paint[] = [
  // 唐草: curling vines with small leaves and flowers all over white, a dark rim line
  (g, S, rnd) => {
    g.fillStyle = '#f7f6f1'
    g.fillRect(0, 0, S, S)
    g.strokeStyle = INK
    g.fillStyle = INK
    for (let v = 0; v < 38; v++) {
      let x = S * (0.1 + rnd() * 0.8), y = S * (0.1 + rnd() * 0.8)
      let a = rnd() * Math.PI * 2
      g.lineWidth = S * 0.0035
      g.beginPath()
      g.moveTo(x, y)
      const pts: [number, number][] = []
      for (let k = 0; k < 14; k++) {
        a += (rnd() - 0.4) * 0.9
        x += Math.cos(a) * S * 0.03
        y += Math.sin(a) * S * 0.03
        g.lineTo(x, y)
        pts.push([x, y])
      }
      g.stroke()
      pts.forEach(([px, py], k) => {
        if (k % 2) return
        const la = a + (k % 4 ? 1 : -1) * (0.9 + rnd() * 0.4)
        g.beginPath()
        g.ellipse(px + Math.cos(la) * S * 0.014, py + Math.sin(la) * S * 0.014, S * 0.017, S * 0.007, la, 0, Math.PI * 2)
        g.fill()
      })
      blossom(g, x, y, S * 0.017, rnd() * 6, INK, INK, '#f7f6f1')
    }
    g.lineWidth = S * 0.012
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.468, 0, Math.PI * 2); g.stroke()
  },
  // 青海波: deep blue waves, rows of rolling crests drawn in white lines
  (g, S) => {
    g.fillStyle = '#2b4c97'
    g.fillRect(0, 0, S, S)
    g.strokeStyle = '#e9eef7'
    const row = S * 0.075
    for (let r = -1; r < 15; r++) {
      for (let c = -1; c < 11; c++) {
        const x = c * S * 0.105 + (r % 2 ? S * 0.0525 : 0)
        const y = r * row * 0.62
        for (let q = 5; q >= 1; q--) {
          g.lineWidth = S * (q === 5 ? 0.0045 : 0.003)
          g.beginPath()
          g.arc(x, y + row, q * S * 0.0105, Math.PI, Math.PI * 2)
          g.stroke()
        }
      }
    }
  },
  // 鯉: speckled cream, a carp in indigo, a rim of wave scrolls
  (g, S, rnd) => {
    g.fillStyle = '#f0e4c8'
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${150 + rnd() * 40}, ${80 + rnd() * 30}, 30, ${0.3 + rnd() * 0.4})`
      g.beginPath()
      g.arc(rnd() * S, rnd() * S, S * (0.0015 + rnd() * 0.004), 0, Math.PI * 2)
      g.fill()
    }
    // the rim: a band of curling waves
    g.strokeStyle = '#27478f'
    g.lineWidth = S * 0.012
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); g.stroke()
    g.lineWidth = S * 0.006
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2
      const x = S / 2 + Math.cos(a) * S * 0.42, y = S / 2 + Math.sin(a) * S * 0.42
      g.beginPath(); g.arc(x, y, S * 0.02, a + Math.PI * 0.2, a + Math.PI * 1.7); g.stroke()
      g.beginPath(); g.arc(x, y, S * 0.01, a + Math.PI * 0.2, a + Math.PI * 1.7); g.stroke()
    }
    // the carp, swimming up to the left
    g.save()
    g.translate(S * 0.5, S * 0.5)
    g.rotate(-0.5)
    g.fillStyle = '#27478f'
    g.beginPath()
    g.moveTo(-S * 0.2, 0)
    g.bezierCurveTo(-S * 0.1, -S * 0.1, S * 0.12, -S * 0.1, S * 0.2, -S * 0.01)
    g.bezierCurveTo(S * 0.12, S * 0.09, -S * 0.1, S * 0.1, -S * 0.2, 0)
    g.fill()
    // tail and fins
    g.beginPath()
    g.moveTo(S * 0.19, -S * 0.01)
    g.bezierCurveTo(S * 0.27, -S * 0.07, S * 0.3, -S * 0.09, S * 0.33, -S * 0.12)
    g.bezierCurveTo(S * 0.3, -S * 0.04, S * 0.3, S * 0.05, S * 0.34, S * 0.1)
    g.bezierCurveTo(S * 0.28, S * 0.07, S * 0.25, S * 0.04, S * 0.19, -S * 0.01)
    g.fill()
    g.beginPath(); g.moveTo(-S * 0.02, -S * 0.085); g.lineTo(S * 0.05, -S * 0.15); g.lineTo(S * 0.1, -S * 0.08); g.fill()
    g.beginPath(); g.moveTo(-S * 0.04, S * 0.085); g.lineTo(S * 0.0, S * 0.16); g.lineTo(S * 0.06, S * 0.09); g.fill()
    // scales: rows of small arcs in cream
    g.strokeStyle = '#f0e4c8'
    g.lineWidth = S * 0.004
    for (let c = 0; c < 9; c++) {
      for (let r = -3; r <= 3; r++) {
        const x = -S * 0.1 + c * S * 0.028, y = r * S * 0.026 + (c % 2 ? S * 0.013 : 0)
        if (Math.abs(y) > S * 0.07 * Math.sin(((c + 1) / 10) * Math.PI) + 0.01) continue
        g.beginPath(); g.arc(x, y, S * 0.014, -Math.PI * 0.5, Math.PI * 0.5); g.stroke()
      }
    }
    g.fillStyle = '#f0e4c8'
    g.beginPath(); g.arc(-S * 0.155, -S * 0.012, S * 0.011, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#27478f'
    g.beginPath(); g.arc(-S * 0.155, -S * 0.012, S * 0.005, 0, Math.PI * 2); g.fill()
    g.restore()
  },
  // 梅花: white blossoms scattered over a mid blue, a few dark ones among them
  (g, S, rnd) => {
    g.fillStyle = '#58719e'
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 150; i++) {
      const x = rnd() * S, y = rnd() * S
      const white = rnd() < 0.8
      blossom(g, x, y, S * (0.03 + rnd() * 0.03), rnd() * 6, white ? '#f4f6fa' : '#3e5887', '#26407a', white ? '#9fb2d4' : '#cfd9ea')
    }
    g.strokeStyle = '#f4f6fa'
    g.lineWidth = S * 0.01
    g.beginPath(); g.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2); g.stroke()
  },
  // 風車: a rim of scrolling leaves round a pinwheel of six fields, alternately waves, cross-hatching and fine scales
  (g, S, rnd) => {
    g.fillStyle = '#f7f6f1'
    g.fillRect(0, 0, S, S)
    const c = S / 2
    g.strokeStyle = INK
    g.fillStyle = INK
    // the rim: dark leaf scrolls
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2
      g.save()
      g.translate(c + Math.cos(a) * S * 0.43, c + Math.sin(a) * S * 0.43)
      g.rotate(a + Math.PI / 2)
      g.beginPath()
      g.ellipse(0, 0, S * 0.022, S * 0.011, rnd() * 0.5, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    g.lineWidth = S * 0.006
    g.beginPath(); g.arc(c, c, S * 0.385, 0, Math.PI * 2); g.stroke()
    g.lineWidth = S * 0.003
    g.beginPath(); g.arc(c, c, S * 0.37, 0, Math.PI * 2); g.stroke()
    const N = 6
    for (let k = 0; k < N; k++) {
      g.save()
      g.beginPath()
      g.moveTo(c, c)
      // each field is a curved blade of the wheel
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2
      g.arc(c, c, S * 0.36, a0, a1)
      g.closePath()
      g.clip()
      if (k % 3 === 0) {
        g.fillStyle = INK; g.fillRect(0, 0, S, S)
        g.strokeStyle = '#f7f6f1'; g.lineWidth = S * 0.004
        for (let w = 0; w < 14; w++) { g.beginPath(); g.arc(c + Math.cos(a0 + 0.5) * S * 0.12, c + Math.sin(a0 + 0.5) * S * 0.12, w * S * 0.03, 0, Math.PI * 2); g.stroke() }
      } else if (k % 3 === 1) {
        g.strokeStyle = INK; g.lineWidth = S * 0.0035
        for (let w = -S; w < S; w += S * 0.022) {
          g.beginPath(); g.moveTo(w, 0); g.lineTo(w + S, S); g.stroke()
          g.beginPath(); g.moveTo(w + S, 0); g.lineTo(w, S); g.stroke()
        }
      } else {
        g.strokeStyle = INK; g.lineWidth = S * 0.003
        for (let r = 0; r < 12; r++) for (let q = 0; q < 14; q++) {
          g.beginPath(); g.arc(q * S * 0.04 + (r % 2 ? S * 0.02 : 0), r * S * 0.025 + S * 0.15, S * 0.02, Math.PI, Math.PI * 2); g.stroke()
        }
      }
      g.restore()
      g.strokeStyle = INK; g.lineWidth = S * 0.005
      g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a0) * S * 0.36, c + Math.sin(a0) * S * 0.36); g.stroke()
    }
    g.fillStyle = '#f7f6f1'
    g.beginPath(); g.arc(c, c, S * 0.03, 0, Math.PI * 2); g.fill()
    g.fillStyle = INK
    g.beginPath(); g.arc(c, c, S * 0.014, 0, Math.PI * 2); g.fill()
  },
]

/** how many designs there are */
export const DESIGN_COUNT = DESIGNS.length
const made: (THREE.CanvasTexture | null)[] = []

/** the n-th design of the customers' plates (any whole number: it wraps), drawn the first time it's asked for */
export function wareDesign(n: number): THREE.CanvasTexture | null {
  const i = ((Math.floor(n) % DESIGN_COUNT) + DESIGN_COUNT) % DESIGN_COUNT
  if (made[i] !== undefined) return made[i]
  if (typeof document === 'undefined') return (made[i] = null)
  const S = 768
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  // (the disc: the picture clipped to the plate's round, and the glazed brown lip all round)
  g.fillStyle = LIP
  g.fillRect(0, 0, S, S)
  g.save()
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.492, 0, Math.PI * 2); g.clip()
  DESIGNS[i](g, S, seeded(101 + i * 37))
  g.restore()
  const t = new THREE.CanvasTexture(forPhone(c))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return (made[i] = t)
}

/** a plate's design from anything that names it: a number or a string */
export function designOf(key: number | string) {
  if (typeof key === 'number') return key
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}
