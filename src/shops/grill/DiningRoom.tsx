import { blessingChime, shrineDoor } from './shrineSound'
import { TISSUE } from '@/game/tissues'
import { BambooModel, WashstandModel } from './BarFurnish'
import { doorClick, LOCK_TEX, ToiletLive, WcBin, WcBrush, WcMarks, WcOtohime, WcPaper, WcRemote } from './Restroom'
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { StaticBatch, mergeByMaterial } from '@/scene/StaticBatch'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'
import { ColdMist } from '@/scene/ColdMist'
import { useGLTF } from '@react-three/drei'
import { brushText, signTexture } from '@/scene/signFont'
import { BOSS_DRINK } from './Boss'
import { CASE_SIZE } from '@/game/drinkStock'
import { askPantry, SUPPLIES, fridgesOf, farOf, DRINK_BACK, setDrinkPanel, DRINKS, FRIDGE, FRIDGE_STATE, FRIDGE_STOCK, FRIDGE_UNITS, moveDrink, moveOut, tipOver, handOver, POINTER_HINT, pullOut, putBack, setShrineFlower, SHRINE_FLOWERS, tableHit, TOILETS, WC_SLIDE, WC_W, type Counter, type DrinkId } from './bar'
import { Movable } from './Movable'
import { getEdit } from './edit'
import { FLOWERS, nextFlower, type Flower } from '@/game/shrineFlowers'
import { setTip } from '@/scene/hoverTip'
import { getBgmOff, setBgmOff, useBgmOff } from '@/ui/bgmStore'
import { getLights, onLights, pressLightSwitch, useLights } from '@/scene/lightsStore'
import { lampGlow } from '@/game/roomLights'
import { lampLit } from './lampShades'

/**
 * The lamps' painted light (their halos and the pools they throw) by the time of day: faint by day, when the room's lit anyway; full and
 * wider by night, a glow blooming round each (data-theme on the page, followed as it changes).
 */
/** (a lamp's: out with the wall switch; the daylight through the windows isn't) */
const NIGHT_GLOWS: { m: THREE.Material; day: number; night: number; lamp: boolean }[] = []
const isNight = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
function nightGlow<M extends THREE.Material>(m: M, day: number, night: number, lamp = true): M {
  NIGHT_GLOWS.push({ m, day, night, lamp })
  m.opacity = (isNight() ? night : day) * (lamp ? lampGlow(getLights().on) : 1)
  return m
}
function lightsNow() {
  const n = isNight(), on = getLights().on
  for (const g of NIGHT_GLOWS) g.m.opacity = (n ? g.night : g.day) * (g.lamp ? lampGlow(on) : 1)
}
if (typeof document !== 'undefined') {
  new MutationObserver(lightsNow).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  onLights(lightsNow)
}

/**
 * The customers' side of the room, behind the aisle: a wall of cream plaster over a dark wooden wainscot, a frieze of
 * seigaiha waves under the beam, prints and hanging scrolls along the plaster, a shelf of sake bottles, crocks and a beckoning cat, and paper
 * pendant lamps hung low over the bar, their warm light painted on it. Seen from behind (the camera swung round),
 * the wall isn't drawn, so it never hides the bar.
 */

const INK = '#2a1a10'
const WP = new THREE.Vector3()
const NORMAL = new THREE.Vector3()
const WALL_H = 2.3
/** how thick the room's walls are, behind their face */
const WALL_T = 0.2
/** how far down the shop's base goes under the room's floor, for the wall's thickness to stand on it all the way */
const BASE_DEPTH = 0.46
const WAINSCOT = 0.85

/** a canvas texture of the given size, drawn by `draw` */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  // (painted again once the sign font has loaded: signFont)
  return signTexture(w, h, (g) => draw(g), repeat)
}

/** a paper's grain: a tile of fine speckle with short fibres in it, near white, multiplied over a picture (made once) */
let grainTile: HTMLCanvasElement | null = null
function grain() {
  if (grainTile) return grainTile
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const im = g.createImageData(256, 256)
  let sd = 7
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 256 * 256; i++) {
    const v = 236 + rnd() * 19
    im.data[i * 4] = v; im.data[i * 4 + 1] = v - 3; im.data[i * 4 + 2] = v - 10; im.data[i * 4 + 3] = 255
  }
  g.putImageData(im, 0, 0)
  for (let k = 0; k < 260; k++) {
    g.strokeStyle = rnd() < 0.55 ? 'rgba(120,96,64,0.16)' : 'rgba(255,250,236,0.4)'
    g.lineWidth = 0.6
    const x = rnd() * 256, y = rnd() * 256, a = rnd() * Math.PI
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke()
  }
  grainTile = c
  return c
}
/**
 * A picture on the walls, painted finer: drawn at its own size `w`×`h` but onto a canvas about 770 (a print) or 400 (a scroll) across, the
 * drawing scaled up, then the paper multiplied over it (its grain and fibres) and its edges aged a shade (a woodblock print's paper, a scroll's
 * silk)
 */
function artTex(kind: 'print' | 'scroll', w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const k = Math.max(1, Math.round(((kind === 'print' ? 770 : 400) / w) * 2) / 2)
  const W = Math.round(w * k), H = Math.round(h * k)
  const tex = signTexture(W, H, (g) => {
    g.save()
    g.scale(k, k)
    draw(g)
    g.restore()
    g.save()
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = g.createPattern(grain(), 'repeat')!
    g.fillRect(0, 0, W, H)
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72)
    v.addColorStop(0, 'rgb(255,255,255)')
    v.addColorStop(1, kind === 'print' ? 'rgb(222,206,180)' : 'rgb(228,216,194)')
    g.fillStyle = v
    g.fillRect(0, 0, W, H)
    g.restore()
  })
  if (tex) tex.anisotropy = 4
  return tex
}

/** a red seal stamped in a corner */
const seal = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = '#b8261c'
  g.fillRect(x, y, s, s)
  g.strokeStyle = '#f4e6cc'
  g.lineWidth = 1.5
  g.strokeRect(x + 3, y + 3, s - 6, s - 6)
}

/** the frieze under the beam: seigaiha, overlapping waves of rings in indigo on cream */
const SEIGAIHA = canvasTex(64 * 8, 32 * 8, (g) => {
  // (drawn eight times over its laid-out size, so the rings' edges stay clean along the whole frieze)
  g.setTransform(8, 0, 0, 8, 0, 0)
  g.fillStyle = '#e9dcc0'
  g.fillRect(0, 0, 64, 32)
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col < 3; col++) {
      const cx = col * 32 + (row % 2 ? 16 : 0), cy = 8 + row * 12
      for (let r = 16; r > 0; r -= 4) {
        g.beginPath()
        g.arc(cx, cy + 8, r, Math.PI, 0)
        g.fillStyle = r % 8 ? '#e9dcc0' : '#3a5578'
        g.fill()
        // (a fine pale thread at each ring's crest, as a dyed pattern's resist line)
        g.strokeStyle = r % 8 ? 'rgba(58,85,120,0.35)' : 'rgba(233,220,192,0.5)'
        g.lineWidth = 0.25
        g.stroke()
      }
    }
  }
}, true)

/** the pictures on the wall, each drawn here (no outside pictures): prints in frames and hanging scrolls */
const ART = {
  // Fuji under a red sun, bands of cloud across it
  fuji: artTex('print', 256, 180, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 180)
    sky.addColorStop(0, '#e8c99a')
    sky.addColorStop(1, '#f3e6c8')
    g.fillStyle = sky
    g.fillRect(0, 0, 256, 180)
    g.fillStyle = '#c8402c'
    g.beginPath(); g.arc(196, 46, 22, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#34507a'
    g.beginPath(); g.moveTo(10, 180); g.lineTo(112, 52); g.lineTo(144, 52); g.lineTo(246, 180); g.fill()
    g.fillStyle = '#f6f2ea'
    g.beginPath(); g.moveTo(112, 52); g.lineTo(144, 52); g.lineTo(166, 80)
    for (let k = 0; k < 6; k++) g.lineTo(160 - k * 11, k % 2 ? 92 : 80)
    g.lineTo(90, 80); g.fill()
    g.fillStyle = 'rgba(255,250,240,0.85)'
    for (const [x, y, w] of [[20, 120, 90], [150, 136, 80], [60, 150, 120]]) g.fillRect(x, y, w, 7)
    seal(g, 14, 14, 16)
  }),
  // a great wave curling over, its crest breaking into claws of foam
  wave: artTex('print', 256, 180, (g) => {
    g.fillStyle = '#efe2c4'
    g.fillRect(0, 0, 256, 180)
    g.fillStyle = '#25406a'
    g.beginPath(); g.moveTo(0, 180); g.bezierCurveTo(30, 60, 150, 10, 200, 60); g.bezierCurveTo(170, 50, 140, 70, 150, 100)
    g.bezierCurveTo(170, 130, 230, 150, 256, 140); g.lineTo(256, 180); g.fill()
    g.strokeStyle = '#f6f2ea'
    g.lineWidth = 3
    for (let k = 0; k < 7; k++) {
      g.beginPath(); g.arc(70 + k * 20, 48 + Math.abs(k - 3) * 8, 7, Math.PI, Math.PI * 1.9); g.stroke()
    }
    for (let k = 0; k < 5; k++) {
      g.beginPath(); g.moveTo(10 + k * 30, 170); g.bezierCurveTo(30 + k * 30, 120, 70 + k * 25, 100, 90 + k * 25, 110); g.stroke()
    }
    g.fillStyle = '#34507a'
    g.beginPath(); g.moveTo(170, 140); g.lineTo(186, 116); g.lineTo(202, 140); g.fill()
    seal(g, 226, 14, 16)
  }),
  // two koi, red and white, in dark water, rings spreading
  // (the koi, painted richer (the owner: the pictures' quality raised): deep water lit from above, two kohaku and a yamabuki gold one
  // gliding round each other, each with its fins, its scales catching the light and its own patches; lotus pads floating, rings spreading)
  koi: artTex('print', 256, 180, (g) => {
    const wat = g.createRadialGradient(150, 70, 10, 128, 90, 190)
    wat.addColorStop(0, '#2c5a66'); wat.addColorStop(0.55, '#173a46'); wat.addColorStop(1, '#0b1f28')
    g.fillStyle = wat
    g.fillRect(0, 0, 256, 180)
    // (light through the water: soft wavering bands)
    g.globalAlpha = 0.12
    g.strokeStyle = '#bfe6ee'
    g.lineWidth = 1.2
    for (let k = 0; k < 14; k++) {
      g.beginPath()
      for (let x = 0; x <= 256; x += 8) g.lineTo(x, 12 + k * 12 + Math.sin(x * 0.06 + k) * 3)
      g.stroke()
    }
    g.globalAlpha = 1
    // (rings spreading where something touched the surface)
    g.strokeStyle = 'rgba(205,235,242,0.32)'
    g.lineWidth = 0.9
    for (const [x, y] of [[62, 46], [204, 140]]) for (let r = 6; r < 40; r += 8) { g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.stroke() }
    const fish = (x: number, y: number, a: number, body: string, patch: string | null, len = 40) => {
      g.save(); g.translate(x, y); g.rotate(a)
      const w = len * 0.3
      // (its shadow on the water below)
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.beginPath(); g.ellipse(4, 6, len * 0.55, w * 0.6, 0, 0, Math.PI * 2); g.fill()
      // (the fins: a pair either side behind the head, the tail fanned)
      g.fillStyle = 'rgba(250,244,230,0.75)'
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(len * 0.22, sd * w * 0.5); g.quadraticCurveTo(len * 0.12, sd * w * 1.5, len * 0.02, sd * w * 1.2); g.lineTo(len * 0.14, sd * w * 0.4); g.fill() }
      g.beginPath(); g.moveTo(-len * 0.42, 0); g.quadraticCurveTo(-len * 0.62, -w * 1.2, -len * 0.75, -w * 1.1); g.quadraticCurveTo(-len * 0.66, 0, -len * 0.75, w * 1.1)
      g.quadraticCurveTo(-len * 0.62, w * 1.2, -len * 0.42, 0); g.fill()
      // (the body: full at the shoulders, narrowing to the tail)
      g.fillStyle = body
      g.beginPath(); g.moveTo(len * 0.5, 0)
      g.bezierCurveTo(len * 0.45, -w, len * 0.05, -w * 1.05, -len * 0.45, -w * 0.25)
      g.lineTo(-len * 0.45, w * 0.25)
      g.bezierCurveTo(len * 0.05, w * 1.05, len * 0.45, w, len * 0.5, 0)
      g.fill()
      g.save(); g.clip()
      if (patch) {
        g.fillStyle = patch
        g.beginPath(); g.ellipse(len * 0.22, -w * 0.2, len * 0.18, w * 0.75, 0.2, 0, Math.PI * 2); g.fill()
        g.beginPath(); g.ellipse(-len * 0.12, w * 0.25, len * 0.15, w * 0.6, -0.2, 0, Math.PI * 2); g.fill()
      }
      // (scales: rows of little arcs catching the light)
      g.strokeStyle = 'rgba(255,255,255,0.28)'
      g.lineWidth = 0.6
      for (let sx = -len * 0.35; sx < len * 0.35; sx += 3.2) for (let sy = -w; sy < w; sy += 3) { g.beginPath(); g.arc(sx + ((sy / 3) % 2) * 1.6, sy, 1.6, -1.1, 1.1); g.stroke() }
      // (the back's sheen)
      const sh = g.createLinearGradient(0, -w, 0, w)
      sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.15)')
      g.fillStyle = sh; g.fillRect(-len, -w, len * 2, w * 2)
      g.restore()
      // (its eye)
      g.fillStyle = '#1a1210'
      g.beginPath(); g.arc(len * 0.36, -w * 0.32, 1.1, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    fish(112, 74, 0.45, '#f6f0e4', '#d43a22', 44)
    fish(160, 118, -2.5, '#f2ebdd', '#e2542a', 40)
    fish(70, 120, -0.9, '#e8b83a', null, 34)
    // (lotus pads afloat, one in bud)
    const pad = (x: number, y: number, r: number, a: number) => {
      g.save(); g.translate(x, y); g.rotate(a)
      g.fillStyle = '#3f7a3a'
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0.25, Math.PI * 2 - 0.05); g.closePath(); g.fill()
      g.strokeStyle = 'rgba(160,210,120,0.6)'; g.lineWidth = 0.7
      for (let k = 0; k < 7; k++) { const t = 0.3 + k * 0.85; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t) * r * 0.9, Math.sin(t) * r * 0.9); g.stroke() }
      g.restore()
    }
    pad(214, 40, 16, 0.3)
    pad(30, 158, 13, 2.1)
    pad(232, 70, 9, 4)
    g.fillStyle = '#f0a8b8'
    g.beginPath(); g.ellipse(206, 52, 3.6, 5.5, 0.2, 0, Math.PI * 2); g.fill()
    seal(g, 14, 150, 16)
  }),
  // calligraphy: 一期一會 brushed down the paper
  calligraphy: artTex('scroll', 96, 256, (g) => {
    g.fillStyle = '#f4ead4'
    g.fillRect(0, 0, 96, 256)
    g.fillStyle = '#1a120c'
    g.font = 'bold 46px "Zen Antique", "Noto Serif TC", serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    ;['一', '期', '一', '會'].forEach((ch, i) => g.fillText(ch, 48, 34 + i * 50))
    seal(g, 56, 226, 18)
  }),
  // a branch of plum in blossom, in ink with pink flowers
  plum: artTex('scroll', 96, 256, (g) => {
    g.fillStyle = '#f4ead4'
    g.fillRect(0, 0, 96, 256)
    g.strokeStyle = '#2a1d16'
    g.lineCap = 'round'
    g.lineWidth = 5
    g.beginPath(); g.moveTo(10, 250); g.bezierCurveTo(40, 190, 20, 140, 60, 90); g.stroke()
    g.lineWidth = 3
    g.beginPath(); g.moveTo(32, 170); g.bezierCurveTo(60, 160, 70, 140, 84, 128); g.stroke()
    g.beginPath(); g.moveTo(60, 90); g.lineTo(76, 40); g.stroke()
    g.fillStyle = '#e48a9a'
    for (const [x, y] of [[60, 90], [76, 40], [84, 128], [50, 120], [66, 150], [40, 196], [70, 66]]) {
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 3.4, 0, Math.PI * 2); g.fill() }
    }
    seal(g, 8, 12, 14)
  }),
  // ---- ukiyo-e, as a woodblock print has them: flat colours, a bokashi graded across the sky, a black key line, a title cartouche, the seal
  // a red Fuji in the clear south wind: the cone in rust red streaked with snow, dark forest at its foot, a blue sky with rows of mackerel cloud
  akaFuji: artTex('print', 512, 360, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 360)
    sky.addColorStop(0, '#1c3c78'); sky.addColorStop(0.45, '#5a86b8'); sky.addColorStop(0.7, '#d8e2e0'); sky.addColorStop(1, '#efe4c8')
    g.fillStyle = sky; g.fillRect(0, 0, 512, 360)
    g.fillStyle = 'rgba(250,248,240,0.9)'
    for (let row = 0; row < 4; row++) for (let k = 0; k < 18; k++) { g.beginPath(); g.ellipse(30 + k * 28 + (row % 2) * 14, 40 + row * 16 + Math.sin(k) * 3, 9, 3.5, 0, 0, Math.PI * 2); g.fill() }
    const red = g.createLinearGradient(0, 100, 0, 330)
    red.addColorStop(0, '#6a1a0e'); red.addColorStop(0.5, '#b0361e'); red.addColorStop(1, '#d4603a')
    g.fillStyle = red
    g.beginPath(); g.moveTo(40, 330); g.bezierCurveTo(150, 250, 210, 140, 236, 110); g.lineTo(276, 108); g.bezierCurveTo(300, 140, 370, 250, 480, 330); g.closePath(); g.fill()
    g.fillStyle = '#f4f0e6'
    g.beginPath(); g.moveTo(236, 110); g.lineTo(276, 108); g.lineTo(286, 124)
    for (let k = 0; k < 7; k++) g.lineTo(282 - k * 7, 132 + (k % 2) * 26)
    g.lineTo(228, 128); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(244,240,230,0.85)'; g.lineWidth = 2
    for (const [x, y, l] of [[250, 140, 40], [262, 150, 52], [238, 150, 34], [274, 160, 30]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x - 256) * 0.3, y + l); g.stroke() }
    g.fillStyle = '#1e3a24'
    g.beginPath(); g.moveTo(0, 360); g.lineTo(0, 318)
    for (let x = 0; x <= 512; x += 10) g.lineTo(x, 318 + Math.sin(x / 9) * 6 - (x > 120 && x < 400 ? 8 : 0))
    g.lineTo(512, 360); g.closePath(); g.fill()
    g.strokeStyle = '#1a1210'; g.lineWidth = 2.2
    g.beginPath(); g.moveTo(40, 330); g.bezierCurveTo(150, 250, 210, 140, 236, 110); g.lineTo(276, 108); g.bezierCurveTo(300, 140, 370, 250, 480, 330); g.stroke()
    g.fillStyle = '#efe6cc'; g.fillRect(420, 14, 30, 92); g.strokeStyle = '#1a1210'; g.lineWidth = 1.2; g.strokeRect(420, 14, 30, 92)
    g.fillStyle = '#1a1210'; g.font = '700 20px "Zen Antique", serif'; g.textAlign = 'center'
    ;['凱', '風', '快', '晴'].forEach((c, k) => g.fillText(c, 435, 36 + k * 21))
    seal(g, 464, 24, 24)
  }),
  // rain on a great bridge: driving lines of rain over all, a dark sky graded down, people under umbrellas hurrying across, the far bank in grey
  rainBridge: artTex('print', 512, 360, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 360)
    sky.addColorStop(0, '#1a1c20'); sky.addColorStop(0.3, '#5a6066'); sky.addColorStop(0.6, '#c8cabe'); sky.addColorStop(1, '#6a8a9a')
    g.fillStyle = sky; g.fillRect(0, 0, 512, 360)
    g.fillStyle = 'rgba(70,80,84,0.7)'
    g.beginPath(); g.moveTo(0, 200); for (let x = 0; x <= 512; x += 16) g.lineTo(x, 196 - Math.sin(x / 40) * 6 - (x > 300 ? 10 : 0)); g.lineTo(512, 220); g.lineTo(0, 220); g.fill()
    g.fillStyle = '#4a7a8a'; g.fillRect(0, 220, 512, 140)
    g.fillStyle = '#8a6a44'
    g.beginPath(); g.moveTo(-10, 300); g.quadraticCurveTo(260, 200, 530, 250); g.lineTo(530, 270); g.quadraticCurveTo(260, 222, -10, 322); g.closePath(); g.fill()
    g.strokeStyle = '#3a2814'; g.lineWidth = 3
    for (let x = 20; x < 512; x += 46) { const y = 300 - (x / 512) * 60 + Math.sin(x / 160) * 0; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + 4, 360); g.stroke() }
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(-10, 300); g.quadraticCurveTo(260, 200, 530, 250); g.stroke()
    for (const [x, c] of [[150, '#2a3a5a'], [210, '#6a2a1a'], [300, '#2a4a3a'], [340, '#3a3020']] as [number, string][]) {
      const y = 300 - (x / 512) * 60 - 22
      g.fillStyle = c; g.beginPath(); g.moveTo(x - 6, y + 22); g.lineTo(x, y + 4); g.lineTo(x + 6, y + 22); g.fill()
      g.fillStyle = '#d8c89a'; g.beginPath(); g.moveTo(x - 16, y + 4); g.quadraticCurveTo(x, y - 12, x + 16, y + 4); g.closePath(); g.fill()
      g.strokeStyle = '#1a1210'; g.lineWidth = 1; g.stroke()
    }
    g.strokeStyle = 'rgba(30,30,34,0.55)'; g.lineWidth = 0.9
    for (let k = 0; k < 220; k++) { const x = (k * 53) % 560 - 20, y = (k * 97) % 380 - 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 9, y + 40); g.stroke() }
    g.fillStyle = '#efe6cc'; g.fillRect(452, 14, 28, 96); g.strokeStyle = '#1a1210'; g.strokeRect(452, 14, 28, 96)
    g.fillStyle = '#1a1210'; g.font = '700 19px "Zen Antique", serif'; g.textAlign = 'center'
    ;['大', '橋', '夕', '立'].forEach((c, k) => g.fillText(c, 466, 36 + k * 22))
    seal(g, 418, 20, 24)
  }),
  // a kabuki actor's head and shoulders (yakusha-e): a white face with red kumadori lines, the brows drawn up, eyes crossed in a glare, a black
  // topknot wig, a robe of bold checks, on a dark mica ground
  kabuki: artTex('scroll', 200, 476, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, 476)
    bg.addColorStop(0, '#3a3438'); bg.addColorStop(1, '#5a5254')
    g.fillStyle = bg; g.fillRect(0, 0, 200, 476)
    g.fillStyle = 'rgba(220,210,200,0.08)'; for (let k = 0; k < 300; k++) g.fillRect((k * 37) % 200, (k * 71) % 476, 2, 2)
    g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(100, 150, 62, 70, 0, Math.PI, 0); g.fill()
    g.beginPath(); g.ellipse(100, 80, 26, 18, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f4eee2'; g.beginPath(); g.ellipse(100, 186, 50, 64, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#c4201a'; g.lineWidth = 4; g.lineCap = 'round'
    for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(100 + sd * 10, 170); g.quadraticCurveTo(100 + sd * 34, 150, 100 + sd * 48, 132); g.stroke()
      g.beginPath(); g.moveTo(100 + sd * 22, 200); g.quadraticCurveTo(100 + sd * 40, 210, 100 + sd * 46, 236); g.stroke()
    }
    g.strokeStyle = '#1a1210'; g.lineWidth = 4
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(100 + sd * 8, 160); g.lineTo(100 + sd * 36, 146); g.stroke() }
    g.fillStyle = '#fff'; g.lineWidth = 1.5
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(100 + sd * 22, 176, 11, 6, sd * -0.2, 0, Math.PI * 2); g.fill(); g.stroke() }
    g.fillStyle = '#1a1210'; for (const sd of [-1, 1]) { g.beginPath(); g.arc(100 + sd * 22 - sd * 5, 176, 3.4, 0, Math.PI * 2); g.fill() }
    g.beginPath(); g.moveTo(100, 184); g.lineTo(94, 206); g.lineTo(102, 208); g.stroke()
    g.strokeStyle = '#8a1a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(84, 226); g.quadraticCurveTo(100, 218, 116, 226); g.stroke()
    for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) { g.fillStyle = (row + col) % 2 ? '#1c2a52' : '#d8b04a'; g.fillRect(16 + col * 28, 262 + row * 26, 28, 26) }
    g.fillStyle = '#f4eee2'; g.beginPath(); g.moveTo(70, 250); g.lineTo(100, 300); g.lineTo(130, 250); g.closePath(); g.fill()
    g.strokeStyle = '#1a1210'; g.lineWidth = 2; g.strokeRect(16, 262, 168, 208)
    g.fillStyle = '#d8c89a'; g.fillRect(150, 12, 36, 120); g.strokeStyle = '#1a1210'; g.lineWidth = 1; g.strokeRect(150, 12, 36, 120)
    g.fillStyle = '#1a1210'; g.font = '700 20px "Zen Antique", serif'; g.textAlign = 'center'
    ;['市', '川', '團', '十', '郎'].forEach((c, k) => g.fillText(c, 168, 34 + k * 22))
    seal(g, 14, 14, 26)
  }),
  // a beauty (bijin-ga): her hair dressed high with combs and pins, a fan in her hand, a kimono of blue waves over red, on a pale ground
  bijin: artTex('scroll', 200, 476, (g) => {
    g.fillStyle = '#f0e6d0'; g.fillRect(0, 0, 200, 476)
    g.fillStyle = 'rgba(160,130,90,0.12)'; for (let k = 0; k < 120; k++) g.fillRect((k * 41) % 200, (k * 67) % 476, 18, 1)
    g.fillStyle = '#1a1210'
    g.beginPath(); g.ellipse(104, 96, 50, 40, 0, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(104, 52, 30, 22, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#c8a050'; g.fillRect(60, 70, 88, 6)
    g.strokeStyle = '#c8a050'; g.lineWidth = 3
    for (const [x0, y0, x1, y1] of [[80, 50, 50, 26], [130, 50, 160, 28], [140, 90, 176, 76]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
    g.fillStyle = '#c4201a'; g.beginPath(); g.arc(50, 26, 5, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f6efe4'; g.beginPath(); g.ellipse(100, 134, 30, 38, 0.1, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#1a1210'; g.lineWidth = 1.4
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(100 + sd * 6, 124); g.quadraticCurveTo(100 + sd * 14, 120, 100 + sd * 20, 124); g.stroke() }
    g.beginPath(); g.moveTo(100, 132); g.lineTo(98, 144); g.stroke()
    g.fillStyle = '#c4201a'; g.beginPath(); g.ellipse(100, 156, 4, 2.2, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#b8261c'; g.beginPath(); g.moveTo(40, 476); g.lineTo(54, 190); g.quadraticCurveTo(100, 170, 150, 190); g.lineTo(168, 476); g.closePath(); g.fill()
    g.fillStyle = '#28487a'; g.beginPath(); g.moveTo(54, 476); g.lineTo(62, 200); g.quadraticCurveTo(100, 186, 140, 200); g.lineTo(156, 476); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(230,236,240,0.7)'; g.lineWidth = 1.6
    for (let y = 220; y < 476; y += 22) for (let x = 60; x < 160; x += 22) { g.beginPath(); g.arc(x + ((y / 22) % 2) * 11, y, 10, Math.PI, 0); g.stroke() }
    g.fillStyle = '#e8c45a'; g.fillRect(56, 268, 98, 34)
    g.fillStyle = '#f4ead4'; g.beginPath(); g.moveTo(120, 300); g.arc(120, 300, 46, -2.4, -1.2); g.closePath(); g.fill()
    g.strokeStyle = '#1a1210'; g.lineWidth = 1; g.stroke()
    g.fillStyle = '#d8c89a'; g.fillRect(156, 12, 30, 100); g.strokeRect(156, 12, 30, 100)
    g.fillStyle = '#1a1210'; g.font = '700 18px "Zen Antique", serif'; g.textAlign = 'center'
    ;['美', '人', '團', '扇'].forEach((c, k) => g.fillText(c, 171, 34 + k * 22))
    seal(g, 14, 430, 26)
  }),
}
type ArtKey = keyof typeof ART
/** a scroll's mounting: the dark silk of its top and foot (a fine weave, a soft sheen down it), and the brocade band round its picture (gold
 * flowers in a lattice of diamonds, 花菱, on olive) */
const SCROLL_SILK = canvasTex(128, 384, (g) => {
  const gr = g.createLinearGradient(0, 0, 128, 0)
  gr.addColorStop(0, '#2c2420'); gr.addColorStop(0.5, '#3c312a'); gr.addColorStop(1, '#2a221e')
  g.fillStyle = gr; g.fillRect(0, 0, 128, 384)
  g.globalAlpha = 0.18
  for (let y = 0; y < 384; y += 2) { g.fillStyle = y % 4 ? '#000' : '#6a5a4a'; g.fillRect(0, y, 128, 1) }
  g.globalAlpha = 1
})
const SCROLL_BROCADE = canvasTex(256, 512, (g) => {
  g.fillStyle = '#5e5530'; g.fillRect(0, 0, 256, 512)
  g.strokeStyle = 'rgba(214,178,92,0.55)'; g.lineWidth = 1.2
  for (let k = -512; k < 512; k += 24) {
    g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 512, 512); g.stroke()
    g.beginPath(); g.moveTo(k + 512, 0); g.lineTo(k, 512); g.stroke()
  }
  g.fillStyle = 'rgba(232,196,110,0.85)'
  for (let y = 12; y < 512; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < 256; x += 24) {
    for (let p = 0; p < 4; p++) {
      const a = (p * Math.PI) / 2
      g.beginPath(); g.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.6, 1.5, a, 0, Math.PI * 2); g.fill()
    }
  }
})
// (the woodblock prints in turn with the others along the walls)
const PRINTS: ArtKey[] = ['akaFuji', 'fuji', 'rainBridge', 'wave', 'koi']
const SCROLLS: ArtKey[] = ['calligraphy', 'kabuki', 'plum', 'bijin']

/**
 * Nobori (幟), the tall narrow banners a yakitori or grill shop hangs: a cloth of red, indigo or white with the shop's
 * word down it in big letters (a stripe along its edge, stitching), laced by loops to a bamboo rod, the foot weighted;
 * it stirs a little in the air.
 */
type NoboriLook = { text: string; cloth: string; ink: string; edge: string; shape: 'rect' | 'swallow' | 'point' | 'wave'
  pat?: 'seigaiha' | 'fish' | 'sun' | 'flame' | 'stripe' }
/** the cloths: red, indigo, white, black, orange, yellow, green; cut square, swallow-tailed, to a point or scalloped; some printed
 * with waves, a fish, the sun, flames or a stripe */
const NOBORI_LOOKS: NoboriLook[] = [
  { text: '炭火燒烤', cloth: '#b8261c', ink: '#fbf3e2', edge: '#fbf3e2', shape: 'rect' },
  { text: '日式烤魚', cloth: '#1f3a68', ink: '#fbf3e2', edge: '#e8d9b0', shape: 'swallow', pat: 'seigaiha' },
  { text: '生ビール', cloth: '#f4efe2', ink: '#b8261c', edge: '#b8261c', shape: 'rect' },
  { text: '銘酒', cloth: '#b8261c', ink: '#fbf3e2', edge: '#fbf3e2', shape: 'point' },
  { text: '深夜食堂', cloth: '#1f3a68', ink: '#fbf3e2', edge: '#e8d9b0', shape: 'rect', pat: 'stripe' },
  { text: '飲料', cloth: '#f4efe2', ink: '#1f3a68', edge: '#1f3a68', shape: 'wave' },
  { text: '大漁', cloth: '#14120f', ink: '#e8c45a', edge: '#e8c45a', shape: 'swallow', pat: 'flame' },
  { text: '旬', cloth: '#e8742a', ink: '#fffaf0', edge: '#fffaf0', shape: 'rect', pat: 'sun' },
  { text: '名物', cloth: '#f2c62a', ink: '#1a0d06', edge: '#1a0d06', shape: 'point' },
  { text: '本日推薦', cloth: '#f4efe2', ink: '#14120f', edge: '#b8261c', shape: 'rect', pat: 'stripe' },
  { text: '秋刀魚', cloth: '#1f3a68', ink: '#fffaf0', edge: '#fffaf0', shape: 'swallow', pat: 'fish' },
  { text: '営業中', cloth: '#b8261c', ink: '#fffaf0', edge: '#fffaf0', shape: 'wave' },
  { text: '焼', cloth: '#14120f', ink: '#d8341c', edge: '#d8341c', shape: 'rect', pat: 'flame' },
  { text: '歓迎', cloth: '#2f7a4a', ink: '#fffaf0', edge: '#fffaf0', shape: 'point' },
  { text: '鮭', cloth: '#e8742a', ink: '#fffaf0', edge: '#fffaf0', shape: 'swallow', pat: 'seigaiha' },
  { text: '炭火', cloth: '#f4efe2', ink: '#14120f', edge: '#14120f', shape: 'wave', pat: 'sun' },
  { text: '焼鳥', cloth: '#e8588a', ink: '#fffaf0', edge: '#fffaf0', shape: 'swallow', pat: 'stripe' },
  { text: '刺身', cloth: '#7a4aa8', ink: '#fffaf0', edge: '#f2d9ff', shape: 'rect', pat: 'seigaiha' },
  { text: '定食', cloth: '#f2c62a', ink: '#b8261c', edge: '#b8261c', shape: 'point' },
  { text: 'おでん', cloth: '#3aa7b8', ink: '#fffaf0', edge: '#fffaf0', shape: 'wave', pat: 'stripe' },
  { text: '祭', cloth: '#d8341c', ink: '#f2c62a', edge: '#f2c62a', shape: 'swallow', pat: 'sun' },
  { text: '呑', cloth: '#9ad0e8', ink: '#1f3a68', edge: '#1f3a68', shape: 'rect', pat: 'seigaiha' },
  { text: '本日限定', cloth: '#f4efe2', ink: '#7a4aa8', edge: '#e8588a', shape: 'swallow', pat: 'stripe' },
  { text: '生ビール', cloth: '#2f7a4a', ink: '#fffaf0', edge: '#e8c45a', shape: 'point' },
]
const NOBORI_W = 0.3
const NOBORI_H = 0.92
const noboriCache = new Map<number, THREE.Texture | null>()
const noboriTex = (i: number) => {
  if (!noboriCache.has(i)) {
    const look = NOBORI_LOOKS[i]
    noboriCache.set(i, signTexture(96 * 3, 296 * 3, (g) => {
      // (drawn at three times its laid-out size: the letters and the stitching stay crisp seen close)
      g.setTransform(3, 0, 0, 3, 0, 0)
      // (the cloth's cut: square, a swallow's tail, a point, or scallops along its foot)
      g.save()
      g.beginPath()
      if (look.shape === 'swallow') {
        g.moveTo(0, 0); g.lineTo(96, 0); g.lineTo(96, 296); g.lineTo(48, 244); g.lineTo(0, 296)
      } else if (look.shape === 'point') {
        g.moveTo(0, 0); g.lineTo(96, 0); g.lineTo(96, 236); g.lineTo(48, 296); g.lineTo(0, 236)
      } else if (look.shape === 'wave') {
        g.moveTo(0, 0); g.lineTo(96, 0); g.lineTo(96, 270)
        for (let k = 2; k >= 0; k--) g.arc(16 + k * 32, 270, 16, 0, Math.PI, false)
      } else {
        g.rect(0, 0, 96, 296)
      }
      g.closePath()
      g.clip()
      g.fillStyle = look.cloth
      g.fillRect(0, 0, 96, 296)
      // (the weave, and a border stitched down each side)
      g.strokeStyle = 'rgba(0,0,0,0.07)'
      for (let y = 0; y < 296; y += 3) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(96, y)
        g.stroke()
      }
      // (what's printed on it)
      g.fillStyle = look.edge
      g.strokeStyle = look.edge
      if (look.pat === 'seigaiha') {
        g.globalAlpha = 0.45
        g.lineWidth = 1.6
        for (let row = 0; row < 3; row++) for (let col = -1; col < 4; col++) for (const r of [14, 9, 4]) {
          g.beginPath()
          g.arc(col * 26 + (row % 2) * 13, 262 + row * 13, r, Math.PI, 0)
          g.stroke()
        }
        g.globalAlpha = 1
      } else if (look.pat === 'fish') {
        g.globalAlpha = 0.5
        g.beginPath()
        g.ellipse(46, 252, 22, 10, 0, 0, Math.PI * 2)
        g.moveTo(66, 252); g.lineTo(84, 240); g.lineTo(84, 264)
        g.fill()
        g.globalAlpha = 1
      } else if (look.pat === 'sun') {
        g.fillStyle = '#c8301e'
        g.beginPath()
        g.arc(48, 44, 24, 0, Math.PI * 2)
        g.fill()
      } else if (look.pat === 'flame') {
        g.fillStyle = '#d8341c'
        g.globalAlpha = 0.85
        for (let k = 0; k < 4; k++) {
          g.beginPath()
          g.moveTo(k * 24 - 4, 296)
          g.quadraticCurveTo(k * 24 + 10, 262 - (k % 2) * 14, k * 24 + 12, 232 - (k % 2) * 22)
          g.quadraticCurveTo(k * 24 + 22, 262, k * 24 + 30, 296)
          g.fill()
        }
        g.globalAlpha = 1
      } else if (look.pat === 'stripe') {
        g.globalAlpha = 0.28
        g.save()
        g.translate(48, 148)
        g.rotate(-0.25)
        g.fillRect(-70, -120, 22, 240)
        g.fillRect(48, -120, 22, 240)
        g.restore()
        g.globalAlpha = 1
      }
      // (the cotton's slub: flecks a little lighter and darker all over)
      for (let k = 0; k < 900; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; g.fillRect((k * 37) % 96, (k * 89) % 296, 1.4, 0.6) }
      // (the cloth's own life: a soft shade down it, two vertical folds, the dye heavier at the top where it's hung)
      const shade = g.createLinearGradient(0, 0, 96, 0)
      shade.addColorStop(0, 'rgba(0,0,0,0.16)')
      shade.addColorStop(0.2, 'rgba(0,0,0,0)')
      shade.addColorStop(0.78, 'rgba(255,255,255,0.06)')
      shade.addColorStop(1, 'rgba(0,0,0,0.2)')
      g.fillStyle = shade
      g.fillRect(0, 0, 96, 296)
      const dye = g.createLinearGradient(0, 0, 0, 60)
      dye.addColorStop(0, 'rgba(0,0,0,0.28)')
      dye.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = dye
      g.fillRect(0, 0, 96, 60)
      g.strokeStyle = 'rgba(0,0,0,0.12)'
      g.lineWidth = 2
      for (const fx of [32, 66]) {
        g.beginPath()
        g.moveTo(fx, 0)
        g.lineTo(fx + 3, 296)
        g.stroke()
      }
      // (the sleeve at the top the rod passes through, stitched along its lower edge)
      g.fillStyle = 'rgba(0,0,0,0.22)'
      g.fillRect(0, 0, 96, 12)
      g.fillStyle = look.edge
      g.globalAlpha = 0.8
      for (let x = 4; x < 96; x += 8) g.fillRect(x, 12, 4, 1.6)
      g.globalAlpha = 1
      g.fillStyle = look.edge
      g.fillRect(5, 0, 3, 296)
      g.fillRect(88, 0, 3, 296)
      g.setLineDash([6, 5])
      g.strokeStyle = look.edge
      g.lineWidth = 1.4
      g.strokeRect(12, 4, 72, look.shape === 'rect' ? 288 : 226)
      g.setLineDash([])
      // (the word, a letter to a line, big and bold, in the sign font)
      const chars = [...look.text]
      const size = chars.length > 3 ? 46 : chars.length === 1 ? 78 : 56
      const gap = Math.min(size * 1.08, 190 / chars.length)
      const top = look.pat === 'sun' ? 104 : 30
      chars.forEach((ch, k) => brushText(g, ch, 48, top + size * 0.55 + k * gap, size, { fill: look.ink, edge: look.cloth, shadow: 'rgba(0,0,0,0.26)', shine: look.ink }))
      g.restore()
    }))
  }
  return noboriCache.get(i) ?? null
}
/** a wide banner (横断幕) hung from two cords across a stretch of the rope: a word set along it */
const HBANNER_LOOKS = [
  { text: 'いらっしゃいませ', cloth: '#b8261c', ink: '#fbf3e2', edge: '#fbf3e2' },
  { text: '炭火燒烤 銘酒', cloth: '#1f3a68', ink: '#fbf3e2', edge: '#e8d9b0' },
  { text: '本日の推薦', cloth: '#f4efe2', ink: '#b8261c', edge: '#b8261c' },
  { text: '大漁', cloth: '#14120f', ink: '#e8c45a', edge: '#e8c45a' },
]
const hbannerCache = new Map<number, THREE.Texture | null>()
const hbannerTex = (i: number) => {
  if (!hbannerCache.has(i)) {
    const look = HBANNER_LOOKS[i]
    hbannerCache.set(i, signTexture(320 * 3, 96 * 3, (g) => {
      g.setTransform(3, 0, 0, 3, 0, 0)
      g.fillStyle = look.cloth
      g.fillRect(0, 0, 320, 96)
      g.strokeStyle = 'rgba(0,0,0,0.07)'
      for (let x = 0; x < 320; x += 3) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, 96)
        g.stroke()
      }
      g.fillStyle = look.edge
      g.fillRect(0, 5, 320, 3)
      g.fillRect(0, 88, 320, 3)
      const chars = [...look.text]
      const size = chars.length > 5 ? 40 : 54
      brushText(g, look.text, 160, 49, Math.min(size, 290 / chars.length), { fill: look.ink, shadow: 'rgba(0,0,0,0.25)' })
      // (a shade along it as it sags between its cords, stitched hems, brass grommets at its top corners)
      const sag = g.createLinearGradient(0, 0, 0, 96)
      sag.addColorStop(0, 'rgba(0,0,0,0.18)'); sag.addColorStop(0.3, 'rgba(0,0,0,0)'); sag.addColorStop(1, 'rgba(0,0,0,0.12)')
      g.fillStyle = sag; g.fillRect(0, 0, 320, 96)
      g.setLineDash([5, 4]); g.strokeStyle = look.edge; g.lineWidth = 1; g.globalAlpha = 0.7
      g.beginPath(); g.moveTo(0, 12); g.lineTo(320, 12); g.moveTo(0, 84); g.lineTo(320, 84); g.stroke()
      g.setLineDash([]); g.globalAlpha = 1
      for (const x of [10, 310]) { g.fillStyle = '#c8a050'; g.beginPath(); g.arc(x, 10, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x, 10, 2.4, 0, Math.PI * 2); g.fill() }
    }))
  }
  return hbannerCache.get(i) ?? null
}
/** a banner's cloth, a unit plane with a slow ripple down it (so it hangs as cloth, not a board) */
const CLOTH_GEO = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 4, 10)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    p.setZ(i, Math.sin(y * 7 + x * 3) * 0.018 * (0.4 + (0.5 - y)) + Math.sin(x * 9) * 0.01)
  }
  g.computeVertexNormals()
  return g
})()
const NOBORI_GEO = {
  rod: new THREE.CylinderGeometry(0.007, 0.007, NOBORI_W + 0.08, 8),
  cap: new THREE.SphereGeometry(0.011, 8, 6),
  loop: new THREE.BoxGeometry(0.004, 0.05, 0.02),
  weight: new THREE.CylinderGeometry(0.006, 0.006, NOBORI_W + 0.03, 6),
}
function Nobori({ i }: { i: number }) {
  const cloth = useRef<THREE.Group>(null)
  const seed = useMemo(() => i * 1.7 + 0.5, [i])
  useFrame(({ clock }) => {
    // (a slow sway from the rod, and a ripple's worth of lean)
    const t = clock.elapsedTime
    if (cloth.current) {
      cloth.current.rotation.z = Math.sin(t * 0.8 + seed) * 0.035
      cloth.current.rotation.y = Math.sin(t * 0.6 + seed * 2) * 0.03
    }
  })
  return (
    <group position-y={NOBORI_H / 2 - 0.05}>
      {/* the rod and its knobs, over the cloth's top */}
      <mesh geometry={NOBORI_GEO.rod} position={[-0.01, NOBORI_H / 2 + 0.03, 0]} rotation-x={Math.PI / 2}><meshToonMaterial color="#6a4a2a" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} geometry={NOBORI_GEO.cap} position={[-0.01, NOBORI_H / 2 + 0.03, s * (NOBORI_W + 0.08) / 2]}><meshToonMaterial color="#3a2a1a" /></mesh>)}
      <group ref={cloth} position={[-0.012, NOBORI_H / 2 + 0.03, 0]}>
        {/* (the loops it hangs by, the cloth below them) */}
        {[-0.11, 0, 0.11].map((z) => <mesh key={z} geometry={NOBORI_GEO.loop} position={[0, -0.02, z]}><meshToonMaterial color="#e8dcc0" /></mesh>)}
        <mesh position={[-0.004, -NOBORI_H / 2 - 0.04, 0]} rotation-y={-Math.PI / 2} geometry={CLOTH_GEO} scale={[NOBORI_W, NOBORI_H, 1]}>
          <meshToonMaterial color="#ffffff" map={noboriTex(i)} side={THREE.DoubleSide} transparent alphaTest={0.4} />
        </mesh>
        <mesh geometry={NOBORI_GEO.weight} position={[-0.006, -NOBORI_H - 0.04, 0]} rotation-x={Math.PI / 2}><meshToonMaterial color="#2a1a10" /></mesh>
      </group>
    </group>
  )
}

/**
 * The banners strung overhead as an izakaya hangs them: a rope along the wall's aisle, a close row of narrow banners of every
 * colour hung from it, each swinging a little on its own.
 */
/** `start`, `step`: which cloths it takes in turn */
function BannerRow({ zs, start = 0, step = 1 }: { zs: number[]; start?: number; step?: number }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  // (the same every time: a mix of cloths and lengths, a wide banner every so often taking three places)
  const items = useMemo(() => {
    const out: { z: number; look: number; len: number; w: number; wide: boolean }[] = []
    for (let k = 0; k < zs.length; k++) {
      if (k % 7 === 3 && k + 2 < zs.length) {
        out.push({ z: zs[k + 1], look: (k * 3) % HBANNER_LOOKS.length, len: 0.2, w: 0.62, wide: true })
        k += 2
      } else {
        const look = (start + k * step) % NOBORI_LOOKS.length
        out.push({ z: zs[k], look, len: 0.34 + 0.05 * Math.abs(((k % 4) - 1.5)), w: NOBORI_LOOKS[look].shape === 'rect' ? 0.15 : 0.17, wide: false })
      }
    }
    return out
  }, [zs, start, step])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      g.rotation.x = Math.sin(t * 0.9 + i * 1.3) * 0.05
      g.rotation.z = Math.sin(t * 0.7 + i) * 0.04
    })
  })
  const z0 = zs[0] - 0.12, z1 = zs[zs.length - 1] + 0.12
  // (the rope swags between pegs about a metre apart, dipping a little in each span; the cloths hang from it where it is)
  const spans = Math.max(1, Math.round((z1 - z0) / 1.1)), span = (z1 - z0) / spans, SAG = 0.06
  const sagAt = (z: number) => { const t = ((z - z0) / span) % 1; return -SAG * 4 * t * (1 - t) }
  const rope = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= spans * 16; k++) { const z = z0 + (k / 16) * span; pts.push(new THREE.Vector3(0, k % 16 === 0 ? 0 : sagAt(z), z)) }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), spans * 16, 0.005, 5)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z0, z1])
  return (
    <group>
      <mesh geometry={rope}><meshToonMaterial color="#3a2414" /></mesh>
      {/* (a brass peg at each end of each span) */}
      {Array.from({ length: spans + 1 }, (_, k) => (
        <mesh key={`p${k}`} position={[0, 0, z0 + k * span]}><sphereGeometry args={[0.012, 8, 6]} /><meshToonMaterial color="#c8a050" /></mesh>
      ))}
      {items.map((it, i) => (
        <group key={i} position={[0, sagAt(it.z), it.z]} ref={(g) => { refs.current[i] = g }}>
          {it.wide ? (
            <>
              <mesh position={[0, -0.02 - it.len / 2, 0]} rotation-y={-Math.PI / 2}>
                <planeGeometry args={[it.w, it.len]} /><meshToonMaterial color="#ffffff" map={hbannerTex(it.look)} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, -0.02 - it.len, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.004, 0.004, it.w, 5]} /><meshToonMaterial color="#3a2414" /></mesh>
            </>
          ) : (
            <>
              {/* (the cloth's sleeve over the rope) */}
              <mesh position={[0, -0.008, 0]}><boxGeometry args={[0.014, 0.022, it.w + 0.01]} /><meshToonMaterial color="#e8dcc0" /></mesh>
              <mesh position={[0, -it.len / 2 - 0.015, 0]} rotation-y={-Math.PI / 2} geometry={CLOTH_GEO} scale={[it.w, it.len, 1]}>
                <meshToonMaterial color="#ffffff" map={noboriTex(it.look)} side={THREE.DoubleSide} transparent alphaTest={0.4} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  )
}

/**
 * A string of little warm bulbs swagged along a wall's top under the frieze: a thin wire looped between brass pegs, a bulb every hand's width
 * along each loop, and a small glowing paper globe at each peg. Light is painted (emissive bulbs, a soft halo), none cast.
 */
// (switched off, grey: a bulb's clear glass darker than a globe's frosted)
const FESTOON_BULB = lampLit(new THREE.MeshBasicMaterial({ toneMapped: false }), { dim: 0.5 })
const FESTOON_GLOBE = lampLit(new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }), { dim: 0.92 })
const FESTOON_HALO = nightGlow(new THREE.MeshBasicMaterial({ color: '#ffc060', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0.1, 0.32)
function Festoon({ l, mid }: { l: number; mid: number }) {
  const built = useMemo(() => {
    const spans = Math.max(1, Math.round(l / 0.8)), span = l / spans, sag = 0.075, per = 6
    const wire: number[] = [], bulbs: [number, number][] = [], pegs: number[] = []
    for (let i = 0; i < spans; i++) {
      const z0 = -l / 2 + i * span
      pegs.push(z0)
      let prev: [number, number] | null = null
      for (let k = 0; k <= 12; k++) {
        const t = k / 12, pt: [number, number] = [z0 + t * span, -sag * 4 * t * (1 - t)]
        if (prev) wire.push(0, prev[1], prev[0], 0, pt[1], pt[0])
        prev = pt
      }
      for (let k = 1; k < per; k++) {
        const t = k / per
        bulbs.push([z0 + t * span, -sag * 4 * t * (1 - t) - 0.016])
      }
    }
    pegs.push(l / 2)
    const wireGeo = new THREE.BufferGeometry()
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3))
    return { wireGeo, bulbs, pegs }
  }, [l])
  const bulb = useRef<THREE.InstancedMesh>(null), halo = useRef<THREE.InstancedMesh>(null), globe = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color()
    built.bulbs.forEach(([z, y], i) => {
      m.makeTranslation(0, y, z)
      bulb.current?.setMatrixAt(i, m)
      halo.current?.setMatrixAt(i, m)
      // (the bulbs go amber, white and gold in turn, so the string reads as a run of colours, not a bead chain)
      bulb.current?.setColorAt(i, c.set(i % 3 === 0 ? '#ffd27a' : i % 3 === 1 ? '#fff0c4' : '#ffb85c'))
    })
    built.pegs.forEach((z, i) => globe.current?.setMatrixAt(i, m.makeTranslation(0, -0.04, z)))
    for (const r of [bulb, halo, globe]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true }
  }, [built])
  return (
    <group position={[-0.034, WALL_H - 0.32, mid]}>
      <group>
        <lineSegments geometry={built.wireGeo}><lineBasicMaterial color="#2a1a10" /></lineSegments>
        <instancedMesh ref={bulb} args={[undefined, undefined, built.bulbs.length]}>
          <sphereGeometry args={[0.013, 8, 6]} /><primitive object={FESTOON_BULB} attach="material" />
        </instancedMesh>
        <instancedMesh ref={halo} args={[undefined, undefined, built.bulbs.length]} renderOrder={2}>
          <sphereGeometry args={[0.034, 8, 6]} /><primitive object={FESTOON_HALO} attach="material" />
        </instancedMesh>
        <instancedMesh ref={globe} args={[undefined, undefined, built.pegs.length]}>
          <sphereGeometry args={[0.03, 10, 8]} /><primitive object={FESTOON_GLOBE} attach="material" />
        </instancedMesh>
      </group>
    </group>
  )
}

/** a big signboard (看板) on the wall: a cream board with the word brushed down it in great black strokes, a red seal at its foot */
const KANBAN_LOOKS = [
  { text: '炭火燒烤', seal: '聞野', bg: '#ecd9a6', ink: '#1a0d06', frame: '#3a2416' },
  { text: '日式烤魚', seal: '聞野', bg: '#1c1a18', ink: '#e8c45a', frame: '#6a4a2a' },
  { text: '大漁', seal: '漁', bg: '#b8261c', ink: '#fbf3e2', frame: '#3a2416' },
  { text: '銘酒', seal: '酒', bg: '#f4efe2', ink: '#1f3a68', frame: '#3a2416' },
  { text: '深夜食堂', seal: '聞野', bg: '#1f3a68', ink: '#fbf3e2', frame: '#2a1a10' },
]
const kanbanCache = new Map<number, THREE.Texture | null>()
const kanbanTex = (i: number) => {
  if (!kanbanCache.has(i)) {
    const look = KANBAN_LOOKS[i]
    kanbanCache.set(i, signTexture(128, 320, (g) => {
      g.fillStyle = look.bg
      g.fillRect(0, 0, 128, 320)
      g.strokeStyle = 'rgba(120,80,30,0.16)'
      for (let y = 0; y < 320; y += 4) {
        g.beginPath()
        g.moveTo(0, y + Math.sin(y * 0.3) * 1.5)
        g.lineTo(128, y)
        g.stroke()
      }
      g.strokeStyle = look.frame
      g.lineWidth = 5
      g.strokeRect(5, 5, 118, 310)
      const chars = [...look.text]
      const size = chars.length > 2 ? 62 : 78
      const gap = Math.min(size * 1.05, 230 / chars.length)
      chars.forEach((ch, k) => brushText(g, ch, 64, 28 + size * 0.5 + k * gap, size, { fill: look.ink, shadow: 'rgba(0,0,0,0.25)' }))
      g.fillStyle = look.bg === '#b8261c' ? '#fbf3e2' : '#b8261c'
      g.fillRect(40, 262, 48, 40)
      brushText(g, look.seal, 64, 283, look.seal.length > 1 ? 18 : 26, { fill: look.bg === '#b8261c' ? '#b8261c' : '#fbf3e2' })
    }))
  }
  return kanbanCache.get(i) ?? null
}
function Kanban({ i }: { i: number }) {
  const W = 0.34, H = 0.82
  return (
    <group>
      <mesh position-x={-0.012}><boxGeometry args={[0.024, H + 0.05, W + 0.05]} /><meshToonMaterial color="#2e1d12" /></mesh>
      <mesh position-x={-0.026} rotation-y={-Math.PI / 2}><planeGeometry args={[W, H]} /><meshToonMaterial color="#ffffff" map={kanbanTex(i)} /></mesh>
    </group>
  )
}

/** a print behind glass in a thin dark frame */
function Framed({ art }: { art: ArtKey }) {
  const W = 0.5, H = 0.36, M = 0.045, F = 0.032
  const OW = W + 2 * M, OH = H + 2 * M
  return (
    <group>
      {/* (the backing board) */}
      <mesh position-x={-0.008}>
        <boxGeometry args={[0.012, OH + 2 * F, OW + 2 * F]} />
        <meshToonMaterial color="#24160d" />
      </mesh>
      {/* (the frame's four sides: a dark moulding with a lighter bead along its inner edge) */}
      {([[0, OH / 2 + F / 2, OW + 2 * F, F], [0, -OH / 2 - F / 2, OW + 2 * F, F], [OW / 2 + F / 2, 0, F, OH], [-OW / 2 - F / 2, 0, F, OH]] as const).map(([z, y, w, h], i) => (
        <group key={i}>
          <mesh position={[-0.026, y, z]}>
            <boxGeometry args={[0.024, h, w]} />
            <meshToonMaterial color="#3a2416" />
          </mesh>
          <mesh position={[-0.039, y, z]} scale={[1, h > w ? 1 : 0.3, h > w ? 0.3 : 1]}>
            <boxGeometry args={[0.004, h, w]} />
            <meshToonMaterial color="#7a5434" />
          </mesh>
        </group>
      ))}
      {/* (the cream mat round the print, and the gold lip at its edge) */}
      <mesh position-x={-0.0155} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[OW, OH]} />
        <meshToonMaterial color="#efe5cf" />
      </mesh>
      <mesh position-x={-0.0165} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W + 0.012, H + 0.012]} />
        <meshToonMaterial color="#c9a24a" />
      </mesh>
      <mesh position-x={-0.0172} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
    </group>
  )
}

/**
 * The round window's paper, as the light outside falls on it: by day the sky's cool blue through it, the bamboo's shadows sharp on it; by
 * night dark blue, a street lantern's warm glow off to one side and the moon's paler one high up, the bamboo only darker against it.
 * Drawn again (the one canvas) whenever the room turns from day to night (data-theme on the page).
 */
function drawRoundPaper(g: CanvasRenderingContext2D, night: boolean) {
  g.clearRect(0, 0, 512, 512)
  if (night) {
    const gr = g.createRadialGradient(256, 256, 30, 256, 256, 300)
    gr.addColorStop(0, '#3a4766'); gr.addColorStop(0.7, '#262f4a'); gr.addColorStop(1, '#151a2c')
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512)
    // (a lantern's warm glow low on the right, the moon's high on the left)
    for (const [x, y, r, c] of [[380, 360, 210, 'rgba(255,170,80,0.55)'], [150, 120, 120, 'rgba(220,230,255,0.35)']] as [number, number, number, string][]) {
      const l = g.createRadialGradient(x, y, 0, x, y, r)
      l.addColorStop(0, c); l.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = l; g.fillRect(0, 0, 512, 512)
    }
  } else {
    // (the sky's cool light through the paper, a linear gradient (the owner's): pale at the top, a deeper blue toward the foot)
    const gr = g.createLinearGradient(0, 0, 0, 512)
    gr.addColorStop(0, '#eef7ff'); gr.addColorStop(0.45, '#cfe5fb'); gr.addColorStop(1, '#94bde9')
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512)
  }
  // (the fibres of the washi)
  g.strokeStyle = night ? 'rgba(200,210,240,0.08)' : 'rgba(110,140,190,0.13)'; g.lineWidth = 1
  for (let k = 0; k < 160; k++) { const x = (k * 97) % 512, y = (k * 233) % 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + (k % 5) - 2); g.stroke() }
  // (and its longer fibres and the odd thicker one, as handmade paper has; by night the moon throws the shadows of the bamboo outside on it,
  // by day none)
  g.strokeStyle = night ? 'rgba(220,228,250,0.06)' : 'rgba(255,255,255,0.5)'
  for (let k = 0; k < 60; k++) {
    const x = (k * 151) % 512, y = (k * 89) % 512, a = (k * 0.71) % Math.PI
    g.lineWidth = k % 9 ? 0.8 : 1.6
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 18 + 6, y + Math.sin(a) * 18 - 4, x + Math.cos(a) * 34, y + Math.sin(a) * 34); g.stroke()
  }
  if (night) bambooShadows(g)
}
/**
 * The moon's shadows of bamboo outside on the round window's paper (512 x 512): two culms far off, thin and soft, two nearer, fuller and
 * sharper, each tapering, its nodes ridged, and from some nodes a slender branch with a spray of narrow pointed leaves drooping from its end;
 * and a few sprays hanging in from above
 */
function bambooShadows(g: CanvasRenderingContext2D) {
  const rnd = seeded(5)
  const leaf = (len: number, wid: number) => {
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, len * 0.34, 0, len); g.quadraticCurveTo(-wid * 0.8, len * 0.34, 0, 0); g.fill()
  }
  const spray = (n: number, side: number, size: number) => {
    for (let k = 0; k < n; k++) {
      g.save()
      g.rotate(side * (0.35 + k * 0.32) + (rnd() - 0.5) * 0.25)
      leaf(size * (0.75 + rnd() * 0.45), size * 0.13)
      g.restore()
    }
  }
  const culm = (x: number, w: number, lean: number, blur: number, alpha: number) => {
    g.save()
    g.filter = `blur(${blur}px)`
    g.fillStyle = `rgba(6,10,24,${alpha})`
    g.strokeStyle = `rgba(6,10,24,${alpha})`
    g.translate(x, 540)
    g.rotate(lean)
    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w * 0.4, -620); g.lineTo(w * 0.4, -620); g.lineTo(w / 2, 0); g.fill()
    for (let y = 30 + rnd() * 40; y < 600; y += 74 + rnd() * 26) {
      // (a node: the culm's ridge across it, a little proud each side)
      g.fillRect(-w * 0.62, -y - 1.6, w * 1.24, 3.4)
      if (rnd() < 0.6) {
        const side = rnd() < 0.5 ? -1 : 1, bl = 30 + rnd() * 46
        g.save()
        g.translate(side * w * 0.4, -y)
        g.rotate(side * (0.75 + rnd() * 0.35))
        g.lineWidth = Math.max(1, w * 0.12)
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * 4, -bl * 0.5, 0, -bl); g.stroke()
        g.translate(0, -bl)
        // (the leaves droop from the branch's end, fanned to the outside)
        g.rotate(Math.PI - side * 0.5)
        spray(3 + Math.floor(rnd() * 4), side, 30 + w * 1.2)
        g.restore()
      }
    }
    g.restore()
  }
  culm(146, 11, 0.05, 2.4, 0.26)
  culm(214, 8, -0.035, 2.6, 0.22)
  culm(366, 17, 0.03, 0.9, 0.46)
  culm(434, 12, -0.06, 1.1, 0.4)
  // (sprays hanging in from above, out of the frame)
  g.save()
  g.filter = 'blur(1.4px)'
  g.fillStyle = 'rgba(6,10,24,0.34)'
  for (const [x, y, side] of [[290, -8, 1], [120, 4, -1], [470, 20, -1]] as [number, number, number][]) {
    g.save(); g.translate(x, y); g.rotate(Math.PI * 0.08 * side); spray(5, side, 46); g.restore()
  }
  g.restore()
  g.filter = 'none'
}
const ROUND_PAPER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const draw = () => { drawRoundPaper(g, document.documentElement.dataset.theme === 'dark'); t.needsUpdate = true }
  draw()
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return t
})()
/**
 * A round window (丸窓) let into the plaster: a reveal of wood round it, a frame of keyaki turned to a moulded profile, four bent segments
 * with the grain running round, and inside, a lattice of sugi over washi lit from outside (day or night: ROUND_PAPER; blender/roundwindow.py
 * for the woodwork); hung low, its frame just clear of the rail over the wainscot
 */
const ROUND_URL = import.meta.env.BASE_URL + 'models/roundwindow.glb'
/** the window's woodwork, in the room's toon light, its frame inked round, drawn a few parts at a time (it never moves) */
function RoundWood() {
  const gltf = useGLTF(ROUND_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
    })
    // (the lattice the shoji's own now: its two halves slide apart, RoundShoji)
    const lattice: THREE.Object3D[] = []
    r.traverse((o) => { if (/^RoundLattice/.test(o.name)) lattice.push(o) })
    for (const o of lattice) o.parent?.remove(o)
    inkModel(r, (m) => !/RoundFrame/.test(m.name), { width: 0.0025, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(ROUND_URL)
/** the round window's radius (its paper's) */
const ROUND_R = 0.4
/** what's outside the round window, seen with its shoji slid open: by day bamboo against the sky (a linear gradient, pale above, the blue
 * deepening toward the horizon), a low fence of split bamboo; by night the same under the moon, dark */
function drawOutside(g: CanvasRenderingContext2D, night: boolean) {
  const sky = g.createLinearGradient(0, 0, 0, 512)
  if (night) { sky.addColorStop(0, '#0d1428'); sky.addColorStop(1, '#25335a') } else { sky.addColorStop(0, '#6fa8e6'); sky.addColorStop(1, '#d6ecff') }
  g.fillStyle = sky; g.fillRect(0, 0, 512, 512)
  if (night) {
    const m = g.createRadialGradient(150, 120, 0, 150, 120, 90)
    m.addColorStop(0, 'rgba(255,250,225,1)'); m.addColorStop(0.25, 'rgba(255,250,225,0.95)'); m.addColorStop(0.3, 'rgba(200,210,255,0.25)'); m.addColorStop(1, 'rgba(200,210,255,0)')
    g.fillStyle = m; g.fillRect(0, 0, 512, 512)
  }
  // (bamboo: culms near and far, their nodes, a few leaves)
  const rnd = seeded(9)
  for (const [x, w, far] of [[70, 16, 1], [190, 11, 1], [330, 18, 0], [440, 13, 1], [260, 9, 1]] as [number, number, number][]) {
    g.fillStyle = night ? (far ? '#1a2a24' : '#13201b') : far ? '#7fa65a' : '#5e8a3e'
    g.fillRect(x - w / 2, 0, w, 512)
    g.fillStyle = night ? '#0c1612' : '#3f6a2a'
    for (let y = 30 + rnd() * 40; y < 512; y += 70 + rnd() * 30) g.fillRect(x - w / 2 - 1, y, w + 2, 3)
    g.fillStyle = night ? 'rgba(20,40,30,0.9)' : 'rgba(80,140,60,0.9)'
    for (let k = 0; k < 6; k++) {
      const ly = rnd() * 400, side = rnd() < 0.5 ? -1 : 1
      g.save(); g.translate(x + side * w * 0.5, ly); g.rotate(side * (0.6 + rnd() * 0.5))
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * 10, 18, 0, 52); g.quadraticCurveTo(-side * 4, 18, 0, 0); g.fill()
      g.restore()
    }
  }
  // (a low fence of split bamboo across the foot)
  g.fillStyle = night ? '#2a2618' : '#c9b277'
  g.fillRect(0, 420, 512, 92)
  g.strokeStyle = night ? '#16130c' : '#8a7442'; g.lineWidth = 3
  for (let x = 0; x < 512; x += 14) { g.beginPath(); g.moveTo(x, 420); g.lineTo(x, 512); g.stroke() }
  g.fillStyle = night ? '#100e08' : '#6a5630'
  g.fillRect(0, 440, 512, 6); g.fillRect(0, 486, 512, 6)
}
const ROUND_OUTSIDE = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const draw = () => { drawOutside(g, document.documentElement.dataset.theme === 'dark'); t.needsUpdate = true }
  draw()
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return t
})()
/** a passer-by's shadow on the paper by day: a figure, soft-edged, walking (a bag on one shoulder) */
const PASSER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 128; c.height = 256
  const g = c.getContext('2d')!
  g.filter = 'blur(5px)'
  g.fillStyle = 'rgba(30,45,70,0.55)'
  g.beginPath(); g.arc(64, 52, 22, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.moveTo(34, 86); g.quadraticCurveTo(64, 70, 94, 86); g.lineTo(100, 190); g.lineTo(28, 190); g.closePath(); g.fill()
  g.fillRect(40, 186, 18, 70); g.fillRect(70, 186, 18, 70)
  g.beginPath(); g.ellipse(100, 140, 16, 24, 0.2, 0, Math.PI * 2); g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/**
 * The round window's shoji (the owner's: it opens left and right): two halves, each a half of the paper with its own lattice (bars over the
 * washi), sliding apart into the wall when clicked and back together, cut to the window's round (whatever slides past its edge is in the wall,
 * unseen); behind them the view outside (ROUND_OUTSIDE). By day, now and then, a passer-by's shadow crosses the paper outside (the owner's).
 * Not batched: it moves, and it's clicked.
 */
function RoundShoji() {
  const R = ROUND_R
  const win = useRef<THREE.Group>(null)
  const halves = useRef<(THREE.Group | null)[]>([])
  const passer = useRef<THREE.Mesh>(null)
  const st = useRef({ open: false, k: 0, next: 12 + Math.random() * 20, walk: -1, dir: 1 })
  /** the window's frame, inverted, for cutting what's drawn to its round */
  const inv = useMemo(() => ({ value: new THREE.Matrix4() }), [])
  const round = useMemo(() => {
    const cut = <T extends THREE.Material>(m: T) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWinInv = inv
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uWinInv;\nvarying vec3 vWin;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvWin = (uWinInv * modelMatrix * vec4(transformed, 1.0)).xyz;')
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWin;')
          .replace('void main() {', `void main() {\n  if (vWin.y * vWin.y + vWin.z * vWin.z > ${(R * R).toFixed(5)}) discard;`)
      }
      m.customProgramCacheKey = () => 'round-cut'
      return m
    }
    return {
      paper: cut(new THREE.MeshBasicMaterial({ map: ROUND_PAPER, toneMapped: false })),
      wood: cut(new THREE.MeshToonMaterial({ color: '#b98656' })),
      passer: cut(new THREE.MeshBasicMaterial({ map: PASSER, transparent: true, depthWrite: false, toneMapped: false })),
    }
  }, [inv, R])
  useEffect(() => () => { round.paper.dispose(); round.wood.dispose(); round.passer.dispose() }, [round])
  // (each half's lattice, one mesh: its outer upright, the three bars across from the middle out to the round, an upright at its inner edge)
  const bars = useMemo(() => [-1, 1].map((sd) => {
    const out: THREE.BufferGeometry[] = []
    const bar = (p: [number, number, number], sz: [number, number, number]) => { const g = new THREE.BoxGeometry(...sz); g.translate(...p); out.push(g) }
    bar([-0.012, 0, sd * 0.2], [0.018, 2 * Math.sqrt(R * R - 0.04), 0.016])
    bar([-0.012, 0, sd * 0.008], [0.018, 2 * R, 0.016])
    for (const y of [-0.2, 0, 0.2]) {
      const half = Math.sqrt(R * R - y * y)
      bar([-0.012, y, sd * half / 2], [0.018, 0.016, half])
    }
    const g = mergeGeometries(out)!
    out.forEach((q) => q.dispose())
    return g
  }), [R])
  useEffect(() => () => { bars.forEach((g) => g.dispose()) }, [bars])
  useFrame((_, dt) => {
    const w = win.current
    const s = st.current
    if (!w) return
    inv.value.copy(w.matrixWorld).invert()
    const want = s.open ? 1 : 0
    s.k += Math.sign(want - s.k) * Math.min(Math.abs(want - s.k), Math.min(dt, 0.1) * 1.6)
    const e = s.k * s.k * (3 - 2 * s.k)
    halves.current.forEach((h, i) => { if (h) h.position.z = (i ? 1 : -1) * e * (R + 0.02) })
    // (a passer-by now and then, by day, while the paper's shut)
    const night = document.documentElement.dataset.theme === 'dark'
    const m = passer.current
    if (m) {
      if (s.walk < 0) {
        s.next -= Math.min(dt, 0.1)
        if (s.next <= 0 && !night && s.k < 0.05) { s.walk = 0; s.dir = Math.random() < 0.5 ? -1 : 1 }
      } else {
        s.walk += Math.min(dt, 0.1) / 5.5
        if (s.walk >= 1 || s.k > 0.05) { s.walk = -1; s.next = 20 + Math.random() * 25 }
      }
      if (s.walk >= 0) {
        m.position.z = s.dir * (-R - 0.2 + s.walk * (2 * R + 0.4))
        m.position.y = -0.02 + Math.abs(Math.sin(s.walk * Math.PI * 9)) * 0.012
      } else m.position.z = 2 * R
    }
  })
  const says = () => (st.current.open ? '點一下關上' : '點一下打開（左右拉開）')
  return (
    <group ref={win}>
      {/* (outside, behind it all) */}
      <mesh position-x={-0.001} rotation-y={-Math.PI / 2}>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial map={ROUND_OUTSIDE} toneMapped={false} />
      </mesh>
      <group onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; st.current.open = !st.current.open; setTip({ title: '圓窗', hint: says() }) }}
        onPointerOver={(ev) => { if (getEdit().on) return; tipOver('圓窗', says()).onPointerOver(ev) }}
        onPointerOut={(ev) => { tipOver('圓窗', '').onPointerOut(ev) }}>
        {[0, 1].map((i) => (
          <group key={i} ref={(o) => { halves.current[i] = o }}>
            <mesh position-x={-0.004} rotation-y={-Math.PI / 2} material={round.paper}>
              <circleGeometry args={[R, 48, i ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
            </mesh>
            <mesh geometry={bars[i]} material={round.wood} />
          </group>
        ))}
      </group>
      {/* (a passer-by's shadow outside, on the paper) */}
      <mesh ref={passer} name="round-passer" position={[-0.0045, 0, 2 * R]} rotation-y={-Math.PI / 2} material={round.passer} renderOrder={3}>
        <planeGeometry args={[0.28, 0.56]} />
      </mesh>
    </group>
  )
}
/** where along the back wall the second round window goes (the wall's own frame) */
const ROUND_AT = -1.36
/** the daylight that comes in through it (by day only, gone at night): a cool glow round it on the plaster, and a faint shaft of it slanting
 * down into the room, soft at its edges and fading as it goes */
const DAYLIGHT = (() => {
  if (typeof document === 'undefined') return { halo: null, beam: null }
  const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
  const halo = document.createElement('canvas')
  halo.width = halo.height = 128
  const h = halo.getContext('2d')!
  // (a ring: clear over the window itself, so its paper keeps its own blue, brightest just outside the frame, fading out over the plaster)
  const gr = h.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(0.56, 'rgba(255,255,255,0.85)')
  gr.addColorStop(0.72, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  h.fillStyle = gr; h.fillRect(0, 0, 128, 128)
  // (the shaft: across it soft at both edges, along it brightest at the window (the picture's top) and gone by its far end)
  const beam = document.createElement('canvas')
  beam.width = 64; beam.height = 256
  const b = beam.getContext('2d')!
  for (let y = 0; y < 256; y++) {
    // (fading in over its first stretch from the window too: the sheets' start at the frame showed as a hard edge)
    const t = y / 255, k = Math.pow(1 - t, 1.7) * Math.min(1, t / 0.2) ** 1.5
    const row = b.createLinearGradient(0, 0, 64, 0)
    row.addColorStop(0, 'rgba(255,255,255,0)'); row.addColorStop(0.5, `rgba(255,255,255,${k})`); row.addColorStop(1, 'rgba(255,255,255,0)')
    b.fillStyle = row; b.fillRect(0, y, 64, 1)
  }
  return { halo: tex(halo), beam: tex(beam) }
})()
// (only by night: the moon's faint blue glow round the window and its shaft slanting in, dust drifting in it (WindowDust); by day none)
const WINDOW_HALO = nightGlow(new THREE.MeshBasicMaterial({ map: DAYLIGHT.halo, color: '#8fc4ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  toneMapped: false }), 0, 0.22, false)
const SUNBEAM = nightGlow(new THREE.MeshBasicMaterial({ map: DAYLIGHT.beam, color: '#78b2ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  toneMapped: false, side: THREE.DoubleSide }), 0, 0.15, false)
/** the dust in the moon's shaft by night: specks drifting slowly down it and about, catching its light (in the window's frame, as the shaft) */
const DUST_N = 46
function WindowDust() {
  const pts = useRef<THREE.Points>(null)
  const { geo, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DUST_N * 3), 3))
    return { geo: g, seeds: Array.from({ length: DUST_N }, () => [Math.random(), Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 6.28, 0.6 + Math.random() * 0.8]) }
  }, [])
  const mat = useMemo(() => new THREE.PointsMaterial({ color: '#cfe4ff', size: 0.018, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false }), [])
  useFrame(({ clock }) => {
    const o = pts.current
    if (!o) return
    o.visible = isNight()
    if (!o.visible) return
    const t = clock.elapsedTime, a = geo.attributes.position as THREE.BufferAttribute
    const tilt = 0.62, R = 0.4
    for (let i = 0; i < DUST_N; i++) {
      const [u0, sx, sz, ph, sp] = seeds[i]
      // (along the shaft, slowly on down it and round again; across it, a lazy wander)
      const u = (u0 + t * 0.012 * sp) % 1, L = 0.2 + u * 1.9
      const w = R * (0.7 + u * 0.4)
      const x = -0.07 - Math.cos(tilt) * L + Math.sin(tilt) * sx * w * 0.6 + Math.sin(t * 0.3 * sp + ph) * 0.03
      const y = -Math.sin(tilt) * L - Math.cos(tilt) * sx * w * 0.6 + Math.cos(t * 0.23 * sp + ph) * 0.03
      a.setXYZ(i, x, y, sz * w * 0.8 + Math.sin(t * 0.17 + ph) * 0.04)
    }
    a.needsUpdate = true
    // (each speck fading in and out of the light: the whole lot's opacity breathing a little)
    mat.opacity = 0.42 + Math.sin(t * 0.5) * 0.08
  })
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />
}
/** the shaft's two crossed sheets, in the window's frame (the room toward -x): from the window's face, slanting down and in */
const SUNBEAM_GEO = (() => {
  const R = 0.4, L = 2.3, tilt = 0.62
  const d = new THREE.Vector3(-Math.cos(tilt), -Math.sin(tilt), 0)
  const up = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0)
  const at = new THREE.Vector3(-0.07, 0, 0)
  const sheet = (side: THREE.Vector3, w0: number, w1: number) => {
    const far = at.clone().addScaledVector(d, L)
    const v = [at.clone().addScaledVector(side, -w0), at.clone().addScaledVector(side, w0), far.clone().addScaledVector(side, w1), far.clone().addScaledVector(side, -w1)]
    return { pos: v.flatMap((p) => [p.x, p.y, p.z]), uv: [0, 1, 1, 1, 1, 0, 0, 0] }
  }
  const a = sheet(new THREE.Vector3(0, 0, 1), R * 0.8, R * 1.15), b = sheet(up, R * 0.7, R * 1.0)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.pos, ...b.pos], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([...a.uv, ...b.uv], 2))
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
  return g
})()
function RoundWindow() {
  const R = 0.4
  return (
    <group name="RoundWindow">
      {/* (what the window view (data/views) looks at: its middle, its +z turned to face into the room) */}
      <group name="look-window" rotation-y={-Math.PI / 2} />
      {/* (by day: the sky's light glowing round it on the plaster, and slanting in) */}
      <mesh position-x={-0.075} rotation-y={-Math.PI / 2} material={WINDOW_HALO} renderOrder={2}><planeGeometry args={[R * 4.2, R * 4.2]} /></mesh>
      <mesh geometry={SUNBEAM_GEO} material={SUNBEAM} renderOrder={2} />
      {/* (the paper is the shoji's: RoundShoji, outside the batch, as it slides open) */}
      {/* (the reveal, the frame and its bead) */}
      <Suspense fallback={null}><RoundWood /></Suspense>
    </group>
  )
}

/** a hanging scroll: the painting on paper mounted in brocade, its cord over a nail, a weighted rod at the foot */
function Scroll({ art }: { art: ArtKey }) {
  const W = 0.26, H = 0.62
  return (
    <group>
      {/* (the dark silk above and below the picture, the whole length) */}
      <mesh position-x={-0.005} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W + 0.08, H + 0.3]} />
        <meshToonMaterial color="#ffffff" map={SCROLL_SILK} />
      </mesh>
      {/* (the brocade band round the picture) */}
      <mesh position-x={-0.006} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W + 0.05, H + 0.1]} />
        <meshToonMaterial color="#ffffff" map={SCROLL_BROCADE} />
      </mesh>
      {/* (the gold strips over and under the picture) */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[-0.007, s * (H / 2 + 0.012), 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W, 0.022]} />
          <meshToonMaterial color="#c9a24a" />
        </mesh>
      ))}
      <mesh position-x={-0.008} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
      {/* (the roller's knob ends, pale, lacquered) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.014, -H / 2 - 0.14, s * (W / 2 + 0.07)]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.015, 0.013, 0.03, 10]} />
          <meshToonMaterial color="#e8dcc4" />
        </mesh>
      ))}
      {/* the rod at the foot with its knobs, and the thin one at the top */}
      <mesh position={[-0.014, -H / 2 - 0.14, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.011, 0.011, W + 0.12, 8]} />
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      <mesh position={[-0.01, H / 2 + 0.13, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.007, 0.007, W + 0.07, 6]} />
        <meshToonMaterial color="#2a1a10" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.006, H / 2 + 0.2, s * 0.06]} rotation-x={s * 0.9}>
          <cylinderGeometry args={[0.002, 0.002, 0.16, 4]} />
          <meshBasicMaterial color="#5a2a1a" />
        </mesh>
      ))}
    </group>
  )
}

/** a picture from public/textures, laid to repeat (its tiling set where it's used) */
function fileTex(file: string) {
  if (typeof document === 'undefined') return null
  const t = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'textures/' + file)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}
/** the plaster: a warm earthen wall (聚楽壁) of cream clay, mottled, its fine sand in it, the trowel's long sweeps faint across it, chopped straw
 * here and there (blender/walltex.py: tileable, so no seam where one tile meets the next, as the old drawn one had); a tile every 1.2 */
const PLASTER = fileTex('plaster_wall.jpg')

function Box({ size, color, ...rest }: { size: [number, number, number]; color: string } & Record<string, unknown>) {
  return (
    <mesh {...rest}>
      <boxGeometry args={size} />
      <meshToonMaterial color={color} />
    </mesh>
  )
}
/** the plaque over the toilet door: お手洗い, and 廁所 under it */
/** a toilet's door's height */
const WC_H = 1.85
/** a stretch of the wall (the wall's own frame: z along it, y up), plaster or the dark wainscot, the plaster's
 * pattern laid from the wall's own z so stretches side by side run on into each other */
/** upright boards of warm brown wood for the wall's foot (the wainscot), twelve to a tile 1.44 across and the wainscot's height, each its own
 * tone, most flat-sawn and some quarter-sawn, a knot here and there, a V-groove between (blender/walltex.py) */
const WALL_BOARDS = fileTex('wainscot_boards.jpg')
function WallPiece({ z0, z1, y0, y1, plaster = false }: { z0: number; z1: number; y0: number; y1: number; plaster?: boolean }) {
  const map = useMemo(() => {
    const src = plaster ? PLASTER : WALL_BOARDS
    if (!src) return null
    const t = src.clone()
    if (plaster) {
      t.repeat.set((z1 - z0) / 1.2, (y1 - y0) / 1.2)
      t.offset.set(-z1 / 1.2, y0 / 1.2)
    } else {
      // (boards twelve centimetres across, running up the wainscot's whole height in one)
      t.repeat.set((z1 - z0) / 1.44, (y1 - y0) / WAINSCOT)
      t.offset.set(-z1 / 1.44, y0 / WAINSCOT)
    }
    t.needsUpdate = true
    return t
  }, [z0, z1, y0, y1, plaster])
  return (
    <mesh position={[0, (y0 + y1) / 2, (z0 + z1) / 2]} rotation-y={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[z1 - z0, y1 - y0]} />
      <meshToonMaterial color="#ffffff" map={map} />
    </mesh>
  )
}
/** the plaque over each toilet's door: 男 in indigo with a man's figure, 女 in red with a woman's, and the word under */
const wcSign = (who: 'm' | 'f') => canvasTex(160, 96, (g) => {
  const ink = who === 'm' ? '#24407a' : '#b8262a'
  g.fillStyle = '#3a2416'
  g.fillRect(0, 0, 160, 96)
  g.fillStyle = '#efe2c4'
  g.fillRect(4, 4, 152, 88)
  // the figure: a head, and a body (a woman's in a skirt)
  g.fillStyle = ink
  g.beginPath()
  g.arc(36, 24, 9, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  if (who === 'm') {
    g.rect(26, 36, 20, 26)
    g.rect(28, 62, 6, 22)
    g.rect(38, 62, 6, 22)
  } else {
    g.moveTo(36, 34)
    g.lineTo(52, 66)
    g.lineTo(20, 66)
    g.closePath()
    g.rect(29, 66, 5, 18)
    g.rect(38, 66, 5, 18)
  }
  g.fill()
  brushText(g, who === 'm' ? '男' : '女', 104, 42, 58, { fill: ink, edge: '#f4eadb', shadow: 'rgba(60,30,10,0.35)', shine: '#ffffff' })
  brushText(g, who === 'm' ? '男廁 · MEN' : '女廁 · WOMEN', 104, 80, 14, { fill: '#1d140c', weight: 'normal' })
})
const WC_SIGNS = { m: wcSign('m'), f: wcSign('f') }

/**
 * The way through to the toilet: one sliding door (引き戸) in a dark wooden frame, shut, wood below and shoji paper on
 * a lattice above, a short indigo noren over it, and the plaque.
 */
/** hinoki floorboards, a warm pale wood, the boards running across */
const WC_FLOOR = canvasTex(128, 64, (g) => {
  g.fillStyle = '#c9a572'
  g.fillRect(0, 0, 128, 64)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = ['#d2b07c', '#c4a06c', '#cfac78', '#c9a572'][i]
    g.fillRect(0, i * 16 + 1, 128, 14)
    g.strokeStyle = 'rgba(110,70,30,0.18)'
    for (let k = 0; k < 6; k++) {
      g.beginPath()
      g.moveTo(0, i * 16 + 3 + k * 2.2)
      g.bezierCurveTo(40, i * 16 + 2 + k * 2.2, 90, i * 16 + 5 + k * 2.2, 128, i * 16 + 3 + k * 2.2)
      g.stroke()
    }
  }
}, true)
/** charred cedar boards (焼杉), the dark upright planks of a traditional wall's foot */
const WC_CEDAR = canvasTex(64, 128, (g) => {
  g.fillStyle = '#2a1d15'
  g.fillRect(0, 0, 64, 128)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = ['#33241a', '#2c1f16', '#382818', '#2e2018'][i]
    g.fillRect(i * 16 + 1, 0, 14, 128)
    g.strokeStyle = 'rgba(0,0,0,0.35)'
    for (let k = 0; k < 6; k++) {
      g.beginPath()
      g.moveTo(i * 16 + 3 + k * 2, 0)
      g.bezierCurveTo(i * 16 + 2 + k * 2, 40, i * 16 + 5 + k * 2, 90, i * 16 + 3 + k * 2, 128)
      g.stroke()
    }
  }
}, true)
/** the plaque by the door: お手洗い in black on a pale board */
const WC_PLAQUE = canvasTex(160, 64, (g) => {
  g.fillStyle = '#e6d2a4'
  g.fillRect(0, 0, 160, 64)
  g.strokeStyle = '#3a2416'
  g.lineWidth = 4
  g.strokeRect(3, 3, 154, 58)
  brushText(g, 'お手洗い', 80, 33, 34, { fill: '#1a0d06', spacing: 3 })
})
/** a hand towel (手拭い) of indigo cotton with a wave pattern, white at both ends */
const WC_TENUGUI = canvasTex(48, 96, (g) => {
  g.fillStyle = '#1f3a68'
  g.fillRect(0, 0, 48, 96)
  g.strokeStyle = 'rgba(244,239,226,0.7)'
  g.lineWidth = 1.2
  for (let row = 0; row < 7; row++) for (let col = -1; col < 3; col++) for (const r of [8, 5, 2]) {
    g.beginPath()
    g.arc(col * 16 + (row % 2) * 8, 20 + row * 8, r, Math.PI, 0)
    g.stroke()
  }
  g.fillStyle = '#f4efe2'
  g.fillRect(0, 0, 48, 6)
  g.fillRect(0, 90, 48, 6)
}, false)
const WC_GEO = {
  bowl: new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  foot: new THREE.CylinderGeometry(0.07, 0.09, 0.28, 16),
  seat: new THREE.TorusGeometry(0.1, 0.022, 8, 20),
  tank: new THREE.BoxGeometry(0.12, 0.3, 0.32),
  basin: new THREE.CylinderGeometry(0.09, 0.065, 0.06, 18),
  pot: new THREE.CylinderGeometry(0.03, 0.026, 0.1, 10),
  leaf: new THREE.ConeGeometry(0.02, 0.12, 4),
  lamp: new THREE.SphereGeometry(0.06, 12, 8),
}
/**
 * The little room behind a toilet's door, in the Japanese way: floorboards of pale hinoki, charred-cedar planks to the
 * waist and cream plaster above, dark beams over a ceiling of boards; a white toilet against the back wall with its
 * cistern (a small basin on its top to wash the hands in), a shoji window over it, a slatted duckboard (簀の子) before
 * it and slippers by the door; a stone basin on a wooden shelf by the other wall with a bamboo dipper, a round mirror
 * in a wooden frame and an indigo hand towel on a rod; the paper in a wooden holder; a bamboo vase of camellia on the
 * cistern, the お手洗い plaque, and a paper lamp lit overhead.
 */
/** the room's paper lamp, on its sensor */
function WcLamp({ who, at }: { who: 'm' | 'f'; at: [number, number, number] }) {
  const m = useRef<THREE.MeshBasicMaterial>(null)
  const k = useRef(0.4)
  useFrame(() => {
    const t = TOILETS[who]
    k.current += ((t.inside > 0 || t.passing > 0 || t.open ? 1 : 0.4) - k.current) * 0.08
    m.current?.color.set('#fff1cc').multiplyScalar(k.current)
  })
  return <mesh geometry={WC_GEO.lamp} position={at}><meshBasicMaterial ref={m} color="#fff1cc" toneMapped={false} /></mesh>
}
function WcRoom({ w, h, who }: { w: number; h: number; who: 'm' | 'f' }) {
  const D = 0.9
  const floor = useMemo(() => {
    if (!WC_FLOOR) return null
    const t = WC_FLOOR.clone()
    t.repeat.set(D / 0.4, w / 0.4)
    t.needsUpdate = true
    return t
  }, [w])
  const cedar = useMemo(() => {
    if (!WC_CEDAR) return null
    const t = WC_CEDAR.clone()
    t.repeat.set(w / 0.3, 0.9 / 0.5)
    t.needsUpdate = true
    return t
  }, [w])
  const cedarSide = useMemo(() => {
    if (!WC_CEDAR) return null
    const t = WC_CEDAR.clone()
    t.repeat.set(D / 0.3, 0.9 / 0.5)
    t.needsUpdate = true
    return t
  }, [])
  const accent = who === 'm' ? '#2c3e66' : '#9a2a2a'
  const top = h + 0.3
  const PLASTER = '#ece0c6'
  return (
    <group>
      <StaticBatch>
      <mesh position={[D / 2, 0.004, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[D, w]} />
        <meshToonMaterial color="#ffffff" map={floor} />
      </mesh>
      {/* back wall and the two side walls: charred cedar to the waist with a rail along it, cream plaster over */}
      <group position={[D, 0, 0]}>
        <mesh position-y={0.45} rotation-y={-Math.PI / 2}><planeGeometry args={[w, 0.9]} /><meshToonMaterial color="#ffffff" map={cedar} /></mesh>
        <mesh position-y={0.9 + (top - 0.9) / 2} rotation-y={-Math.PI / 2}><planeGeometry args={[w, top - 0.9]} /><meshToonMaterial color={PLASTER} /></mesh>
        <mesh position={[-0.012, 0.9, 0]}><boxGeometry args={[0.03, 0.035, w]} /><meshToonMaterial color="#6a4428" /></mesh>
        {/* (the shoji window over the toilet: washi in a dark lattice, lit from outside) */}
        <group position={[-0.006, 1.38, 0]} rotation-y={-Math.PI / 2}>
          <mesh position-z={0.0015}><planeGeometry args={[0.46, 0.34]} /><meshBasicMaterial color="#fcebc6" toneMapped={false} /></mesh>
          {[-1, 0, 1].map((k) => <mesh key={`v${k}`} position={[k * 0.115, 0, 0.003]}><planeGeometry args={[0.012, 0.34]} /><meshToonMaterial color="#3a2416" /></mesh>)}
          {[-0.5, 0.5].map((k) => <mesh key={`h${k}`} position={[0, k * 0.11, 0.003]}><planeGeometry args={[0.46, 0.012]} /><meshToonMaterial color="#3a2416" /></mesh>)}
          {[[0, 0.18, 0.5, 0.03], [0, -0.18, 0.5, 0.03], [-0.24, 0, 0.03, 0.4], [0.24, 0, 0.03, 0.4]].map(([x, y, sw, sh]) => (
            <mesh key={`${x}${y}`} position={[x, y, 0.004]}><planeGeometry args={[sw, sh]} /><meshToonMaterial color="#2e1d12" /></mesh>
          ))}
        </group>
      </group>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[D / 2, 0, sd * w / 2]} rotation-y={sd > 0 ? Math.PI : 0}>
          <mesh position-y={0.45}><planeGeometry args={[D, 0.9]} /><meshToonMaterial color="#ffffff" map={cedarSide} /></mesh>
          <mesh position-y={0.9 + (top - 0.9) / 2}><planeGeometry args={[D, top - 0.9]} /><meshToonMaterial color={PLASTER} /></mesh>
          <mesh position={[0, 0.9, 0.012]}><boxGeometry args={[D, 0.035, 0.03]} /><meshToonMaterial color="#6a4428" /></mesh>
        </group>
      ))}
      {/* the ceiling of dark boards, with two beams across it */}
      <mesh position={[D / 2, top, 0]} rotation-x={Math.PI / 2}><planeGeometry args={[D, w]} /><meshToonMaterial color="#3a2416" /></mesh>
      {[0.25, 0.7].map((x) => <mesh key={x} position={[x, top - 0.03, 0]}><boxGeometry args={[0.06, 0.06, w]} /><meshToonMaterial color="#241408" /></mesh>)}
      </StaticBatch>
      <Movable id={`wc-${who}-toilet`} label={`馬桶（${who === 'm' ? '男廁' : '女廁'}）`}>
      {/* the toilet with its washlet, facing the door, its cistern to the back wall (blender/wc.py; Restroom: its lid, flush, scrubbing) */}
      <ToiletLive who={who} at={[D - 0.4, 0, 0]} />
      </Movable>
      {/* (marks on the duckboard as it gets dirty) */}
      <WcMarks who={who} at={[0.105, 0.032, 0]} size={[0.21, 0.46]} />
      <Movable id={`wc-${who}-remote`} label={`免治馬桶遙控器（${who === 'm' ? '男廁' : '女廁'}）`}>
        <group position={[D - 0.36, 0.86, w / 2]} rotation-y={Math.PI}><WcRemote who={who} /></group>
      </Movable>
      <Movable id={`wc-${who}-oto`} label={`音姬（${who === 'm' ? '男廁' : '女廁'}）`}>
        <group position={[D, 1.0, w / 2 - 0.12]} rotation-y={-Math.PI / 2}><WcOtohime who={who} /></group>
      </Movable>
      <Movable id={`wc-${who}-brush`} label={`馬桶刷（${who === 'm' ? '男廁' : '女廁'}）`}>
        <WcBrush who={who} at={[D - 0.08, 0, -w / 2 + 0.08]} bowl={[D - 0.43, 0.31, 0]} />
      </Movable>
      {who === 'f' && (
        <Movable id="wc-f-bin" label="生理用品垃圾桶（女廁）">
          <group position={[D - 0.1, 0, w / 2 - 0.1]} rotation-y={Math.PI}><WcBin /></group>
        </Movable>
      )}
      <Movable id={`wc-${who}-vase`} label={`竹花瓶（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* (on the hand-wash counter, beside the bowl) */}
      <group position={[D * 0.45 - 0.26, 0.06, -w / 2 + 0.01]}>
        {/* (a bamboo vase of camellia beside it) */}
        <group position={[0.13, 0.7, 0.09]}>
          <mesh geometry={WC_GEO.pot} position-y={0.05}><meshToonMaterial color="#b8a060" /></mesh>
          {[0.02, 0.05, 0.08].map((y) => <mesh key={y} position-y={y}><torusGeometry args={[0.03, 0.002, 4, 10]} /><meshToonMaterial color="#8a7a3a" /></mesh>)}
          <mesh position={[0.01, 0.17, 0.005]} rotation-z={0.15}><cylinderGeometry args={[0.0022, 0.0022, 0.14, 5]} /><meshToonMaterial color="#3a2a1a" /></mesh>
          <mesh position={[0.02, 0.24, 0.005]}><sphereGeometry args={[0.024, 8, 6]} /><meshToonMaterial color="#d8445a" /></mesh>
          {[0, 1.6, 3.2, 4.7].map((a) => (
            <mesh key={a} geometry={WC_GEO.leaf} position={[Math.cos(a) * 0.02, 0.15, Math.sin(a) * 0.02]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}>
              <meshToonMaterial color="#3f7a3a" />
            </mesh>
          ))}
        </group>
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-duck`} label={`簀之子踏板（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* the slatted duckboard (簀の子) before the toilet, and the slippers by the door */}
      {/* (from the door to the toilet's front, stopping short of it: the toilet stands on the floor) */}
      <group position={[0.105, 0, 0]}>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[0, 0.02, (k - 4) * 0.052]}><boxGeometry args={[0.2, 0.02, 0.04]} /><meshToonMaterial color="#d8c08a" /></mesh>
        ))}
        {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.008, sd * 0.2]}><boxGeometry args={[0.2, 0.016, 0.03]} /><meshToonMaterial color="#6a4a28" /></mesh>)}
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-slippers`} label={`室內拖鞋（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* (a pair of toilet slippers: rounded soles, a cloth band over the toes, the toilet's own colour, set side by side toes out) */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[0.15, 0.03, sd * 0.055]} rotation-y={sd * 0.06}>
          <mesh position-y={0.008} scale={[0.13, 0.016, 0.046]}><cylinderGeometry args={[1, 1, 1, 18]} /><meshToonMaterial color="#e8dcc4" /></mesh>
          <mesh position-y={0.017} scale={[0.125, 0.004, 0.042]}><cylinderGeometry args={[1, 1, 1, 18]} /><meshToonMaterial color={accent} /></mesh>
          <mesh position={[-0.055, 0.024, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 0.8]}><torusGeometry args={[0.04, 0.016, 6, 16, Math.PI]} /><meshToonMaterial color={accent} /></mesh>
        </group>
      ))}
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-basin`} label={`石洗手台與鏡子（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* the hand-wash counter against the side wall: a cedar plank on brackets, a stone bowl, a brass tap arching over it, a round
          mirror and a towel ring (blender/wc.py); the indigo hand towel hung beside */}
      <group position={[D * 0.45, 0, -w / 2]} rotation-y={Math.PI / 2}><WashstandModel /></group>
      <mesh position={[D * 0.45 + 0.26, 0.86, -w / 2 + 0.035]}><planeGeometry args={[0.1, 0.2]} /><meshToonMaterial color="#ffffff" map={WC_TENUGUI} side={THREE.DoubleSide} /></mesh>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-paper`} label={`衛生紙架（${who === 'm' ? '男廁' : '女廁'}）`}>
      {/* the paper, on its walnut holder on the other wall (Restroom: thinning with use, a new roll at a click) */}
      <group position={[D - 0.36, 0.6, w / 2]} rotation-y={Math.PI}><WcPaper who={who} /></group>
      </Movable>
      <Movable id={`wc-${who}-plaque`} label={`廁所牌（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      <mesh position={[D * 0.45, 1.5, w / 2 - 0.006]} rotation-y={Math.PI}><planeGeometry args={[0.3, 0.12]} /><meshToonMaterial color="#ffffff" map={WC_PLAQUE} /></mesh>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-lamp`} label={`紙燈（${who === 'm' ? '男廁' : '女廁'}）`}><WcLamp who={who} at={[D / 2, h + 0.1, 0]} /><StaticBatch>
      {/* a paper lamp overhead, in a wooden cage: on a motion sensor, bright while someone's in or the door's open, dim otherwise */}
      <mesh position={[D / 2, h + 0.1, 0]}><torusGeometry args={[0.062, 0.004, 5, 18]} /><meshToonMaterial color="#3a2416" /></mesh>
      </StaticBatch></Movable>
    </group>
  )
}
const WCDOOR_URL = import.meta.env.BASE_URL + 'models/wcdoor.glb'
/** the toilets' doors (blender/wcdoor.py): the sliding panel, a waist-high board shoji in cedar, and the doorway's frame, in the room's toon
 * light; a fresh copy of either at each call (each door slides on its own) */
function useWcDoor() {
  const gltf = useGLTF(WCDOOR_URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    const toon = new Map<THREE.Material, THREE.Material>()
    const conv = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const src = m.material as THREE.MeshStandardMaterial
        let t = toon.get(src)
        // (the paper seen from both sides: from in the toilet too)
        if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, side: src.name === 'WcDoorPaper' ? THREE.DoubleSide : THREE.FrontSide }); toon.set(src, t) }
        m.material = t
      })
      return root
    }
    return { panel: () => conv(gltf.scene.getObjectByName('WcDoorPanel')!.clone(true)), frame: () => conv(gltf.scene.getObjectByName('WcDoorFrame')!.clone(true)) }
  }, [gltf])
}
useGLTF.preload(WCDOOR_URL)
/**
 * A toilet's door itself: one whole sliding panel (blender/wcdoor.py), figured cedar below, washi on close-set kumiko above, the lock's little
 * brass plate and a sunk pull by its free edge. It slides aside into the wall when someone goes in or comes out, or when it's clicked (and
 * back again with another click).
 */
function LockWindow({ who }: { who: 'm' | 'f' }) {
  const m = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(() => {
    const want = TOILETS[who].inside > 0 ? LOCK_TEX.in : LOCK_TEX.free
    if (m.current && m.current.map !== want) { m.current.map = want; m.current.needsUpdate = true }
  })
  return (
    <mesh position={[-0.0135, 0.02, WC_W / 2 - 0.09]} rotation-y={-Math.PI / 2}>
      <planeGeometry args={[0.07, 0.035]} />
      <meshBasicMaterial ref={m} map={LOCK_TEX.free} />
    </mesh>
  )
}
function ToiletPanel({ who }: { who: 'm' | 'f' }) {
  const H = WC_H
  const g = useRef<THREE.Group>(null)
  const door = useWcDoor()
  const panel = useMemo(() => door.panel(), [door])
  const k = useRef(0)
  // (the men's slides off one way, the women's the other, away from each other)
  const away = who === 'm' ? -1 : 1
  useFrame((_, dt) => {
    const d = TOILETS[who]
    const want = d.passing > 0 || d.open ? 1 : 0
    k.current += Math.sign(want - k.current) * Math.min(Math.abs(want - k.current), Math.min(dt, 0.1) * 1.8)
    // (first out of the doorway onto its track in front of the wall, clear of the frame's posts and the plaster, then
    // along it; shutting, the other way about)
    const ss = (a: number, b: number) => { const t = Math.min(1, Math.max(0, (k.current - a) / (b - a))); return t * t * (3 - 2 * t) }
    if (g.current) {
      g.current.position.x = -0.065 * ss(0, 0.25)
      g.current.position.z = away * ss(0.2, 1) * WC_SLIDE
    }
  })
  return (
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; doorClick(who, Math.max(0, 1 - ev.distance / 8)) }}
      {...tipOver('廁所門', '點一下開關（有人時會敲門）')}>
      <group position={[-0.03, H / 2, 0]}>
        <primitive object={panel} position-y={-H / 2} />
        {/* the lock's little window on its brass plate, over the pull: 使用中 in red while someone's in, 空き in blue */}
        <LockWindow who={who} />
      </group>
    </group>
  )
}
const SUPPLIES_URL = import.meta.env.BASE_URL + 'models/supplies.glb'
useGLTF.preload(SUPPLIES_URL)
/** the cartons' print (blender/supplies.py's SupplyCartonPrint): two cells, one for each carton; in each a long side's print (衛生紙, 200抽 ×
 * 5盒, a box of tissues drawn), an end's (衛生紙, this way up), and the plain board of the top along the cell's foot */
const CARTON_PRINT = canvasTex(1024, 512, (g) => {
  const cw = 256, ch = 256
  for (let cell = 0; cell < 2; cell++) {
    const x0 = cell * cw, y0 = 512 - ch
    // (the board: kraft brown, its fluting showing faintly, darker at the edges)
    g.fillStyle = '#c29a66'; g.fillRect(x0, y0, cw, ch)
    g.globalAlpha = 0.1
    g.fillStyle = '#6a4a26'
    for (let k = 0; k < cw; k += 4) g.fillRect(x0 + k, y0, 1, ch)
    g.globalAlpha = 1
    const side = (x: number, w: number, big: boolean) => {
      // (the print, in navy: the word, what's in it, a box of tissues)
      const top = y0, h = ch * 0.7
      g.strokeStyle = '#1e3a6a'; g.lineWidth = 3
      g.strokeRect(x + 8, top + 8, w - 16, h - 16)
      if (big) {
        brushText(g, '衛生紙', x + w * 0.42, top + h * 0.38, 40, { fill: '#1e3a6a', spacing: 2 })
        g.fillStyle = '#1e3a6a'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('200抽 × 5盒', x + w * 0.42, top + h * 0.68)
        // (a box of tissues, a tissue standing up out of it)
        g.fillStyle = '#ffffff'; g.fillRect(x + w * 0.74, top + h * 0.42, w * 0.18, h * 0.22)
        g.strokeRect(x + w * 0.74, top + h * 0.42, w * 0.18, h * 0.22)
        g.beginPath(); g.moveTo(x + w * 0.78, top + h * 0.42); g.quadraticCurveTo(x + w * 0.83, top + h * 0.2, x + w * 0.88, top + h * 0.42); g.fill(); g.stroke()
      } else {
        brushText(g, '衛生紙', x + w / 2, top + h * 0.35, 26, { fill: '#1e3a6a' })
        // (this way up: two arrows)
        g.fillStyle = '#1e3a6a'
        for (const ax of [x + w * 0.38, x + w * 0.62]) {
          g.beginPath(); g.moveTo(ax, top + h * 0.56); g.lineTo(ax - 9, top + h * 0.7); g.lineTo(ax + 9, top + h * 0.7); g.closePath(); g.fill()
          g.fillRect(ax - 3, top + h * 0.7, 6, 14)
        }
      }
    }
    side(x0, cw * 0.5, true)
    side(x0 + cw * 0.5, cw * 0.5, false)
  }
})
/**
 * The supplies in the corner by the drinks fridge (the owner's: tissue cartons and cleaning things, for the toilets and about the shop;
 * blender/supplies.py): the cartons of spare tissue boxes (the stock's), a pack of toilet rolls, a bucket and mop, a broom, sprays and
 * detergent. Pointed at, the cartons say how many spare boxes there are; clicked, the stock opens on its supplies.
 */
function CornerSupplies() {
  const gltf = useGLTF(SUPPLIES_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('CornerSupplies')!.clone(true)
    r.position.set(0, 0, 0)
    const mats = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: src.name === 'SupplyCartonPrint' ? '#ffffff' : src.color.clone(), map: src.name === 'SupplyCartonPrint' ? CARTON_PRINT : null })
        if (src.name === 'SupplyCartonPrint' && CARTON_PRINT) CARTON_PRINT.flipY = false
        mats.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, (m) => /Strand|Core|Bail|Label|Tape/.test(m.name), { width: 0.002, weld: true })
    // (folded together by material: seventy small parts and their ink lines were each a draw of their own)
    mergeByMaterial(r)
    return r
  }, [gltf])
  const says = () => { const n = SUPPLIES.has(TISSUE); return n < 0 ? '衛生紙與清潔用品・點一下看耗材' : `衛生紙備品 ${n} 盒・點一下看耗材` }
  return (
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('衛生紙與清潔用品', says()).onPointerOver(e) }}
      onPointerOut={(e) => { tipOver('衛生紙與清潔用品', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('supplies', 'sack') }}>
      <primitive object={obj} />
    </group>
  )
}
/** the staff's door, its width along the wall (narrower than the toilets') */
const STAFF_W = 0.66
/**
 * Behind the staff's door, painted on the wall inside its frame (the owner's: the stair done as a picture, nothing built behind the wall):
 * a narrow wooden stair going up between plaster walls, its treads closing up as they rise, their nosings catching the light, a handrail
 * up the right, warm light from the landing at the top, 2F on a little plate there
 */
const STAFF_STAIRS = canvasTex(512, 1440, (g) => {
  // (drawn at twice its laid-out size, for its edges up close)
  g.scale(2, 2)
  const W = 256, H = 720, cx = W / 2, top = 70
  g.fillStyle = '#2a1e16'; g.fillRect(0, 0, W, H)
  // (the walls either side, plaster, darker toward the foot)
  for (const sd of [-1, 1]) {
    const gr = g.createLinearGradient(0, 0, 0, H)
    gr.addColorStop(0, '#e6d8bc'); gr.addColorStop(1, '#6a5a46')
    g.fillStyle = gr
    g.beginPath()
    g.moveTo(cx + sd * W * 0.5, H); g.lineTo(cx + sd * W * 0.5, 0); g.lineTo(cx + sd * W * 0.2, top); g.lineTo(cx + sd * W * 0.2, top + 40); g.lineTo(cx + sd * W * 0.36, H)
    g.closePath(); g.fill()
  }
  // (the landing's light at the top)
  const lt = g.createRadialGradient(cx, top + 10, 4, cx, top + 10, 140)
  lt.addColorStop(0, 'rgba(255,214,150,0.95)'); lt.addColorStop(1, 'rgba(255,214,150,0)')
  g.fillStyle = '#f2d9a8'; g.fillRect(cx - W * 0.2, 0, W * 0.4, top + 40)
  g.fillStyle = lt; g.fillRect(0, 0, W, 260)
  // (the treads: closing up as they rise, each a riser in shadow and a tread in light with a bright nosing)
  const n = 16
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n
    const y0 = H - (H - top - 40) * Math.pow(t0, 0.82), y1 = H - (H - top - 40) * Math.pow(t1, 0.82)
    const half = (t: number) => W * (0.36 - 0.16 * Math.pow(t, 0.82))
    const ym = y0 + (y1 - y0) * 0.55
    // (riser)
    g.fillStyle = `rgb(${70 + k * 4},${46 + k * 3},${30 + k * 2})`
    g.beginPath(); g.moveTo(cx - half(t0), y0); g.lineTo(cx + half(t0), y0); g.lineTo(cx + half(t0), ym); g.lineTo(cx - half(t0), ym); g.closePath(); g.fill()
    // (tread)
    g.fillStyle = `rgb(${150 + k * 5},${106 + k * 4},${66 + k * 3})`
    g.beginPath(); g.moveTo(cx - half(t0), ym); g.lineTo(cx + half(t0), ym); g.lineTo(cx + half(t1), y1); g.lineTo(cx - half(t1), y1); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(255,230,180,0.75)'; g.lineWidth = 2
    g.beginPath(); g.moveTo(cx - half(t0), ym); g.lineTo(cx + half(t0), ym); g.stroke()
  }
  // (the handrail up the right wall)
  g.strokeStyle = '#3a2416'; g.lineWidth = 7
  g.beginPath(); g.moveTo(W * 0.9, H * 0.62); g.lineTo(W * 0.66, top + 60); g.stroke()
  g.strokeStyle = 'rgba(255,220,170,0.5)'; g.lineWidth = 2
  g.beginPath(); g.moveTo(W * 0.9, H * 0.62 - 4); g.lineTo(W * 0.66, top + 56); g.stroke()
  // (2F on a plate at the landing)
  g.fillStyle = '#3a2416'; g.fillRect(cx - 18, top - 34, 36, 22)
  g.fillStyle = '#f4e6c8'; g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2F', cx, top - 23)
  // (and the shadow of the doorway's edge over the foot)
  const sh = g.createLinearGradient(0, H * 0.7, 0, H)
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)')
  g.fillStyle = sh; g.fillRect(0, 0, W, H)
})
/** 員工專用 painted on the staff's door, across its board below the waist (the owner's: on the door itself; it was a plaque over it, half
 * behind the banner hung there), STAFF ONLY small under it: cream signwriter's paint on the cedar, worn a little so the grain shows through */
const STAFF_SIGN = canvasTex(512, 256, (g) => {
  brushText(g, '員工專用', 256, 104, 104, { fill: '#f3e7cc', shadow: 'rgba(30,16,8,0.45)', spacing: 10 })
  g.save()
  g.fillStyle = '#efe0c0'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  ;(g as unknown as { letterSpacing: string }).letterSpacing = '9px'
  g.fillText('STAFF ONLY', 260, 196)
  g.restore()
  // (the paint worn: specks and short scuffs along the grain taken out of it; the canvas's state put back after, as it's painted again on
  // the same canvas once the sign font is in, and would rub everything out)
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  g.save()
  g.globalCompositeOperation = 'destination-out'
  for (let k = 0; k < 900; k++) {
    g.globalAlpha = 0.25 + rnd() * 0.55
    g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2.5, 1 + rnd() * 1.2)
  }
  for (let k = 0; k < 70; k++) {
    g.globalAlpha = 0.18 + rnd() * 0.3
    g.fillRect(rnd() * 512, rnd() * 256, 8 + rnd() * 26, 0.8 + rnd() * 0.8)
  }
  g.restore()
})
/**
 * The staff's door (the owner's: in the side wall by the corner, where the koi print hung; a sliding door like the toilets'): the toilets'
 * door narrowed, its dark cedar frame on the plaster, the stair painted on the wall inside it, 員工專用 painted on its board; clicked it
 * slides aside away from the corner and back again (the owner's: it slid toward the corner, behind the bamboo's pot), the panel turned
 * about so its pull is at the edge it's pulled by.
 */
function StaffDoor() {
  const door = useWcDoor()
  const frame = useMemo(() => door.frame(), [door])
  const panel = useMemo(() => door.panel(), [door])
  const g = useRef<THREE.Group>(null)
  const st = useRef({ open: false, k: 0 })
  const narrow = STAFF_W / WC_W
  useFrame((_, dt) => {
    const s = st.current
    const want = s.open ? 1 : 0
    s.k += Math.sign(want - s.k) * Math.min(Math.abs(want - s.k), Math.min(dt, 0.1) * 1.8)
    const ss = (a: number, b: number) => { const t = Math.min(1, Math.max(0, (s.k - a) / (b - a))); return t * t * (3 - 2 * t) }
    if (g.current) {
      g.current.position.x = -0.065 * ss(0, 0.25)
      // (its far edge stopping short of the scroll hung beside it)
      g.current.position.z = ss(0.2, 1) * (STAFF_W - 0.1)
    }
  })
  const says = () => (st.current.open ? '點一下關上（樓上是員工休息室）' : '點一下打開（樓上是員工休息室）')
  return (
    <group name="staff-door">
      <group scale={[1, 1, narrow]}><primitive object={frame} /></group>
      <mesh position={[-0.004, WC_H / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[STAFF_W - 0.05, WC_H - 0.02]} />
        <meshBasicMaterial color="#ffffff" map={STAFF_STAIRS} />
      </mesh>
      <group ref={g} onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; st.current.open = !st.current.open; setTip({ title: '員工專用門', hint: says() }) }}
        onPointerOver={(ev) => { if (getEdit().on) return; tipOver('員工專用門', says()).onPointerOver(ev) }}
        onPointerOut={(ev) => { tipOver('員工專用門', '').onPointerOut(ev) }}>
        <group position={[-0.03, 0, 0]} scale={[1, 1, -narrow]}><primitive object={panel} /></group>
        {/* (on the board's face, a little above its middle, just clear of it) */}
        <mesh position={[-0.0372, 0.6, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.46, 0.23]} />
          <meshToonMaterial color="#ffffff" map={STAFF_SIGN} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </group>
    </group>
  )
}
/**
 * The whole doorway, noren and plaque too, as one easy thing to point at: an unseen plane just in front of it (clicking it works the door, pointing
 * lights up the sliding panel and names it). Not merged, so it can be pointed at.
 */
function ToiletHit({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = WC_H
  return (
      <mesh position={[-0.16, (H + 0.3) / 2, 0]} rotation-y={-Math.PI / 2}
        onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; doorClick(who, Math.max(0, 1 - ev.distance / 8)) }}
        onPointerOver={(ev) => {
          ev.stopPropagation()
          // (the sliding panel lights up, not the plane)
          let top: THREE.Object3D | null = ev.eventObject
          while (top && !top.getObjectByName(`look-wc-${who}`)) top = top.parent
          glowOnly(top?.getObjectByName(`look-wc-${who}`))
          setTip({ title: '廁所門', hint: TOILETS[who].inside > 0 ? '使用中：點一下敲門' : '點一下開關' })
          POINTER_HINT.hand++
          const el = ev.nativeEvent.target as HTMLElement | null
          if (el?.style) el.style.cursor = 'pointer'
        }}
        onPointerOut={(ev) => {
          let top: THREE.Object3D | null = ev.eventObject
          while (top && !top.getObjectByName(`look-wc-${who}`)) top = top.parent
          glowLeave(top?.getObjectByName(`look-wc-${who}`)); setTip(null)
          POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand - 1)
          const el = ev.nativeEvent.target as HTMLElement | null
          if (el?.style && !POINTER_HINT.hand) el.style.cursor = ''
        }}>
        <planeGeometry args={[W + 0.1, H + 0.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
  )
}
function ToiletDoor({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = WC_H
  const door = useWcDoor()
  const frame = useMemo(() => door.frame(), [door])
  return (
    <group>
      {/* the frame round the opening: dark cedar posts, the head over them and the sill (blender/wcdoor.py) */}
      <primitive object={frame} />
      {/* (the sliding panel: ToiletPanel, not merged) and the little room behind it */}
      <WcRoom w={W} h={H} who={who} />
      {/* the short noren, and the plaque over it */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[-0.125, H - 0.2, sd * W / 4.2]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W / 2.2, 0.36]} />
          <meshToonMaterial color={who === 'm' ? '#2c3e66' : '#9a2a2a'} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[-0.075, H + 0.16, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.4, 0.24]} />
        <meshToonMaterial color="#ffffff" map={WC_SIGNS[who]} />
      </mesh>
    </group>
  )
}

/** the two vases' arrangements (blender/shrinevase.py): 0 white and gold chrysanthemums, 1 pink, crimson and violet blooms */
const VASE_URLS = ['shrinevase', 'shrinevase0', 'shrinevase1'].map((v) => import.meta.env.BASE_URL + `models/${v}.glb`)
/** a shrine vase (榊立て, blender/shrinevase.py): white porcelain with a cobalt band of waves, a spray of glossy sakaki and small chrysanthemums */
function Bouquet({ lean = 0, variant = 0 }: { lean?: number; variant?: number }) {
  const gltf = useGLTF(VASE_URLS[variant]) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    const r = gltf.scene.clone(true)
    // (one material for each of the model's: the petals sharing theirs, the bouquet folds into a few draws below)
    const mats = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) {
        t = src.name === 'VasePorcelain'
          ? new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 })
          : src.name === 'VaseLeaf'
            ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide })
            : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, side: THREE.DoubleSide })
        mats.set(src, t)
      }
      m.material = t
      m.castShadow = true
    })
    inkModel(r, (m) => /Leaves|Mum|Stems|Stalk|Bud|Breath|Flower/.test(m.name), { width: 0.0008, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return <group rotation-z={lean}><primitive object={root} /></group>
}
VASE_URLS.forEach((u) => useGLTF.preload(u))
/** a vase whose flowers change at a click: the sakaki with small chrysanthemums, the white and gold, the pink and crimson, each bringing its
 * own blessing while it stands there (game/shrineFlowers); each time set at a slightly different turn and lean, so the two sides never
 * look stamped out alike. `slot`: 0 the left vase, 1 the right */
function BouquetPick({ lean = 0, slot }: { lean?: number; slot: number }) {
  const [v, setV] = useState<Flower>(SHRINE_FLOWERS[slot] ?? 0)
  const turn = useMemo(() => (Math.random() - 0.5) * 1.2, [v])
  const tilt = useMemo(() => (Math.random() - 0.5) * 0.06, [v])
  return (
    // (smaller than they were: the vases stood nearly as tall as the shrine; a sakaki vase comes to about two thirds of it)
    <group rotation-y={turn} scale={0.78} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; const n = nextFlower(v); setShrineFlower(slot, n); setV(n) }}
      {...tipOver(`供花・${FLOWERS[v].name}`, `${FLOWERS[v].buff}｜點一下換一組花`)}>
      <Bouquet lean={lean + tilt} variant={v} />
    </group>
  )
}


/**
 * The household shrine (神棚) up on the wall: a shelf on two brackets, a little shrine of pale hinoki on a stepped base
 * with a railing, its two doors and a roof with the crossed finials (千木) and the short logs (鰹木) along its ridge,
 * a bouquet in a vase either side, the cups of rice, salt and water before it, and the sacred rope (注連縄) with its
 * paper streamers hung across the front.
 */
/** `part`: the shrine itself, the things set about it (vases, cups), or all of it (on the wall) */
const KAMIDANA_URL = import.meta.env.BASE_URL + 'models/kamidana.glb'
/** the shrine's model (and the oranges and the sutra, nodes of their own in it): its wood toon like the room, its gold real metal reflecting the
 * studio, an ink line round the bigger parts; made once, each piece taken out of it to be shown where it stands */
type KamiPart = 'shrine' | 'oranges' | 'sutra' | 'table' | 'flask' | 'cupstand' | 'doors' | 'ebisu'
let kamidanaParts: Record<KamiPart, THREE.Object3D> | null = null
function kamidanaOf(scene: THREE.Group) {
  if (kamidanaParts) return kamidanaParts
  const r = scene.clone(true)
  const mats = new Map<THREE.Material, THREE.Material>()
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = mats.get(src)
    if (!t) {
      if (src.name === 'KamiGold') {
        // (the shrine's fittings: gilt, a paler, softer gold than the ingot's polished casting, its gleam spread wide)
        const g = new THREE.MeshPhysicalMaterial({ color: '#dcb25a', metalness: 1, roughness: 0.34, envMapIntensity: 0.9 })
        reflectStudio(g)
        t = g
      } else if (src.name === 'KamiRuri') {
        // (the cups' stand: porcelain under a deep cobalt glaze run through with emerald and turquoise, glossy, the studio's light sliding over it)
        const g = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: src.map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 0.9 })
        reflectStudio(g)
        g.envMapIntensity = 0.7
        t = g
      } else if (src.name === 'KamiEbisuStone') {
        // (the Ebisu: a light carving wearing the fine one's relief (a normal map baked from it) and its hollows' shadow in the colour; lit, not
        // toon-flat, so the carving shows)
        t = new THREE.MeshStandardMaterial({ map: src.map, normalMap: src.normalMap, roughness: 0.85 })
      } else if (src.name === 'KamiPeel') {
        // (the ponkan's peel: a little gloss on its oily skin, not a polish)
        t = new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, roughness: 0.48, clearcoat: 0.22, clearcoatRoughness: 0.35, specularIntensity: 0.55 })
      } else if (src.name === 'KamiLeaf' || src.name === 'KamiDish' || src.name === 'KamiCobalt' || src.name === 'KamiFlaskGlaze') {
        // (the leaves' gloss, the porcelain's glaze: a soft sheen)
        t = new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.25 })
      } else t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      mats.set(src, t)
    }
    m.material = t
    m.castShadow = true
    m.receiveShadow = true
  })
  inkModel(r, (m) => /Gold|Cap|Plate|Crest|Seam|Bal|Katsuogi|Fold|Char|Slip|Calyx|Stem|Bow|Cord|Tail|Tassel|Fringe|Line|Inlay|Nail|Core|Pillar|Beam|Shide|Label|Knot|Edge|Jamb|Sill|Inside|Fuda|Eye|Smile|Ear|Cheek|Rod/.test(m.name), { width: 0.0012, weld: true })
  const take = (n: string) => { const o = r.getObjectByName(n)!; o.removeFromParent(); o.position.set(0, 0, 0); return o }
  // (the doors' leaves, each hung from its hinge, apart from the rest (they swing open); the Ebisu inside, a piece of its own)
  const doors = new THREE.Group()
  const shrineNode = r.getObjectByName('Kamidana') ?? r
  doors.position.copy(shrineNode.position); doors.quaternion.copy(shrineNode.quaternion); doors.scale.copy(shrineNode.scale)
  for (const leaf of [...shrineNode.children].filter((o) => /DoorLeaf/.test(o.name))) { leaf.removeFromParent(); doors.add(leaf) }
  kamidanaParts = { oranges: take('KamiOranges'), sutra: take('KamiSutra'), table: take('KamiTable'), flask: take('KamiFlask'), cupstand: take('KamiCupStand'),
    ebisu: (() => { const o = r.getObjectByName('KamiEbisu')!; o.removeFromParent(); return o })(), doors, shrine: r }
  // (what's left, the shrine itself, never moves: its hundred parts folded into a mesh per material)
  mergeByMaterial(r)
  return kamidanaParts
}
function KamidanaModel({ part = 'shrine' }: { part?: KamiPart }) {
  const gltf = useGLTF(KAMIDANA_URL) as unknown as { scene: THREE.Group }
  useStudio()
  const obj = useMemo(() => kamidanaOf(gltf.scene)[part], [gltf, part])
  return <primitive object={obj} />
}
useGLTF.preload(KAMIDANA_URL)

/** a soft round shadow under something standing on the table (a contact shadow: dark in the middle, gone at the edge) */
const CONTACT = canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(20,12,6,0.55)'); gr.addColorStop(0.55, 'rgba(20,12,6,0.28)'); gr.addColorStop(1, 'rgba(20,12,6,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
})
export function ContactShadow({ r, y = 0.0008 }: { r: number; y?: number }) {
  return (
    <mesh position-y={y} rotation-x={-Math.PI / 2} renderOrder={1}>
      <planeGeometry args={[r * 2, r * 2]} /><meshBasicMaterial map={CONTACT} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** whether an offering of sake stands just now (Altar sets it): the shrine's doors open of themselves, the Ebisu glows */
const BLESSING = { on: false, k: 0 }
/** a ring of light, feathered both sides, a little brighter and broken with sparkle along its band (the ripple when the sake's offered) */
const RIPPLE = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const img = g.createImageData(256, 256)
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const spark = Array.from({ length: 90 }, () => [rnd() * Math.PI * 2, 0.72 + rnd() * 0.14, 0.4 + rnd() * 0.6])
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = (x - 127.5) / 128, dy = (y - 127.5) / 128, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx)
    let v = Math.exp(-(((r - 0.8) / 0.05) ** 2)) * 0.9 + Math.exp(-(((r - 0.8) / 0.16) ** 2)) * 0.35
    for (const [sa, sr, sb] of spark) {
      const da = Math.abs(((a - sa + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * r, dr = r - sr
      v += sb * Math.exp(-(da * da + dr * dr) / 0.0004)
    }
    const i = (y * 256 + x) * 4
    img.data[i] = 255; img.data[i + 1] = 226; img.data[i + 2] = 160; img.data[i + 3] = Math.min(255, v * 255) * (r < 1 ? 1 : 0)
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/** the burst of sparks at the moment it's poured, and the motes that rise round the shrine while it stands */
const SPARKS = 36, MOTES = 60
/** points with a size and a transparency of their own each (the size and alpha attributes), so a mote can fade without going dark */
const pointsEach = (sh: { vertexShader: string; fragmentShader: string }) => {
  sh.vertexShader = sh.vertexShader.replace('uniform float size;', 'attribute float size;\nattribute float alpha;\nvarying float vAlpha;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAlpha = alpha;')
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;')
    .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.a *= vAlpha;\n#include <premultiplied_alpha_fragment>')
}
/** a glint: a white-hot core, a soft glow, and four thin rays (the motes and the sparks: a twinkle that reads on pale wood as on dark) */
const STAR = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const img = g.createImageData(64, 64)
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = (x - 31.5) / 32, dy = (y - 31.5) / 32, r = Math.hypot(dx, dy)
    const core = Math.exp(-((r / 0.09) ** 2)), glow = Math.exp(-((r / 0.35) ** 2)) * 0.55
    const rays = (Math.exp(-((dx / 0.035) ** 2)) + Math.exp(-((dy / 0.035) ** 2))) * Math.max(0, 1 - r) ** 2 * 0.8
    const v = Math.min(1, core + glow + rays)
    const i = (y * 64 + x) * 4
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = v * 255
  }
  g.putImageData(img, 0, 0)
  return new THREE.CanvasTexture(c)
})()
/** a gentle ease out */
const easeOut = (q: number) => 1 - (1 - q) ** 3
/** the shrine's doors: each pair swings open about its hinges when clicked, and shut again */
/** pointer props that only name a thing when pointed at (no glow, the cursor as it is, nothing to click): the shrine's offerings */
function nameOnly(title: string, hint: string) {
  return {
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title, hint }) },
    onPointerOut: () => setTip(null),
  }
}
/** the shrine drawn wider than it was modelled, across its front (along z): the owner's 1.1 (it was 1.25, too wide for its height) */
const SHRINE_WIDE = 1.1
/** and a little shallower front to back, its back still to the wall (the offerings' shelf in front of it as it was) */
const SHRINE_DEEP = 0.8
function ShrineDoors() {
  const gltf = useGLTF(KAMIDANA_URL) as unknown as { scene: THREE.Group }
  const doors = useMemo(() => {
    const d = kamidanaOf(gltf.scene).doors
    // (widened with the shrine: each leaf's hinge moved out, the leaf itself widened in its own frame, so it still swings true when opened)
    if (!d.userData.wide) {
      d.updateMatrixWorld(true)
      for (const leaf of d.children) {
        // (but the crest and the gold plates on it kept their shape (a round crest, square plates): their meshes narrowed back by as much,
        // the crest about the line where the doors meet, the plates about their own middles)
        const toLeaf = new THREE.Matrix4(), back = new THREE.Matrix4(), box = new THREE.Box3()
        const meshes: THREE.Mesh[] = []
        leaf.traverse((o) => { if ((o as THREE.Mesh).isMesh && /Crest|DoorPlate/.test(o.name + (o.parent?.name ?? ''))) meshes.push(o as THREE.Mesh) })
        for (const m of meshes) {
          toLeaf.copy(leaf.matrixWorld).invert().multiply(m.matrixWorld)
          m.geometry = m.geometry.clone()
          m.geometry.applyMatrix4(toLeaf)
          box.setFromBufferAttribute(m.geometry.getAttribute('position') as THREE.BufferAttribute)
          const crest = /Crest/.test(m.name + (m.parent?.name ?? ''))
          const pivot = crest ? (Math.abs(box.max.z) > Math.abs(box.min.z) ? box.max.z : box.min.z) : (box.min.z + box.max.z) / 2
          m.geometry.applyMatrix4(back.makeTranslation(0, 0, -pivot)).applyMatrix4(back.makeScale(1, 1, 1 / SHRINE_WIDE)).applyMatrix4(back.makeTranslation(0, 0, pivot))
          m.geometry.applyMatrix4(toLeaf.invert())
          m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox()
        }
        leaf.position.z *= SHRINE_WIDE
        leaf.scale.z *= SHRINE_WIDE
      }
      d.userData.wide = true
    }
    return d
  }, [gltf])
  const [open, setOpen] = useState(false)
  const k = useRef(0)
  const wasOpen = useRef(false)
  useFrame((_, dt) => {
    const want = open || BLESSING.on
    // (each time they start to swing, their creak and knock)
    if (want !== wasOpen.current) { wasOpen.current = want; shrineDoor(want) }
    k.current += ((want ? 1 : 0) - k.current) * Math.min(1, dt * 4)
    for (const leaf of doors.children) {
      // (each leaf swings out to the front, the left one one way and the right the other)
      const sd = leaf.name.endsWith('-1') ? -1 : 1
      leaf.rotation.y = sd * k.current * 1.75
    }
  })
  return (
    <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v); setTip({ title: '神棚の扉', hint: open ? '點一下打開' : '點一下關上' }) }}
      {...tipOver('神棚門', open ? '點一下關上' : '點一下打開')}>
      <primitive object={doors} />
    </group>
  )
}

function Kamidana({ part = 'all' }: { part?: 'all' | 'shrine' | 'vase-1' | 'vase1' | 'cups' }) {
  return (
    <group>
      {/* the shrine itself, from blender/kamidana.py: a three-bay shrine in hinoki, its fittings gold */}
      {(part === 'all' || part === 'shrine') && <group position={[-0.14, 0.015, 0]}><KamidanaModel /></group>}
      {/* the bouquets in their vases, leaning in a little, each its own piece */}
      {[-1, 1].filter((sd) => part === 'all' || part === `vase${sd}`).map((sd) => (
        <group key={sd} position={[-0.15, 0.015, sd * 0.3]}><BouquetPick lean={sd * -0.08} slot={sd < 0 ? 0 : 1} /><ContactShadow r={0.05} y={-0.014} /></group>
      ))}
      {/* the cups' stand (blender/kamidana.py), the cups on it */}
      {(part === 'all' || part === 'cups') && <group position={[-0.3, 0, 0]}><KamidanaModel part="cupstand" /><ContactShadow r={0.15} /></group>}
      {(part === 'all' || part === 'cups') && [-0.09, 0, 0.09].map((z) => (
        <group key={z} position={[-0.3, 0.03, z]}>
          {/* (a cup with a wall of its own: a thick rim, a foot ring, a floor, the sake poured in is seen in it) */}
          <mesh geometry={SAKE_CUP} position-y={-0.0125}><meshToonMaterial color="#f4f1ea" /></mesh>
          <mesh geometry={SAKE_CUP} position-y={-0.0125} scale={[1.05, 1.03, 1.05]}><meshBasicMaterial color="#5a4a3a" side={THREE.BackSide} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** the shrine's scale on the shelf (its cups too) */
const KAMI_SC = 1.25
/** the cup's inside: its floor's height, how high it's filled, and its radius at a height (the inner wall of SAKE_CUP's profile, in its own units) */
const CUP_FLOOR = 0.0058, CUP_FULL = 0.0212
const CUP_INNER: [number, number][] = [[0.0056, 0], [0.0062, 0.0066], [0.0125, 0.0088], [0.0225, 0.0102], [0.0246, 0.0106]]
const cupInnerR = (y: number) => {
  for (let i = 0; i < CUP_INNER.length - 1; i++) {
    const [y0, r0] = CUP_INNER[i], [y1, r1] = CUP_INNER[i + 1]
    if (y <= y1) return r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1)
  }
  return CUP_INNER[CUP_INNER.length - 1][1]
}
/** a little sake cup (お猪口), thick-walled: foot ring, belly, a rounded rim, the inside hollow with its own floor */
const SAKE_CUP = new THREE.LatheGeometry([[0, 0.0005], [0.0072, 0.0005], [0.0078, 0.0022], [0.0095, 0.008], [0.0118, 0.016], [0.0128, 0.0232], [0.0126, 0.0252],
  [0.0116, 0.0256], [0.0106, 0.0246], [0.0102, 0.0225], [0.0088, 0.0125], [0.0066, 0.0062], [0, 0.0056]].map(([x, y]) => new THREE.Vector2(x, y)), 20)
/** the glow round a lit lamp, and the pool of its light on what's under it: a soft warm disc, bright in the middle */
const GLOW = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,200,130,0.9)')
  grad.addColorStop(0.4, 'rgba(255,170,90,0.35)')
  grad.addColorStop(1, 'rgba(255,150,70,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

/**
 * A paper pendant lamp over the bar, lit. Its light is painted, not cast: a halo round the shade and a warm pool on
 * the bar top under it (added on, so it brightens what it falls on). Six real lights would cost every lit surface in
 * the room on every frame; these cost two quads each.
 */
/** the paper lantern's body: a round ball, a circle in section, drawn in to the wooden rings at its two ends, turned on a lathe */
const LANTERN_R = 0.125
const LANTERN_END = Math.sqrt(LANTERN_R ** 2 - 0.05 ** 2)
/** a ball's band turned (a paper lantern's body): from `end` below its middle to `end` above, its points evenly round the curve (they were
 * evenly up its height, crowded across the flat middle and few where it rounds in to its rings: twice the faces for a coarser outline) */
function ballLathe(R: number, end: number, bands: number, round: number) {
  const top = Math.asin(Math.min(1, end / R)), pts: THREE.Vector2[] = []
  for (let i = 0; i <= bands; i++) {
    const a = -top + (2 * top * i) / bands
    pts.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a)))
  }
  return new THREE.LatheGeometry(pts, round)
}
const LANTERN_GEO = ballLathe(LANTERN_R, LANTERN_END, 12, 24)
/** a little seeded stream of numbers, the same pictures every time */
function seeded(seed: number) {
  let n = seed
  return () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646 }
}
/** an indigo band round a lantern's belly, after the owner's references (they found the waves there wouldn't do): a ground of indigo,
 * its pattern in pale lines through it: 麻の葉 (hemp leaves: a lattice of triangles, each with lines from its corners to its middle) or 七宝
 * (circles linked endlessly, each through its neighbours, a little four-petalled flower where four meet). Its width a whole number of
 * repeats, so it runs on round the lantern with no seam; drawn on its own sheet and laid over the paper, the washi showing through */
function indigoBand(g: CanvasRenderingContext2D, W: number, y0: number, y1: number, lit: boolean, kind: 'asanoha' | 'shippo') {
  const h = Math.ceil(y1 - y0)
  const sheet = document.createElement('canvas')
  sheet.width = W; sheet.height = h
  const s = sheet.getContext('2d')
  if (!s) return
  s.fillStyle = lit ? 'rgba(38,50,98,0.68)' : 'rgba(30,46,92,0.86)'
  s.fillRect(0, 0, W, h)
  s.strokeStyle = lit ? 'rgba(255,240,214,0.85)' : 'rgba(244,238,224,0.92)'
  s.lineCap = 'round'
  if (kind === 'asanoha') {
    const a = W / 40, rh = (a * Math.sqrt(3)) / 2
    s.lineWidth = 1.6
    for (let row = -1; row * rh < h + rh; row++) {
      const yA = row * rh, yB = yA + rh, off = (row % 2 ? a / 2 : 0)
      for (let x = off - a; x < W + a; x += a) {
        // (an upward triangle and the downward one beside it, each with its edges and the lines from its corners to its middle)
        const tris = [[[x, yB], [x + a, yB], [x + a / 2, yA]], [[x + a / 2, yA], [x + 1.5 * a, yA], [x + a, yB]]]
        for (const t of tris) {
          const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3
          s.beginPath()
          s.moveTo(t[0][0], t[0][1]); s.lineTo(t[1][0], t[1][1]); s.lineTo(t[2][0], t[2][1]); s.closePath()
          for (const v of t) { s.moveTo(v[0], v[1]); s.lineTo(cx, cy) }
          s.stroke()
        }
      }
    }
  } else {
    const d = W / 32, r = d / Math.SQRT2
    s.lineWidth = 1.8
    for (let y = 0; y < h + d; y += d) for (let x = 0; x < W + d; x += d) {
      s.beginPath(); s.arc(x, y, r, 0, Math.PI * 2); s.stroke()
    }
    // (a little flower where four circles meet, in each star between them)
    s.fillStyle = s.strokeStyle
    for (let y = d / 2; y < h + d; y += d) for (let x = d / 2; x < W + d; x += d) {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4
        s.beginPath(); s.ellipse(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.4, 1.3, a, 0, Math.PI * 2); s.fill()
      }
    }
  }
  g.drawImage(sheet, 0, y0)
  // (a fine line of indigo along either edge)
  g.fillStyle = lit ? 'rgba(46,56,98,0.6)' : 'rgba(30,46,92,0.85)'
  g.fillRect(0, y0 - 5, W, 2)
  g.fillRect(0, y1 + 3, W, 2)
}
/**
 * A lantern's paper (u round it, v up it: 1024 x 300, about as many pixels to the inch round its belly as up it, so what's painted on it
 * keeps its shape there). `lit`: glowing from within, warm, brightest in the middle of its belly; unlit, plain washi, a little cream (only
 * a little). Its bamboo ribs and the seams between its panels, the paper's fibres here and there, and an indigo band round its lower belly
 * (`band`: 麻の葉 or 七宝, after the owner's references; it had two sea bream painted on it, then seigaiha waves, neither of which would do).
 */
function lanternPaper(g: CanvasRenderingContext2D, lit: boolean, band: 'asanoha' | 'shippo' | null = 'asanoha') {
  const W = 1024, H = 300
  const grad = g.createLinearGradient(0, 0, 0, H)
  for (const [t, c] of (lit ? [[0, '#f2b878'], [0.22, '#ffe2b0'], [0.5, '#fff6e0'], [0.78, '#ffe2b0'], [1, '#f2b878']]
    : [[0, '#e0d9cb'], [0.28, '#f1ebdf'], [0.52, '#f7f2e8'], [0.76, '#efe9dc'], [1, '#dcd5c6']]) as [number, string][]) grad.addColorStop(t, c)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  const rnd = seeded(lit ? 11 : 29)
  // (the washi's own clouding and its long kozo fibres, a little lighter and darker than the sheet)
  for (let k = 0; k < 26; k++) {
    const x = rnd() * W, y = rnd() * H, r = 20 + rnd() * 60
    const cl = g.createRadialGradient(x, y, 0, x, y, r)
    cl.addColorStop(0, lit ? 'rgba(255,250,235,0.16)' : 'rgba(255,255,255,0.22)'); cl.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = cl
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.lineCap = 'round'
  for (let k = 0; k < 360; k++) {
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 8 + rnd() * 26, bend = (rnd() - 0.5) * 10
    g.strokeStyle = k % 3 ? (lit ? 'rgba(255,248,230,0.28)' : 'rgba(255,255,255,0.45)') : (lit ? 'rgba(170,110,60,0.12)' : 'rgba(150,140,120,0.16)')
    g.lineWidth = 0.6 + rnd() * 0.7
    g.beginPath(); g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * bend, y + Math.sin(a) * l / 2 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l)
    g.stroke()
  }
  // (the bamboo ribs it's wound on: a fine line every few pixels, a shade darker, a pale one beside it)
  for (let y = 3; y < H; y += 6.6) {
    g.fillStyle = lit ? 'rgba(190,130,70,0.22)' : 'rgba(120,112,98,0.2)'
    g.fillRect(0, y, W, 1.5)
    g.fillStyle = lit ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.35)'
    g.fillRect(0, y + 1.8, W, 1)
  }
  // (the seams between its panels)
  g.fillStyle = lit ? 'rgba(200,140,80,0.16)' : 'rgba(120,110,95,0.14)'
  for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 1.6, H)
  // (its band, round its lower belly)
  if (band) indigoBand(g, W, H * 0.58, H * 0.8, lit, band)
}
/** the round lantern's paper (the owner's: a round one with 日式烤魚 on it): the same washi, a band of vermilion near each end, the words
 * twice round it (a side each), in the signs' brush lettering */
function roundPaper(g: CanvasRenderingContext2D, lit: boolean) {
  lanternPaper(g, lit, null)
  const W = 1024, H = 300
  g.fillStyle = lit ? '#d0392a' : '#9a3a30'
  g.fillRect(0, H * 0.07, W, H * 0.07); g.fillRect(0, H * 0.86, W, H * 0.07)
  for (const x of [W * 0.25, W * 0.75]) brushText(g, '日式烤魚', x, H * 0.5, H * 0.27, { fill: lit ? '#b8261c' : '#8a2a22', spacing: 6 })
}
/** the fish lantern's paper (the owner's: a lantern made a fish, a sea bream). Round it (u) from the belly (u 0, straight down) up a flank
 * (u 0.25) to the back (u 0.5) and down the other flank; along it (v, the canvas's foot the head, its top the tail). A red back fading to a
 * pale belly, scales in rows down the flanks, the gill's curve, an eye on each flank */
function fishPaper(g: CanvasRenderingContext2D, lit: boolean) {
  const W = 1024, H = 300
  for (let x = 0; x < W; x += 2) {
    const back = 0.5 - 0.5 * Math.cos((x / W) * Math.PI * 2)
    const k = Math.pow(back, 0.8)
    const r = lit ? [255 - 20 * k, 236 - 146 * k, 222 - 164 * k] : [214 - 30 * k, 206 - 96 * k, 198 - 96 * k]
    g.fillStyle = `rgb(${r.map((c) => Math.round(c)).join(',')})`
    g.fillRect(x, 0, 2, H)
  }
  // (scales: rows of little arcs from behind the gill to the tail, on the back and flanks, not the belly)
  g.strokeStyle = lit ? 'rgba(160,40,22,0.32)' : 'rgba(100,56,46,0.3)'
  g.lineWidth = 2
  let row = 0
  for (let y = H * 0.12; y < H * 0.74; y += 16, row++) {
    for (let x = (row % 2) * 13; x < W; x += 26) {
      const back = 0.5 - 0.5 * Math.cos((x / W) * Math.PI * 2)
      if (back < 0.3) continue
      g.beginPath(); g.arc(x, y, 11, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
    }
  }
  // (the gill's curve behind each eye, the eye itself, a glint in it; a lip line where the mouth is)
  for (const cx of [W * 0.25, W * 0.75]) {
    g.strokeStyle = lit ? 'rgba(150,32,20,0.65)' : 'rgba(90,50,40,0.6)'
    g.lineWidth = 4
    g.beginPath(); g.arc(cx, H * 0.93, 70, -Math.PI * 0.82, -Math.PI * 0.18); g.stroke()
    g.fillStyle = '#fff6e6'; g.beginPath(); g.arc(cx, H * 0.85, 17, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#1a1210'; g.beginPath(); g.arc(cx, H * 0.85, 10, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx + 4, H * 0.835, 3.5, 0, Math.PI * 2); g.fill()
  }
  g.fillStyle = lit ? 'rgba(150,32,20,0.7)' : 'rgba(90,50,40,0.6)'
  g.fillRect(0, H * 0.985, W, H * 0.015)
}
const LANTERN_SKIN = signTexture(1024, 300, (g) => lanternPaper(g, true))
const PENDANT_GLOW = nightGlow(new THREE.SpriteMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffcf90' }), 0.35, 0.75)
const PENDANT_BLOOM = nightGlow(new THREE.SpriteMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffb870' }), 0, 0.28)
// (pulled toward the camera in depth so it never fights the bar's top under it, seen from far off)
const PENDANT_POOL = nightGlow(new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0.18, 0.42)
/** and the same paper with no light in it: plain washi, a little cream, its fibres and its waves */
const LANTERN_SKIN_OFF = signTexture(1024, 300, (g) => lanternPaper(g, false))
const LANTERN_SHADE = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: LANTERN_SKIN, toneMapped: false, side: THREE.DoubleSide }), { offMap: LANTERN_SKIN_OFF })
/** the other oval lantern's: the same washi, its band 七宝 */
const LANTERN_SHADE_SHIPPO = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: signTexture(1024, 300, (g) => lanternPaper(g, true, 'shippo')),
  toneMapped: false, side: THREE.DoubleSide }), { offMap: signTexture(1024, 300, (g) => lanternPaper(g, false, 'shippo')) })
/** the round lantern (日式烤魚 on it): rounder and a little bigger, drawn in to its rings */
const ROUND_LANTERN_R = 0.15
const ROUND_LANTERN_END = Math.sqrt(ROUND_LANTERN_R ** 2 - 0.06 ** 2)
const ROUND_LANTERN_GEO = ballLathe(ROUND_LANTERN_R, ROUND_LANTERN_END, 12, 24)
const ROUND_SHADE = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: signTexture(1024, 300, (g) => roundPaper(g, true)), toneMapped: false, side: THREE.DoubleSide }),
  { offMap: signTexture(1024, 300, (g) => roundPaper(g, false)) })
/** the fish lantern's body: turned along its length, a blunt head (its mouth a little round), deep and full to past its middle as a sea
 * bream is, narrowing late to the root of its tail. `fishR` its radius from the head (t 0) to the tail (t 1). Laid along z (head at -z),
 * its back up, flattened side to side and deeper than wide (`FISH_DEEP`), set back along z (`FISH_Z0`) so it hangs from its shoulders */
const FISH_LEN = 0.42
const FISH_DEEP = 1.12
const FISH_Z0 = 0.07
const fishR = (t: number) => t < 0.36 ? 0.034 + 0.07 * Math.pow(Math.sin((Math.PI / 2) * (t / 0.36)), 0.7)
  : t < 0.9 ? 0.104 - 0.076 * THREE.MathUtils.smoothstep((t - 0.36) / 0.54, 0, 1)
    : 0.028 - 0.006 * ((t - 0.9) / 0.1)
const fishZ = (t: number) => -FISH_LEN / 2 + FISH_LEN * t + FISH_Z0
const FISH_GEO = (() => {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -FISH_LEN / 2)]
  for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector2(fishR(i / 16), -FISH_LEN / 2 + (FISH_LEN * i) / 16))
  pts.push(new THREE.Vector2(0, FISH_LEN / 2))
  const g = new THREE.LatheGeometry(pts, 16)
  // (laid along z, its back up: the lathe's axis turned from y to z, which turns the paper's u 0 straight down and u 0.5 up)
  g.rotateX(Math.PI / 2)
  g.scale(0.7, FISH_DEEP, 1)
  g.translate(0, 0, FISH_Z0)
  return g
})()
const FISH_SHADE = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: signTexture(1024, 300, (g) => fishPaper(g, true)), toneMapped: false, side: THREE.DoubleSide }),
  { offMap: signTexture(1024, 300, (g) => fishPaper(g, false)) })
/** where the fish hangs from: its back, a little behind its head, at the cord */
const FISH_HANG = FISH_DEEP * fishR((FISH_LEN / 2 - FISH_Z0) / FISH_LEN)
/** the fish lantern's fins, one mesh (one draw): its tail fanned and forked, the long spiny fin along its back, a small one under its tail;
 * each deeper red at its root, paler toward its edge (colour in the vertices), the same lit paper as the body */
const FISH_FIN = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, toneMapped: false, side: THREE.DoubleSide }))
const FISH_FIN_GEO = (() => {
  const root = new THREE.Color('#e4483a'), edge = new THREE.Color('#ffc48c'), c = new THREE.Color()
  // (a fin from its outline, drawn where it is: x along the fish (z), y up; coloured by how far a point is from its root)
  const fin = (sh: THREE.Shape, far: (z: number, y: number) => number) => {
    const g = new THREE.ShapeGeometry(sh, 6)
    const pos = g.attributes.position as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    for (let v = 0; v < pos.count; v++) {
      c.copy(root).lerp(edge, THREE.MathUtils.clamp(far(pos.getX(v), pos.getY(v)), 0, 1))
      col.set([c.r, c.g, c.b], v * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    // (turned into the plane of its length and height: x runs along z)
    g.rotateY(-Math.PI / 2)
    return g
  }
  const tOf = (z: number) => THREE.MathUtils.clamp((z - FISH_Z0 + FISH_LEN / 2) / FISH_LEN, 0, 1)
  // (a fin along its back (side 1) or belly (-1) from t0 to t1: its root sunk a little into the body, following its curve; n spines,
  // each leaning back to a point with a dip of webbing to the next, lower toward the tail)
  const edgeFin = (t0: number, t1: number, n: number, side: 1 | -1, h0: number, h1: number) => {
    const at = (t: number) => side * (FISH_DEEP * fishR(t) - 0.006)
    const sh = new THREE.Shape()
    sh.moveTo(fishZ(t0), at(t0))
    for (let k = 0; k < n; k++) {
      const t = t0 + ((t1 - t0) * (k + 0.55)) / n, h = h0 + ((h1 - h0) * k) / Math.max(1, n - 1)
      sh.lineTo(fishZ(t) + 0.01, at(t) + side * h)
      const tv = t0 + ((t1 - t0) * (k + 1)) / n
      if (k < n - 1) sh.lineTo(fishZ(tv), at(tv) + side * h * 0.55)
    }
    sh.lineTo(fishZ(t1), at(t1))
    for (let k = 6; k >= 0; k--) { const t = t0 + ((t1 - t0) * k) / 6; sh.lineTo(fishZ(t), at(t)) }
    return fin(sh, (z, y) => side * (y - at(tOf(z))) / h0)
  }
  const z1 = fishZ(1) - 0.012
  const tail = new THREE.Shape()
  tail.moveTo(z1, 0.026); tail.quadraticCurveTo(z1 + 0.06, 0.05, z1 + 0.135, 0.125); tail.quadraticCurveTo(z1 + 0.1, 0.05, z1 + 0.088, 0.0)
  tail.quadraticCurveTo(z1 + 0.1, -0.05, z1 + 0.135, -0.125); tail.quadraticCurveTo(z1 + 0.06, -0.05, z1, -0.026); tail.closePath()
  const parts = [
    fin(tail, (z) => (z - z1) / 0.12),
    edgeFin(0.36, 0.84, 8, 1, 0.056, 0.03),
    edgeFin(0.7, 0.86, 4, -1, 0.034, 0.022),
  ]
  const g = mergeGeometries(parts)!
  parts.forEach((q) => q.dispose())
  return g
})()
/** a pendant lamp; `style`: 0 the oval washi lantern with its waves, 1 the round one with 日式烤魚 on it, 2 the fish (the owner's: two or
 * three kinds of lantern, a fish among them) */
function Pendant({ z, drop, pool, style = 0, band = 0 }: { z: number; drop: number; pool: number; style?: number; band?: number }) {
  return (
    <group position={[0, WALL_H, z]}>
      <mesh position-y={-drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {/* (a paper lantern: the oval of ribbed washi, a pale wooden ring at each end, a little ring at the top for the cord) */}
      {/* (a lamp casts no shadow: the moon threw the lit lanterns' onto the floor, well away under them) */}
      <group position-y={-drop - (style === 1 ? 0.18 : style === 2 ? FISH_HANG + 0.016 : 0.13)}>
        {style === 0 && (<>
          <mesh geometry={LANTERN_GEO} material={band ? LANTERN_SHADE_SHIPPO : LANTERN_SHADE} />
          <mesh geometry={LANTERN_GEO} scale={1.035}>
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          {[LANTERN_END + 0.004, -LANTERN_END - 0.004].map((y) => (
            <mesh key={y} position-y={y}>
              <cylinderGeometry args={[0.056, 0.056, 0.024, 16]} />
              <meshToonMaterial color="#cdb083" />
            </mesh>
          ))}
          <mesh position-y={LANTERN_END + 0.028} rotation-x={Math.PI / 2}><torusGeometry args={[0.012, 0.0025, 5, 12]} /><meshToonMaterial color="#8a6a3a" /></mesh>
        </>)}
        {style === 1 && (<>
          {/* (the round one: its paper with 日式烤魚 round it, black-lacquered rings at its ends) */}
          <mesh geometry={ROUND_LANTERN_GEO} material={ROUND_SHADE} />
          <mesh geometry={ROUND_LANTERN_GEO} scale={1.03}>
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          {[ROUND_LANTERN_END + 0.006, -ROUND_LANTERN_END - 0.006].map((y) => (
            <mesh key={y} position-y={y}>
              <cylinderGeometry args={[0.068, 0.068, 0.03, 18]} />
              <meshToonMaterial color="#1c1412" />
            </mesh>
          ))}
          <mesh position-y={ROUND_LANTERN_END + 0.034} rotation-x={Math.PI / 2}><torusGeometry args={[0.013, 0.003, 5, 12]} /><meshToonMaterial color="#8a6a3a" /></mesh>
        </>)}
        {style === 2 && (<>
          {/* (the fish: hung by its back, lying along the bar, its tail and its fin of the same lit paper) */}
          <mesh geometry={FISH_GEO} material={FISH_SHADE} />
          <mesh geometry={FISH_GEO} scale={1.03}>
            <meshBasicMaterial color={INK} side={THREE.BackSide} />
          </mesh>
          <mesh geometry={FISH_FIN_GEO} material={FISH_FIN} />
          <mesh position-y={FISH_HANG + 0.008} rotation-x={Math.PI / 2}><torusGeometry args={[0.011, 0.0025, 5, 12]} /><meshToonMaterial color="#8a6a3a" /></mesh>
        </>)}
        <sprite scale={0.85} material={PENDANT_GLOW} />
        {/* (and by night a wide soft bloom round it) */}
        <sprite scale={2.2} material={PENDANT_BLOOM} />
      </group>
      {/* (the pool of light on the bar top below, down from the lamp's height) */}
      <mesh position-y={pool - WALL_H + 0.004} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[1.3, 1.3]} />
        <primitive object={PENDANT_POOL} attach="material" />
      </mesh>
    </group>
  )
}

/**
 * One counter's stretch of the room: the wall behind its aisle (from/to along it, in the counter's own frame), and
 * pendant lamps over it.
 */
function DiningWallImpl({ c, from, to, far, lamps, top, door, altar = false, clear = [], corner = false, hang = [], staffDoor }: { c: Counter; from: number; to: number; far: number
  /** prints hung here as well, where asked (along it) */
  hang?: { z: number; print: ArtKey }[]
  /** a staff-only door here (its middle, along it): nothing hung over it */
  staffDoor?: number
  /** the first of the room's two walls, whose start is the corner they meet in: its thickness runs on to close the corner, to where the other
   * wall's face truly is (along it) if given (its start, a hair beyond, is where its pictures and lamps are laid out from) */
  corner?: boolean | number
  /** stretches of it (along it) where something stands against it: nothing hung there, no post */
  clear?: [number, number][]
  /** its shelf an altar instead (by the door): a command flag in the censer, and incense (lit when, and lighting more) */
  altar?: boolean | { litAt: number | null; onLight: () => void }
  lamps: number
  /** the bar top's height, where the lamps' light falls */
  top: number
  /** where along it the sliding door to the toilet is, if it has one */
  door?: number
  }) {
  const yaw = Math.atan2(c.along.x, c.along.z)
  const meetAt = typeof corner === 'number' ? corner : from
  const l = to - from
  const mid = (from + to) / 2
  // the wall's stretches: whole, or with the toilets' doorways left open (as high as their frames' lintel)
  const spans = useMemo(() => {
    if (door === undefined) return [[from, to, 0]]
    const g0 = door - WC_W - 0.12, g1 = door + WC_W + 0.12
    return [[from, g0, 0], [door - 0.06, door + 0.06, 0], [g1, to, 0], [g0, g1, WC_H + 0.07]]
  }, [from, to, door])
  // (pictures along the wall, a print then a scroll in turn, about a metre apart, leaving the shelf's stretch clear)
  // (the shelf in the far third of the wall, or the near one if the door's in the far one)
  const shelfZ0 = door !== undefined && Math.abs(door - (mid + l * 0.3)) < 1.3 ? mid - l * 0.3 : mid + l * 0.3
  // (moved along the wall away from the toilets' door, the owner's wish: more room round it; on the back wall only a little toward the way
  // in, the lucky cats and the shoe cupboard under it moved along with it, clear of the door)
  const shelfZ = shelfZ0 + (door !== undefined ? Math.sign(shelfZ0 - door) || 1 : 1) * (door !== undefined ? 0.35 : 0.05)
  // (the wall with the toilets has the fridge and the doors' sliding along it: no shelf there)
  const shelf = door === undefined
  const isClear = (z: number, pad: number) => clear.every(([a, b]) => z < a - pad || z > b + pad)
  const art = useMemo(() => {
    // (in the bays between the posts, spaced evenly in each, never over a post or the shelf)
    const posts = [from, mid - l / 6, mid + l / 6, to]
    const start = Math.round(c.length * 3)
    const spots: number[] = []
    for (let b = 0; b < 3; b++) {
      const w = posts[b + 1] - posts[b]
      const n = Math.max(0, Math.floor(w / 0.95))
      for (let i = 0; i < n; i++) spots.push(posts[b] + (w / n) * (i + 0.5))
    }
    const kept = spots.filter((z) => (!shelf || Math.abs(z - shelfZ) > 0.85 * ALTAR_SCALE) && isClear(z, 0.3) && (door === undefined || Math.abs(z - door) > 0.95)
      && (door === undefined || Math.abs(z - door) > WC_W * 2 + 0.3))
    // (and on the back wall a second round window, in the bay among the bunting left of the specials' boards: the place nearest it)
    const extra = shelf && kept.length ? kept.reduce((m, z) => (Math.abs(z - ROUND_AT) < Math.abs(m - ROUND_AT) ? z : m), kept[0]) : null
    return kept
      .map((z, k) => ({ z, scroll: k % 2 ? SCROLLS[(start + k) % SCROLLS.length] : undefined, print: PRINTS[(start + k) % PRINTS.length],
        // (on the back wall, the plum scroll's place is a round window let into the plaster instead)
        round: (shelf && k % 2 === 1 && SCROLLS[(start + k) % SCROLLS.length] === 'plum') || z === extra,
        // (a banner every third place along the wall, in turn)
        // (none by the drinks fridges: the wall there is left plain)
        nobori: z !== extra && k % 3 === 2 && isClear(z, 0.9) ? Math.floor(k / 3 + start) % NOBORI_LOOKS.length : undefined,
        // (and a big signboard every fifth, between)
        kanban: z !== extra && k % 5 === 3 && k % 3 !== 2 ? Math.floor(k / 5 + start) % KANBAN_LOOKS.length : undefined }))
      // (nothing where the staff's door is: taken out after the rest are given theirs, so they keep what they were)
      .filter((a) => staffDoor === undefined || Math.abs(a.z - staffDoor) > STAFF_W / 2 + 0.3)
      .concat(hang.map((h) => ({ z: h.z, scroll: undefined, print: h.print, round: false, nobori: undefined, kanban: undefined })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l, from, to, mid, shelfZ, c.length, door, shelf, clear, staffDoor, hang.map((h) => `${h.z}${h.print}`).join()])
  // (the supplies' place: the gap between the drinks fridges and the toilets' doorway on this wall; shrunk only if it's narrower than
  // the stack, about 0.55 across)
  const supplies = useMemo(() => {
    if (door === undefined || !clear.length) return null
    const g0 = door - WC_W - 0.12, g1 = door + WC_W + 0.12
    const below = clear.filter((r) => r[1] <= g0), above = clear.filter((r) => r[0] >= g1)
    const span = below.length ? [Math.max(...below.map((r) => r[1])), g0] : above.length ? [g1, Math.min(...above.map((r) => r[0]))] : null
    if (!span || span[1] - span[0] < 0.35) return null
    const w = span[1] - span[0] - 0.08
    return { z: (span[0] + span[1]) / 2, k: Math.min(1, w / 0.56) }
  }, [door, clear])
  // (the light switch: halfway between the round window short of the shelf and the next picture toward it; by the door if there's none)
  const switchZ = useMemo(() => {
    const i = art.reduce((k, a, j) => (a.round && a.z < shelfZ ? j : k), -1)
    return i >= 0 && i + 1 < art.length && art[i + 1].z < shelfZ ? (art[i].z + art[i + 1].z) / 2 : to - 0.16
  }, [art, shelfZ, to])
  const frieze = useMemo(() => {
    if (!SEIGAIHA) return null
    const t = SEIGAIHA.clone()
    t.repeat.set(l / 0.4, 1)
    t.needsUpdate = true
    return t
  }, [l])
  // (the wall and all on it are hidden while the camera is round behind it)
  const wall = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    const w = wall.current
    if (!w) return
    w.getWorldPosition(WP)
    const facing = NORMAL.set(-1, 0, 0).transformDirection(w.matrixWorld)
    w.visible = camera.position.clone().sub(WP).dot(facing) > 0
  })
  return (
    <group position={c.at} rotation-y={yaw}>
      {/* (local x is away from the cook: the wall stands at the floor's far edge, facing back toward the bar) */}
      <group ref={wall} position-x={-far} name="room-wall" userData={{ from, to, shelf }}>
        {/* (all of it standing still: drawn merged, a few meshes for the whole wall) */}
        <StaticBatch key={`${from}|${to}|${door}|${!!altar}`}>
        {/* the plaster over the wainscot, open where the toilets' doors are (a strip between them, and over them) */}
        {/* (the wall's thickness: a slab behind it, the base's dark wood, full height, over the toilets' doorways only above them) */}
        {/* (down through the base's own thickness too, which stops at the room's outline, short of the wall's) */}
        {spans.map(([z0, z1, y0]) => {
          const lo = y0 > 0 ? y0 : -BASE_DEPTH
          const z0e = corner !== false && z0 === from ? meetAt - WALL_T - 0.012 : z0
          return (
            <mesh key={`t${z0}|${y0}`} position={[WALL_T / 2 + 0.012, (lo + WALL_H) / 2, (z0e + z1) / 2]}>
              <boxGeometry args={[WALL_T, WALL_H - lo, z1 - z0e]} /><meshToonMaterial color="#3d2414" />
            </mesh>
          )
        })}
        {/* (at the corner, the sliver between this wall's face and its slab where the other wall's slab ends: filled, so the two walls' tops
            meet without a slot) */}
        {corner !== false && (
          <mesh position={[0.006, (WALL_H - BASE_DEPTH) / 2, meetAt - 0.012 - WALL_T / 2]}>
            <boxGeometry args={[0.014, WALL_H + BASE_DEPTH, WALL_T + 0.002]} /><meshToonMaterial color="#3d2414" />
          </mesh>
        )}
        {spans.map(([z0, z1, y0]) => (
          <group key={`${z0}|${y0}`}>
            <WallPiece z0={z0} z1={z1} y0={Math.max(WAINSCOT, y0)} y1={WALL_H} plaster />
            {y0 < WAINSCOT && <WallPiece z0={z0} z1={z1} y0={0} y1={WAINSCOT} />}
          </group>
        ))}
        {/* the rail over the wainscot and the beam along the top */}
        {/* (the rail broken where the toilets' doorways are) */}
        {/* (stopping short of the doorways' frames, and not across the little strip between the two doors) */}
        {spans.filter(([a, b, y0]) => y0 < WAINSCOT && b - a > 0.3).flatMap(([z0, z1]) => {
          const a = door !== undefined && z0 !== from ? z0 + 0.09 : z0, b = door !== undefined && z1 !== to ? z1 - 0.09 : z1
          // (and broken at the staff's door, short of its frame either side)
          const cut = staffDoor === undefined ? null : [staffDoor - STAFF_W / 2 - 0.07, staffDoor + STAFF_W / 2 + 0.07]
          const runs = cut && cut[0] < b && cut[1] > a ? [[a, cut[0]], [cut[1], b]].filter(([p, q]) => q - p > 0.02) : [[a, b]]
          return runs.map(([p, q]) => <Box key={`${z0}|${p}`} size={[0.05, 0.05, q - p]} color="#3a2416" position={[-0.02, WAINSCOT, (p + q) / 2]} />)
        })}
        <Box size={[0.08, 0.1, l]} color="#3a2416" position={[-0.03, WALL_H - 0.05, mid]} />
        {/* (no upright posts: nothing stands in the way of the banners strung along it) */}
        {/* a frieze of seigaiha waves under the beam, and the pictures hung along the plaster */}
        <mesh position={[-0.004, WALL_H - 0.2, mid]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[l, 0.2]} />
          <meshToonMaterial color="#ffffff" map={frieze} />
        </mesh>
        <Box size={[0.03, 0.025, l]} color="#3a2416" position={[-0.01, WALL_H - 0.31, mid]} />
        </StaticBatch>
        {/* (everything below is its own piece in a batch of its own, so each can be moved by hand when the shop's shut: key G) */}
        {art.filter((a) => a.nobori === undefined).map((a) => (
          <Movable key={a.z} id={`art${from.toFixed(1)}_${a.z.toFixed(2)}`} label={`${a.kanban !== undefined ? '木牌' : a.round ? '圓窗' : a.scroll ? '掛軸' : '畫'}（${from.toFixed(0)}, ${a.z.toFixed(1)}）`}><StaticBatch>
            <group position={[0, a.round ? 1.4 : a.scroll ? 1.42 : 1.5, a.z]}>
              {a.kanban !== undefined ? <Kanban i={a.kanban} /> : a.round ? <RoundWindow /> : a.scroll ? <Scroll art={a.scroll} /> : <Framed art={a.print} />}
            </group>
          </StaticBatch>
          {/* (the moon's dust in its shaft by night, outside the batch: it drifts, and a batch's pieces stand still) */}
          {a.round && <group position={[0, 1.4, a.z]}><WindowDust /><RoundShoji /></group>}
          </Movable>
        ))}
        {/* (the supplies in the corner between the drinks fridges and the toilets' doorway) */}
        {supplies && <Movable id="supplies" label="衛生紙與清潔用品"><group position={[-0.02, 0, supplies.z]} rotation-y={-Math.PI / 2} scale={supplies.k}><CornerSupplies /></group></Movable>}
        {/* (the staff's door, where asked: up the stairs behind it, 員工專用) */}
        {staffDoor !== undefined && <Movable id="staffdoor" label="員工專用門"><group position={[0, 0, staffDoor]}><StaffDoor /></group></Movable>}
        {/* (the exit sign on the frieze by the way out, its arrow and running figure toward the door at the wall's end) */}
        {altar && <Movable id="exitsign" label="逃生出口燈"><group name="look-exit" position={[-0.045, 2.08, to - 0.62]} rotation-y={-Math.PI / 2}><ExitSign /></group></Movable>}
        {/* (the light switch at hand height on the plaster between the round window and the picture after it, the owner's place for it) */}
        {altar && <Movable id="lightswitch" label="電燈開關"><group position={[-0.002, 1.12, switchZ]}><LightSwitch /></group></Movable>}
        {altar && <Movable id="altar" label="供桌"><StaticBatch><group position={[(-ALTAR_D / 2) * ALTAR_SCALE, ALTAR_Y, shelfZ]} scale={ALTAR_SCALE}><AltarTable />
          {/* held off the wall on two carved brackets (持ち送り): a curved knee from the wall up under the shelf */}
          {[-0.35, 0.35].map((z) => (
            <group key={z} position={[ALTAR_D / 2, -0.03, z - 0.015]}>
              <mesh geometry={SHELF_BRACKET}><meshToonMaterial color="#1c130d" /></mesh>
              <mesh geometry={SHELF_BRACKET} scale={[1.035, 1.035, 1.4]} position-z={-0.004}><meshBasicMaterial color="#c9a040" side={THREE.BackSide} /></mesh>
            </group>
          ))}</group></StaticBatch></Movable>}
        {/* (the string of bulbs under the frieze: instanced, so out of the batch) */}
        <Movable id={`festoon${from.toFixed(1)}`} label={`燈串（${from.toFixed(0)}）`}><group userData={{ fade: true }}><Festoon l={l} mid={mid} /></group></Movable>
        {/* (the strings of banners overhead, clear of the altar, the fridges and the toilets' doors) */}
        {(() => {
          const zs: number[] = []
          // (not out to the way in at the end: nothing hung over the doorway)
          // (and none in the corner where the speaker hangs: kept clear of it by its own reach and size)
          for (let z = from + (corner ? 1.15 : 0.25); z < to - 1.05; z += 0.145) {
            if (altar && Math.abs(z - shelfZ) < 0.62 * ALTAR_SCALE) continue
            if (!isClear(z, 0.6)) continue
            if (door !== undefined && Math.abs(z - door) < WC_W + 0.3) continue
            zs.push(z)
          }
          return zs.length > 1 ? (
            <>
              {/* (one string along the wall, swagged between its pegs, a cloth every other place) */}
              <Movable id={`banners${from.toFixed(1)}a`} label={`旗幟串 1（${from.toFixed(0)}）`}><group position={[-0.3, 2.22, 0]} userData={{ fade: true }}><BannerRow zs={zs.filter((_, k) => k % 2 === 0)} /></group></Movable>
            </>
          ) : null
        })()}
        {/* (the banners sway: not merged) */}
        {art.filter((a) => a.nobori !== undefined).map((a) => <Movable key={`n${a.z}`} id={`nobori${from.toFixed(1)}_${a.z.toFixed(2)}`} label={`幟旗（${from.toFixed(0)}, ${a.z.toFixed(1)}）`}><group position={[0, 1.08, a.z]} userData={{ fade: true }}><Nobori i={a.nobori!} /></group></Movable>)}
        {/* (the altar's flag stirs, its incense smokes: not merged) */}
        {altar && <Movable id="altarfittings" label="供桌上的供品與線香"><group name="look-altar" position={[(-ALTAR_D / 2) * ALTAR_SCALE, ALTAR_Y, shelfZ]} scale={ALTAR_SCALE}><Altar incense={altar === true ? undefined : altar} /></group></Movable>}
      </group>
      {/* the toilets: not part of the wall that's hidden from behind, so they're still there when the camera swings round to the back */}
      <group position-x={-far}>
        {/* the toilets, the men's and the women's, side by side */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletDoor who={who} /></group>
        ))}
        {/* (the toilets' doors slide: not merged) */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} name={`look-wc-${who}`} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletPanel who={who} /><ToiletHit who={who} /></group>
        ))}
      </group>
      {/* pendant lamps over the bar's customer side, low */}
      {Array.from({ length: lamps }, (_, i) => {
        const z = (i - (lamps - 1) / 2) * (c.length / lamps)
        // (three kinds in turn (the owner's): the oval washi one, the round one with 日式烤魚 on it, the fish)
        return <Movable key={i} id={`pendant${i}`} label={`吊燈 ${i + 1}`}><group position-x={0.05} userData={{ fade: true }}><Pendant z={z} drop={0.25} pool={top} style={(i + (lamps === 2 ? 1 : 0)) % 3} band={i > 0 ? 1 : 0} /></group></Movable>
      })}
    </group>
  )
}

/**
 * The altar on the shelf by the door: the household shrine (神棚), a pair of sake flasks (御神酒徳利) and a cup set out before it, a
 * dish of oranges. Offering the sake (a click) fills the cup and makes the shrine itself glow for a minute.
 */
/**
 * A carved shelf bracket (持ち送り), in the wall's frame (x out from the wall, which is at x = 0, so it reaches to -x):
 * a post against the wall, an arm under the shelf, and between them a deep curve, its end rounded off.
 */
const SHELF_BRACKET = (() => {
  const sh = new THREE.Shape()
  const D = 0.34, H = 0.24, w = 0.035
  sh.moveTo(0, 0)
  sh.lineTo(-D, 0)
  sh.quadraticCurveTo(-D - 0.01, -0.03, -D + 0.02, -0.045)
  sh.quadraticCurveTo(-w - 0.02, -0.06, -w, -H + 0.02)
  sh.quadraticCurveTo(-w * 0.4, -H - 0.02, 0, -H)
  sh.lineTo(0, 0)
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 })
  return g
})()
/** where the Ebisu sits, in the altar's frame (the shrine at the wall, scaled up, its middle bay's floor) */
const EBISU_AT: [number, number, number] = [0.29 + 1.25 * (-0.14 + 0.027), 1.25 * (0.015 + 0.045 + 0.04), 0]
/** a faint rainbow aura: a soft ring of the spectrum round a clear middle, fading out at its edge */
const AURA = canvasTex(128, 128, (g) => {
  // (a pale, warm glow ring, only a hint of colour round it (a faint, desaturated rainbow), broken up by grainy noise; painted per pixel, so a
  // repaint once the sign font loads gives the same picture)
  g.globalCompositeOperation = 'source-over'
  const img = g.createImageData(128, 128)
  const hash = (x: number, y: number) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return h - Math.floor(h)
  }
  const vnoise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = (x - 63.5) / 64, dy = (y - 63.5) / 64, r = Math.hypot(dx, dy)
    const ring = Math.exp(-(((r - 0.66) / 0.17) ** 2)) * (r < 1 ? 1 : 0)
    const n = 0.55 * vnoise(x / 9, y / 9) + 0.3 * vnoise(x / 4, y / 4) + 0.15 * hash(x, y)
    const hue = (Math.atan2(dy, dx) / (2 * Math.PI) + 0.5 + n * 0.3) * 6
    const rgb = [0, 2, 4].map((o) => Math.max(0, Math.min(1, Math.abs(((hue + o) % 6) - 3) - 1)))
    const i = (y * 128 + x) * 4
    for (let k = 0; k < 3; k++) img.data[i + k] = 255 * (0.86 * [1, 0.93, 0.78][k] + 0.14 * rgb[k])
    img.data[i + 3] = 255 * ring * Math.max(0, Math.min(1, (n - 0.3) * 1.8))
  }
  g.putImageData(img, 0, 0)
})
/** the cups and their stand set out from where they were worked out: where the owner put them in the edit panel (X −0.015), and back 0.02
 * toward the shrine's steps with the shallower table (TABLE_DEEP) */
const CUPS_SHIFT = 0.005
/** where the Ebisu's feet are, on his pedestal (the ring of light spreads out from there) */
// (where the shrine's back stands, ALTAR_D / 2, and the Ebisu brought back toward it with the shrine's shallower depth)
const EBISU_FEET: [number, number, number] = [0.29 + (0.145 - 0.29) * SHRINE_DEEP, 0.077, 0]
/** where the cups stand along the shelf's depth (the offering's light comes from there) */
const CUPS_FX = 0.29 - 0.375 + CUPS_SHIFT
/** the altar shelf's depth, out from the wall: the god at the back, raised, the censer before him */
/** the whole shrine area drawn a size larger, its back still against the wall */
const ALTAR_SCALE = 1.2
const ALTAR_D = 0.58
/** the offering table drawn shallower than it was modelled (ALTAR_D), its back still to the wall: the owner's, a little less deep (0.53);
 * what's on it brought back to fit, the cups, the flask, the oranges (a little smaller) and the sutra */
const TABLE_DEEP = 0.53 / ALTAR_D
/** where the flask stands, by the cups' stand (back 0.02 with them) */
const FLASK_X = -0.04
/** and its height: up over the beckoning cats' stand below it, by the door */
const ALTAR_Y = 1.42
/** how long the sake offered stands there, and the extra custom it brings (ms) */
const INCENSE_MS = 180000
/** the small shrine's offering table (blender/kamidana.py's KamiTable): three keyaki boards, a dark lip with a gold line inside it, gold front
 * corners, the arched apron below; in the altar's own frame (its top's surface at y = 0, its front at x = -D/2) */
function AltarTable() {
  return <group position-x={(ALTAR_D / 2) * (1 - TABLE_DEEP)} scale-x={TABLE_DEEP}><KamidanaModel part="table" /></group>
}
function Sutra() {
  return (
    <group position={[-0.105, 0.001, -0.34]} rotation-y={-Math.PI / 2}><KamidanaModel part="sutra" /></group>
  )
}
function Altar({ incense }: { incense?: { litAt: number | null; onLight: () => void } }) {
  // (the offering: one flask pours clear sake into the three cups in turn, the stream and the cups filling; then it's set back)
  const flaskRef = useRef<THREE.Group>(null)
  const flaskShadow = useRef<THREE.Group>(null)
  const streamRef = useRef<THREE.Mesh>(null)
  const liquid = useRef<(THREE.Mesh | null)[]>([null, null, null])
  // (the cups as they stand, moved by hand or not: the pour, the stream, the sake in them and the sparks all go where they are)
  const cupsRef = useRef<THREE.Group>(null)
  const cupsOff = useMemo(() => new THREE.Vector3(), [])
  // (the motes: while the offering stands, faint glowing ones drift up from the shrine)
  const burning = useRef(false)
  const motes = useRef<THREE.Points>(null)
  const moteMat = useRef<THREE.PointsMaterial>(null)
  const sparks = useRef<THREE.Points>(null)
  // (each mote its own: how fast it rises, round which way and how far it spirals, how it twinkles, when it starts, how big, its tint (gold,
  // a paler gold, nearly white, now and then a faint rose or sky), and a few large soft ones, as light out of focus)
  const moteRnd = useMemo(() => {
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const tints = [[1, 0.78, 0.4], [1, 0.86, 0.55], [1, 0.95, 0.82], [1, 0.82, 0.7], [0.85, 0.92, 1]]
    return Array.from({ length: MOTES }, (_, i) => ({ speed: 0.025 + rnd() * 0.045, turn: (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 1.4), r0: 0.01 + rnd() * 0.03,
      twF: 2 + rnd() * 7, phase: rnd() * 6.28, z0: (rnd() - 0.5) * 0.6, rise: 0.32 + rnd() * 0.2, x0: -0.09 + rnd() * 0.12, offset: rnd(), size: i < 6 ? 2.2 + rnd() : 0.4 + rnd(),
      tint: tints[Math.floor(rnd() * (rnd() < 0.85 ? 3 : 5))] }))
  }, [])
  const sparkRnd = useMemo(() => {
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: SPARKS }, () => ({ a: rnd() * Math.PI * 2, out: 0.12 + rnd() * 0.3, up: 0.05 + rnd() * 0.22, life: 0.9 + rnd() * 1.1, size: 0.5 + rnd() }))
  }, [])
  // (the Ebisu's stone, glowing, a soft halo and a faint rainbow aura round him while the offering stands)
  const gltfK = useGLTF(KAMIDANA_URL) as unknown as { scene: THREE.Group }
  const ebisuMats = useMemo(() => {
    const out = new Set<THREE.MeshToonMaterial>()
    kamidanaOf(gltfK.scene).ebisu.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // (its own copy, so nothing else in the stone glows with it)
      if (!m.userData.ownGlow) { m.material = (m.material as THREE.Material).clone(); m.userData.ownGlow = true }
      const mat = m.material as THREE.MeshToonMaterial
      if (mat.emissive) { mat.emissive.set('#ffc860'); out.add(mat) }
    })
    return [...out]
  }, [gltfK])
  const halo = useRef<THREE.Sprite>(null)
  const aura = useRef<THREE.Sprite>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ring2 = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.Sprite>(null)
  const lamp = useRef<THREE.PointLight>(null)
  const moteGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3))
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MOTES), 1))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(MOTES), 1))
    return g
  }, [])
  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(SPARKS), 1))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(SPARKS), 1))
    return g
  }, [])
  const sizes = moteGeo.attributes.size as THREE.BufferAttribute
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // (the motes: each rises from the shrine's base and fades as it goes, over about three seconds, swaying a little)
    if (moteMat.current) moteMat.current.opacity += ((BLESSING.on ? 0.9 : 0) - moteMat.current.opacity) * Math.min(1, dt * 1.5)
    if (motes.current && moteMat.current && moteMat.current.opacity > 0.01) {
      const pos = moteGeo.attributes.position as THREE.BufferAttribute
      const col = moteGeo.attributes.color as THREE.BufferAttribute
      for (let i = 0; i < MOTES; i++) {
        // (each spirals up round the shrine at its own pace and turn, swelling in, twinkling, thinning as it climbs, gone at the top)
        const m = moteRnd[i]
        const life = (t * m.speed + m.offset) % 1
        const ang = m.phase + life * m.turn * Math.PI * 2
        const rr = m.r0 * (0.6 + life * 0.8)
        // (out in front of the open doors, where they're seen, not inside the shrine's walls)
        // (slowly up the whole face of the shrine, from its base to above its roof, spread across its width, in front of it)
        pos.setXYZ(i, m.x0 + Math.cos(ang) * rr * 0.5, 0.03 + life * m.rise, m.z0 + Math.sin(ang) * rr)
        // (in quickly, held, out softly near the top: the shelf's group is scaled, so all this is in its own small units)
        const fade = THREE.MathUtils.smoothstep(life, 0, 0.12) * (1 - THREE.MathUtils.smoothstep(life, 0.55, 1))
        const tw = 0.65 + 0.35 * Math.sin(t * m.twF + m.phase) ** 2
        sizes.setX(i, 0.045 * m.size * (0.7 + 0.3 * tw) * (0.6 + fade * 0.4))
        // (its tint, and the fade and the twinkle in its transparency: it shows by day as well as by night)
        col.setXYZ(i, m.tint[0], m.tint[1], m.tint[2])
        ;(moteGeo.attributes.alpha as THREE.BufferAttribute).setX(i, fade * tw * (m.size > 2 ? 0.35 : 1))
      }
      sizes.needsUpdate = true
      pos.needsUpdate = true
      col.needsUpdate = true
      ;(moteGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true
    }
    // (offered, the sake stands in its cup for a minute and the shrine glows, then goes quiet; then another can be offered)
    const at = incense?.litAt ?? null
    const left = at === null ? 0 : Math.max(0, 1 - (performance.now() - at) / INCENSE_MS)
    const on = left > 0
    burning.current = on
    // (the blessing's strength: up as the pour ends, a pulse while it stands, down at its end; the doors open for it)
    const blessed = on && (performance.now() - (at ?? 0)) / 1000 > 3.6
    // (as it comes down: the bowl's ring and the little bells)
    if (blessed && !BLESSING.on) blessingChime()
    BLESSING.on = blessed
    BLESSING.k += ((BLESSING.on ? 1 : 0) - BLESSING.k) * Math.min(1, dt * 2.5)
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.4)
    // (the Ebisu: always a faint warm glow in the stone, much brighter while blessed)
    for (const m of ebisuMats) m.emissiveIntensity = 0.05 + 0.22 * BLESSING.k * pulse
    if (halo.current) {
      const hm = halo.current.material as THREE.SpriteMaterial
      hm.opacity = 0.1 + 0.25 * BLESSING.k * pulse
      halo.current.scale.setScalar(0.14 + 0.06 * BLESSING.k * pulse)
    }
    // (round him a faint rainbow aura, its colours turning slowly, breathing)
    if (aura.current) {
      const am = aura.current.material as THREE.SpriteMaterial
      am.opacity = 0.32 * BLESSING.k * (0.8 + 0.2 * Math.sin(t * 1.3))
      am.rotation = t * 0.35
      aura.current.scale.setScalar(0.19 + 0.015 * Math.sin(t * 1.1))
      aura.current.visible = BLESSING.k > 0.01
    }
    // (the moment the offering's taken: a flash of light up from the cups, sparks thrown out from it in arcs, and two soft rings of light, one
    // after the other, rippling out across the shelf, easing as they spread, turning a little, fading as they go)
    const since0 = on ? (performance.now() - (at ?? 0)) / 1000 - 3.6 : -1
    for (const [r, delay, dur, size, peak] of [[ring.current, 0, 1.8, 0.34, 0.95], [ring2.current, 0.3, 2.2, 0.26, 0.7]] as const) {
      if (!r) continue
      const q = (since0 - delay) / dur
      r.visible = q > 0 && q < 1
      if (r.visible) {
        r.scale.setScalar(0.08 + easeOut(q) * size)
        r.rotation.z = q * 0.6 * (delay ? -1 : 1)
        ;(r.material as THREE.MeshBasicMaterial).opacity = peak * Math.min(1, q * 8) * (1 - q) ** 1.6
      }
    }
    if (flash.current) {
      const q = since0 / 0.7
      flash.current.visible = q > 0 && q < 1
      if (flash.current.visible) {
        ;(flash.current.material as THREE.SpriteMaterial).opacity = 0.7 * Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q)
        flash.current.scale.setScalar(0.12 + 0.3 * easeOut(q))
      }
    }
    if (sparks.current) {
      const on2 = since0 > 0 && since0 < 2.4
      sparks.current.visible = on2
      if (on2) {
        const pos = sparkGeo.attributes.position as THREE.BufferAttribute
        const siz = sparkGeo.attributes.size as THREE.BufferAttribute
        const col = sparkGeo.attributes.color as THREE.BufferAttribute
        for (let i = 0; i < SPARKS; i++) {
          const sp = sparkRnd[i]
          const q = Math.min(1, since0 / sp.life)
          const o = easeOut(q) * sp.out
          // (out from the cups and up, then falling back a little, as thrown)
          pos.setXYZ(i, CUPS_FX + Math.cos(sp.a) * o * 0.5, 0.04 + sp.up * Math.sin(Math.PI * Math.min(1, q * 1.2)) * 0.8, Math.sin(sp.a) * o)
          siz.setX(i, 0.045 * sp.size * (1 - q * 0.6) * Math.min(1, (1 - q) * 3))
          col.setXYZ(i, 1, 0.82 + 0.15 * (1 - q), 0.42 + 0.4 * (1 - q))
          ;(sparkGeo.attributes.alpha as THREE.BufferAttribute).setX(i, Math.min(1, (1 - q) * 2.5))
        }
        pos.needsUpdate = true; siz.needsUpdate = true; col.needsUpdate = true
        ;(sparkGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true
      }
    }
    if (lamp.current) lamp.current.intensity = 0.3 * BLESSING.k * pulse
    // (pouring: a few seconds from the moment it's offered; the cups stay full while the offering stands)
    const since = at === null ? 99 : (performance.now() - at) / 1000
    // (how far the cups have been moved from where they were made to stand, in this frame: the middle cup's place as it is now)
    const host = streamRef.current?.parent
    if (cupsRef.current && host) {
      const w = cupsRef.current.localToWorld(new THREE.Vector3(-0.3, 0.03, 0))
      const l = host.worldToLocal(w)
      cupsOff.set(l.x - (ALTAR_D / 2 - 0.375 + CUPS_SHIFT), l.y - 0.03 * KAMI_SC, l.z)
    }
    const CUP_X = ALTAR_D / 2 - 0.375 + CUPS_SHIFT + cupsOff.x, CUP_TOP = 0.05 + cupsOff.y, POUR_Y = 0.085 + cupsOff.y
    const cupZ = [-0.1125, 0, 0.1125].map((z) => z + cupsOff.z)
    const rest = { x: FLASK_X, y: 0, z: 0.3 }
    const f = flaskRef.current
    // (one cup after another: 1.1 s each from 0.7 s in, the first quarter second gliding over from the last cup, tipped back a little so
    // nothing spills between, then pouring; all of it eased, nothing jumps)
    const GLIDE = 0.28, EACH = 1.1
    const tt = since - 0.7
    const which = on && tt >= 0 && tt < 3 * EACH ? Math.min(2, Math.floor(tt / EACH)) : on && tt >= 3 * EACH ? 2 : -1
    const inSeg = which >= 0 ? tt - which * EACH : 0
    // (the move to the last cup goes over the top: a little longer)
    const glideT = which === 2 ? 0.45 : GLIDE
    const glide = which > 0 ? THREE.MathUtils.smootherstep(inSeg, 0, glideT) : 1
    const pourK = which >= 0 && tt < 3 * EACH ? THREE.MathUtils.smoothstep(inSeg, which > 0 ? glideT : 0.05, (which > 0 ? glideT : 0.05) + 0.15) * (1 - THREE.MathUtils.smoothstep(inSeg, EACH - 0.12, EACH)) : 0
    // (lifted out and tipped in over the first 0.7 s, set back down over the last 0.6)
    const k = on && since < 4.6 ? THREE.MathUtils.smootherstep(since, 0, 0.7) * (1 - THREE.MathUtils.smootherstep(since, 4.0, 4.6)) : 0
    if (f) {
      // (it pours from beside each cup, on the side away from the oranges: the first two from the near side, the last from the far one,
      // lifted up over the cups to get there, turning upright on the way and tipping the other way)
      const side = (i: number) => (i === 2 ? 1 : -1)
      const zAt = (i: number) => cupZ[i] + side(i) * 0.1337
      const z = which <= 0 ? zAt(0) : THREE.MathUtils.lerp(zAt(which - 1), zAt(which), glide)
      const tipSide = which <= 0 ? -1 : THREE.MathUtils.lerp(side(which - 1), side(which), glide)
      const hop = which > 0 ? Math.sin(Math.PI * glide) * (side(which) !== side(which - 1) ? 0.16 : 0.025) : 0
      // (held well above the cups and their stand, and arcing up as it's lifted across, so it never passes through them or the oranges)
      const arc = Math.sin(Math.PI * k) * 0.06
      f.position.set(THREE.MathUtils.lerp(rest.x, CUP_X, k), THREE.MathUtils.lerp(rest.y, POUR_Y, k) + hop * k + arc, THREE.MathUtils.lerp(rest.z, z, k))
      f.rotation.x = -tipSide * (k * (0.85 + 0.25 * pourK) + Math.sin(since * 9) * 0.01 * pourK)
    }
    const sh = flaskShadow.current
    if (sh) {
      const lift = THREE.MathUtils.smoothstep(k, 0, 0.35)
      sh.scale.setScalar(1 + 0.6 * lift)
      sh.visible = lift < 0.99
      sh.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (m) m.opacity = 1 - lift })
    }
    const pouring = pourK > 0.01
    if (streamRef.current) {
      streamRef.current.visible = pouring
      if (pouring) {
        const z = cupZ[which]
        const a = POUR_Y + 0.068, b = CUP_TOP
        // (the stream thins in as it starts and out as it stops, wavering a little)
        streamRef.current.position.set(CUP_X, (a + b) / 2, z)
        streamRef.current.scale.set(pourK * (0.85 + 0.15 * Math.sin(since * 23)), a - b, pourK * (0.85 + 0.15 * Math.cos(since * 19)))
      }
    }
    for (let i = 0; i < 3; i++) {
      const m = liquid.current[i]
      if (!m) continue
      // (each cup fills as the stream is on it: 1.1 s each from 0.7 s in; what shows is the sake's surface, rising from the cup's floor and
      // always just inside its wall at that height (the cup's walls are solid, so the rest of it is hidden), never through it)
      const fill = !on ? 0 : THREE.MathUtils.smoothstep(since - 0.7 - i * 1.1, i ? 0.32 : 0.1, 1.0)
      m.visible = fill > 0
      const h = CUP_FLOOR + (CUP_FULL - CUP_FLOOR) * fill
      m.position.set(ALTAR_D / 2 - 0.375 + CUPS_SHIFT + cupsOff.x, KAMI_SC * (0.03 - 0.0125 + h) + cupsOff.y, [-0.1125, 0, 0.1125][i] + cupsOff.z)
      m.scale.setScalar(Math.max(0.0001, KAMI_SC * cupInnerR(h) * 0.96))
    }
  })
  const offer = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; incense?.onLight() }
  // (the shrine's front, in the altar's frame: its doors' plane, and the roof's)
  const SC = KAMI_SC
  // (the flask (blender/kamidana.py): clicked, it's lifted and pours the offering; a box round it to point at)
  const flask = (z: number, key: string) => (
    <group key={key} position={[0, 0, z]} onClick={offer} {...tipOver('御神酒', '點一下供清酒')}>
      <KamidanaModel part="flask" />
      <mesh position={[0, 0.075, 0]} visible={false}><boxGeometry args={[0.09, 0.16, 0.09]} /></mesh>
    </group>
  )
  return (
    <group>
      {/* the household shrine (神棚) on the shelf, up against the wall, a size larger than it hung up on a wall */}
      <Movable id="shrine" label="神龕"><group position-x={ALTAR_D / 2} scale={SC}>
        {/* (pointed at, the shrine is only named (it isn't clicked: no glow, the cursor as it is); its doors and the flask are what's worked) */}
        <group onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '神棚', hint: '供奉惠比壽；點御神酒供酒，點門開關' }) }}
          onPointerOut={() => setTip(null)}>
          <group scale-z={SHRINE_WIDE} scale-x={SHRINE_DEEP}><StaticBatch><Kamidana part="shrine" /></StaticBatch></group>
        </group>
        {/* (its doors, which open; the Ebisu inside, a piece of its own: brought back with the shallower shrine, he himself not squashed) */}
        <group scale-x={SHRINE_DEEP}><group position={[-0.14, 0.015, 0]}>
          <ShrineDoors />
          <Movable id="ebisu" label="惠比壽石像"><group scale-x={1 / SHRINE_DEEP} {...nameOnly('惠比壽石像', '七福神之一，保佑生意興隆、漁獲豐收')}><KamidanaModel part="ebisu" /></group></Movable>
        </group></group>
      </group></Movable>
      {/* (the vases and the cups beside it, each its own piece: not part of what's pointed at, they don't light with it; the vases not batched,
          a batch takes no clicks, and clicked they change their flowers) */}
      <Movable id="vase-1" label="花瓶（左）"><group position-x={ALTAR_D / 2} scale={SC}><Kamidana part="vase-1" /></group></Movable>
      <Movable id="vase1" label="花瓶（右）"><group position-x={ALTAR_D / 2} scale={SC}><Kamidana part="vase1" /></group></Movable>
      <Movable id="shrinecups" label="清酒杯與琉璃台"><group ref={cupsRef} position-x={ALTAR_D / 2 + CUPS_SHIFT} scale={SC} {...nameOnly('清酒杯', '供神的酒杯；點御神酒壺倒酒')}><StaticBatch><Kamidana part="cups" /></StaticBatch></group></Movable>
      <points ref={motes} geometry={moteGeo} frustumCulled={false} renderOrder={4}>
        <pointsMaterial ref={moteMat} map={STAR} vertexColors size={1} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} onBeforeCompile={pointsEach} />
      </points>
      {/* (the sparks thrown out from the cups as it's poured) */}
      <points ref={sparks} geometry={sparkGeo} frustumCulled={false} renderOrder={4} visible={false}>
        <pointsMaterial map={STAR} vertexColors size={1} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} onBeforeCompile={pointsEach} />
      </points>
      {/* (and the flash of light up from them) */}
      <sprite ref={flash} position={[CUPS_FX, 0.07, 0]} visible={false} renderOrder={5}>
        <spriteMaterial map={GLOW} color="#ffe39a" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>
      {/* (the Ebisu's halo, a faint glow always (hidden behind the shut doors), bright while blessed) */}
      <sprite ref={halo} position={[EBISU_AT[0] - 0.01, EBISU_AT[1], EBISU_AT[2]]} scale={0.16} renderOrder={4}>
        <spriteMaterial map={GLOW} color="#ffd27a" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* (a faint rainbow aura round him while blessed, its colours slowly turning) */}
      <sprite ref={aura} position={[EBISU_AT[0] - 0.012, EBISU_AT[1], EBISU_AT[2]]} scale={0.17} visible={false} renderOrder={5}>
        <spriteMaterial map={AURA} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* (the ripple of light spreading once from the cups as the offering's poured) */}
      {/* (and a ring of light spreading out across the table once from the shrine, as the offering's taken: as it first was) */}
      {/* (just over the shelf's top, so all of it shows on the shelf; gold drawn over, not only added, so it shows by day as well as by night) */}
      <mesh ref={ring} position={EBISU_FEET} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={RIPPLE} color="#ffc95a" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring2} position={[EBISU_FEET[0], EBISU_FEET[1] + 0.001, EBISU_FEET[2]]} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={RIPPLE} color="#fff0c0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={lamp} position={[EBISU_AT[0] - 0.06, EBISU_AT[1] + 0.02, EBISU_AT[2]]} color="#ffc070" intensity={0} distance={0.9} decay={2} />
      {/* the offering of sake (御神酒): a pair of white flasks either side of the oranges, and a flat cup before them that the
          sake's poured into: only the shrine itself is clicked, to make the offering */}
      <Movable id="sutra" label="經書"><group {...nameOnly('經書', '般若心經，供在神前')}><Sutra /></group></Movable>
      <Movable id="flask" label="御神酒壺"><group ref={flaskRef} position={[FLASK_X, 0, 0.3]}>{flask(0, 'f')}</group>
        {/* (its shadow stays on the stand where it stood: fading and spreading as it's lifted off, not carried up with it) */}
        <group ref={flaskShadow} position={[FLASK_X, 0, 0.3]}><ContactShadow r={0.055} /></group></Movable>
      {/* (the clear sake: a thin stream down into the cup, and the cups, each filling with it) */}
      <mesh ref={streamRef} visible={false}>
        <cylinderGeometry args={[0.0012, 0.0012, 1, 6]} /><meshBasicMaterial color="#e6f4ff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => { liquid.current[i] = m }} position={[ALTAR_D / 2 - 0.375 + CUPS_SHIFT, 0.035, [-0.1125, 0, 0.1125][i]]} rotation-x={-Math.PI / 2} visible={false}>
          <circleGeometry args={[1, 24]} /><meshBasicMaterial color="#e3f1fb" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
      {/* the oranges on their dish, a leaf on the top one */}
      {/* (in front of the cups' stand, a little smaller: where the owner set it in the edit panel (X −0.010, Z −0.203); brought back and made
          a touch smaller with the shallower table) */}
      <Movable id="oranges" label="橘子盤"><group name="look-oranges" position={[-0.176, 0, 0.002]} scale={0.76} {...nameOnly('椪柑', '供品，圓滿吉祥')}><KamidanaModel part="oranges" /><ContactShadow r={0.07} /></group></Movable>
    </group>
  )
}

/**
 * A drinks fridge: the downloaded "medium freezer" model (a tall glass-doored cabinet with three wire shelves), scaled to the
 * fridge's size and stood with its middle at the origin, its front toward +z, with the shop's sign over its glass. The model's
 * door is its own node: FridgeDoor swings it. Each fridge gets its own copy.
 */
const FREEZER_URL = import.meta.env.BASE_URL + 'models/medium_freezer.glb'
/** its size as modelled (0.866 wide, 2.24 tall, 0.774 deep), its middle and the door's hinge, and how it's scaled to the shop */
const FREEZER = { scale: 0.97, cx: 0.21, cz: 0.045, base: -0.013 }
const freezers = new Map<number, { body: THREE.Group; doorRoot: THREE.Group; door: THREE.Group }>()
function useFreezer(n: number) {
  const gltf = useGLTF(FREEZER_URL) as unknown as { scene: THREE.Group }
  return useMemo(() => {
    const hit = freezers.get(n)
    if (hit) return hit
    const root = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.Material>()
    const conv = (m: THREE.Material) => {
      let t = toon.get(m)
      if (!t) {
        const src = m as THREE.MeshStandardMaterial
        // (the glass clearer than the model has it, so the drinks show; the sign's light box keeps the model's own glow, brightened)
        const toonMat = new THREE.MeshToonMaterial({ color: src.color?.clone() ?? new THREE.Color('#ffffff'), map: src.map ?? null, transparent: src.transparent,
          opacity: src.transparent ? src.opacity * 0.4 : src.opacity, side: src.transparent ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !src.transparent })
        if (src.emissiveMap) {
          toonMat.emissive = new THREE.Color('#ffffff')
          toonMat.emissiveMap = src.emissiveMap
          toonMat.emissiveIntensity = 1.5
        }
        t = toonMat
        toon.set(m, t)
      }
      return t
    }
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material)
        // (the glass neither casts a shadow nor takes one: the door's pane, swung open, threw a solid one across the floor and the cabinet's
        // side, and shadows lay on the glass itself, hanging in the air)
        const glass = (Array.isArray(m.material) ? m.material : [m.material]).some((x) => x.transparent)
        m.castShadow = !glass
        m.receiveShadow = !glass
      }
    })
    inkModel(root, (m) => !!(m.material as THREE.Material).transparent)
    root.updateMatrixWorld(true)
    const door = root.getObjectByName('Door_6')
    const body = new THREE.Group()
    const pivot = new THREE.Group()
    if (door) {
      // (the door swings on its left edge: a pivot there, the door moved onto it without moving)
      const box = new THREE.Box3().setFromObject(door)
      pivot.position.set(box.min.x, 0, box.max.z)
      body.add(root)
      body.updateMatrixWorld(true)
      pivot.updateMatrixWorld(true)
      pivot.attach(door)
    } else body.add(root)
    // (stood in the shop: scaled, its middle at the origin, its base on the floor)
    const place = new THREE.Group()
    place.scale.setScalar(FREEZER.scale)
    place.position.set(-FREEZER.cx * FREEZER.scale, -FREEZER.base * FREEZER.scale, -FREEZER.cz * FREEZER.scale)
    place.add(body)
    // (the door's pivot stands in its own copy of the same placing, so the door sits on the cabinet when it's shut)
    const doorRoot = new THREE.Group()
    doorRoot.scale.copy(place.scale)
    doorRoot.position.copy(place.position)
    doorRoot.add(pivot)
    const out = { body: place, doorRoot, door: pivot }
    freezers.set(n, out)
    return out
  }, [gltf, n])
}
/** the soft wash of a cove light: white along the slot, fading to nothing across the wall */
const COVE_WASH = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 8
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 64, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.28)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 8)
  return new THREE.CanvasTexture(c)
})()
// (the fridge, its door and its stock each drawn again only when its own props change: with eighty-odd bottles apiece they were redrawn every
// time the room above them was, several times a second while the shop's open)
export const DrinkFridge = memo(DrinkFridgeImpl)
function DrinkFridgeImpl({ n = 0 }: { n?: number }) {
  const { W, H, D } = FRIDGE
  const { body } = useFreezer(n)
  return (
    <group>
      <primitive object={body} />
      {/* the cove lights (槽燈): a narrow slot let into each inner side, a thin line of white light deep in it, and
          the light washing softly along the wall, shelf and drinks beside it (up each side only) */}
      <StaticBatch>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (W / 2 - 0.075), H / 2 - 0.02, D / 2 - 0.1]}>
          <mesh><boxGeometry args={[0.03, H - 0.46, 0.03]} /><meshBasicMaterial color="#202226" /></mesh>
          <mesh position={[-sd * 0.0085, 0, 0.0155]}><boxGeometry args={[0.008, H - 0.5, 0.004]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
          <mesh position={[-sd * 0.014, 0, -0.17]} rotation-y={sd * Math.PI / 2}><planeGeometry args={[0.45, H - 0.46]} />
            <meshBasicMaterial map={COVE_WASH} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.75} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      </StaticBatch>
      {/* the lit sign standing on top of the cabinet: a slim dark box with the board on its front, slanted a little back */}
      <group position={[0, H + 0.03, D / 2 - 0.1]} rotation-x={-0.12}>
        {/* (its box and its twenty-one bulbs drawn as a few: they never move) */}
        <StaticBatch>
        <mesh position={[0, 0.1, -0.02]}><boxGeometry args={[W * 0.92, 0.2, 0.06]} /><meshToonMaterial color="#1c1d20" /></mesh>
        <mesh position={[0, 0.1, 0.0115]}><planeGeometry args={[W * 0.86, 0.17]} /><meshBasicMaterial color="#ffffff" map={FRIDGE_SIGNS[n]} toneMapped={false} /></mesh>
        {/* (a strip of light round the sign's edge: little bulbs in a row, warm white, and a glowing bar along its foot) */}
        {Array.from({ length: 13 }, (_, k) => (
          <mesh key={`t${k}`} position={[-W * 0.43 + (k * W * 0.86) / 12, 0.205, 0.012]}><sphereGeometry args={[0.009, 8, 6]} /><meshBasicMaterial color={k % 2 ? '#ffe9a8' : '#fff6d8'} toneMapped={false} /></mesh>
        ))}
        {[-1, 1].map((sd) => Array.from({ length: 4 }, (_, k) => (
          <mesh key={`s${sd}${k}`} position={[sd * W * 0.45, 0.04 + k * 0.045, 0.012]}><sphereGeometry args={[0.009, 8, 6]} /><meshBasicMaterial color="#ffe9a8" toneMapped={false} /></mesh>
        )))}
        </StaticBatch>
        <sprite position={[0, 0.1, 0.1]} scale={[W * 1.1, 0.4, 1]}><spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.22} /></sprite>
      </group>
    </group>
  )
}
/**
 * The fridge's door: a glass door in a dark frame, hinged on the fridge's left with a long handle on its right, swinging
 * open (out into the room) when someone's at the fridge or when it's clicked, and shutting after; while it's open the cold
 * pours out of it in a low white mist.
 */
export const FridgeDoor = memo(FridgeDoorImpl)
function FridgeDoorImpl({ n = 0 }: { n?: number }) {
  const { W, D } = FRIDGE
  const { door, doorRoot } = useFreezer(n)
  const open = useRef(0)
  const mist = useRef(0)
  // (the door's state lives outside React: leave it shut when the shop's let go, so it doesn't come back open)
  useEffect(() => () => { FRIDGE_STATE[n].open = false; FRIDGE_STATE[n].passing = 0 }, [n])
  useFrame((_, dt) => {
    const want = FRIDGE_STATE[n].passing > 0 || FRIDGE_STATE[n].open ? 1 : 0
    open.current += Math.sign(want - open.current) * Math.min(Math.abs(want - open.current), Math.min(dt, 0.1) * 2.2)
    const e = open.current * open.current * (3 - 2 * open.current)
    door.rotation.y = -e * (Math.PI / 2)
    mist.current = e
  })
  return (
    <group>
      {/* the model's own door, hung on its pivot (the glass and its frame), swung with the rest of the model's scale */}
      <group onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; FRIDGE_STATE[n].open = !FRIDGE_STATE[n].open }} {...tipOver('飲料櫃', '點一下開關門')}><primitive object={doorRoot} /></group>
      {/* the cold, pouring out over the open door's foot and rolling out over the floor (it was drawn as rising steam: the owner saw it
          was wrong) */}
      <group position={[0, 0, D / 2 + 0.02]}>
        <ColdMist width={W * 0.85} drop={0.4} reach={0.9} level={mist} />
      </group>
    </group>
  )
}
/**
 * A fridge's drinks, each in its place on its shelf (FRIDGE_STOCK): one tidy row to a shelf, every label to the door.
 * Customers empty places as they take their drinks, the shop puts one back every so often, and any drink can be dragged,
 * with the door open: to another place (an empty one, or swapping with the drink there), or right out onto the floor
 * before the fridge, and back in again later.
 */
export const FridgeStock = memo(FridgeStockImpl)
function FridgeStockImpl({ n = 0 }: { n?: number }) {
  const root = useRef<THREE.Group>(null)
  const { camera, gl, raycaster, scene } = useThree()
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  const [, setVer] = useState(0)
  const seen = useRef(-1)
  const objs = useRef(new Map<string, THREE.Group>())
  const dragKey = useRef<string | null>(null)
  // (the bottles on the shelves are drawn in one batch with the ranks behind them; each place is pointed at by an unseen stand-in, lit
  // round when the pointer's on it, and the bottle that's picked up drawn on its own while it's carried)
  const [lifted, setLifted] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const shelves = FRIDGE_UNITS[n].shelves
  const slotAt = (r: number, k: number) => new THREE.Vector3((k - (shelves[r].ids.length - 1) / 2) * shelves[r].pitch, shelves[r].y, 0.16)
  const doorOpen = () => FRIDGE_STATE[n].open || FRIDGE_STATE[n].passing > 0
  useFrame((_, dt) => {
    if (seen.current !== FRIDGE_STOCK.ver) {
      seen.current = FRIDGE_STOCK.ver
      setVer((v) => v + 1)
    }
    // (what's out: on the floor before the fridge, or set down on a table, upright, where it was put)
    const host = root.current
    if (host) {
      host.updateWorldMatrix(true, false)
      FRIDGE_STOCK.out.forEach((o, i) => {
        const g = objs.current.get(`o${i}`)
        if (!g || o.unit !== n || dragKey.current === `o${i}`) return
        if (o.w) {
          g.position.copy(host.worldToLocal(new THREE.Vector3(o.w[0], o.w[1], o.w[2])))
          g.quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()).invert())
        } else {
          // (let go in mid-air, it falls: gravity, and a small bounce on the floor)
          if (o.fy !== undefined) {
            o.fell = Math.max(o.fell ?? 0, o.fy)
            o.vy = (o.vy ?? 0) - 9.8 * Math.min(dt, 0.05)
            o.fy += o.vy * Math.min(dt, 0.05)
            if (o.fy <= 0) {
              o.fy = 0
              // (landing: a hard fall from high enough can't keep it upright, a tall bottle least of all: it tips over, and rolls)
              if (!o.tipped && o.vy < -2.2 && Math.random() < Math.min(0.95, (o.fell ?? 0) * 0.9 + 0.15)) { o.tipped = true; o.tip = 0; o.roll = 0 }
              if (o.vy < -0.8) o.vy = -o.vy * 0.25
              else { o.fy = undefined; o.vy = undefined; o.fell = 0 }
            }
          }
          if (o.tipped) {
            // (over on its side in about half a second, rolling a hand's width while it goes, slowing)
            const tip = Math.min(Math.PI / 2, (o.tip ?? 0) + dt * 4)
            o.tip = tip
            const roll = Math.min(0.22, (o.roll ?? 0) + dt * 0.5 * (1 - tip / (Math.PI / 2) + 0.15))
            o.roll = roll
            g.position.set(o.x + roll, (o.fy ?? 0) + (0.026 * Math.sin(tip)), o.z)
            g.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, -1), tip + roll * 2)
          } else {
            g.position.set(o.x, o.fy ?? 0, o.z)
            g.quaternion.identity()
          }
        }
      })
    }
    // (what's been taken is put back by the stocker, carried out from the back (GuestBar3D's stocker), not by itself)
  })
  type From = { kind: 'slot'; r: number; k: number } | { kind: 'out'; i: number }
  const begin = (from: From, ev: { stopPropagation: () => void }) => {
    // (edit mode is for the scene alone)
    if (getEdit().on) return
    // (a drink in the fridge only with its door open: the glass is in the way otherwise)
    if (from.kind === 'slot' && !doorOpen()) return
    ev.stopPropagation()
    if (from.kind === 'out') { const o = FRIDGE_STOCK.out[from.i]; if (o) { o.tipped = false; o.tip = 0; o.roll = 0 } }
    const key = from.kind === 'slot' ? `${from.r}-${from.k}` : `o${from.i}`
    const grp = objs.current.get(key)
    const host = root.current
    if (!grp || !host) return
    if (controls) controls.enabled = false
    document.body.classList.add('is-carrying')
    const plane = new THREE.Plane()
    const at = new THREE.Vector3()
    let onTable: THREE.Vector3 | null = null
    dragKey.current = key
    if (from.kind === 'slot') setLifted(key)
    const move = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera)
      host.updateWorldMatrix(true, false)
      const nrm = new THREE.Vector3(0, 0, 1).transformDirection(host.matrixWorld)
      plane.setFromNormalAndCoplanarPoint(nrm, host.localToWorld(new THREE.Vector3(0, 0.7, 0.2)))
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3())
      // (over a table, nearer than the fridge's own front, it goes down on the table, standing upright, wherever the pointer is)
      const th = tableHit(raycaster.ray)
      onTable = th && (!hit || th.distanceTo(raycaster.ray.origin) < hit.distanceTo(raycaster.ray.origin)) ? th : null
      if (onTable) {
        grp.position.copy(host.worldToLocal(onTable.clone()))
        grp.quaternion.copy(host.getWorldQuaternion(new THREE.Quaternion()).invert())
        return
      }
      grp.quaternion.identity()
      if (!hit) return
      at.copy(host.worldToLocal(hit))
      grp.position.set(THREE.MathUtils.clamp(at.x, -1.1, 1.1), THREE.MathUtils.clamp(at.y, 0.02, 1.62), 0.2)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('is-carrying')
      if (controls) controls.enabled = true
      dragKey.current = null
      setLifted(null)
      grp.quaternion.identity()
      if (onTable) {
        const w: [number, number, number] = [onTable.x, onTable.y, onTable.z]
        grp.position.set(0, 0, 0)
        if (from.kind === 'slot') pullOut(n, [from.r, from.k], 0, 0.5, w)
        else moveOut(from.i, w)
        // (set down near the boss: it's for him, and he comes over and drinks it)
        const boss = scene.getObjectByName('BossFollow')
        const item = from.kind === 'slot' ? FRIDGE_STOCK.out[FRIDGE_STOCK.out.length - 1] : FRIDGE_STOCK.out[from.i]
        if (boss && item && !BOSS_DRINK.at && boss.getWorldPosition(new THREE.Vector3()).setY(onTable.y).distanceTo(onTable) < 3) {
          BOSS_DRINK.at = onTable.clone(); BOSS_DRINK.id = item.id; BOSS_DRINK.item = item; BOSS_DRINK.arrived = false
        }
        return
      }
      const px = grp.position.x, py = grp.position.y
      const inside = Math.abs(px) < 0.4 && py > 0.1 && py < 1.62
      // (dropped on the nearest place within reach: moved or swapped; out past the fridge's sides or down to the floor, stood
      // on the floor; anywhere else, back where it was)
      let best: [number, number] | null = null
      let bestD = 0.1
      for (let rr = 0; rr < shelves.length; rr++) {
        for (let kk = 0; kk < shelves[rr].ids.length; kk++) {
          const sp = slotAt(rr, kk)
          const d = Math.hypot(sp.x - px, sp.y - py)
          if (d < bestD) {
            bestD = d
            best = [rr, kk]
          }
        }
      }
      const home = from.kind === 'slot' ? slotAt(from.r, from.k) : new THREE.Vector3(FRIDGE_STOCK.out[from.i].x, 0, FRIDGE_STOCK.out[from.i].z)
      grp.position.copy(home)
      if (inside && best) {
        if (from.kind === 'slot' && (best[0] !== from.r || best[1] !== from.k)) moveDrink(n, [from.r, from.k], best)
        else if (from.kind === 'out') putBack(from.i, n, best)
      } else if (!inside) {
        const x = THREE.MathUtils.clamp(px, -1.0, 1.0)
        const z = 0.5 + 0.13 * (FRIDGE_STOCK.out.filter((o) => o.unit === n).length % 3)
        let idx = from.kind === 'out' ? from.i : -1
        if (from.kind === 'slot') {
          pullOut(n, [from.r, from.k], x, z)
          idx = FRIDGE_STOCK.out.length - 1
        } else {
          FRIDGE_STOCK.out[from.i].x = x
          FRIDGE_STOCK.ver++
        }
        // (let go above the floor, it drops from there)
        const o = FRIDGE_STOCK.out[idx]
        if (o && py > 0.03) {
          o.fy = py
          o.vy = 0
          grp.position.set(o.x, py, o.z)
        }
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const reg = (key: string) => (g: THREE.Group | null) => { if (g) objs.current.set(key, g); else objs.current.delete(key) }
  return (
    <group ref={root}>
      {FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => id && (
        <group key={`${r}-${k}`} ref={reg(`${r}-${k}`)}
          position={slotAt(r, k).toArray()} onPointerDown={(ev) => begin({ kind: 'slot', r, k }, ev)}
          onPointerOver={(ev) => { ev.stopPropagation(); if (doorOpen()) { document.body.style.cursor = 'grab'; setHover(`${r}-${k}`) } setTip({ title: drinkName(id), hint: doorOpen() ? '拖出來，放到桌上或客人面前' : '先點櫃門打開' }) }}
          onPointerOut={() => { document.body.style.cursor = ''; setHover((h) => (h === `${r}-${k}` ? null : h)); setTip(null) }}>
          {/* (what the pointer finds: the bottle's size, unseen) */}
          <mesh position-y={0.11} visible={false}><boxGeometry args={[shelves[r].pitch * 0.9, 0.22, 0.06]} /></mesh>
          {lifted === `${r}-${k}` ? <DrinkBottle id={id} lit /> : hover === `${r}-${k}` && (
            <mesh position-y={0.11}><cylinderGeometry args={[0.036, 0.036, 0.25, 16, 1, true]} /><primitive object={BOTTLE_HALO} attach="material" /></mesh>
          )}
        </group>
      )))}
      {/* (the front bottles and the ranks behind each, packed shoulder to shoulder back to the fridge's back wall, as a shop's shelves are:
          one batch, redrawn as the stock changes (and without the one being carried); a hair of play in each so the rows aren't ruled) */}
      <StaticBatch key={`ranks${FRIDGE_STOCK.ver}-${lifted}`}>
        {FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => {
          if (!id) return null
          const sp = slotAt(r, k), step = shelves[r].pitch * 1.02
          const ranks = Math.max(1, Math.floor(RANK_DEPTH / step))
          return [...(lifted === `${r}-${k}` ? [] : [<group key={`f${r}-${k}`} position={sp.toArray()}><DrinkBottle id={id} lit /></group>]), ...Array.from({ length: ranks }, (_, j) => (
            <group key={`b${r}-${k}-${j}`} position={[sp.x + (((k * 7 + j * 3) % 5) - 2) * 0.003, sp.y, sp.z - step * (j + 1)]} rotation-y={((k + j) % 3 - 1) * 0.25}>
              <DrinkBottle id={id} lit />
            </group>
          ))]
        }))}
      </StaticBatch>
      {/* (what's been taken out, stood on the floor before the fridge) */}
      {FRIDGE_STOCK.out.map((o, i) => o.unit === n && (
        <group key={`o${i}-${o.id}`} ref={reg(`o${i}`)} position={[o.x, 0, o.z]} onPointerDown={(ev) => begin({ kind: 'out', i }, ev)}
          onPointerOver={(ev) => { document.body.style.cursor = 'grab'; glowOnly(ev.eventObject); setTip({ title: drinkName(o.id), hint: '拖曳移動，放回櫃子或遞給客人' }) }} onPointerOut={(ev) => { document.body.style.cursor = ''; glowLeave(ev.eventObject); setTip(null) }}>
          <DrinkBottle id={o.id} wet />
        </group>
      ))}
    </group>
  )
}
/** how far back behind the front rank the shelves are filled: one rank more behind each, enough for the shelf to read full through the
 * glass (all the way back it was six hundred bottles a fridge) */
const RANK_DEPTH = 0.12
/** the soft light round a bottle the pointer's on */
const BOTTLE_HALO = new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
/** a drink's name, for its tag */
const drinkName = (id: string) => DRINKS.find((d) => d.id === id)?.zh ?? '飲料'
/** a bottle of one of the drinks, standing (its foot at the origin): its glass or can, its label printed round it,
 * its neck and cap */
/** how much bigger each drink stands than it's modelled, to be the size it is in a shop (a 350 ml can is 12 cm tall) */
// (as sold: a 500 ml beer bottle 25 cm, a 300 ml sake 23 cm, a 2 l tea bottle 31 cm, ramune 18 cm, 350 ml cans 12.2 cm, 500 ml PET 20.5 cm,
// the 65 ml cultured milk 9 cm, a 200 ml milk bottle 13 cm)
const DRINK_SCALE: Record<DrinkId, number> = { beer: 1.2, sake: 1.12, oolong: 1.26, ramune: 1.06, beerCan: 1.36, highball: 1.36, coffee: 1.2, greenTea: 1.3,
  cola: 1.3, yakult: 1.12, sports: 1.3, milk: 1.1, chuhai: 1.36 }
/** (`lit`: standing in a fridge, in its cove lights' wash: lifted by a soft glow of its own, which can't leak out through the cabinet as a lamp's light would) */
/** (`wet`: out of the fridge, misted over with beads of condensation, a few run down) */
export const DrinkBottle = memo(DrinkBottleImpl)
function DrinkBottleImpl({ id, lit = false, wet = false }: { id: DrinkId; lit?: boolean; wet?: boolean }) {
  return <group scale={DRINK_SCALE[id]}><DrinkBottleRaw id={id} lit={lit} wet={wet} /></group>
}
/** each drink's look with a gentle glow, for those standing in a fridge */
const LIT_LOOK = new Map<DrinkId, { glass: THREE.Material; label: THREE.Material }>()
function litLook(id: DrinkId) {
  let l = LIT_LOOK.get(id)
  if (!l) {
    const base = BOTTLE_LOOK[id]
    const glass = base.glass.clone() as THREE.MeshToonMaterial
    glass.emissive = glass.color.clone()
    glass.emissiveIntensity = 0.32
    const label = base.label.clone() as THREE.MeshToonMaterial
    label.emissive = new THREE.Color('#ffffff')
    label.emissiveMap = label.map
    label.emissiveIntensity = 0.3
    l = { glass, label }
    LIT_LOOK.set(id, l)
  }
  return l
}
function DrinkBottleRaw({ id, lit = false, wet = false }: { id: DrinkId; lit?: boolean; wet?: boolean }) {
  const d = DRINKS.find((x) => x.id === id)!
  const look = lit ? litLook(id) : BOTTLE_LOOK[id]
  // (turned so its label's name faces +z)
  if (d.shape === 'can' && id !== 'cola' && id !== 'greenTea') return (
    // a can: printed all over, its silver top and rim
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.can} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canLabel} position-y={0.046} material={look.label} />
      {wet && <mesh geometry={BOTTLE_GEO.canLabel} position-y={0.046} material={DEW} scale={[1.012, 1, 1.012]} />}
      <mesh geometry={BOTTLE_GEO.canTop} position-y={0.0905} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canRim} position-y={0.09}><meshToonMaterial color="#aeb3b9" /></mesh>
      <mesh geometry={BOTTLE_GEO.canTab} position={[0, 0.0928, 0.002]}><meshToonMaterial color="#d8dce0" /></mesh>
    </group>
  )
  if (d.shape === 'small') return (
    // the little cultured milk bottle: waisted, a red foil top
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.small} position-y={0.036} material={look.label} />
      {wet && <mesh geometry={BOTTLE_GEO.small} position-y={0.036} material={DEW} scale={[1.02, 1, 1.02]} />}
      <mesh geometry={BOTTLE_GEO.smallTop} position-y={0.074}><meshToonMaterial color={d.cap} /></mesh>
    </group>
  )
  // the bottles proper, each shaped as it is in a shop: the beer's long neck, the sake's slim shoulder, the big tea bottle
  const shaped = id === 'beer' ? BOTTLE_SHAPE.beer : id === 'sake' ? BOTTLE_SHAPE.sake : id === 'oolong' ? BOTTLE_SHAPE.pet
    : id === 'cola' || id === 'greenTea' || id === 'sports' ? BOTTLE_SHAPE.pet500 : id === 'milk' ? BOTTLE_SHAPE.milk : null
  const drinkKey = id === 'beer' ? 'beer' : id === 'sake' ? 'sake' : id === 'oolong' ? 'pet' : id === 'milk' ? 'milk' : 'pet500'
  if (shaped) return (
    <group rotation-y={-Math.PI / 2}>
      {/* (the drink inside, seen through the glass or plastic: made before the bottle, so at the same depth it is drawn first and the bottle over it) */}
      <mesh geometry={BOTTLE_DRINK[drinkKey]} material={DRINK_FILL[id]} />
      <mesh geometry={shaped.body} material={look.glass} />
      {wet && <mesh geometry={shaped.body} material={DEW} scale={[1.006, 1, 1.006]} />}
      <mesh geometry={shaped.label} position-y={shaped.labelY} material={look.label} />
      <mesh geometry={shaped.cap} position-y={shaped.capY}><meshToonMaterial color={d.cap} /></mesh>
      {/* (the foil round the beer's neck, the sake's paper collar) */}
      {shaped.foil && <mesh geometry={shaped.foil} position-y={shaped.foilY}><meshToonMaterial color={id === 'beer' ? '#d4b04a' : '#f4efe2'} /></mesh>}
    </group>
  )
  // the ramune: its pale aqua glass, the fizzy drink in it, the glass marble held up in the neck's pinch, the blue plastic cap, a paper band
  return (
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.ramuneDrink} material={DRINK_FILL[id]} />
      <mesh geometry={BOTTLE_GEO.marble} position-y={0.1402} material={MARBLE} />
      <mesh geometry={BOTTLE_GEO.ramune} material={look.glass} />
      {wet && <mesh geometry={BOTTLE_GEO.ramune} material={DEW} scale={[1.006, 1, 1.006]} />}
      <mesh geometry={BOTTLE_GEO.ramuneLabel} position-y={0.055} material={look.label} />
      <mesh geometry={BOTTLE_GEO.ramuneCap} position-y={0.182}><meshToonMaterial color={d.cap} /></mesh>
    </group>
  )
}
/** a bottle turned from its profile: the points of (radius, height) from its foot up to its mouth */
// (16 round: a bottle a few centimetres across is round enough at that, and there are hundreds of them)
const bottleBody = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 16)
/** what's in a bottle: its inside (the profile drawn in by the glass's thickness) filled to `fill` of the way up, a flat top there */
function liquidOf(pts: [number, number][], fill: number) {
  const top = pts[pts.length - 1][1] * fill
  const out: [number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const [r, y] = pts[i]
    if (y <= top) { out.push([Math.max(0, r * 0.9), Math.max(0.002, y)]); continue }
    const [r0, y0] = pts[i - 1]
    out.push([(r0 + ((top - y0) / (y - y0)) * (r - r0)) * 0.9, top])
    break
  }
  out.push([0, top])
  return bottleBody(out)
}
/** a screw cap: a short cylinder, its side finely ribbed for the fingers */
function ribbedCap(r: number, h: number) {
  const g = new THREE.CylinderGeometry(r, r, h, 24, 1)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z)
    if (d < r * 0.99) continue
    const a = Math.atan2(z, x), k = 1 + 0.04 * (Math.cos(a * 12) > 0 ? 1 : 0)
    pos.setX(i, x * k); pos.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}
/** the ramune bottle's profile: a round body, its shoulder drawn in to the neck's pinch, the chamber the marble rolls in, a second pinch
 * that holds it up against the mouth, and the mouth */
const RAMUNE_PTS: [number, number][] = [[0, 0], [0.021, 0], [0.0245, 0.004], [0.025, 0.012], [0.025, 0.085], [0.023, 0.1], [0.017, 0.114],
  [0.0115, 0.122], [0.0108, 0.128], [0.0148, 0.138], [0.0152, 0.146], [0.0115, 0.154], [0.0098, 0.16], [0.0115, 0.172], [0.0122, 0.178], [0, 0.178]]
const BOTTLE_SHAPE = {
  // a brown long-necked beer bottle, a gold foil at its neck
  beer: { body: bottleBody([[0, 0], [0.024, 0], [0.0275, 0.005], [0.0275, 0.12], [0.0235, 0.145], [0.0145, 0.17], [0.0125, 0.2],
    [0.0135, 0.206], [0.0135, 0.21], [0, 0.21]]), label: new THREE.CylinderGeometry(0.0282, 0.0282, 0.07, 16, 1, true), labelY: 0.065,
    cap: new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 24), capY: 0.213, foil: new THREE.CylinderGeometry(0.0138, 0.0155, 0.04, 9), foilY: 0.18 },
  // the glass milk bottle: a wide mouth, a paper cap pressed down over it, a paper label round its middle
  milk: { body: bottleBody([[0, 0], [0.02, 0], [0.0225, 0.005], [0.0225, 0.085], [0.02, 0.098], [0.0175, 0.106], [0.0175, 0.118], [0, 0.118]]),
    label: new THREE.CylinderGeometry(0.0228, 0.0228, 0.06, 16, 1, true), labelY: 0.05,
    cap: new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 9), capY: 0.121, foil: new THREE.CylinderGeometry(0.0182, 0.0188, 0.014, 9) as THREE.BufferGeometry | null, foilY: 0.112 },
  // the 500 ml plastic bottle: a ribbed foot, a label round its middle, a coloured cap
  pet500: { body: bottleBody([[0, 0], [0.019, 0], [0.0235, 0.006], [0.0235, 0.1], [0.021, 0.125], [0.0135, 0.145], [0.0105, 0.152],
    [0.0105, 0.158], [0, 0.158]]), label: new THREE.CylinderGeometry(0.0238, 0.0238, 0.075, 16, 1, true), labelY: 0.07,
    cap: ribbedCap(0.0118, 0.012), capY: 0.164, foil: null as THREE.BufferGeometry | null, foilY: 0 },
  // a clear slim sake bottle with a round shoulder, a paper collar under the red cap
  sake: { body: bottleBody([[0, 0], [0.022, 0], [0.0245, 0.004], [0.0245, 0.12], [0.0225, 0.15], [0.014, 0.178], [0.0105, 0.2],
    [0.0115, 0.206], [0, 0.206]]), label: new THREE.CylinderGeometry(0.0249, 0.0249, 0.085, 16, 1, true), labelY: 0.07,
    cap: ribbedCap(0.0125, 0.014), capY: 0.21, foil: new THREE.CylinderGeometry(0.0112, 0.0125, 0.012, 9), foilY: 0.196 },
  // the big plastic tea bottle: wide, a ribbed foot, a green label round its middle
  pet: { body: bottleBody([[0, 0], [0.026, 0], [0.032, 0.008], [0.032, 0.012], [0.0305, 0.02], [0.032, 0.028], [0.032, 0.17],
    [0.028, 0.2], [0.017, 0.225], [0.0135, 0.236], [0.0135, 0.246], [0, 0.246]]), label: new THREE.CylinderGeometry(0.0326, 0.0326, 0.1, 16, 1, true),
    labelY: 0.1, cap: ribbedCap(0.0145, 0.014), capY: 0.252, foil: null as THREE.BufferGeometry | null, foilY: 0 },
}
/** what's in each shaped bottle, and how full: the tea and the sports drink near the top, the sake a little lower, the milk to the neck */
const BOTTLE_DRINK = {
  beer: liquidOf([[0, 0], [0.024, 0], [0.0275, 0.005], [0.0275, 0.12], [0.0235, 0.145], [0.0145, 0.17], [0.0125, 0.2], [0, 0.21]], 0.8),
  milk: liquidOf([[0, 0], [0.02, 0], [0.0225, 0.005], [0.0225, 0.085], [0.02, 0.098], [0.0175, 0.106], [0, 0.118]], 0.86),
  pet500: liquidOf([[0, 0], [0.019, 0], [0.0235, 0.006], [0.0235, 0.1], [0.021, 0.125], [0.0135, 0.145], [0.0105, 0.152], [0, 0.158]], 0.9),
  sake: liquidOf([[0, 0], [0.022, 0], [0.0245, 0.004], [0.0245, 0.12], [0.0225, 0.15], [0.014, 0.178], [0.0105, 0.2], [0, 0.206]], 0.8),
  pet: liquidOf([[0, 0], [0.026, 0], [0.032, 0.008], [0.032, 0.17], [0.028, 0.2], [0.017, 0.225], [0.0135, 0.236], [0, 0.246]], 0.88),
}
const BOTTLE_GEO = {
  body: new THREE.CylinderGeometry(0.026, 0.028, 0.13, 9),
  label: new THREE.CylinderGeometry(0.0285, 0.0295, 0.06, 9, 1, true),
  neck: new THREE.CylinderGeometry(0.012, 0.026, 0.04, 8),
  cap: new THREE.CylinderGeometry(0.013, 0.013, 0.01, 8),
  can: bottleBody([[0, 0], [0.0168, 0], [0.0198, 0.004], [0.0212, 0.011], [0.0212, 0.078], [0.0202, 0.084], [0.0184, 0.0885], [0.0178, 0.09], [0, 0.09]]),
  canLabel: new THREE.CylinderGeometry(0.0215, 0.0215, 0.07, 16, 1, true),
  canTop: new THREE.CylinderGeometry(0.0172, 0.0178, 0.004, 16),
  canTab: new THREE.CylinderGeometry(0.0062, 0.0062, 0.0014, 8),
  canRim: new THREE.CylinderGeometry(0.0182, 0.0182, 0.0026, 16, 1, true),
  small: new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.02], [0.013, 0.036], [0.016, 0.056], [0.015, 0.072], [0, 0.072]]
    .map(([x, y]) => new THREE.Vector2(x, y - 0.036)), 28),
  smallTop: new THREE.CylinderGeometry(0.0155, 0.0155, 0.004, 28),
  // the ramune bottle: its glass, the drink in it, the marble held up in its neck, its blue cap, a paper band round its shoulder
  ramune: bottleBody(RAMUNE_PTS),
  ramuneDrink: liquidOf(RAMUNE_PTS, 0.62),
  marble: new THREE.SphereGeometry(0.0108, 20, 14),
  ramuneCap: new THREE.CylinderGeometry(0.0128, 0.0135, 0.014, 28),
  ramuneLabel: new THREE.CylinderGeometry(0.0252, 0.0252, 0.05, 16, 1, true),
}
/**
 * Each drink's label, drawn round it twice (it reads from either side), in the manner of what's on a Japanese shop's shelf (no maker's
 * marks): the beer can's gold with a big 生, the highball's navy and amber, the coffee can's dark brown with a steaming cup, the green
 * tea's brushed 緑茶 over leaves, the oolong's amber, the sports drink's blue and white split, the milk's blue lettering, the lemon chuhai's
 * frosted silver and a lemon slice, the sake's washi label and red seal, the ramune's blue and its marble.
 */
const LABEL_W = 512, LABEL_H = 256
function drawLabel(g: CanvasRenderingContext2D, id: DrinkId, lbl: readonly string[]) {
  const W = LABEL_W, H = LABEL_H
  // (a glass bottle's label printed once, on its front: its back shows through the glass, and twice it would read through itself)
  const once = id === 'sake' || id === 'ramune' || id === 'milk' || id === 'beer'
  const face = (draw: (cx: number) => void) => { for (const cx of once ? [W * 0.25] : [W * 0.25, W * 0.75]) { g.save(); draw(cx); g.restore() } }
  const vtext = (text: string, cx: number, cy: number, size: number, fill: string) => {
    const chars = [...text]
    g.font = `900 ${size}px "Zen Antique", "Noto Serif TC", serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    chars.forEach((ch, k) => { g.fillStyle = fill; g.fillText(ch, cx, cy + (k - (chars.length - 1) / 2) * size * 0.95) })
  }
  const htext = (text: string, cx: number, cy: number, size: number, fill: string, font = '"Arial Black", "Helvetica Neue", sans-serif', weight = 900) => {
    g.font = `${weight} ${size}px ${font}`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillStyle = fill; g.fillText(text, cx, cy)
  }
  const grad = (stops: [number, string][]) => {
    const gr = g.createLinearGradient(0, 0, 0, H)
    for (const [t, c] of stops) gr.addColorStop(t, c)
    return gr
  }
  const JP = '"Zen Antique", serif'
  switch (id) {
    case 'beerCan': {
      g.fillStyle = grad([[0, '#f4e3a0'], [0.5, '#d9b24a'], [1, '#a8822a']]); g.fillRect(0, 0, W, H)
      g.fillStyle = '#f6f1e2'; g.fillRect(0, H * 0.08, W, H * 0.06); g.fillRect(0, H * 0.86, W, H * 0.05)
      face((cx) => {
        g.fillStyle = '#b8201c'; g.beginPath(); g.arc(cx, H * 0.45, 46, 0, Math.PI * 2); g.fill()
        g.strokeStyle = '#f6e7b0'; g.lineWidth = 3; g.beginPath(); g.arc(cx, H * 0.45, 52, 0, Math.PI * 2); g.stroke()
        htext('生', cx, H * 0.46, 64, '#fff8e8', JP)
        htext('BEER', cx, H * 0.74, 26, '#5a1a10')
        g.fillStyle = '#7a4a12'
        for (const sd of [-1, 1]) for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + sd * 76, H * 0.32 + k * 13, 5, 9, sd * 0.5, 0, Math.PI * 2); g.fill() }
      })
      break
    }
    case 'beer': {
      g.fillStyle = '#f2e8c8'; g.fillRect(0, 0, W, H)
      face((cx) => {
        g.fillStyle = '#b8201c'; g.beginPath(); g.ellipse(cx, H / 2, 100, 88, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#f6efd6'; g.beginPath(); g.ellipse(cx, H / 2, 90, 78, 0, 0, Math.PI * 2); g.fill()
        htext('生', cx, H * 0.46, 76, '#b8201c', JP)
        htext('LAGER', cx, H * 0.78, 20, '#5a1a10')
      })
      break
    }
    case 'highball': {
      g.fillStyle = grad([[0, '#0f1a34'], [1, '#1c2a52']]); g.fillRect(0, 0, W, H)
      g.fillStyle = '#d88a2a'; g.fillRect(0, H * 0.58, W, H * 0.16)
      face((cx) => {
        vtext('ハイボール', cx - 40, H * 0.4, 30, '#f2d27a')
        htext('WHISKY', cx + 34, H * 0.3, 22, '#f2d27a')
        htext('& SODA', cx + 34, H * 0.42, 18, '#d8e0f0')
        g.fillStyle = 'rgba(255,255,255,0.7)'
        for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(cx + 10 + (k * 23) % 60, H * 0.6 + (k * 37) % 30, 2 + (k % 3), 0, Math.PI * 2); g.fill() }
        htext('ALC.7%', cx + 34, H * 0.85, 16, '#d8e0f0')
      })
      break
    }
    case 'coffee': {
      g.fillStyle = grad([[0, '#3a2012'], [1, '#1c0e06']]); g.fillRect(0, 0, W, H)
      g.fillStyle = '#c89a4a'; g.fillRect(0, H * 0.14, W, 4); g.fillRect(0, H * 0.84, W, 4)
      face((cx) => {
        g.fillStyle = '#f2e6cc'; g.beginPath(); g.moveTo(cx - 30, H * 0.42); g.lineTo(cx + 30, H * 0.42); g.lineTo(cx + 22, H * 0.62); g.lineTo(cx - 22, H * 0.62); g.closePath(); g.fill()
        g.strokeStyle = '#f2e6cc'; g.lineWidth = 5; g.beginPath(); g.arc(cx + 32, H * 0.5, 9, -1.4, 1.4); g.stroke()
        g.strokeStyle = 'rgba(242,230,204,0.7)'; g.lineWidth = 3
        for (const dx of [-12, 0, 12]) { g.beginPath(); g.moveTo(cx + dx, H * 0.38); g.bezierCurveTo(cx + dx - 8, H * 0.32, cx + dx + 8, H * 0.28, cx + dx, H * 0.22); g.stroke() }
        htext('COFFEE', cx, H * 0.74, 28, '#e8c27a')
        g.fillStyle = '#c4302a'; g.beginPath(); g.arc(cx + 70, H * 0.3, 20, 0, Math.PI * 2); g.fill()
        htext('微糖', cx + 70, H * 0.3, 16, '#fff', JP)
      })
      break
    }
    case 'greenTea': {
      g.fillStyle = grad([[0, '#f6f8ee'], [0.6, '#dfecc8'], [1, '#9cc070']]); g.fillRect(0, 0, W, H)
      face((cx) => {
        g.fillStyle = 'rgba(74,138,58,0.35)'
        for (let k = 0; k < 5; k++) { g.save(); g.translate(cx + 40, H * 0.3 + k * 32); g.rotate(-0.6 + k * 0.3); g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); g.fill(); g.restore() }
        vtext('緑茶', cx - 20, H * 0.48, 66, '#1f4a22')
        g.fillStyle = '#c4302a'; g.fillRect(cx + 46, H * 0.72, 30, 30)
        htext('濃', cx + 61, H * 0.72 + 16, 20, '#fff', JP)
      })
      break
    }
    case 'cola': {
      g.fillStyle = '#b8161a'; g.fillRect(0, 0, W, H)
      g.strokeStyle = '#ffffff'; g.lineWidth = 10
      g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * 0.62 + Math.sin(x / 40) * 16; if (x) g.lineTo(x, y); else g.moveTo(x, y) } g.stroke()
      face((cx) => { htext('コーラ', cx, H * 0.36, 52, '#ffffff', JP); htext('COLA', cx, H * 0.82, 22, '#ffd8d0') })
      break
    }
    case 'oolong': {
      g.fillStyle = grad([[0, '#c87a2a'], [1, '#6a3410']]); g.fillRect(0, 0, W, H)
      g.strokeStyle = 'rgba(240,200,120,0.6)'; g.lineWidth = 3
      for (let k = 0; k < 6; k++) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = H * 0.2 + k * 34 + Math.sin(x / 30 + k) * 8; if (x) g.lineTo(x, y); else g.moveTo(x, y) } g.stroke() }
      face((cx) => { g.fillStyle = 'rgba(40,16,4,0.55)'; g.fillRect(cx - 44, H * 0.1, 88, H * 0.8); vtext('烏龍茶', cx, H * 0.5, 54, '#f6e2b0') })
      break
    }
    case 'sports': {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H)
      g.fillStyle = '#1f5fb8'
      g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.55); for (let x = 0; x <= W; x += 16) g.lineTo(x, H * 0.55 - Math.sin((x / W) * Math.PI * 4) * 30 - x * 0.05); g.lineTo(W, H); g.closePath(); g.fill()
      face((cx) => { htext('SPORTS', cx, H * 0.24, 34, '#1f5fb8'); htext('DRINK', cx, H * 0.4, 26, '#1f5fb8'); htext('イオン', cx, H * 0.78, 30, '#ffffff', JP) })
      break
    }
    case 'milk': {
      g.fillStyle = '#fbf8ee'; g.fillRect(0, 0, W, H)
      g.fillStyle = '#2a5aa8'; g.fillRect(0, 0, W, H * 0.12); g.fillRect(0, H * 0.88, W, H * 0.12)
      face((cx) => {
        g.fillStyle = 'rgba(42,90,168,0.85)'
        for (const [dx, dy, r] of [[-60, -30, 12], [62, 20, 16], [-50, 46, 9], [40, -48, 10]]) { g.beginPath(); g.ellipse(cx + dx, H / 2 + dy, r * 1.3, r, 0.4, 0, Math.PI * 2); g.fill() }
        vtext('牛乳', cx, H * 0.5, 62, '#2a5aa8')
        htext('成分無調整', cx, H * 0.94, 16, '#ffffff', JP, 400)
      })
      break
    }
    case 'chuhai': {
      g.fillStyle = grad([[0, '#eef2f4'], [0.5, '#c8d0d6'], [1, '#e8eef2']]); g.fillRect(0, 0, W, H)
      g.fillStyle = 'rgba(255,255,255,0.8)'
      for (let k = 0; k < 160; k++) g.fillRect((k * 97) % W, (k * 61) % H, 2, 2)
      face((cx) => {
        g.fillStyle = '#f6d23a'; g.beginPath(); g.arc(cx + 30, H * 0.45, 40, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(cx + 30, H * 0.45, 32, 0, Math.PI * 2); g.fill()
        g.strokeStyle = '#f6d23a'; g.lineWidth = 3
        for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(cx + 30, H * 0.45); g.lineTo(cx + 30 + Math.cos(k * 0.785) * 32, H * 0.45 + Math.sin(k * 0.785) * 32); g.stroke() }
        vtext('レモン', cx - 50, H * 0.45, 30, '#1c3a7a')
        htext('チューハイ', cx, H * 0.82, 22, '#1c3a7a', JP)
      })
      break
    }
    case 'sake': {
      g.fillStyle = '#f4efe0'; g.fillRect(0, 0, W, H)
      g.fillStyle = 'rgba(160,130,80,0.15)'
      for (let k = 0; k < 90; k++) g.fillRect((k * 89) % W, (k * 53) % H, 14, 1)
      face((cx) => {
        vtext('清酒', cx, H * 0.46, 70, '#1a1410')
        g.fillStyle = '#b8261c'; g.fillRect(cx + 44, H * 0.12, 26, 40)
        vtext('特撰', cx + 57, H * 0.12 + 20, 15, '#fff2e0')
      })
      break
    }
    case 'ramune': {
      g.fillStyle = '#2a6ab0'; g.fillRect(0, 0, W, H)
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 6
      for (let x = -H; x < W; x += 30) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke() }
      face((cx) => {
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx, H / 2, 70, 50, 0, 0, Math.PI * 2); g.fill()
        htext('ラムネ', cx, H * 0.48, 40, '#2a6ab0', JP)
      })
      break
    }
    case 'yakult': {
      g.fillStyle = '#f8f2e4'; g.fillRect(0, 0, W, H)
      g.fillStyle = '#d42a24'; g.fillRect(0, H * 0.3, W, H * 0.4)
      face((cx) => htext('乳酸菌', cx, H / 2, 46, '#ffffff', JP))
      break
    }
    default: {
      g.fillStyle = lbl[0]; g.fillRect(0, 0, W, H)
      face((cx) => htext(lbl[2], cx, H / 2, 40, lbl[1], JP))
    }
  }
}
/** what each drink's made of: aluminium cans, glass bottles, PET bottles, the little cultured milk bottle */
const KIND_OF: Record<DrinkId, 'can' | 'glass' | 'pet' | 'small'> = { beer: 'glass', sake: 'glass', oolong: 'pet', ramune: 'glass', beerCan: 'can', highball: 'can',
  coffee: 'can', greenTea: 'pet', cola: 'pet', yakult: 'small', sports: 'pet', milk: 'glass', chuhai: 'can' }
const BOTTLE_LOOK = Object.fromEntries(DRINKS.map((d) => {
  const tex = canvasTex(LABEL_W, LABEL_H, (g) => drawLabel(g, d.id, d.label))
  if (tex) tex.anisotropy = 4
  const kind = KIND_OF[d.id]
  // (a can is printed on bare aluminium: its body and lid polished metal; glass and plastic glossy and see-through)
  // (the glass itself: the beer's brown, the ramune's pale aqua, the rest clear; the PET clear and thinner; the drink is its own mesh inside)
  const glassTint = d.id === 'beer' ? '#5a3010' : d.id === 'ramune' ? '#a8dcea' : '#eef4f2'
  const glass = kind === 'can'
    ? new THREE.MeshStandardMaterial({ color: '#d4d8dc', metalness: 0.9, roughness: 0.25 })
    : kind === 'glass'
      ? new THREE.MeshPhysicalMaterial({ color: glassTint, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true,
        opacity: d.id === 'beer' ? 0.88 : 0.28, specularIntensity: 1, depthWrite: false })
      : kind === 'pet'
        ? new THREE.MeshPhysicalMaterial({ color: '#f2f6f8', roughness: 0.08, clearcoat: 0.9, clearcoatRoughness: 0.06, transparent: true, opacity: 0.22, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.4 })
  const label = kind === 'can'
    ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, metalness: 0.55, roughness: 0.28 })
    : new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tex, roughness: d.id === 'sake' ? 0.8 : 0.3, clearcoat: d.id === 'sake' ? 0 : 0.6 })
  reflectStudio(glass as THREE.MeshStandardMaterial, label as THREE.MeshStandardMaterial)
  return [d.id, { glass, label }]
})) as unknown as Record<DrinkId, { glass: THREE.Material; label: THREE.Material }>
/** the drink in each bottle: its own colour, a little see-through (the milk not at all), lit a touch from within so it glows in the fridge */
const DRINK_FILL = Object.fromEntries(DRINKS.map((d) => [d.id, new THREE.MeshPhysicalMaterial({ color: d.id === 'ramune' ? '#dff4fa' : d.id === 'sake' ? '#f6f2de' : d.color,
  roughness: 0.15, transparent: d.id !== 'milk', opacity: d.id === 'milk' ? 1 : d.id === 'ramune' || d.id === 'sake' || d.id === 'sports' ? 0.45 : 0.85,
  emissive: d.color, emissiveIntensity: 0.12, depthWrite: d.id === 'milk' })])) as unknown as Record<DrinkId, THREE.Material>
/** the ramune's marble: clear glass catching the light */
const MARBLE = new THREE.MeshPhysicalMaterial({ color: '#e8f6fa', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55, specularIntensity: 1 })
/** dew on a cold bottle: little beads of water scattered over it, a few running down (a picture of them, laid over the glass) */
const DEW = (() => {
  const t = canvasTex(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256)
    let seed = 13
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 420; k++) {
      const x = rnd() * 256, y = rnd() * 256, r = 0.6 + rnd() * rnd() * 3.2
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(230,245,255,0.35)'); gr.addColorStop(1, 'rgba(200,230,255,0)')
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
    // (a few that have run down, leaving a trail)
    for (let k = 0; k < 9; k++) {
      const x = rnd() * 256, y = rnd() * 120, l = 40 + rnd() * 90
      g.strokeStyle = 'rgba(235,248,255,0.4)'; g.lineWidth = 1.6
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 2, y + l / 3, x - 2, y + (l * 2) / 3, x + 1, y + l); g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(x + 1, y + l, 2.4, 0, Math.PI * 2); g.fill()
    }
  })
  if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1) }
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85 })
})()
/** each fridge's sign: 飲料 · ドリンク, white on red; 酒類 · お酒, on indigo */
const FRIDGE_SIGNS = FRIDGE_UNITS.map((u, n) => canvasTex(192, 48, (g) => {
  g.fillStyle = n ? '#1c2a4a' : '#b8261c'
  g.fillRect(0, 0, 192, 48)
  g.strokeStyle = n ? 'rgba(232,196,90,0.8)' : 'rgba(255,230,160,0.7)'
  g.lineWidth = 1.4
  g.strokeRect(4, 4, 184, 40)
  brushText(g, `${u.sign[0]} · ${u.sign[1]}`, 96, 25, 26, { fill: '#fff6e0', edge: n ? '#0a1020' : '#7a0e0a', shadow: 'rgba(0,0,0,0.5)', shine: '#ffffff', spacing: 1 })
}))

const PROP_GEO = {
  barrel: new THREE.CylinderGeometry(0.2, 0.2, 0.42, 24, 1, true),
  barrelTop: new THREE.CircleGeometry(0.2, 24),
  rope: new THREE.TorusGeometry(0.203, 0.012, 5, 28),
  pot: new THREE.CylinderGeometry(0.15, 0.12, 0.26, 16),
  stalk: new THREE.CylinderGeometry(0.014, 0.017, 1, 6),
  leaf: new THREE.ConeGeometry(0.035, 0.2, 4),
  crate: new THREE.BoxGeometry(0.3, 0.2, 0.24),
  tallPot: new THREE.CylinderGeometry(0.13, 0.1, 0.34, 16),
  bottle: new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8),
}
function Inked({ geometry, color, map, grow = 1.04, side, ...rest }: { geometry: THREE.BufferGeometry; color: string; map?: THREE.Texture | null
  grow?: number; side?: THREE.Side } & Record<string, unknown>) {
  return (
    <group {...rest}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshToonMaterial color={color} map={map ?? null} side={side ?? THREE.FrontSide} />
      </mesh>
      <mesh geometry={geometry} scale={grow}>
        <meshBasicMaterial color={INK} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}
const BARRELS_URL = import.meta.env.BASE_URL + 'models/komodaru.glb'
/** a stack of straw-wrapped sake barrels (菰樽, blender/komodaru.py: two on the floor, one on them), toon-shaded and inked, stood on the
 * floor, ~1.1 tall; `part` turns each stack its own way so two never look alike */
function SakeStack({ part }: { part: number }) {
  const gltf = useGLTF(BARRELS_URL) as unknown as { scene: THREE.Group }
  const stack = useMemo(() => {
    const root = gltf.scene.clone(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      m.material = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
      m.castShadow = true
      m.receiveShadow = true
    })
    // (no ink round the straw's frayed ends over the lids: a line round every blade drew a black zigzag along each rim)
    inkModel(root, (m) => /Ink|Red|Label|Fringe/.test(m.name), { width: 0.0018, weld: true })
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const k = 1.1 / (size.y || 1)
    const c = box.getCenter(new THREE.Vector3())
    const out = new THREE.Group()
    root.position.set(-c.x, -box.min.y, -c.z)
    out.add(root)
    out.scale.setScalar(k)
    // (its marks turned to the room)
    out.rotation.y = part ? -0.95 : -0.62
    return out
  }, [gltf, part])
  return <primitive object={stack} />
}
/** the willow's weeping branches: each a thin tube arching out from the top of its trunk and falling away */
const WILLOW = (() => {
  const branches: THREE.BufferGeometry[] = []
  const leaves: THREE.Vector3[] = []
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + (k % 3) * 0.3
    const reach = 0.16 + (k % 4) * 0.04, fall = 0.55 + (k % 5) * 0.09
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const top = new THREE.Vector3(0, 1.05 + (k % 3) * 0.04, 0)
    const pts = [top, top.clone().addScaledVector(dir, reach * 0.5).add(new THREE.Vector3(0, 0.08, 0)), top.clone().addScaledVector(dir, reach),
      top.clone().addScaledVector(dir, reach * 1.15).add(new THREE.Vector3(0, -fall * 0.5, 0)), top.clone().addScaledVector(dir, reach * 1.2).add(new THREE.Vector3(0, -fall, 0))]
    const curve = new THREE.CatmullRomCurve3(pts)
    branches.push(new THREE.TubeGeometry(curve, 10, 0.0035, 3, false))
    for (let i = 3; i <= 12; i++) leaves.push(curve.getPoint(i / 12))
  }
  return { branches: mergeGeometries(branches)!, leaves }
})()
const WILLOW_LEAF = new THREE.ConeGeometry(0.012, 0.06, 4)
/** a weeping willow (柳) in a tall glazed pot: a slender trunk, its long thin branches falling all round it in green */
function PottedWillow() {
  return (
    <group>
      <Inked geometry={PROP_GEO.tallPot} color="#3a4a3e" position-y={0.17} />
      <mesh position-y={0.34} rotation-x={-Math.PI / 2}><circleGeometry args={[0.12, 16]} /><meshToonMaterial color="#4a3020" /></mesh>
      <mesh position={[0.01, 0.7, 0]} rotation-z={0.05}><cylinderGeometry args={[0.012, 0.022, 0.75, 6]} /><meshToonMaterial color="#5a4a32" /></mesh>
      <mesh geometry={WILLOW.branches}><meshToonMaterial color="#6a7a3a" /></mesh>
      {WILLOW.leaves.map((p, i) => (
        <mesh key={i} geometry={WILLOW_LEAF} position={p} rotation={[Math.PI + (i % 3 - 1) * 0.4, i * 1.3, (i % 2 - 0.5) * 0.6]}>
          <meshToonMaterial color={i % 3 ? '#7a9a3e' : '#8aac4a'} />
        </mesh>
      ))}
    </group>
  )
}
/** plastic crates of empty bottles (P箱), stacked by the kitchen's end, where the stock's seen to */
/** a beer crate's side: its maker's name moulded in, a hand-hold slot, a ribbed band (white on the crate's red) */
const CRATE_SIDE = canvasTex(256, 128, (g) => {
  g.fillStyle = '#c0302a'; g.fillRect(0, 0, 256, 128)
  g.fillStyle = 'rgba(0,0,0,0.18)'
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 3, 128)
  g.fillStyle = '#2a0a08'; g.beginPath(); g.roundRect(78, 14, 100, 22, 11); g.fill()
  g.fillStyle = '#f4ece0'
  g.font = '900 34px "Zen Antique", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('ビール', 128, 76)
  g.font = '700 14px "Arial Black", sans-serif'; g.fillText('20本入 · 中瓶', 128, 108)
})
/**
 * The empty-bottle crates (P箱) by the fridges, the brewer's red plastic, two stacked: each a frame of ribbed sides with hand-holds,
 * a grid of cells inside, and its brown beer bottles standing in the cells, their necks and caps up out of it
 */
/** the drinks' names, for the back stock's tag */
const drinkLabel = (id: string) => DRINKS.find((d) => d.id === id)?.zh ?? id
/** the drinks that live in the fridges, the lowest in the back first */
const lowestBack = () => [...new Set(FRIDGE_UNITS.flatMap((u) => u.shelves.flatMap((sh) => sh.ids)))]
  .sort((a, b) => (DRINK_BACK.back[a] ?? 0) / (CASE_SIZE[a] ?? 24) - (DRINK_BACK.back[b] ?? 0) / (CASE_SIZE[b] ?? 24))
const CARTONS_URL = import.meta.env.BASE_URL + 'models/drinkcartons.glb'
/** what each case in the stack holds (blender/drinkcartons.py's CartonPrint0..4): the canned drinks come by the carton, the bottles by the crate */
const CARTON_DRINKS: DrinkId[] = ['beerCan', 'greenTea', 'cola', 'highball', 'chuhai']
/** a carton's print: the kraft board, a band of the drink's own colour across it with its name big, a row of its cans and how many are in */
const cartonPrint = (id: DrinkId) => canvasTex(512, 256, (g) => {
  const d = DRINKS.find((x) => x.id === id)!
  const [bg, fg, text] = d.label
  g.fillStyle = '#b98a5c'; g.fillRect(0, 0, 512, 256)
  g.fillStyle = 'rgba(90,60,30,0.08)'
  for (let x = 0; x < 512; x += 9) g.fillRect(x, 0, 3, 256)
  // (the band, and a thinner one of the drink's second colour under it)
  g.fillStyle = bg; g.fillRect(0, 46, 512, 128)
  g.fillStyle = fg; g.fillRect(0, 174, 512, 10)
  g.fillStyle = fg
  g.font = '900 70px "Zen Antique", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, 300, 112)
  // (a little can at the band's left, in the drink's colours)
  g.fillStyle = '#c8ccd2'; g.beginPath(); g.roundRect(46, 66, 64, 92, 10); g.fill()
  g.fillStyle = bg; g.fillRect(48, 88, 60, 46)
  g.fillStyle = fg; g.fillRect(58, 104, 40, 12)
  g.strokeStyle = '#3b2a20'; g.lineWidth = 3; g.beginPath(); g.roundRect(46, 66, 64, 92, 10); g.stroke()
  // (what's in it, printed small on the board under the band)
  g.fillStyle = '#3b2a20'
  g.font = '700 26px "Arial Black", sans-serif'
  g.fillText(`350ml × ${CASE_SIZE[id] ?? 24}`, 256, 220)
  g.font = '700 18px sans-serif'; g.textAlign = 'left'
  g.fillText('↑ 天地無用', 18, 24)
})
/** the cartons of canned drinks stacked by the crates (blender/drinkcartons.py), each printed for its drink, in the room's toon light */
function DrinkCartons() {
  const gltf = useGLTF(CARTONS_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const root = gltf.scene.clone(true)
    const mats = new Map<THREE.Material, THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) {
        const k = /^CartonPrint(\d)/.exec(src.name)
        // (a glTF model's pictures are read top row first: the print's canvas too)
        const print = k ? cartonPrint(CARTON_DRINKS[+k[1]]) : null
        if (print) { print.flipY = false; print.needsUpdate = true }
        t = new THREE.MeshToonMaterial({ color: k ? '#ffffff' : src.color.clone(), map: print ?? src.map })
        mats.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(root, (m) => /Tape/.test((m.material as THREE.Material).name ?? ''), { width: 0.0012, weld: true })
    // (nine cases now, each its board, its print and three strips of tape: folded together by material, a handful of draws for the stack)
    mergeByMaterial(root)
    return root
  }, [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(CARTONS_URL)
/** an unseen box over the crates and cartons: they're the drinks' stock; pointed at it says what's lowest and lights them all (`lit`: the
 * crates and cartons as drawn, the box itself being unseen), a click opens the drinks' stock (DrinkStockPanel: order cases, fill the fridges) */
function BackStockHit({ size = [0.42, 0.62, 0.34], lit }: { size?: [number, number, number]; lit: () => THREE.Object3D | null }) {
  const hint = () => `後場最少：${lowestBack().slice(0, 3).map((id) => `${drinkLabel(id)} ${DRINK_BACK.back[id] ?? 0}`).join('、')}｜點一下打開飲料庫存`
  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (getEdit().on) return
    setDrinkPanel(true)
  }
  return (
    <mesh position={[0, size[1] / 2, 0]} onClick={open} onPointerOver={(e) => { handOver.onPointerOver({ ...e, eventObject: lit() ?? e.eventObject }); setTip({ title: '飲料庫存區', hint: hint() }) }}
      onPointerOut={(e) => { handOver.onPointerOut({ ...e, eventObject: lit() ?? e.eventObject }); setTip(null) }}>
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
/** an unseen box over the sake barrels: the sake's stock (kept at room temperature); pointed at, it says how much there is and lights them
 * (`lit`: the barrels as drawn), a click opens the stock on its larder's tab, at the sake (the owner's) */
function SakeHit({ lit }: { lit: () => THREE.Object3D | null }) {
  const hint = () => {
    const n = SUPPLIES.has('Sake')
    return n < 0 ? '點一下看常溫區的清酒' : `清酒 ${n}・點一下看常溫區的庫存`
  }
  return (
    <mesh position={[0, SAKE_HIT[1] / 2, 0]}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('ambient', 'sack', undefined, 'Sake') }}
      onPointerOver={(e) => { if (getEdit().on) return; handOver.onPointerOver({ ...e, eventObject: lit() ?? e.eventObject }); setTip({ title: '菰樽（清酒）', hint: hint() }) }}
      onPointerOut={(e) => { handOver.onPointerOut({ ...e, eventObject: lit() ?? e.eventObject }); setTip(null) }}>
      <boxGeometry args={SAKE_HIT} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
/** the stack's size (in the frame it's turned in): the box pointed at over it */
const SAKE_HIT: [number, number, number] = [0.9, 1.1, 0.76]
/** how far along from the crates the cartons stand (the crates' own frame) */
/** where the cartons stand by the crates (the crates' own frame): turned end on, close beside them and running out from the wall, so they
 * keep to the floor (laid along the wall they ran on past the wall's end and the floor's edge) */
/** (the stack bigger now (nine cases, 0.83 by 0.42, 1.1 high): drawn 0.08 further from the crates, which it ran 6 cm into) */
const CARTONS_AT: [number, number, number] = [-0.44, 0, 0.173]
function BottleCrates() {
  const W = 0.36, D = 0.29, H = 0.2
  const cols = 5, rows = 4
  return (
    <group>
      {[0, 1].map((k) => (
        <group key={k} position={[k * 0.03 - 0.015, k * 0.272, 0]} rotation-y={k * 0.1}>
          {/* (the four sides, printed, and the floor) */}
          {[[0, D / 2, 0], [0, -D / 2, Math.PI], [W / 2, 0, Math.PI / 2], [-W / 2, 0, -Math.PI / 2]].map(([x, z, ry], i) => (
            <mesh key={i} position={[x, H / 2, z]} rotation-y={ry}>
              <boxGeometry args={[i < 2 ? W : D, H, 0.012]} /><meshToonMaterial color="#ffffff" map={CRATE_SIDE} />
            </mesh>
          ))}
          <mesh position-y={0.006}><boxGeometry args={[W, 0.012, D]} /><meshToonMaterial color="#9a2620" /></mesh>
          {/* (the cells' walls) */}
          {Array.from({ length: cols - 1 }, (_, c) => (
            <mesh key={`c${c}`} position={[-W / 2 + (W / cols) * (c + 1), H * 0.45, 0]}><boxGeometry args={[0.006, H * 0.9, D - 0.02]} /><meshToonMaterial color="#a82a22" /></mesh>
          ))}
          {Array.from({ length: rows - 1 }, (_, r) => (
            <mesh key={`r${r}`} position={[0, H * 0.45, -D / 2 + (D / rows) * (r + 1)]}><boxGeometry args={[W - 0.02, H * 0.9, 0.006]} /><meshToonMaterial color="#a82a22" /></mesh>
          ))}
          {/* (the bottles: the lower crate full, the top one with a few gone) */}
          {Array.from({ length: cols * rows }, (_, n) => {
            if (k === 1 && (n % 7 === 3 || n === 11)) return null
            const x = -W / 2 + (W / cols) * ((n % cols) + 0.5), z = -D / 2 + (D / rows) * (Math.floor(n / cols) + 0.5)
            return <group key={n} position={[x, 0.012, z]} rotation-y={n * 1.3}><DrinkBottle id="beer" /></group>
          })}
        </group>
      ))}
    </group>
  )
}
/**
 * What stands about the room besides the counters (the shop's own frame): sake barrels stacked in the open corner past
 * the kitchen, a pot of bamboo at the dead end of the side counter's aisle, and the empty-bottle crates at the
 * kitchen's end — all of it on the floor out of everyone's way, and facing the room.
 */

/** the glyphs of the notes that float out of the speaker, drawn once */
const NOTE_TEX = (() => {
  if (typeof document === 'undefined') return []
  return ['♪', '♫', '♩', '♬'].map((ch, i) => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    g.font = '700 52px sans-serif'
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.lineWidth = 6; g.strokeStyle = 'rgba(40,20,8,0.85)'
    g.strokeText(ch, 32, 34)
    g.fillStyle = ['#ffd98a', '#9fe3ae', '#ffb0a0', '#a8d0ff'][i]
    g.fillText(ch, 32, 34)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })
})()
/**
 * Notes coming out of the speaker's cones while music plays: ♪ ♫ ♩ ♬ sprites, big ones from the woofer and small ones from the tweeter, each
 * rising and swaying on its own beat, growing as it goes and fading out; with the music off they thin out and are gone.
 */
function MusicNotes({ playing }: { playing: boolean }) {
  const N = 10
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const k = useRef(0)
  // (each note: which driver it comes out of (the big woofer or the little tweeter), how big it grows, its own speed and way to drift)
  const notes = useMemo(() => Array.from({ length: N }, (_, i) => {
    const woofer = i % 3 !== 2
    return { x0: (((i * 37) % 7) - 3) * 0.008, y0: woofer ? -0.07 : 0.15, size: (woofer ? 0.17 : 0.09) * (0.8 + ((i * 53) % 5) * 0.1), speed: 0.22 + ((i * 29) % 6) * 0.025,
      drift: (((i * 17) % 9) - 4) * 0.045, phase: i / N }
  }), [])
  useFrame(({ clock }, dt) => {
    k.current += ((playing ? 1 : 0) - k.current) * Math.min(1, dt * 3)
    const t = clock.elapsedTime
    notes.forEach((n, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const life = (t * n.speed + n.phase) % 1
      // (out of the cone, on and up in front of the speaker, swaying as it goes)
      sp.position.set(n.x0 + n.drift * life + Math.sin(t * 2.1 + i * 1.7) * 0.04 * life, n.y0 + life * 0.55, 0.14 + life * 0.5)
      sp.scale.setScalar(n.size * Math.min(1, life * 6) * (0.75 + 0.5 * life) * k.current)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.min(1, life * 8) * (1 - life) ** 0.6 * k.current
      sp.visible = k.current > 0.02
    })
  })
  return (
    <>
      {notes.map((_, i) => (
        <sprite key={i} ref={(o) => { refs.current[i] = o }} visible={false}>
          <spriteMaterial map={NOTE_TEX[i % NOTE_TEX.length]} transparent depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  )
}

/**
 * The speaker (スピーカー) hung high in the room's corner, angled down toward the floor, as the ones over a shop's counter are: the model
 * from blender/speaker.py (a black cabinet with rounded edges, a domed perforated grille over a woofer and a horn tweeter, a U-shaped yoke on
 * an arm out from a wall plate, the cable looping down from the back). Click it (when not editing) to switch the music on, and again to switch it off; its
 * power light shows which.
 */
const SPEAKER_URL = import.meta.env.BASE_URL + 'models/speaker.glb'
/** the parts drawn with an ink line round them (the small ones, the grille and the light, without) */
const SPEAKER_INKED = /^Speaker(Cabinet|Yoke|WallPlate|Arm|Joint|Knob)/
/** the arm's length as the model has it (blender/speaker.py: WALL - YB), stretched from there to reach the corner */
const SPEAKER_ARM = 0.38 - 0.19

function WallSpeaker() {
  const [lit, setLit] = useState(false)
  const off = useBgmOff()
  const tag = () => setTip({ title: '音箱', hint: getBgmOff() ? '點一下開啟音樂' : '點一下關閉音樂' })
  const press = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setBgmOff(!getBgmOff()); tag() }
  const gltf = useGLTF(SPEAKER_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const root = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.MeshToonMaterial>()
    let led: THREE.MeshBasicMaterial | null = null
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'SpeakerLED') {
        led = new THREE.MeshBasicMaterial()
        m.material = led
        return
      }
      let t = toon.get(src)
      if (!t) {
        // (the grille's holes are cut by its alpha: tested, not blended, so what's behind shows sharp and sorts right)
        const grille = src.name === 'SpeakerGrille'
        // (the cabinet, its grille and its arm a charcoal grey, not the model's near-black: in the toon light that came out a flat black slab,
        // a hole in the picture, with nothing of its shape or its grille to show what it was)
        const lift = /^Speaker(Grille|Frame|Steel)$/.test(src.name) ? 2.6 : 1
        const shell = src.name === 'SpeakerABS' || src.name === 'SpeakerBaffle'
        t = new THREE.MeshToonMaterial({ color: shell ? new THREE.Color(src.name === 'SpeakerABS' ? '#45484e' : '#2c2e32') : src.color.clone().multiplyScalar(lift),
          map: shell ? null : src.map, alphaTest: grille ? 0.5 : 0, side: grille ? THREE.DoubleSide : THREE.FrontSide })
        t.name = src.name
        toon.set(src, t)
      }
      m.material = t
      m.castShadow = SPEAKER_INKED.test(m.name)
    })
    inkModel(root, (m) => !SPEAKER_INKED.test(m.name), { width: 0.004, weld: true })
    // (drawn a few parts at a time; the arm and its bracket, which reach back to the corner wherever it's put, on their own)
    mergeByMaterial(root, (o) => /^Speaker(Arm|Mount)/.test(o.name))
    return { root, led: led as THREE.MeshBasicMaterial | null, toon: [...toon.values()] }
  }, [gltf])
  useEffect(() => { model.led?.color.set(off ? '#d02a2a' : '#3ddc6a') }, [model, off])
  // (the arm reaches back to the room's corner and the bracket sits in it: found by a ray from the arm's joint straight back, so it still fits
  // wherever the speaker's been moved to. Looked for every half second only until two looks agree, and again once it's moved: asked all the
  // time, the ray caught whatever passed behind it (the notes it plays drifting by among them) and the arm went in and out, on and on)
  const { scene: room, camera } = useThree()
  const outer = useRef<THREE.Group>(null)
  const reachAt = useRef(0)
  const found = useRef({ at: new THREE.Vector3(Infinity, 0, 0), dir: new THREE.Vector3(), len: -1, sure: false })
  useFrame((st) => {
    if (st.clock.elapsedTime - reachAt.current < 0.5) return
    reachAt.current = st.clock.elapsedTime
    const reach = model.root.getObjectByName('SpeakerArmReach'), mount = model.root.getObjectByName('SpeakerMount')
    if (!reach || !mount) return
    reach.updateWorldMatrix(true, false)
    const from = reach.getWorldPosition(new THREE.Vector3())
    const back = new THREE.Vector3(0, 0, -1).transformDirection(reach.matrixWorld)
    const f = found.current
    const still = from.distanceToSquared(f.at) < 1e-6 && back.dot(f.dir) > 0.99999
    if (still && f.sure) return
    const ray = new THREE.Raycaster(from, back, 0.03, 2)
    ray.camera = camera
    ray.params.Line = { threshold: 0 }
    ray.params.Points = { threshold: 0 }
    const mine = (o: THREE.Object3D | null) => {
      for (; o; o = o.parent) if (o === model.root || o === outer.current || o.userData.fade || o.userData.editHandle) return true
      return false
    }
    const hit = ray.intersectObjects(room.children, true).find((h) => (h.object as THREE.Mesh).isMesh && !mine(h.object))
    if (!hit) return
    // (the distance in the arm's own units: by its parent's scale, not its own, which is the stretch itself: by its own, each look undid the
    // last, the arm long, then short, then long again every half second)
    const k = (reach.parent ?? reach).getWorldScale(new THREE.Vector3()).z || 1
    const len = Math.max(0.05, hit.distance / k)
    // (sure once the same wall's found twice from the same place)
    f.sure = still && Math.abs(len - f.len) < 0.002
    f.at.copy(from); f.dir.copy(back); f.len = len
    reach.scale.z = len / SPEAKER_ARM
    mount.position.z = reach.position.z - len
  })
  // (pointed at, it lifts a little out of the dark, to say it can be clicked)
  useEffect(() => { for (const t of model.toon) t.emissive.set(lit ? '#2a2a30' : '#000000') }, [model, lit])
  return (
    <group ref={outer} name="look-speaker" onClick={press} onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setLit(true); handOver.onPointerOver(e as never); tag() }}
      onPointerOut={(e: { stopPropagation: () => void }) => { setLit(false); handOver.onPointerOut(e as never); setTip(null) }} >
      <MusicNotes playing={!off} />
      {/* (the handlers on a group round it: a primitive's own aren't attached) */}
      <primitive object={model.root} />
    </group>
  )
}
useGLTF.preload(SPEAKER_URL)

const EXIT_URL = import.meta.env.BASE_URL + 'models/exitsign.glb'
/** the language on screen (App sets the page's lang), followed as it's switched */
function useDocLang() {
  const read = () => (typeof document === 'undefined' ? 'zh-Hant' : document.documentElement.lang || 'zh-Hant')
  const [lang, setLang] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setLang(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => mo.disconnect()
  }, [])
  return lang
}
/** the exit sign's face, as Taiwan's edge-lit ones: green, lit; EXIT spaced out on the left, in the middle a white doorway with the running
 * figure leaving by it, on the right the words in the language on screen. The three laid out evenly: each measured, the same margin at either
 * end and the same gap between them, each centred on the pane's middle by its own letters' height (the words were set low, and crowded
 * against the doorway's step while EXIT stood far off); words too long for their room set smaller */
const exitFace = (lang: string) => {
  const words = lang === 'ja' ? '非常口' : lang === 'en' ? 'WAY OUT' : '緊急出口'
  return canvasTex(1024, 378, (g) => {
    const W = 1024, H = 378, MID = H / 2
    // (the ground: a bright green, a little brighter toward the top edge where the light comes in)
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#36dc7c'); grad.addColorStop(1, '#1cb75f')
    g.fillStyle = grad; g.fillRect(0, 0, W, H)
    const edge = g.createLinearGradient(0, 0, 0, 70)
    edge.addColorStop(0, 'rgba(255,255,255,0.32)'); edge.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = edge; g.fillRect(0, 0, W, 70)
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round'
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    // (the parts measured: EXIT's letters with a space between each, the doorway with its step, the words)
    const EXIT_FONT = '600 92px "Arial", "Helvetica", sans-serif', TRACK = 22
    g.font = EXIT_FONT
    const letters = 'EXIT'.split('').map((ch) => ({ ch, w: g.measureText(ch).width }))
    const wExit = letters.reduce((a, l) => a + l.w, 0) + TRACK * (letters.length - 1)
    const exitM = g.measureText('EXIT')
    const DOOR = 150, STEP = 60, wDoor = DOOR + STEP
    const MARGIN = 64, MIN_GAP = 56
    let size = lang === 'en' ? 76 : 96
    const wordFont = (px: number) => (lang === 'en' ? `700 ${px}px "Arial", "Helvetica", sans-serif` : `700 ${px}px "Noto Sans TC", "Noto Sans JP", "Microsoft JhengHei", sans-serif`)
    g.font = wordFont(size)
    let wWords = g.measureText(words).width
    const room = W - 2 * MARGIN - wExit - wDoor - 2 * MIN_GAP
    if (wWords > room) { size = Math.floor((size * room) / wWords); g.font = wordFont(size); wWords = g.measureText(words).width }
    const gap = (W - 2 * MARGIN - wExit - wDoor - wWords) / 2
    // (each line of letters set so the middle of its own glyphs is the pane's middle)
    const centred = (m: TextMetrics) => MID + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
    g.font = EXIT_FONT
    let x = MARGIN
    const yExit = centred(exitM)
    for (const l of letters) { g.fillText(l.ch, x, yExit); x += l.w + TRACK }
    // (the doorway: a white frame, open, the green showing through it, the figure running out through it to the right, the step beyond)
    const x0 = MARGIN + wExit + gap, top = MID - 118, foot = MID + 118
    g.fillRect(x0, top, DOOR, foot - top)
    g.fillStyle = grad; g.fillRect(x0 + 18, top + 18, DOOR - 36, foot - top - 18)
    g.fillStyle = '#ffffff'
    const fx = (dx: number) => x0 + dx, fy = (dy: number) => top + dy
    g.beginPath(); g.arc(fx(96), fy(42), 21, 0, Math.PI * 2); g.fill()
    g.lineWidth = 30
    g.beginPath(); g.moveTo(fx(80), fy(76)); g.lineTo(fx(60), fy(136)); g.stroke()
    g.lineWidth = 20
    g.beginPath(); g.moveTo(fx(78), fy(82)); g.lineTo(fx(114), fy(106)); g.lineTo(fx(148), fy(92)); g.stroke()
    g.beginPath(); g.moveTo(fx(78), fy(82)); g.lineTo(fx(48), fy(90)); g.lineTo(fx(30), fy(120)); g.stroke()
    g.beginPath(); g.moveTo(fx(60), fy(136)); g.lineTo(fx(94), fy(168)); g.lineTo(fx(88), fy(212)); g.stroke()
    g.beginPath(); g.moveTo(fx(60), fy(136)); g.lineTo(fx(32), fy(168)); g.lineTo(fx(-2), fy(174)); g.stroke()
    g.fillRect(x0, foot - 10, wDoor, 12)
    // (the words)
    g.font = wordFont(size)
    g.fillText(words, x0 + wDoor + gap, centred(g.measureText(words)))
  })
}
/** a soft glow the shape of a lit panel: a rectangle (iw x ih) on a w x h sheet, blurred `blur` px all round (the blur of a shadow cast from
 * off the sheet: canvas filters aren't in every browser) */
function softRect(w: number, h: number, iw: number, ih: number, blur: number) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  g.shadowColor = '#ffffff'; g.shadowBlur = blur; g.shadowOffsetX = w * 2
  g.fillStyle = '#ffffff'
  g.fillRect((w - iw) / 2 - w * 2, (h - ih) / 2, iw, ih)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
/** the exit sign's light round its pane (0.42 x 0.156 in its frame, on a sheet 0.62 x 0.35), and the wider light it throws on the wall behind */
const EXIT_HALO = softRect(320, 180, 216, 80, 26)
const EXIT_SPILL = softRect(256, 160, 110, 50, 40)
/**
 * The emergency exit sign on the wall by the way out (blender/exitsign.py): an aluminium housing along the top, an acrylic pane hanging from
 * it lit from its edge, its face (both sides) lit whatever the room's lights, the words in the language on screen
 */
function ExitSign() {
  const lang = useDocLang()
  const gltf = useGLTF(EXIT_URL) as unknown as { scene: THREE.Group }
  const face = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.FrontSide }), [])
  useEffect(() => {
    const t = exitFace(lang)
    if (!t) return
    t.flipY = false
    face.map = t
    face.needsUpdate = true
    return () => t.dispose()
  }, [lang, face])
  const model = useMemo(() => {
    const root = gltf.scene.clone(true)
    const alu = new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 1, roughness: 0.34 })
    reflectStudio(alu)
    const edge = new THREE.MeshBasicMaterial({ color: '#dcffe9', toneMapped: false, transparent: true, opacity: 0.95 })
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      m.material = src.name === 'ExitFaceLit' ? face : src.name === 'ExitPaneEdge' ? edge : alu
    })
    inkModel(root, (m) => !/ExitBox/.test(m.name), { width: 0.0012, weld: true })
    return root
  }, [gltf, face])
  return (
    <group>
      <primitive object={model} />
      {/* (its light: a green edge all round the pane, from a glow its own shape just behind it, and the light it throws on the wave frieze
          behind (its face 0.038 in front of it), wider and fainter; it was a round glow, orange-tinted, its bright middle hidden by the pane) */}
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[0.62, 0.35]} />
        <meshBasicMaterial map={EXIT_HALO} color="#6dffad" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.02, -0.036]}>
        <planeGeometry args={[1.2, 0.75]} />
        <meshBasicMaterial map={EXIT_SPILL} color="#3ee58a" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}
useGLTF.preload(EXIT_URL)

const SWITCH_URL = import.meta.env.BASE_URL + 'models/lightswitch.glb'
/**
 * The light switch on the wall by the door (blender/lightswitch.py): an ivory wide rocker at hand height. A click puts the shop's lights out
 * or on again (scene/lightsStore; the lamps and the room's light follow it): the rocker rocks over, and while the lights are out its
 * little guide light (ホタル) glows green, to find it by in the dark. Facing -x (the wall's own frame: the room).
 */
function LightSwitch() {
  const { on } = useLights()
  const [lit, setLit] = useState(false)
  const tag = () => setTip({ title: '電燈開關', hint: getLights().on ? '點一下關燈' : '點一下開燈' })
  const press = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; pressLightSwitch(); tag() }
  const gltf = useGLTF(SWITCH_URL) as unknown as { scene: THREE.Group }
  const model = useMemo(() => {
    const root = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.MeshToonMaterial>()
    const lamp = new THREE.MeshBasicMaterial({ toneMapped: false })
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      if (src.name === 'SwitchLamp') { m.material = lamp; return }
      let t = toon.get(src)
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone() }); toon.set(src, t) }
      m.material = t
    })
    inkModel(root, (m) => /Lamp/.test(m.name), { width: 0.0012, weld: true })
    return { root, rocker: root.getObjectByName('SwitchRocker'), lamp, toon: [...toon.values()] }
  }, [gltf])
  useEffect(() => {
    if (model.rocker) model.rocker.rotation.x = on ? -0.14 : 0.14
    model.lamp.color.set(on ? '#7c8a72' : '#8dffb0')
  }, [model, on])
  useEffect(() => { for (const t of model.toon) t.emissive.set(lit ? '#2a2a30' : '#000000') }, [model, lit])
  return (
    <group rotation-y={-Math.PI / 2} onClick={press}
      onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setLit(true); handOver.onPointerOver(e as never); tag() }}
      onPointerOut={(e: { stopPropagation: () => void }) => { setLit(false); handOver.onPointerOut(e as never); setTip(null) }}>
      {/* (the handlers on a group round it: a primitive's own aren't attached) */}
      <primitive object={model.root} />
    </group>
  )
}
useGLTF.preload(SWITCH_URL)

function ShopPropsImpl({ counters }: { counters: Counter[] }) {
  const c0 = counters[0]
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(c0.along, along).addScaledVector(c0.lay, lay)
  // (their fronts toward the room's open side, where the camera is)
  const face = Math.atan2(-c0.lay.x, -c0.lay.z)
  const fr = useMemo(() => fridgesOf(counters), [counters])
  // (the drinks' stock as drawn, the crates and the cartons: what lights up when the unseen box over them is pointed at)
  const stock = useRef<THREE.Group>(null)
  const stockLit = () => stock.current
  // (and the sake barrels, as drawn: the sake's stock)
  const sake = useRef<THREE.Group>(null)
  const sakeLit = () => sake.current
  const c1 = counters[1]
  // (the corner where the room's two walls meet: the plant stands in it, a little in from both)
  const cornerAt = useMemo(() => {
    const along = Math.min(-c0.length / 2 - 0.35, ...counters.slice(1).map((o) => o.at.clone().addScaledVector(o.lay, farOf(o)).sub(c0.at).dot(c0.along)))
    return c0.at.clone().addScaledVector(c0.along, along + 0.42).addScaledVector(c0.lay, farOf(c0) + 0.42)
  }, [c0, counters])
  // (the same corner, up under the ceiling, the speaker hung there and turned to face down the room's diagonal)
  const speaker = useMemo(() => {
    const along = Math.min(-c0.length / 2 - 0.35, ...counters.slice(1).map((o) => o.at.clone().addScaledVector(o.lay, farOf(o)).sub(c0.at).dot(c0.along)))
    // (flat to the far wall and tucked right into the corner, so none of the banner strings (which hang no nearer than 0.3 from a wall) runs through it)
    const p = c0.at.clone().addScaledVector(c0.along, along + 0.145).addScaledVector(c0.lay, farOf(c0) + 0.115)
    p.y += 1.55
    return { p, yaw: Math.atan2(c0.lay.x, c0.lay.z) }
  }, [c0, counters])
  const crateAt = useMemo(() => {
    if (!fr || !c1) return new THREE.Vector3()
    const last = fr[fr.length - 1]
    return c1.at.clone().addScaledVector(c1.along, last.z - FRIDGE.W / 2 - 0.3).addScaledVector(c1.lay, farOf(c1) + 0.32)
  }, [fr, c1])
  return (
    // (each piece is its own batch inside its own Movable, so each can be moved by hand when the shop's shut: key G)
    // (not keyed by the language any more: that was for a mat with words on it, long gone, and each switch built all four again, their
    // copies, pictures and ink lines left behind each time)
    <>
      <Movable id="speaker" label="音箱" baseTurn={[0, 45, 0]} baseScale={0.82}><group position={speaker.p} rotation-y={speaker.yaw}><WallSpeaker /></group></Movable>
      {/* (one stack, standing where the two used to) */}
      <Movable id="sake" label="酒樽"><group ref={sake}><StaticBatch>
        <group position={at(3.55, 3.6)} rotation-y={face + 0.3}>
          <group rotation-y={Math.PI / 2}><SakeStack part={0} /></group>
        </group>
      </StaticBatch></group>
        <group position={at(3.55, 3.6)} rotation-y={face + 0.3}><group rotation-y={Math.PI / 2}><SakeHit lit={sakeLit} /></group></group>
      </Movable>
      {/* plants about the room: a willow by the sake barrels in the front corner; bamboo by the till's end, by the door
          (none against the side wall: the two drinks fridges stand there) */}
      <Movable id="willow" label="柳樹"><StaticBatch>
        <group position={at(3.55, 2.95)} rotation-y={1.4} scale={0.9}><PottedWillow /></group>
      </StaticBatch></Movable>
      <Movable id="bamboo" label="竹盆栽"><StaticBatch>
        <group position={cornerAt} rotation-y={0.4}><BambooModel /></group>
      </StaticBatch></Movable>
      {/* (the crates of red bottles against the side wall just along from the fridges, clear of the men's door's slide) */}
      {fr && <Movable id="crates" label="酒箱"><group ref={stock}><StaticBatch>
        <group position={crateAt} rotation-y={Math.atan2(counters[1].lay.x, counters[1].lay.z)}>
          <BottleCrates />
          {/* (and beside them the cartons of canned drinks) */}
          <group position={CARTONS_AT} rotation-y={Math.PI / 2 + 0.04}><DrinkCartons /></group>
        </group>
      </StaticBatch></group>
        {/* (the back stock: pointed at, what's running low; a click opens the drinks' stock) */}
        <group name="look-crates" position={crateAt} rotation-y={Math.atan2(counters[1].lay.x, counters[1].lay.z)}>
          <BackStockHit lit={stockLit} />
          <group position={CARTONS_AT} rotation-y={Math.PI / 2}><BackStockHit size={[0.86, 1.16, 0.32]} lit={stockLit} /></group>
        </group>
      </Movable>}
    </>
  )
}

// (drawn again only when their own props change, not each time the page above them redraws: while the shop's open that's many times a second)
export const ShopProps = memo(ShopPropsImpl)
export const DiningWall = memo(DiningWallImpl)
