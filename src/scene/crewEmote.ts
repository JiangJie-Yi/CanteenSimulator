import * as THREE from 'three'
import type { CrewEmote } from '@/game/crewMood'
import { warmLater } from './Prewarm'
import { SOFT_DOT } from './softDot'

/**
 * What the staff feel, over their heads (item 381, the owner's 「員工也得有情緒」; game/crewMood says what): drawn emotes, each a sticker, bold
 * and simple to read from across the room (item 379: chunky, a thick white edge, a dark line, a strong colour): a "!" startled, the anger
 * mark (four veins), blush lines shy, a sparkle glad, the gloom lines worn out, a sweat drop pressed, a note humming. Not characters (the
 * owner's rule 13): shapes. Sprites facing the camera, over everything as an emote is (depthTest off, as the customers' anger mark, item
 * 347); one material each for the shop, made at load, their one program with them (warmLater).
 */
type Kind = Exclude<CrewEmote, 'none'>
const N = 128
const INK = '#2a1d16'
function sticker(draw: (g: CanvasRenderingContext2D) => void, fill: string) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.lineJoin = g.lineCap = 'round'
  // (the thick white edge, the colour, the dark line: drawn three times over the one path)
  for (const [w, mode, col] of [[16, 'stroke', '#ffffff'], [0, 'fill', fill], [3.5, 'stroke', INK]] as const) {
    g.beginPath()
    draw(g)
    if (mode === 'fill') { g.fillStyle = col; g.fill() } else { g.strokeStyle = col; g.lineWidth = w; g.stroke() }
  }
  return g
}
const done = (g: CanvasRenderingContext2D | null) => {
  if (!g) return null
  const t = new THREE.CanvasTexture(g.canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** lines (open strokes, not filled): the white edge, the colour, a dark core of none (they're thin) */
function lines(paths: (g: CanvasRenderingContext2D) => void, col: string, w: number) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.lineJoin = g.lineCap = 'round'
  for (const [lw, s] of [[w + 10, '#ffffff'], [w + 3, INK], [w, col]] as const) {
    g.beginPath()
    paths(g)
    g.strokeStyle = s
    g.lineWidth = lw
    g.stroke()
  }
  return g
}
const TEX: Record<Kind, THREE.Texture | null> = {
  // (startled: a tapering bar and its dot)
  alarm: done(sticker((g) => {
    g.moveTo(49, 14); g.lineTo(79, 14); g.lineTo(72, 82); g.lineTo(56, 82); g.closePath()
    g.moveTo(78, 104); g.arc(64, 104, 14, 0, Math.PI * 2)
  }, '#ff5233')),
  // (cross: four red veins bulging toward a middle, mirrored (never turning one way round: it read as a 卍, item 347))
  anger: done(lines((g) => {
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
      const cx = 64 + sx * 33, cy = 64 + sy * 33
      const a0 = Math.atan2(0, -sx), a1 = Math.atan2(-sy, 0)
      const d = ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
      g.moveTo(cx + 27 * Math.cos(a0 + d * 0.1), cy + 27 * Math.sin(a0 + d * 0.1))
      g.arc(cx, cy, 27, a0 + d * 0.1, a0 + d * 0.9, d < 0)
    }
  }, '#e8303d', 12)),
  // (shy: three short slanted blush lines)
  shy: done(lines((g) => { for (let i = 0; i < 3; i++) { g.moveTo(30 + i * 28, 96); g.lineTo(46 + i * 28, 40) } }, '#ff6f9e', 10)),
  // (glad: a four-pointed star, its sides curved in)
  sparkle: done(sticker((g) => {
    const c = 64, R = 56, r = 11
    g.moveTo(c, c - R)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2, b = a + Math.PI / 2
      g.quadraticCurveTo(c + r * Math.cos(a + Math.PI / 4), c + r * Math.sin(a + Math.PI / 4), c + R * Math.cos(b), c + R * Math.sin(b))
    }
    g.closePath()
  }, '#ffd23a')),
  // (worn out: three wavering lines hanging down, どよーん)
  gloom: done(lines((g) => {
    for (const x0 of [34, 64, 94]) {
      g.moveTo(x0, 16)
      for (let y = 16; y <= 110; y += 4) g.lineTo(x0 + Math.sin((y - 16) / 13) * 7, y)
    }
  }, '#6a62a8', 9)),
  // (pressed: a drop of sweat, a highlight on it)
  sweat: done((() => {
    const g = sticker((q) => {
      q.moveTo(64, 12)
      q.bezierCurveTo(76, 38, 98, 56, 98, 80)
      q.arc(64, 80, 34, 0, Math.PI, false)
      q.bezierCurveTo(30, 56, 52, 38, 64, 12)
    }, '#52b5ff')
    if (g) { g.beginPath(); g.ellipse(51, 76, 7, 12, 0.35, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill() }
    return g
  })()),
  // (humming: an eighth note)
  note: done(sticker((g) => {
    g.ellipse(50, 96, 22, 15, -0.38, 0, Math.PI * 2)
    g.moveTo(67, 92); g.lineTo(67, 18); g.lineTo(77, 18)
    g.quadraticCurveTo(80, 40, 102, 50); g.quadraticCurveTo(84, 48, 77, 36); g.lineTo(77, 92); g.closePath()
  }, '#7a3fb0')),
}
const MAT = Object.fromEntries((Object.keys(TEX) as Kind[]).map((k) => [k, new THREE.SpriteMaterial({ map: TEX[k], transparent: true, depthWrite: false, depthTest: false })])) as Record<Kind, THREE.SpriteMaterial>
/** steam off the top when cross, soft white puffs */
const PUFF = new THREE.SpriteMaterial({ map: SOFT_DOT, color: '#f6f3ee', transparent: true, depthWrite: false, depthTest: false, opacity: 0.85 })
if (typeof document !== 'undefined') { const g = new THREE.Group(); g.add(new THREE.Sprite(MAT.alarm), new THREE.Sprite(PUFF)); warmLater(g) }

/** an emote's way of popping up: from nothing, past its size, back (s since it began) */
const pop = (s: number) => (s >= 0.32 ? 1 : s <= 0 ? 0 : 1 + 2.4 * Math.pow(s / 0.32 - 1, 3) + 1.4 * Math.pow(s / 0.32 - 1, 2))

export type Emote = { g: THREE.Group; update: (t: number, e: CrewEmote, level: number) => void }

/** (item 388) an emote's sticker as a picture for a page (the game's guide shows each by what it means, as it is over their heads): its
 * data URL; none drawn (no page), '' */
export function emotePicture(kind: Exclude<CrewEmote, 'none'>): string {
  const c = TEX[kind]?.image as HTMLCanvasElement | undefined
  try { return c?.toDataURL() ?? '' } catch { return '' }
}

/**
 * One figure's emotes, over a head whose top is `top` up in its own frame (and `side` out to its side for those beside the head): the one
 * showing now and its little bits (the sweat flying off, the sparkles round, the steam). `update` each frame: what shows (game/crewMood's
 * emote), how strongly (0..1), the time (s)
 */
export function makeEmote(top: number, side: number): Emote {
  const g = new THREE.Group()
  g.name = 'crew-emote'
  const main = new THREE.Sprite(MAT.alarm)
  main.renderOrder = 21
  const bits = [0, 1, 2].map(() => { const s = new THREE.Sprite(MAT.sweat); s.renderOrder = 21; return s })
  g.add(main, ...bits)
  g.visible = false
  const size = top * 0.24
  let was: CrewEmote = 'none', since = 0, goneAt = -1
  /** the one on the sprite (kept as it shrinks away) */
  let cur: Kind = 'alarm'
  const update = (t: number, e: CrewEmote, level: number) => {
    if (e !== was) {
      // (gone: a moment shrinking away, the last one kept on the sprite)
      if (e === 'none') goneAt = t
      else { since = t; goneAt = -1; cur = e; main.material = MAT[e] }
      was = e
    }
    const k = e === 'none' ? Math.max(0, 1 - (t - goneAt) / 0.15) : pop(t - since)
    g.visible = k > 0.01
    if (!g.visible) return
    const s = size * (0.85 + 0.15 * level) * k
    for (const b of bits) b.visible = false
    switch (cur) {
      case 'alarm':
        // (over the head, a quick shake as it pops)
        main.position.set(Math.sin(t * 40) * 0.012 * Math.max(0, 1 - (t - since) * 2), top + size * 0.75, 0)
        main.scale.setScalar(s * 1.1)
        break
      case 'anger': {
        // (at the head's top corner, throbbing; steam off the top, more as it's stronger)
        const beat = Math.max(0, Math.sin(t * 8))
        main.position.set(side, top - size * 0.1, 0)
        main.scale.setScalar(s * (1 + 0.16 * beat))
        bits.forEach((b, i) => {
          b.material = PUFF
          const q = (t * 0.9 + i / 3) % 1
          b.visible = level > 0.5 && k >= 1
          b.position.set(Math.sin((t + i) * 2.3) * 0.03 * q + (i - 1) * 0.05, top + 0.02 + 0.3 * q, 0)
          b.scale.setScalar(size * (0.35 + 0.5 * Math.sin(Math.PI * q)))
        })
        break
      }
      case 'shy':
        // (on the cheek's side, a little pulse)
        main.position.set(side * 0.9, top - size * 0.95, 0)
        main.scale.setScalar(s * (0.9 + 0.08 * Math.sin(t * 5)))
        break
      case 'sparkle':
        // (a star by the head, two smaller twinkling round it in turn)
        main.position.set(side, top + size * 0.15, 0)
        main.scale.setScalar(s * (0.85 + 0.2 * Math.max(0, Math.sin(t * 6))))
        bits.slice(0, 2).forEach((b, i) => {
          b.material = MAT.sparkle
          const q = (t * 1.3 + i * 0.5) % 1
          b.visible = k >= 1
          b.position.set(-side * (0.55 + 0.3 * i), top + size * (0.5 - 0.6 * i), 0)
          b.scale.setScalar(size * 0.55 * Math.sin(Math.PI * q))
        })
        break
      case 'gloom':
        // (hanging over the head, swaying slowly, drooping)
        main.position.set(Math.sin(t * 1.6) * 0.015, top + size * 0.55 - 0.02 * Math.sin(t * 1.1), 0)
        main.scale.set(s * 1.15, s * (1 + 0.06 * Math.sin(t * 2.2)), 1)
        break
      case 'sweat': {
        // (a drop on the head's side, sliding a little; more flying off as they're pressed harder, out and falling)
        main.position.set(side, top - size * 0.2 - 0.025 * ((t * 0.8) % 1), 0)
        main.scale.setScalar(s * 0.85)
        const n = level > 0.8 ? 3 : level > 0.6 ? 2 : 1
        bits.forEach((b, i) => {
          b.material = MAT.sweat
          if (i >= n || k < 1) return
          const q = (t * 1.6 + i / n) % 1
          const dir = i % 2 ? -1 : 1
          b.visible = true
          b.position.set(dir * (side * 0.6 + 0.25 * q), top + 0.04 + 0.16 * q - 0.42 * q * q, 0)
          b.scale.setScalar(size * 0.5 * (1 - 0.6 * q))
        })
        break
      }
      case 'note': {
        // (rising from over the head and swaying, again and again)
        const q = (t * 0.8) % 1
        main.position.set(side * 0.4 + Math.sin(q * Math.PI * 2) * 0.05, top + size * (0.3 + 0.9 * q), 0)
        main.scale.setScalar(s * Math.min(1, 4 * (1 - q)) * Math.min(1, q * 6 + 0.2))
        break
      }
    }
  }
  return { g, update }
}
