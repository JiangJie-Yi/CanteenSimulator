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
/** a rosette of guilloche: `n` loops of a curve round (x, y), as the notes' security printing has them */
const rosette = (g: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, lobes: number) => {
  for (let k = 0; k < n; k++) {
    g.beginPath()
    for (let i = 0; i <= 360; i++) {
      const a = (i / 360) * Math.PI * 2
      const rr = r * (0.18 + 0.82 * Math.abs(Math.cos((lobes / 2) * a + (k / n) * Math.PI)))
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr
      if (i) g.lineTo(px, py); else g.moveTo(px, py)
    }
    g.stroke()
  }
}
const noteFace = (kind: Note) => {
  const n = NOTES[kind]
  const W = 1024, H = 512
  return tex(W, H, (g) => {
    g.save()
    g.scale(2, 2)
    // (the paper: its colour washed across from the left and the middle, flecked with fibres)
    g.fillStyle = n.paper
    g.fillRect(0, 0, 512, 256)
    const wash = g.createLinearGradient(0, 0, 512, 0)
    wash.addColorStop(0, n.tint); wash.addColorStop(0.3, n.paper); wash.addColorStop(0.62, n.tint); wash.addColorStop(1, n.paper)
    g.globalAlpha = 0.6
    g.fillStyle = wash
    g.fillRect(0, 0, 512, 256)
    let seed = kind
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    g.globalAlpha = 0.18
    g.strokeStyle = n.ink
    g.lineWidth = 0.4
    for (let k = 0; k < 140; k++) { const x = rnd() * 512, y = rnd() * 256, a = rnd() * 6.28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke() }
    if (kind === 10000) {
      // (the 10000's green underprint behind the middle)
      g.globalAlpha = 0.22
      g.fillStyle = '#7f9a68'
      g.beginPath(); g.ellipse(230, 140, 160, 90, 0, 0, Math.PI * 2); g.fill()
    }
    // (the background guilloche: fine waving lines across the whole note, and rosettes in the middle and behind the figure)
    g.globalAlpha = 0.22
    g.lineWidth = 0.45
    for (let k = 0; k < 64; k++) {
      g.beginPath()
      for (let x = 0; x <= 512; x += 4) {
        const y = 16 + k * 3.6 + Math.sin(x / 19 + k * 0.6) * 5 + Math.sin(x / 53 + k * 0.3) * 4
        if (x) g.lineTo(x, y); else g.moveTo(x, y)
      }
      g.stroke()
    }
    g.globalAlpha = 0.4
    g.lineWidth = 0.5
    rosette(g, 210, 140, 58, 22, 9)
    rosette(g, 120, 62, 34, 14, 7)
    g.globalAlpha = 1
    // (the border: a band of fine diagonal hatching between two lines, the corners with a little rosette)
    g.strokeStyle = n.ink
    g.lineWidth = 1.6
    g.strokeRect(6, 6, 500, 244)
    g.lineWidth = 0.6
    g.strokeRect(12, 12, 488, 232)
    g.globalAlpha = 0.5
    for (let x = 8; x < 504; x += 2.4) { g.beginPath(); g.moveTo(x, 7); g.lineTo(x + 3, 11); g.stroke(); g.beginPath(); g.moveTo(x, 245); g.lineTo(x + 3, 249); g.stroke() }
    g.globalAlpha = 1
    // (the hologram: a striped band down the left on the 10000 and 5000, a patch on the 1000; shifting colours, a portrait's outline in it)
    const hx = 30, hw = kind === 1000 ? 34 : 30
    const hy = kind === 1000 ? 150 : 14, hh = kind === 1000 ? 70 : 228
    const holo = g.createLinearGradient(0, hy, hw, hy + hh)
    for (const [t, c] of [[0, '#d8d4cc'], [0.15, '#a9d1ec'], [0.35, '#efc3e4'], [0.55, '#c6ecc0'], [0.75, '#f3e2a4'], [0.9, '#c0c9f0'], [1, '#d8d4cc']] as [number, string][]) holo.addColorStop(t, c)
    g.fillStyle = holo
    g.beginPath(); g.roundRect(hx, hy, hw, hh, kind === 1000 ? 8 : 2); g.fill()
    g.strokeStyle = 'rgba(110,110,120,0.55)'
    g.lineWidth = 0.4
    for (let y = hy + 2; y < hy + hh; y += 2.2) { g.beginPath(); g.moveTo(hx, y); g.lineTo(hx + hw, y + 2); g.stroke() }
    g.lineWidth = 0.9
    g.beginPath(); g.ellipse(hx + hw / 2, hy + hh / 2, 9, 12, 0, 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.arc(hx + hw / 2, hy + hh / 2 + 20, 11, Math.PI, 0); g.stroke()
    // (the figure, very large at the top left, outlined as it's printed; 日本銀行券 along the top; the amount again small at the bottom right)
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    g.font = `900 ${kind === 10000 ? 66 : 74}px "Arial Black", "Helvetica Neue", sans-serif`
    g.lineWidth = 2
    g.strokeStyle = n.deep
    g.fillStyle = n.ink
    g.fillText(String(kind), 74, 84)
    g.strokeText(String(kind), 74, 84)
    g.font = 'bold 15px "Arial Black", sans-serif'
    g.fillStyle = n.deep
    g.textAlign = 'right'
    g.fillText(String(kind), 496, 30)
    g.font = 'bold 25px "Noto Serif JP", "Yu Mincho", serif'
    g.textAlign = 'center'
    g.fillText('日本銀行券', 250, 42)
    // (the amount in characters at the foot in a cartouche, the bank's name beneath)
    g.lineWidth = 0.8
    g.beginPath(); g.ellipse(212, 190, 62, 24, 0, 0, Math.PI * 2); g.stroke()
    g.font = 'bold 34px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText(n.han, 212, 202)
    g.font = '12px "Noto Serif JP", "Yu Mincho", serif'
    g.fillText('日本銀行', 212, 230)
    // (the serial numbers: one red-brown at the top left under the figure, one at the bottom right)
    g.font = 'bold 14px "OCR A Std", "Courier New", monospace'
    g.fillStyle = '#9a3e14'
    g.textAlign = 'left'
    g.fillText(`${kind === 1000 ? 'KM' : kind === 5000 ? 'GT' : 'AA'} 302915 ${kind === 10000 ? 'R' : 'K'}`, 76, 108)
    g.textAlign = 'right'
    g.fillText(`${kind === 1000 ? 'KM' : kind === 5000 ? 'GT' : 'AA'} 302915 ${kind === 10000 ? 'R' : 'K'}`, 492, 238)
    // (the watermark: a pale oval in the clear middle, the same bust faint in it, and the bars beside it)
    g.globalAlpha = 0.5
    g.fillStyle = n.paper
    g.beginPath(); g.ellipse(316, 120, 30, 42, 0, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 0.12
    g.fillStyle = n.deep
    g.beginPath(); g.ellipse(316, 112, 12, 16, 0, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(316, 150, 22, 14, 0, Math.PI, Math.PI * 2); g.fill()
    for (let k = 0; k < 3; k++) g.fillRect(352, 96 + k * 18, 4, 12)
    g.globalAlpha = 1
    // (the portrait at the right: an engraved bust, its light and shade all in fine lines that follow the form, no outline round the
    // vignette but the hatching fading out)
    const px = 428, py = 126
    const grad = g.createRadialGradient(px, py, 40, px, py, 96)
    grad.addColorStop(0, n.tint); grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.globalAlpha = 0.7
    g.beginPath(); g.ellipse(px, py, 66, 96, 0, 0, Math.PI * 2); g.fill()
    g.save()
    g.beginPath(); g.ellipse(px, py, 64, 94, 0, 0, Math.PI * 2); g.clip()
    g.strokeStyle = n.deep
    g.lineWidth = 0.45
    g.globalAlpha = 0.35
    for (let y = py - 96; y < py + 96; y += 2.2) { g.beginPath(); g.moveTo(px - 70, y); g.quadraticCurveTo(px, y - 6, px + 70, y + 4); g.stroke() }
    g.globalAlpha = 1
    // (the coat: dark, its lapels and a white collar and tie)
    g.fillStyle = n.deep
    g.beginPath(); g.moveTo(px - 66, py + 96); g.quadraticCurveTo(px - 60, py + 50, px - 18, py + 42); g.lineTo(px + 18, py + 42); g.quadraticCurveTo(px + 60, py + 50, px + 66, py + 96); g.fill()
    g.fillStyle = n.paper
    g.beginPath(); g.moveTo(px - 14, py + 40); g.lineTo(px, py + 74); g.lineTo(px + 14, py + 40); g.closePath(); g.fill()
    g.fillStyle = n.deep
    g.beginPath(); g.moveTo(px - 4, py + 46); g.lineTo(px, py + 70); g.lineTo(px + 4, py + 46); g.fill()
    // (the neck and head, shaded by hatching curved round it: darker on the shadow side)
    g.fillStyle = n.paper
    g.beginPath(); g.ellipse(px, py + 34, 11, 12, 0, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(px, py - 6, 25, 33, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = n.ink
    g.lineWidth = 0.55
    for (let k = 0; k < 16; k++) {
      g.globalAlpha = 0.18 + 0.03 * k
      g.beginPath(); g.ellipse(px - 3 + k * 0.8, py - 6, 25 - k * 1.1, 33 - k * 0.6, 0, -Math.PI / 2 + 0.2, Math.PI / 2 - 0.2); g.stroke()
    }
    g.globalAlpha = 1
    // (the hair: swept back, a parting, lines along it; brows, eyes, nose and mouth in a few strokes)
    g.fillStyle = n.deep
    g.beginPath(); g.ellipse(px, py - 26, 26, 15, 0, Math.PI, Math.PI * 2); g.fill()
    g.strokeStyle = n.paper; g.lineWidth = 0.4; g.globalAlpha = 0.5
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(px + k * 5, py - 40); g.quadraticCurveTo(px + k * 6, py - 30, px + k * 6.5, py - 24); g.stroke() }
    g.globalAlpha = 1
    g.strokeStyle = n.deep; g.lineWidth = 1.2
    g.beginPath(); g.moveTo(px - 15, py - 14); g.lineTo(px - 5, py - 15); g.moveTo(px + 5, py - 15); g.lineTo(px + 15, py - 14); g.stroke()
    g.fillStyle = n.deep
    g.beginPath(); g.ellipse(px - 10, py - 9, 2.4, 1.4, 0, 0, Math.PI * 2); g.ellipse(px + 10, py - 9, 2.4, 1.4, 0, 0, Math.PI * 2); g.fill()
    g.lineWidth = 0.9
    g.beginPath(); g.moveTo(px + 1, py - 8); g.lineTo(px + 3, py + 4); g.lineTo(px - 2, py + 5); g.stroke()
    g.beginPath(); g.moveTo(px - 7, py + 14); g.quadraticCurveTo(px, py + 16, px + 7, py + 14); g.stroke()
    g.lineWidth = 0.8; g.globalAlpha = 0.6
    g.beginPath(); g.ellipse(px, py - 6, 25, 33, 0, 0, Math.PI * 2); g.stroke()
    g.restore()
    // (the governor's seal: red, square, the characters in it in seal script's place)
    g.fillStyle = '#c0392b'
    g.fillRect(334, 182, 30, 30)
    g.strokeStyle = '#f6e2d8'
    g.lineWidth = 1
    g.strokeRect(337, 185, 24, 24)
    g.fillStyle = '#f6e2d8'
    g.font = 'bold 11px "Noto Serif JP", "Yu Mincho", serif'
    g.textAlign = 'center'
    g.fillText('総裁', 349, 196)
    g.fillText('之印', 349, 207)
    // (the tactile marks at the left edge, and the identifying shape)
    g.fillStyle = n.deep
    g.globalAlpha = 0.7
    for (let k = 0; k < (kind === 1000 ? 1 : kind === 5000 ? 2 : 3); k++) g.fillRect(16, 108 + k * 14, 7, 7)
    g.globalAlpha = 1
    g.restore()
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
/** text set round an arc (the coins' 日本国 and their year) */
const arcText = (g: CanvasRenderingContext2D, text: string, x: number, y: number, r: number, mid: number, span: number, top: boolean) => {
  const chars = [...text]
  chars.forEach((ch, i) => {
    const a = mid + (chars.length === 1 ? 0 : (i / (chars.length - 1) - 0.5) * span) * (top ? 1 : -1)
    g.save()
    g.translate(x + Math.cos(a) * r, y + Math.sin(a) * r)
    g.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2))
    g.fillText(ch, 0, 0)
    g.restore()
  })
}
const coinFace = (kind: CoinKind) => {
  const c = COINS[kind]
  const S = 256, C = 128
  return tex(S, S, (g) => {
    // (the metal: a radial shading so the field reads a little dished, the struck relief raised in a lighter tone with a dark edge on one
    // side, as light falls across a coin)
    const field = g.createRadialGradient(C - 30, C - 30, 10, C, C, 130)
    field.addColorStop(0, '#ffffff'); field.addColorStop(1, '#000000')
    g.fillStyle = c.base
    g.fillRect(0, 0, S, S)
    g.globalAlpha = 0.16
    g.fillStyle = field
    g.fillRect(0, 0, S, S)
    g.globalAlpha = 1
    if (kind === 500) {
      // (the bicolour: a nickel-brass ring round a paler cupronickel centre, a fine latent pattern ring between)
      g.fillStyle = '#d9d4c4'
      g.beginPath(); g.arc(C, C, 76, 0, Math.PI * 2); g.fill()
      g.strokeStyle = c.edge; g.lineWidth = 2
      g.beginPath(); g.arc(C, C, 76, 0, Math.PI * 2); g.stroke()
      g.lineWidth = 0.8
      for (let k = 0; k < 120; k++) { const a = (k / 120) * Math.PI * 2; g.beginPath(); g.moveTo(C + Math.cos(a) * 80, C + Math.sin(a) * 80); g.lineTo(C + Math.cos(a) * 86, C + Math.sin(a) * 86); g.stroke() }
    }
    // (the design in relief: drawn twice, once dark and offset, once light, so it stands up)
    const design = (col: string, dx: number, dy: number) => {
      g.save()
      g.translate(dx, dy)
      g.fillStyle = col
      g.strokeStyle = col
      if (kind === 100) {
        // (three cherry blossoms, five notched petals each, on a stem)
        for (const [x, y, r] of [[C, 92, 16], [C - 36, 140, 13], [C + 36, 138, 13]] as [number, number, number][]) {
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 - Math.PI / 2
            g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, r * 0.38, a, 0, Math.PI * 2); g.fill()
          }
        }
        g.lineWidth = 2.5
        g.beginPath(); g.moveTo(C, 108); g.quadraticCurveTo(C - 10, 140, C - 30, 150); g.moveTo(C, 112); g.quadraticCurveTo(C + 12, 140, C + 30, 148); g.stroke()
      }
      if (kind === 50) {
        // (three chrysanthemums round the hole, their many petals)
        for (let k = 0; k < 3; k++) {
          const x = C + Math.cos(k * 2.094 - 1.57) * 54, y = C + Math.sin(k * 2.094 - 1.57) * 54
          for (let q = 0; q < 14; q++) { const a = (q / 14) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 2.4, a, 0, Math.PI * 2); g.fill() }
        }
      }
      if (kind === 10) {
        // (the Phoenix Hall: the central hall's roof and its two wings, the phoenixes on the ridge, the pillars, the pond's edge)
        g.beginPath(); g.moveTo(C - 30, 112); g.quadraticCurveTo(C, 92, C + 30, 112); g.lineTo(C + 22, 116); g.lineTo(C - 22, 116); g.fill()
        g.fillRect(C - 18, 116, 36, 22)
        for (const sd of [-1, 1]) {
          g.beginPath(); g.moveTo(C + sd * 22, 128); g.lineTo(C + sd * 70, 122); g.lineTo(C + sd * 72, 128); g.lineTo(C + sd * 22, 134); g.fill()
          g.fillRect(C + sd * 22 + (sd < 0 ? -48 : 0), 134, 48, 10)
          g.beginPath(); g.moveTo(C + sd * 68, 116); g.lineTo(C + sd * 76, 108); g.lineTo(C + sd * 78, 124); g.fill()
        }
        g.fillRect(C - 3, 86, 6, 8)
        g.fillRect(C - 70, 148, 140, 4)
      }
      if (kind === 5) {
        // (an ear of rice round the hole's top, a gear's teeth along the bottom, water lines below)
        for (let k = 0; k < 9; k++) { const a = Math.PI + 0.25 + k * 0.33; g.beginPath(); g.ellipse(C + Math.cos(a) * 52, C + Math.sin(a) * 52, 4, 8, a, 0, Math.PI * 2); g.fill() }
        g.lineWidth = 2
        g.beginPath(); g.arc(C, C, 52, Math.PI + 0.2, Math.PI * 2 - 0.2); g.stroke()
        for (let k = 0; k < 11; k++) { const a = 0.45 + k * 0.2; g.fillRect(C + Math.cos(a) * 36 - 2.5, C + Math.sin(a) * 36 - 2.5, 5, 5) }
        for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = -40; x <= 40; x += 4) { const y = 204 + k * 7 + Math.sin(x / 6) * 2; if (x > -40) g.lineTo(C + x, y); else g.moveTo(C + x, y) } g.stroke() }
      }
      if (kind === 1) {
        // (a young tree: a stem and two pairs of leaves)
        g.lineWidth = 4
        g.beginPath(); g.moveTo(C, 170); g.lineTo(C, 92); g.stroke()
        for (const [y, w] of [[108, 26], [138, 30]] as [number, number][]) for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(C + sd * w * 0.55, y, w * 0.55, 9, sd * -0.4, 0, Math.PI * 2); g.fill() }
        g.beginPath(); g.ellipse(C, 86, 7, 12, 0, 0, Math.PI * 2); g.fill()
      }
      if (kind === 500) {
        // (the paulownia: three spikes of flowers over three leaves)
        for (const [dx, h] of [[-22, 34], [0, 44], [22, 34]] as [number, number][]) for (let q = 0; q < 5; q++) { g.beginPath(); g.ellipse(C + dx, 70 + (44 - h) + q * (h / 5), 5 - q * 0.5, 4.5, 0, 0, Math.PI * 2); g.fill() }
        for (const [dx, a] of [[-26, -0.5], [0, 0], [26, 0.5]] as [number, number][]) { g.beginPath(); g.ellipse(C + dx, 140, 14, 20, a, 0, Math.PI * 2); g.fill() }
      }
      g.restore()
    }
    design('rgba(0,0,0,0.32)', 1.6, 1.6)
    design(c.ink, 0, 0)
    g.globalAlpha = 0.35
    design('#ffffff', -0.8, -0.8)
    g.globalAlpha = 1
    // (日本国 round the top and the value in characters at the foot, as on the real ones)
    g.fillStyle = c.ink
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = 'bold 22px "Noto Serif JP", "Yu Mincho", serif'
    const han: Record<CoinKind, string> = { 1: '一円', 5: '五円', 10: '十円', 50: '五十円', 100: '百円', 500: '五百円' }
    if (kind !== 5 && kind !== 10) arcText(g, '日本国', C, C, 96, -Math.PI / 2, 0.55, true)
    if (kind === 5 || kind === 50) {
      g.font = 'bold 26px "Noto Serif JP", "Yu Mincho", serif'
      g.fillText(han[kind], C, kind === 5 ? 184 : 190)
      if (kind === 5) arcText(g, '日本国', C, C, 96, -Math.PI / 2, 0.55, true)
    } else if (kind === 10) {
      arcText(g, '日本国', C, C, 100, -Math.PI / 2, 0.5, true)
      arcText(g, '十円', C, C, 100, Math.PI / 2, 0.3, false)
    } else {
      g.font = 'bold 22px "Noto Serif JP", "Yu Mincho", serif'
      arcText(g, han[kind], C, C, 98, Math.PI / 2, kind === 500 ? 0.55 : 0.4, false)
    }
    // (the hole, for the 5 and 50, with its own raised lip)
    if (c.hole) {
      g.fillStyle = '#16140f'
      g.beginPath(); g.arc(C, C, 26, 0, Math.PI * 2); g.fill()
      g.strokeStyle = c.edge; g.lineWidth = 4
      g.beginPath(); g.arc(C, C, 28, 0, Math.PI * 2); g.stroke()
    }
    // (the raised rim, lit on one side and shadowed on the other, and the milled edge's ticks where they have them)
    const rim = g.createLinearGradient(0, 0, S, S)
    rim.addColorStop(0, 'rgba(255,255,255,0.75)'); rim.addColorStop(0.5, c.edge); rim.addColorStop(1, 'rgba(0,0,0,0.6)')
    g.strokeStyle = rim
    g.lineWidth = 10
    g.beginPath(); g.arc(C, C, 120, 0, Math.PI * 2); g.stroke()
    g.strokeStyle = c.edge
    g.lineWidth = 1.5
    g.beginPath(); g.arc(C, C, 114, 0, Math.PI * 2); g.stroke()
    // (and a soft highlight across it, as from the lamp over the till)
    const sheen = g.createLinearGradient(0, 0, S, S)
    sheen.addColorStop(0, 'rgba(255,255,255,0.28)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,0.12)')
    g.fillStyle = sheen
    g.fillRect(0, 0, S, S)
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
  // (struck metal: a satin sheen that catches the lamps, the aluminium 1 duller; the edge the metal's own darker tone)
  const metal = kind === 1 ? 0.55 : 0.85, rough = kind === 1 ? 0.5 : 0.32
  const side = new THREE.MeshStandardMaterial({ color: COINS[kind].edge, metalness: metal, roughness: rough + 0.1 })
  return [side, new THREE.MeshStandardMaterial({ color: '#ffffff', map: coinTex.get(kind), metalness: metal, roughness: rough, envMapIntensity: 1.2 }), side]
}
const NOTE_GEO = new THREE.BoxGeometry(NOTE_W, 1, NOTE_D)
const COIN_GEO: Partial<Record<CoinKind, THREE.CylinderGeometry>> = {}
const coinGeo = (kind: CoinKind) => (COIN_GEO[kind] ??= new THREE.CylinderGeometry(COINS[kind].r, COINS[kind].r, 1, 28))

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
