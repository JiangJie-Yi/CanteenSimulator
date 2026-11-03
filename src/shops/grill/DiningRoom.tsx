import { blessingChime, shrineDoor } from './shrineSound'
import { TISSUE } from '@/game/tissues'
import { BambooModel } from './BarFurnish'
import { doorClick, LOCK_TEX, ToiletLive, WashstandLive, WcBin, WcBrush, WcMarks, WcOtohime, WcPads, WcPaper, WcRemote } from './Restroom'
import { coolerDoorSound, lightSwitchSound, slideDoorSound } from './restroomSound'
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { StaticBatch, mergeByMaterial, type BatchParts } from '@/scene/StaticBatch'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'
import { ColdMist } from '@/scene/ColdMist'
import { useGLTF } from '@react-three/drei'
import { brushText, signTexture, SIGN_FONT } from '@/scene/signFont'
import { BOSS_DRINK, BOSS_FX } from './Boss'
import { CASE_SIZE } from '@/game/drinkStock'
import { askPantry, SUPPLIES, fridgesOf, farOf, DRINK_BACK, setDrinkPanel, DRINKS, FRIDGE, FRIDGE_STATE, FRIDGE_STOCK, FRIDGE_UNITS, moveDrink, moveOut, tipOver, handOver, POINTER_HINT, pullOut, putBack, setShrineFlower, SHRINE_FLOWERS, tableHit, TOILETS, WC_ROOM, WC_SLIDE, WC_W, lampsAlong, nameOver, type Counter, type DrinkId } from './bar'
import { Movable } from './Movable'
import { getEdit } from './edit'
import { FLOWERS, nextFlower, type Flower } from '@/game/shrineFlowers'
import { setTip } from '@/scene/hoverTip'
import { getBgmOff, setBgmOff, useBgmOff } from '@/ui/bgmStore'
import { getLights, onLights, pressLightSwitch, useLights } from '@/scene/lightsStore'
import { lampGlow, lightOn, type Circuit } from '@/game/roomLights'
import type { Sky } from '@/game/clock'
import { lampLit } from './lampShades'
import { replaces } from '@/scene/hot'

/**
 * The lamps' painted light (their halos and the pools they throw) by the time of day: faint by day, when the room's lit anyway; full and
 * wider by night, a glow blooming round each (data-theme on the page, followed as it changes).
 */
/** (a lamp's: out with the wall switch; the daylight through the windows isn't) */
const NIGHT_GLOWS: { m: THREE.Material; day: number; night: number; lamp: boolean }[] = []
const isNight = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
/** the part of the day outside (the page's data-sky: dawn, day, dusk, night; the round window's paper, view and light follow it) */
function skyNow(): Sky {
  const s = typeof document === 'undefined' ? undefined : document.documentElement.dataset.sky
  return s === 'dawn' || s === 'day' || s === 'dusk' || s === 'night' ? s : isNight() ? 'night' : 'day'
}
/** what this module sets going by itself (observers, subscriptions), undone when it's swapped for a new copy of itself (a hot update while
 * it's being worked on): left behind, each kept redrawing the old copy's pictures at every turn of the day, a few more with every edit */
const UNDO: (() => void)[] = []
replaces(import.meta.hot, () => { for (const f of UNDO.splice(0)) f() })
/** watch the page for the part of the day turning (either of its two marks) */
const onSky = (f: () => void) => {
  const o = new MutationObserver(f)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] })
  UNDO.push(() => o.disconnect())
}
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
  const o = new MutationObserver(lightsNow)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  UNDO.push(() => o.disconnect(), onLights(lightsNow))
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
  // a beauty with a round fan (bijin-ga), drawn as an ukiyo-e print draws one (the owner's: a little finer; it was a few flat shapes): her
  // hair dressed in a shimada, its side locks puffed out fine, a tortoiseshell comb and gold pins with dangles, a red band at the knot's
  // root; a long pale face, high thin brows, slit eyes, a small red mouth; collars crossed red, white and navy; a navy kimono of flowing
  // water and plum blossoms over a red one dotted with tie-dye, a gold obi with its bow behind; a round fan with a goldfish on it in her
  // hand; mist bands across a pale mica ground; the title in its cartouche and a seal
  bijin: artTex('scroll', 200, 476, (g) => {
    const INK = '#1a1210'
    g.lineJoin = 'round'; g.lineCap = 'round'
    // ---- the ground, and pink mist bands (kasumi) across its top and foot
    const bg = g.createLinearGradient(0, 0, 0, 476)
    bg.addColorStop(0, '#f4ebd8'); bg.addColorStop(1, '#eadcc0')
    g.fillStyle = bg; g.fillRect(0, 0, 200, 476)
    g.fillStyle = 'rgba(220,168,150,0.32)'
    for (const [y, x0, x1] of [[16, -12, 112], [31, 46, 214], [438, -12, 84], [453, 70, 214]]) { g.beginPath(); g.roundRect(x0, y, x1 - x0, 11, 5.5); g.fill() }
    const line = (w = 1.1, c = INK) => { g.lineWidth = w; g.strokeStyle = c }
    // ---- her kimono: an S of a robe, swaying in at her waist and flaring to a hem trailing off to her right
    const robe = new Path2D()
    robe.moveTo(80, 176)
    robe.bezierCurveTo(62, 182, 54, 200, 52, 224)
    robe.bezierCurveTo(50, 272, 60, 320, 54, 380)
    robe.bezierCurveTo(50, 420, 38, 452, 26, 476)
    robe.lineTo(182, 476)
    robe.bezierCurveTo(168, 440, 152, 402, 148, 352)
    robe.bezierCurveTo(146, 300, 152, 240, 148, 208)
    robe.bezierCurveTo(144, 190, 132, 180, 120, 176)
    robe.closePath()
    // (the hanging sleeve of her left arm, its lining red at its foot)
    const sleeve = new Path2D()
    sleeve.moveTo(56, 204)
    sleeve.bezierCurveTo(40, 222, 26, 262, 22, 302)
    sleeve.bezierCurveTo(20, 334, 26, 356, 42, 364)
    sleeve.bezierCurveTo(58, 370, 72, 362, 76, 342)
    sleeve.lineTo(80, 240)
    sleeve.closePath()
    // (her right sleeve hanging from her arm, bent to the shamisen's plectrum)
    const rsleeve = new Path2D()
    rsleeve.moveTo(146, 204)
    rsleeve.bezierCurveTo(166, 226, 176, 270, 176, 318)
    rsleeve.bezierCurveTo(176, 340, 164, 350, 150, 344)
    rsleeve.bezierCurveTo(138, 338, 132, 316, 130, 296)
    rsleeve.lineTo(126, 262)
    rsleeve.closePath()
    const NAVY = '#203a6c'
    const kimono = (path: Path2D) => {
      g.fillStyle = NAVY; g.fill(path)
      g.save(); g.clip(path)
      // (flowing water, 観世水: long lines curling as they go, pale blue on the navy)
      line(1.3, 'rgba(176,206,236,0.6)')
      for (let y = 196, r = 0; y < 476; y += 17, r++) {
        g.beginPath()
        for (let x = 0; x <= 200; x += 4) {
          const yy = y + Math.sin(x / 14 + r * 1.7) * 4 + Math.sin(x / 37 + r) * 3
          if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy)
        }
        g.stroke()
      }
      g.restore()
    }
    // (the red under-kimono at the hem, dotted with tie-dye (kanoko), and the sleeves' red linings at their feet)
    const kanoko = (x0: number, y0: number, x1: number, y1: number) => {
      g.fillStyle = '#b8261c'; g.fillRect(x0, y0, x1 - x0, y1 - y0)
      g.fillStyle = 'rgba(250,236,220,0.85)'
      for (let y = y0 + 3, r = 0; y < y1; y += 5, r++) for (let x = x0 + (r % 2) * 2.5; x < x1; x += 5) { g.beginPath(); g.arc(x, y, 0.9, 0, Math.PI * 2); g.fill() }
    }
    kimono(sleeve)
    g.save(); g.clip(sleeve); kanoko(0, 346, 100, 380); g.restore()
    line(); g.stroke(sleeve)
    kimono(robe)
    g.save(); g.clip(robe)
    kanoko(0, 452, 200, 476)
    // (plum blossoms scattered over it: five round petals, white, a pink heart)
    for (const [x, y, r] of [[70, 214, 5], [118, 230, 4.5], [86, 330, 5.5], [130, 360, 5], [66, 402, 6], [112, 420, 5], [96, 252, 4], [138, 312, 4.5]]) {
      g.fillStyle = '#fbf3ec'
      for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, Math.PI * 2); g.fill() }
      g.fillStyle = '#e07a8a'; g.beginPath(); g.arc(x, y, r * 0.24, 0, Math.PI * 2); g.fill()
    }
    // (the obi: wide, gold, a lattice of hexagons (kikkō) in it, a red cord across)
    g.fillStyle = '#d9ac48'; g.fillRect(40, 262, 120, 42)
    line(0.8, 'rgba(120,70,20,0.55)')
    for (let y = 262, r = 0; y < 306; y += 9, r++) for (let x = 40 + (r % 2) * 7; x < 162; x += 14) {
      g.beginPath()
      for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2; const px = x + Math.cos(a) * 5.4, py = y + Math.sin(a) * 4.4; if (q === 0) g.moveTo(px, py); else g.lineTo(px, py) }
      g.closePath(); g.stroke()
    }
    g.fillStyle = '#c4201a'; g.fillRect(40, 281, 120, 3)
    line(1, INK); g.beginPath(); g.moveTo(40, 262); g.lineTo(160, 262); g.moveTo(40, 304); g.lineTo(160, 304); g.stroke()
    g.restore()
    line(); g.stroke(robe)
    // (the obi's bow behind her, its loops out past her right side)
    const bow = new Path2D()
    bow.moveTo(146, 266); bow.bezierCurveTo(164, 246, 182, 252, 178, 276); bow.bezierCurveTo(176, 296, 160, 302, 146, 296); bow.closePath()
    g.fillStyle = '#d9ac48'; g.fill(bow); line(); g.stroke(bow)
    line(0.8, 'rgba(120,70,20,0.6)'); g.beginPath(); g.moveTo(152, 272); g.quadraticCurveTo(166, 266, 172, 278); g.stroke()
    // ---- her right sleeve over the robe, its red lining at its foot
    kimono(rsleeve)
    g.save(); g.clip(rsleeve); kanoko(100, 330, 200, 360); g.restore()
    line(); g.stroke(rsleeve)
    // ---- her neck, the collars crossed over it (left over right): red, white, then the robe's own navy
    g.fillStyle = '#faf4ea'
    g.beginPath(); g.moveTo(90, 148); g.lineTo(114, 148); g.lineTo(118, 196); g.lineTo(86, 196); g.closePath(); g.fill()
    for (const [w, c] of [[15, '#b8261c'], [10, '#f6efe4'], [5, '#16223f']] as [number, string][]) {
      line(w, c); g.lineCap = 'butt'
      g.beginPath(); g.moveTo(84, 172); g.quadraticCurveTo(92, 196, 102, 222); g.stroke()
      g.beginPath(); g.moveTo(120, 172); g.quadraticCurveTo(112, 196, 102, 222); g.stroke()
    }
    g.lineCap = 'round'
    // ---- her face: long and pale, a blush on her cheeks, the features fine
    const face = new Path2D()
    face.ellipse(103, 127, 21, 28, -0.08, 0, Math.PI * 2)
    g.fillStyle = '#faf5ec'; g.fill(face)
    const blush = g.createRadialGradient(94, 136, 0, 94, 136, 12)
    blush.addColorStop(0, 'rgba(236,150,150,0.28)'); blush.addColorStop(1, 'rgba(236,150,150,0)')
    g.fillStyle = blush; g.fillRect(80, 122, 28, 28)
    line(0.9); g.stroke(face)
    line(0.8)
    g.beginPath(); g.moveTo(88, 115); g.quadraticCurveTo(93, 112, 99, 114); g.moveTo(107, 114); g.quadraticCurveTo(113, 112, 118, 115); g.stroke()
    line(1.1)
    g.beginPath(); g.moveTo(89, 123); g.quadraticCurveTo(94, 121, 99, 123); g.moveTo(107, 123); g.quadraticCurveTo(112, 121, 117, 123); g.stroke()
    g.fillStyle = INK; g.beginPath(); g.ellipse(95, 123, 1.4, 0.9, 0, 0, Math.PI * 2); g.ellipse(111, 123, 1.4, 0.9, 0, 0, Math.PI * 2); g.fill()
    line(0.8); g.beginPath(); g.moveTo(103, 119); g.quadraticCurveTo(100, 132, 101, 137); g.quadraticCurveTo(103, 138.5, 105, 137); g.stroke()
    g.fillStyle = '#d0302a'; g.beginPath(); g.ellipse(103, 145, 3.6, 1.6, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#a01818'; g.beginPath(); g.ellipse(103, 146.2, 2.6, 0.9, 0, 0, Math.PI * 2); g.fill()
    // ---- her hair: the side locks puffed out, fine at their edges; the cap over her head to a hairline with a peak; the knot on top; the
    // nape's bun behind her neck on the right
    g.fillStyle = 'rgba(20,15,13,0.94)'
    g.beginPath(); g.ellipse(129, 136, 11, 8, 0.5, 0, Math.PI * 2); g.fill()
    for (const sd of [-1, 1]) {
      const bin = new Path2D()
      bin.moveTo(103 + sd * 18, 96)
      bin.bezierCurveTo(103 + sd * 46, 98, 103 + sd * 46, 132, 103 + sd * 24, 140)
      bin.bezierCurveTo(103 + sd * 22, 128, 103 + sd * 20, 114, 103 + sd * 16, 106)
      bin.closePath()
      g.fillStyle = 'rgba(22,17,15,0.82)'; g.fill(bin)
      g.save(); g.clip(bin)
      line(0.5, 'rgba(110,100,96,0.55)')
      for (let q = 0; q < 9; q++) { g.beginPath(); g.moveTo(103 + sd * 18, 98 + q * 2); g.bezierCurveTo(103 + sd * (34 + q), 100 + q * 2, 103 + sd * (38 + q * 0.5), 124, 103 + sd * 24, 138); g.stroke() }
      g.restore()
    }
    const cap = new Path2D()
    cap.moveTo(81, 122)
    cap.bezierCurveTo(76, 96, 90, 80, 104, 80)
    cap.bezierCurveTo(120, 80, 132, 94, 126, 120)
    cap.bezierCurveTo(120, 110, 112, 106, 104, 111)
    cap.bezierCurveTo(96, 106, 88, 110, 81, 122)
    cap.closePath()
    g.fillStyle = '#15100e'; g.fill(cap)
    g.save(); g.clip(cap)
    line(0.5, 'rgba(120,110,104,0.5)')
    for (let q = 0; q < 12; q++) { const x = 84 + q * 3.6; g.beginPath(); g.moveTo(x, 118); g.quadraticCurveTo(x + (x - 104) * 0.2, 96, 104, 82); g.stroke() }
    g.restore()
    // (the knot on top, folded over, a red band at its root dotted white)
    g.fillStyle = '#15100e'
    g.beginPath(); g.ellipse(106, 66, 21, 12, -0.06, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.ellipse(106, 76, 14, 7, 0, 0, Math.PI * 2); g.fill()
    line(0.6, 'rgba(120,110,104,0.55)')
    g.beginPath(); g.ellipse(106, 66, 15, 7, -0.06, Math.PI * 1.05, Math.PI * 1.95); g.stroke()
    g.fillStyle = '#c8202a'; g.beginPath(); g.roundRect(92, 76, 28, 6, 2); g.fill()
    g.fillStyle = '#fbe6dc'; for (let q = 0; q < 6; q++) { g.beginPath(); g.arc(95 + q * 4.4, 79, 0.8, 0, Math.PI * 2); g.fill() }
    // (a tortoiseshell comb across the front, its teeth into the hair)
    const comb = new Path2D()
    comb.ellipse(104, 92, 21, 8, 0, Math.PI, Math.PI * 2)
    comb.closePath()
    g.fillStyle = '#9c5a22'; g.fill(comb)
    g.save(); g.clip(comb)
    g.fillStyle = 'rgba(40,20,8,0.55)'; for (const [x, y, r] of [[92, 88, 3], [101, 86, 2.5], [112, 89, 3.2], [118, 90, 2]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill() }
    g.restore()
    line(0.9); g.stroke(comb)
    // (gold pins: one fanning out up to the left with a red flower at its end, one to the right hung with little dangles)
    line(2.2, '#c99a34')
    g.beginPath(); g.moveTo(96, 74); g.lineTo(60, 48); g.moveTo(116, 72); g.lineTo(152, 50); g.moveTo(80, 70); g.lineTo(134, 62); g.stroke()
    g.fillStyle = '#c4201a'
    for (let q = 0; q < 5; q++) { const a = (q / 5) * Math.PI * 2; g.beginPath(); g.arc(60 + Math.cos(a) * 3.4, 48 + Math.sin(a) * 3.4, 2.6, 0, Math.PI * 2); g.fill() }
    g.fillStyle = '#f2d36a'; g.beginPath(); g.arc(60, 48, 1.8, 0, Math.PI * 2); g.fill()
    line(0.7, '#c99a34')
    for (let q = 0; q < 4; q++) {
      const x = 146 + q * 2.4, y = 54 - q * 1.4
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 14 + q * 3); g.stroke()
      g.fillStyle = '#e8c45a'; g.beginPath(); g.ellipse(x + 1, y + 16 + q * 3, 1.4, 2.2, 0, 0, Math.PI * 2); g.fill()
    }
    // ---- the shamisen across her (the owner's: it was a round fan with a goldfish on it): its body (胴) at her waist, turned to the neck's
    // slope, a dark wooden rim round its white skin with the dark guard (撥皮) where the plectrum strikes; its slender lacquered neck (棹)
    // up to her right, past her sleeve, to the pegbox (天神) bent back with its three ivory pegs; three strings from the bridge up the neck;
    // the plectrum (撥), ivory, fanning out from her hand over the skin
    const ang = Math.atan2(160 - 300, 186 - 124)
    g.save(); g.translate(124, 300); g.rotate(ang + Math.PI / 2)
    const dou = new Path2D(); dou.roundRect(-21, -22, 42, 44, 7)
    g.fillStyle = '#5a3018'; g.fill(dou)
    g.fillStyle = '#f4eee2'; g.beginPath(); g.roundRect(-17.5, -18.5, 35, 37, 5); g.fill()
    g.fillStyle = '#2c2420'; g.beginPath(); g.ellipse(0, -8, 11, 6, 0, Math.PI, Math.PI * 2); g.fill()
    line(0.9); g.stroke(dou)
    // (the bridge (駒) low on the skin)
    g.fillStyle = '#e9dcae'; g.fillRect(-7, 11, 14, 2.2)
    g.restore()
    const ux = Math.cos(ang), uy = Math.sin(ang)
    const neckA = [124 + ux * 22, 300 + uy * 22], neckB = [124 + ux * 162, 300 + uy * 162]
    line(5.5, '#24160e'); g.beginPath(); g.moveTo(neckA[0], neckA[1]); g.lineTo(neckB[0], neckB[1]); g.stroke()
    line(1, 'rgba(200,150,100,0.45)'); g.beginPath(); g.moveTo(neckA[0] - 1.6, neckA[1]); g.lineTo(neckB[0] - 1.6, neckB[1]); g.stroke()
    // (the pegbox bent back from the neck's top, and its three pegs out to either side)
    const tx = neckB[0] + ux * 4, ty = neckB[1] + uy * 4
    line(6.5, '#1c120c'); g.beginPath(); g.moveTo(neckB[0], neckB[1]); g.quadraticCurveTo(tx + ux * 8, ty + uy * 8, tx + ux * 10 + 5, ty + uy * 10 + 2); g.stroke()
    line(2.2, '#efe3c4')
    for (const [k, sd] of [[2, 1], [6, -1], [10, 1]] as [number, number][]) {
      const px = neckB[0] + ux * k, py = neckB[1] + uy * k
      g.beginPath(); g.moveTo(px - uy * sd * 2, py + ux * sd * 2); g.lineTo(px - uy * sd * 9, py + ux * sd * 9); g.stroke()
    }
    // (the three strings, from the bridge up to the pegs)
    line(0.45, 'rgba(250,244,228,0.95)')
    for (const o of [-1.4, 0, 1.4]) {
      const bx = 124 - ux * 12 - uy * o, by = 300 - uy * 12 + ux * o
      g.beginPath(); g.moveTo(bx, by); g.lineTo(neckB[0] - uy * o * 0.4, neckB[1] + ux * o * 0.4); g.stroke()
    }
    // (her hand out of her sleeve with the plectrum, over the skin)
    const bachi = new Path2D()
    bachi.moveTo(146, 282); bachi.lineTo(128, 266); bachi.lineTo(140, 254); bachi.lineTo(152, 276); bachi.closePath()
    g.fillStyle = '#ecdcae'; g.fill(bachi); line(0.8, '#6a5030'); g.stroke(bachi)
    const hand = new Path2D()
    hand.moveTo(142, 290); hand.bezierCurveTo(146, 280, 158, 280, 160, 288); hand.bezierCurveTo(160, 296, 152, 300, 146, 298); hand.closePath()
    g.fillStyle = '#faf5ec'; g.fill(hand); line(0.8); g.stroke(hand)
    line(0.6); g.beginPath(); g.moveTo(150, 285); g.lineTo(152, 293); g.moveTo(154, 284); g.lineTo(156, 291); g.stroke()
    // ---- the title in its cartouche, top right, and a seal at the foot
    g.fillStyle = '#efe2c2'; g.fillRect(162, 12, 28, 96)
    line(1); g.strokeRect(162, 12, 28, 96); g.strokeRect(164.5, 14.5, 23, 91)
    g.fillStyle = INK; g.font = '700 17px "Zen Antique", serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
    ;['三', '味', '線'].forEach((c, q) => g.fillText(c, 176, 38 + q * 26))
    seal(g, 14, 420, 24)
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
 * The round window's paper, as the light outside falls on it: by day the sky's cool blue through it; by night dark blue, a street lantern's
 * warm glow off to one side and the moon's paler one high up, the bamboo's shadows on it; at dusk the evening sun's orange, brightest where
 * it's low behind the paper, the bamboo's shadows thrown long and warm-dark; at dawn a pale rose under lavender, the bamboo's shadows faint.
 * Drawn again (the one canvas) whenever the part of the day turns (data-sky on the page).
 */
function drawRoundPaper(g: CanvasRenderingContext2D, sky: Sky) {
  const night = sky === 'night'
  g.clearRect(0, 0, 512, 512)
  if (sky === 'dusk' || sky === 'dawn') {
    const gr = g.createLinearGradient(0, 0, 0, 512)
    if (sky === 'dusk') { gr.addColorStop(0, '#ffebcf'); gr.addColorStop(0.45, '#ffd29e'); gr.addColorStop(1, '#f3a874') }
    else { gr.addColorStop(0, '#eceeff'); gr.addColorStop(0.5, '#f4dde8'); gr.addColorStop(1, '#ebc4c8') }
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512)
    // (the sun's own brightness through the paper: the evening's low on one side, the morning's a faint glow over it all)
    const [x, y, r, c] = sky === 'dusk' ? [330, 300, 260, 'rgba(255,244,214,0.75)'] : [256, 160, 330, 'rgba(255,250,246,0.5)']
    const l = g.createRadialGradient(x as number, y as number, 0, x as number, y as number, r as number)
    l.addColorStop(0, c as string); l.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = l; g.fillRect(0, 0, 512, 512)
  } else if (night) {
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
  if (night) bambooGrove(g, 'shadow')
  else if (sky === 'dusk') bambooGrove(g, 'shadow', '90,58,26')
  else if (sky === 'dawn') { g.globalAlpha = 0.45; bambooGrove(g, 'shadow', '70,58,104'); g.globalAlpha = 1 }
}
/**
 * The bamboo just outside the round window, in the paper's frame (512 x 512 over the window's round): two culms further off, thin, two
 * nearer and fuller, each tapering, its nodes ridged, and from some nodes a slender branch with a spray of narrow pointed leaves drooping
 * from its end; and a few sprays hanging in from above. Drawn the one way, by one seed, as the moon's shadows on the paper by night
 * (`shadow`), and as the bamboo itself seen with the shoji open (`day`: green culms lit down one side, their nodes pale rings, the leaves in
 * three greens; `night`: moonlit silhouettes, a cool light down one edge), so each culm, branch and leaf outside is where its shadow falls
 * (the owner's: the view open matching the shadows shut)
 */
function bambooGrove(g: CanvasRenderingContext2D, look: 'shadow' | 'day' | 'night', shade = '6,10,24') {
  const rnd = seeded(5)
  const shadow = look === 'shadow'
  const LEAF = look === 'day' ? ['#4f7a2c', '#6c9a3a', '#3f6424'] : ['#18261e', '#203226', '#121c16']
  let tone = 0
  const leaf = (len: number, wid: number) => {
    if (!shadow) g.fillStyle = LEAF[tone++ % 3]
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(wid, len * 0.34, 0, len); g.quadraticCurveTo(-wid * 0.8, len * 0.34, 0, 0); g.fill()
    // (the midrib: a fine paler line down the leaf)
    if (!shadow && len > 26) {
      g.strokeStyle = look === 'day' ? 'rgba(220,235,170,0.35)' : 'rgba(150,170,190,0.18)'
      g.lineWidth = 0.7
      g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(wid * 0.15, len * 0.4, 0, len * 0.9); g.stroke()
    }
  }
  const spray = (n: number, side: number, size: number) => {
    for (let k = 0; k < n; k++) {
      g.save()
      g.rotate(side * (0.35 + k * 0.32) + (rnd() - 0.5) * 0.25)
      leaf(size * (0.75 + rnd() * 0.45), size * 0.13)
      g.restore()
    }
  }
  const culm = (x: number, w: number, lean: number, blur: number, alpha: number, far: boolean) => {
    g.save()
    // (the shadows soft as the moon throws them; the bamboo itself crisp, the two further off a touch out of focus)
    g.filter = shadow ? `blur(${blur}px)` : far ? 'blur(0.8px)' : 'none'
    const ink = shadow ? `rgba(${shade},${alpha})` : look === 'day' ? '#4a5e22' : '#141e18'
    g.fillStyle = ink
    g.strokeStyle = ink
    g.translate(x, 540)
    g.rotate(lean)
    // (the culm: its shadow from below the paper up past its top; the bamboo itself on down to the ground, out of sight under the window)
    const foot = shadow ? 0 : 260
    if (!shadow) {
      const body = g.createLinearGradient(-w / 2, 0, w / 2, 0)
      if (look === 'day') { body.addColorStop(0, '#5f7a2a'); body.addColorStop(0.3, '#a6be58'); body.addColorStop(0.55, '#8eaa44'); body.addColorStop(1, '#4e6622') }
      else { body.addColorStop(0, '#2c3c46'); body.addColorStop(0.25, '#1a2620'); body.addColorStop(1, '#0f1712') }
      g.fillStyle = body
    }
    g.beginPath(); g.moveTo(-w / 2, foot); g.lineTo(-w * 0.4, -620); g.lineTo(w * 0.4, -620); g.lineTo(w / 2, foot); g.fill()
    g.fillStyle = ink
    for (let y = 30 + rnd() * 40; y < 600; y += 74 + rnd() * 26) {
      // (a node: the culm's ridge across it, a little proud each side; on the bamboo itself a pale ring over a dark line)
      if (shadow) g.fillRect(-w * 0.62, -y - 1.6, w * 1.24, 3.4)
      else {
        g.fillStyle = look === 'day' ? '#d8dc9a' : '#3a4a52'
        g.fillRect(-w * 0.58, -y - 1.6, w * 1.16, 1.8)
        g.fillStyle = ink
        g.fillRect(-w * 0.55, -y + 0.2, w * 1.1, 1.4)
      }
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
  culm(146, 11, 0.05, 2.4, 0.26, true)
  culm(214, 8, -0.035, 2.6, 0.22, true)
  culm(366, 17, 0.03, 0.9, 0.46, false)
  culm(434, 12, -0.06, 1.1, 0.4, false)
  // (sprays hanging in from above, out of the frame)
  g.save()
  g.filter = shadow ? 'blur(1.4px)' : 'none'
  g.fillStyle = `rgba(${shade},0.34)`
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
  const draw = () => { drawRoundPaper(g, skyNow()); t.needsUpdate = true }
  draw()
  onSky(draw)
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
/**
 * What's outside the round window, seen with its shoji slid open (the owner's: the shop's in a city, and the view wants depth; it was bamboo
 * against the sky, flat): a city backstreet in four layers, each drawn at its own depth behind the window and looked through it in
 * perspective (ROUND_VIEW's shader), so as the camera moves the near things slide across the far ones. Near (0.2 behind it): a few bamboo,
 * the ones whose shadows fall on the paper by night (bambooGrove; there was a low fence of split bamboo and a wire: the owner took them away).
 * Across the alley (1.2): old two- and three-storey fronts, their windows, a vertical sign or two, the
 * air conditioners' outdoor units, a utility pole with its transformer and the wires strung from it. Far off (5): the city's towers, hazy blue
 * with the distance by day, by night their windows lit and red lights on their tops, and a lattice radio tower among them. And the sky (20): by
 * day blue, paler toward the horizon, a few clouds; by night deep blue, the city's glow along its foot, a few stars and the moon. Each layer's
 * picture spans a half-size `H` either way of the window's middle (in its own units), so it fills the view at an angle too.
 */
const VIEW_LAYERS = { near: { d: 0.2, H: 0.52 }, mid: { d: 1.2, H: 1.12 }, far: { d: 5, H: 3.4 }, sky: { d: 20, H: 12.4 } }
type ViewLayer = keyof typeof VIEW_LAYERS
/** a layer's picture's own places: x, y (the window's units, its middle 0, up +) to the canvas's pixels */
const viewPx = (k: ViewLayer, size: number) => {
  const H = VIEW_LAYERS[k].H
  return { X: (x: number) => (x / H * 0.5 + 0.5) * size, Y: (y: number) => (0.5 - y / H * 0.5) * size, S: (l: number) => (l / H * 0.5) * size }
}
/** the street's day-lit pictures toned to the light of dawn or dusk: everything drawn on the layer (and only that) washed over with it */
function toneTo(g: CanvasRenderingContext2D, size: number, sky: Sky, dusk: string, dawn: string) {
  if (sky !== 'dusk' && sky !== 'dawn') return
  g.save()
  g.filter = 'none'
  g.globalCompositeOperation = 'source-atop'
  g.fillStyle = sky === 'dusk' ? dusk : dawn
  g.fillRect(0, 0, size, size)
  g.restore()
}
function drawViewSky(g: CanvasRenderingContext2D, size: number, sky: Sky) {
  const night = sky === 'night'
  const { X, Y, S } = viewPx('sky', size)
  const grd = g.createLinearGradient(0, 0, 0, size)
  if (sky === 'dusk' || sky === 'dawn') {
    // (dusk: deep violet overhead to the orange glow along the horizon, the sun low in it; dawn: blue going pale, a rose and peach band low
    // down, the last stars fading)
    const stops: [number, string][] = sky === 'dusk'
      ? [[0, '#3a4076'], [0.3, '#76668f'], [0.43, '#e5a070'], [0.5, '#ffd28a'], [0.54, '#f5bb7e'], [1, '#6a5258']]
      : [[0, '#5f80c8'], [0.36, '#a9b7e6'], [0.46, '#f1c6cc'], [0.5, '#ffdcbc'], [0.54, '#f3d2c6'], [1, '#cdbfd0']]
    for (const [k, c] of stops) grd.addColorStop(k, c)
    g.fillStyle = grd
    g.fillRect(0, 0, size, size)
    const rnd = seeded(91)
    if (sky === 'dusk') {
      const sx = X(1.9), sy = Y(1.7), sr = S(0.62)
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 7)
      glow.addColorStop(0, 'rgba(255,240,200,0.9)'); glow.addColorStop(0.25, 'rgba(255,196,112,0.45)'); glow.addColorStop(1, 'rgba(255,170,100,0)')
      g.fillStyle = glow
      g.fillRect(sx - sr * 7, sy - sr * 7, sr * 14, sr * 14)
      g.fillStyle = '#fff1d0'
      g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill()
    } else {
      for (let k = 0; k < 24; k++) {
        g.fillStyle = `rgba(255,255,250,${0.15 + rnd() * 0.35})`
        g.fillRect(rnd() * size, rnd() * size * 0.22, 1, 1)
      }
    }
    // (long thin clouds lit from below: gold and rose at dusk, pink at dawn)
    g.filter = 'blur(5px)'
    for (const [cx, cy, w] of [[-3.5, 3.0, 3.2], [2.8, 4.4, 3.6], [0.2, 2.4, 2.2], [5.2, 2.9, 2.6], [-6, 4.8, 3.0]]) {
      g.fillStyle = sky === 'dusk' ? 'rgba(255,200,145,0.7)' : 'rgba(255,212,222,0.75)'
      for (let k = 0; k < 6; k++) {
        const r = S(w * (0.1 + rnd() * 0.08))
        g.beginPath(); g.ellipse(X(cx + (rnd() - 0.5) * w), Y(cy + rnd() * w * 0.12), r * 2.6, r, 0, 0, Math.PI * 2); g.fill()
      }
      g.fillStyle = sky === 'dusk' ? 'rgba(138,104,122,0.42)' : 'rgba(190,170,210,0.4)'
      g.fillRect(X(cx - w * 0.5), Y(cy + 0.02), S(w), S(0.1))
    }
    g.filter = 'none'
    return
  }
  if (night) { grd.addColorStop(0, '#070d22'); grd.addColorStop(0.42, '#14214a'); grd.addColorStop(0.5, '#3a3550'); grd.addColorStop(0.53, '#6a4a48'); grd.addColorStop(1, '#1a1a26') }
  else { grd.addColorStop(0, '#3f86d8'); grd.addColorStop(0.4, '#8dbcef'); grd.addColorStop(0.5, '#d4e8fb'); grd.addColorStop(1, '#c8dcef') }
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const rnd = seeded(91)
  if (night) {
    // (a few stars, the city's glow drowning those low down; the moon, high, its halo)
    for (let k = 0; k < 90; k++) {
      const x = rnd() * size, y = rnd() * size * 0.45
      g.fillStyle = `rgba(255,255,240,${0.25 + rnd() * 0.6})`
      g.fillRect(x, y, 1 + (rnd() < 0.15 ? 1 : 0), 1 + (rnd() < 0.15 ? 1 : 0))
    }
    const mx = X(-2.2), my = Y(4.2), mr = S(0.55)
    const halo = g.createRadialGradient(mx, my, 0, mx, my, mr * 6)
    halo.addColorStop(0, 'rgba(255,250,225,0.5)'); halo.addColorStop(0.3, 'rgba(190,200,255,0.15)'); halo.addColorStop(1, 'rgba(190,200,255,0)')
    g.fillStyle = halo
    g.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12)
    g.fillStyle = '#fff6da'
    g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(200,190,160,0.35)'
    for (const [dx, dy, r] of [[-0.25, -0.1, 0.22], [0.2, 0.25, 0.15], [0.05, -0.35, 0.12]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); g.fill() }
  } else {
    // (a few clouds: soft heaps of white, flat below, drifting high)
    g.filter = 'blur(6px)'
    for (const [cx, cy, w] of [[-3.5, 3.2, 2.4], [2.6, 4.6, 3.0], [0.4, 2.2, 1.6], [5.5, 2.6, 2.0], [-6, 5.2, 2.6]]) {
      g.fillStyle = 'rgba(255,255,255,0.85)'
      for (let k = 0; k < 7; k++) {
        const r = S(w * (0.18 + rnd() * 0.16))
        g.beginPath(); g.arc(X(cx + (rnd() - 0.5) * w), Y(cy + rnd() * w * 0.22), r, 0, Math.PI * 2); g.fill()
      }
      g.fillStyle = 'rgba(205,220,240,0.6)'
      g.fillRect(X(cx - w * 0.55), Y(cy - 0.05), S(w * 1.1), S(0.18))
    }
    g.filter = 'none'
  }
}
function drawViewFar(g: CanvasRenderingContext2D, size: number, sky: Sky) {
  const night = sky === 'night'
  const { X, Y, S } = viewPx('far', size)
  g.clearRect(0, 0, size, size)
  const rnd = seeded(37)
  // (far off, the haze of the distance: their colour gone toward the sky's)
  const body = night ? '#121a30' : '#8aa3c2', edge = night ? '#0c1222' : '#7d97b8'
  g.filter = 'blur(0.8px)'
  // (the radio tower: a lattice tapering up, two decks, its top a mast; red and white by day, lit warm by night)
  const tx = -0.9
  const tower = (x: number, y: number) => [X(tx + x), Y(y)] as const
  g.strokeStyle = night ? '#ffb45a' : '#d9663f'
  g.lineWidth = Math.max(1, S(0.012))
  for (const sd of [-1, 1]) {
    g.beginPath()
    g.moveTo(...tower(sd * 0.45, -0.6)); g.quadraticCurveTo(...tower(sd * 0.12, 0.6), ...tower(sd * 0.04, 1.9))
    g.stroke()
  }
  for (let k = 0; k < 14; k++) {
    const y0 = -0.6 + k * 0.18, w0 = 0.45 * Math.pow(1 - (y0 + 0.6) / 2.6, 1.6) + 0.04
    const y1 = y0 + 0.18, w1 = 0.45 * Math.pow(1 - (y1 + 0.6) / 2.6, 1.6) + 0.04
    g.beginPath(); g.moveTo(...tower(-w0, y0)); g.lineTo(...tower(w1, y1)); g.moveTo(...tower(w0, y0)); g.lineTo(...tower(-w1, y1)); g.stroke()
  }
  g.fillStyle = night ? '#ffc070' : '#f2f0ea'
  g.fillRect(X(tx - 0.16), Y(0.85), S(0.32), S(0.08))
  g.fillRect(X(tx - 0.08), Y(1.5), S(0.16), S(0.06))
  g.fillRect(X(tx - 0.012), Y(2.6), S(0.024), S(0.7))
  // (the towers: a row of blocks of every height and width along the horizon, some stepped, each with its windows)
  let x = -3.4
  while (x < 3.4) {
    const w = 0.22 + rnd() * 0.45, h = 0.2 + rnd() * rnd() * 1.6 + (Math.abs(x - 0.6) < 0.8 ? 0.4 : 0)
    const y0 = -0.75
    g.fillStyle = rnd() < 0.5 ? body : edge
    g.fillRect(X(x), Y(y0 + h), S(w), S(h))
    if (rnd() < 0.3) g.fillRect(X(x + w * 0.2), Y(y0 + h + 0.12), S(w * 0.6), S(0.12))
    // (windows: by night lit, warm and cool, many dark; by day faint lines)
    const rows = Math.floor(h / 0.045), cols = Math.max(2, Math.floor(w / 0.05))
    for (let r = 1; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (night) {
        if (rnd() < 0.42) {
          g.fillStyle = rnd() < 0.7 ? 'rgba(255,214,140,0.85)' : 'rgba(190,220,255,0.75)'
          g.fillRect(X(x + (c + 0.3) * (w / cols)), Y(y0 + r * 0.045), Math.max(1, S(w / cols * 0.45)), Math.max(1, S(0.018)))
        }
      } else if (r % 2 === 0) {
        g.fillStyle = 'rgba(220,232,245,0.35)'
        g.fillRect(X(x + (c + 0.2) * (w / cols)), Y(y0 + r * 0.045), Math.max(1, S(w / cols * 0.6)), Math.max(1, S(0.012)))
      }
    }
    if (night && h > 0.9) { g.fillStyle = '#ff3a2a'; g.beginPath(); g.arc(X(x + w / 2), Y(y0 + h + 0.02), Math.max(1.5, S(0.016)), 0, Math.PI * 2); g.fill() }
    x += w + (rnd() < 0.25 ? 0.05 + rnd() * 0.15 : 0)
  }
  g.filter = 'none'
  // (the haze at their feet, the street's lights by night)
  const haze = g.createLinearGradient(0, Y(-0.2), 0, Y(-0.8))
  haze.addColorStop(0, night ? 'rgba(90,60,70,0)' : 'rgba(210,225,240,0)')
  haze.addColorStop(1, night ? 'rgba(120,80,70,0.7)' : 'rgba(210,225,240,0.75)')
  g.fillStyle = haze
  g.fillRect(0, Y(-0.2), size, Y(-0.8) - Y(-0.2))
  // (at dusk the towers dark violet against the glow behind them, at dawn a lavender haze)
  toneTo(g, size, sky, 'rgba(66,44,92,0.58)', 'rgba(150,140,196,0.38)')
}
function drawViewMid(g: CanvasRenderingContext2D, size: number, sky: Sky) {
  const night = sky === 'night'
  const { X, Y, S } = viewPx('mid', size)
  g.clearRect(0, 0, size, size)
  const rnd = seeded(58)
  // (the fronts across the alley: each its own height, colour and windows, the street below out of sight)
  // (low enough that the city's towers and the sky show over them through the window's upper half: the depth's in what's seen beyond)
  const fronts = [
    { x: -1.12, w: 0.62, top: 0.02, col: '#b7a58a', win: 3 },
    { x: -0.5, w: 0.5, top: 0.2, col: '#8c8f93', win: 2 },
    { x: 0.0, w: 0.04, top: -1, col: '#000', win: 0 },
    { x: 0.04, w: 0.56, top: -0.06, col: '#c9b9a0', win: 3 },
    { x: 0.6, w: 0.56, top: 0.26, col: '#9d8470', win: 3 },
  ]
  const dim = night ? 0.26 : 1
  const shade = (hex: string, k: number) => { const c = new THREE.Color(hex).multiplyScalar(k); return `#${c.getHexString()}` }
  for (const f of fronts) {
    if (f.top < -0.5) continue
    g.fillStyle = shade(f.col, dim)
    g.fillRect(X(f.x), Y(f.top), S(f.w), Y(-1.1) - Y(f.top))
    // (its parapet and the shadow under it)
    g.fillStyle = shade(f.col, dim * 0.78)
    g.fillRect(X(f.x - 0.01), Y(f.top + 0.03), S(f.w + 0.02), S(0.05))
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(X(f.x), Y(f.top - 0.02), S(f.w), S(0.03))
    // (its windows, floor by floor: frames, the panes dark or lit, a curtain here and there)
    for (let fl = 0; fl < 3; fl++) {
      const wy = f.top - 0.16 - fl * 0.34
      if (wy < -0.95) break
      for (let k = 0; k < f.win; k++) {
        const wx = f.x + 0.06 + k * (f.w - 0.08) / f.win
        const ww = (f.w - 0.08) / f.win - 0.06, wh = 0.16
        g.fillStyle = shade('#5a5148', dim)
        g.fillRect(X(wx - 0.008), Y(wy + 0.008), S(ww + 0.016), S(wh + 0.016))
        const lit = night && rnd() < 0.55
        g.fillStyle = lit ? (rnd() < 0.7 ? '#ffd389' : '#bfe0ff') : night ? '#1b2030' : '#6f8ea8'
        g.fillRect(X(wx), Y(wy), S(ww), S(wh))
        if (!night) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(X(wx + ww * 0.1), Y(wy - 0.01), S(ww * 0.25), S(wh * 0.8)) }
        if (rnd() < 0.4) { g.fillStyle = lit ? 'rgba(240,170,110,0.75)' : 'rgba(220,210,190,0.7)'; g.fillRect(X(wx), Y(wy), S(ww * 0.35), S(wh)) }
      }
      // (an air conditioner's outdoor unit on a bracket under a window, now and then)
      if (rnd() < 0.6) {
        const ax = f.x + 0.08 + rnd() * (f.w - 0.3)
        g.fillStyle = night ? '#4a4c50' : '#e6e4dc'
        g.fillRect(X(ax), Y(wy - 0.2), S(0.16), S(0.11))
        g.strokeStyle = night ? '#2a2c30' : '#9a9890'
        g.lineWidth = Math.max(1, S(0.006))
        g.beginPath(); g.arc(X(ax + 0.1), Y(wy - 0.255), S(0.035), 0, Math.PI * 2); g.stroke()
      }
    }
  }
  // (the signs: tall boards on the fronts, lit by night)
  const sign = (x: number, top: number, h: number, bg: string, fg: string, text: string) => {
    const glow = night
    if (glow) { g.fillStyle = bg; g.globalAlpha = 0.35; g.filter = 'blur(8px)'; g.fillRect(X(x - 0.04), Y(top + 0.04), S(0.16), S(h + 0.08)); g.filter = 'none'; g.globalAlpha = 1 }
    g.fillStyle = glow ? bg : shade(bg, 0.85)
    g.fillRect(X(x), Y(top), S(0.08), S(h))
    g.strokeStyle = shade(bg, 0.5)
    g.lineWidth = Math.max(1, S(0.005))
    g.strokeRect(X(x), Y(top), S(0.08), S(h))
    g.fillStyle = fg
    g.font = `bold ${Math.round(S(0.055))}px "Yu Mincho", "MS Mincho", serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const chars = [...text]
    chars.forEach((ch, i) => g.fillText(ch, X(x + 0.04), Y(top - (i + 0.5) * (h / chars.length))))
  }
  sign(-0.42, 0.12, 0.42, night ? '#ff4d6d' : '#c8344c', '#fff6ee', 'スナック')
  sign(0.12, -0.14, 0.34, night ? '#ffd24a' : '#e2b23a', '#3a2410', 'ラーメン')
  sign(0.98, 0.16, 0.36, night ? '#5ad1ff' : '#2f8fc4', '#ffffff', '居酒屋')
  // (a lantern hung by a door below, by night its glow)
  if (night) { const lg = g.createRadialGradient(X(-0.8), Y(-0.55), 0, X(-0.8), Y(-0.55), S(0.25)); lg.addColorStop(0, 'rgba(255,170,90,0.7)'); lg.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = lg; g.fillRect(X(-1.05), Y(-0.3), S(0.5), S(0.5)) }
  // (the utility pole: its concrete shaft, a crossarm, a transformer, insulators; and its wires, sagging off both ways)
  const px = 0.36
  g.fillStyle = night ? '#2e3036' : '#a8a8a2'
  g.beginPath(); g.moveTo(X(px - 0.03), Y(-1.1)); g.lineTo(X(px - 0.018), Y(1.0)); g.lineTo(X(px + 0.018), Y(1.0)); g.lineTo(X(px + 0.03), Y(-1.1)); g.fill()
  g.fillStyle = night ? '#24262c' : '#7c7c76'
  g.fillRect(X(px - 0.2), Y(0.86), S(0.4), S(0.025))
  g.fillRect(X(px - 0.15), Y(0.6), S(0.3), S(0.02))
  g.fillStyle = night ? '#3a3e44' : '#8f9497'
  g.fillRect(X(px + 0.03), Y(0.55), S(0.09), S(0.15))
  g.fillRect(X(px - 0.12), Y(0.55), S(0.09), S(0.15))
  g.strokeStyle = night ? 'rgba(10,10,14,0.9)' : 'rgba(40,40,40,0.85)'
  g.lineWidth = Math.max(1, S(0.005))
  for (const [y, sag] of [[0.86, 0.12], [0.84, 0.16], [0.6, 0.1], [0.58, 0.14], [0.45, 0.2]] as [number, number][]) {
    for (const sd of [-1, 1]) {
      g.beginPath()
      g.moveTo(X(px + sd * 0.18), Y(y))
      g.quadraticCurveTo(X(px + sd * 0.7), Y(y - sag * 1.6), X(px + sd * 1.15), Y(y - sag * 0.4))
      g.stroke()
    }
  }
  // (the fronts across the alley in the shade at dusk, the sun going down behind them, warm on their edges; cool and grey at dawn)
  toneTo(g, size, sky, 'rgba(94,72,62,0.38)', 'rgba(118,118,168,0.26)')
}
function drawViewNear(g: CanvasRenderingContext2D, size: number, sky: Sky) {
  const { X, S } = viewPx('near', size)
  g.clearRect(0, 0, size, size)
  // (a few bamboo just outside (the owner's: the fence taken away), the very ones whose shadows the moon throws on the paper: the paper's
  // 512 px over the window's round, laid on this layer's own span)
  g.save()
  g.translate(X(-ROUND_R), X(-ROUND_R))
  g.scale(S(2 * ROUND_R) / 512, S(2 * ROUND_R) / 512)
  bambooGrove(g, sky === 'night' ? 'night' : 'day')
  g.restore()
  // (against the evening sun the bamboo's dark, its edges warm; in the dawn a cool grey-green)
  toneTo(g, size, sky, 'rgba(40,30,20,0.6)', 'rgba(70,72,110,0.3)')
}
/** the four layers' pictures, made again as the part of the day turns */
const ROUND_VIEW = (() => {
  if (typeof document === 'undefined') return null
  const make = (size: number, draw: (g: CanvasRenderingContext2D, size: number, sky: Sky) => void) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { t, paint: (sky: Sky) => { draw(g, size, sky); t.needsUpdate = true } }
  }
  const layers = { sky: make(512, drawViewSky), far: make(1024, drawViewFar), mid: make(1024, drawViewMid), near: make(512, drawViewNear) }
  // (only when it's turned: the two marks change together, and each would paint all four again)
  let painted: Sky | null = null
  const paint = () => { const sky = skyNow(); if (sky === painted) return; painted = sky; for (const l of Object.values(layers)) l.paint(sky) }
  paint()
  onSky(paint)
  const L = VIEW_LAYERS
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSky: { value: layers.sky.t }, uFar: { value: layers.far.t }, uMid: { value: layers.mid.t }, uNear: { value: layers.near.t },
      uCam: { value: new THREE.Vector3(0, 0, 3) } },
    vertexShader: `varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uSky, uFar, uMid, uNear;
uniform vec3 uCam;
varying vec3 vLocal;
vec4 layer(sampler2D t, vec2 xy, float H) { return texture2D(t, clamp(xy / (2.0 * H) + 0.5, 0.0, 1.0)); }
void main() {
  // (the way the eye looks through this point of the window, on into the street: where it meets each layer)
  vec3 dir = normalize(vLocal - uCam);
  vec2 slope = dir.xy / max(-dir.z, 0.15);
  vec3 c = layer(uSky, vLocal.xy + slope * ${L.sky.d.toFixed(1)}, ${L.sky.H.toFixed(2)}).rgb;
  vec4 f = layer(uFar, vLocal.xy + slope * ${L.far.d.toFixed(1)}, ${L.far.H.toFixed(2)}); c = mix(c, f.rgb, f.a);
  vec4 m = layer(uMid, vLocal.xy + slope * ${L.mid.d.toFixed(1)}, ${L.mid.H.toFixed(2)}); c = mix(c, m.rgb, m.a);
  vec4 n = layer(uNear, vLocal.xy + slope * ${L.near.d.toFixed(1)}, ${L.near.H.toFixed(2)}); c = mix(c, n.rgb, n.a);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  })
  return mat
})()
/**
 * The round window's shoji (the owner's: it opens left and right): two halves, each a half of the paper with its own lattice (bars over the
 * washi), sliding apart into the wall when clicked and back together at another, with the runners' sound, cut to the window's round
 * (whatever slides past its edge is in the wall, unseen); behind them the view outside (ROUND_VIEW: a city backstreet, in depth). They swung open into the room for a
 * while, hinged at the round's left and right like the fridges' doors; the owner found the half-moons standing out in the air odd, and chose
 * this, as a round window's shoji does. (A passer-by's shadow crossed the paper by day now and then: the owner found it odd and had it
 * taken away.) Not batched: it moves, and it's clicked.
 */
function RoundShoji() {
  const R = ROUND_R
  const win = useRef<THREE.Group>(null)
  const halves = useRef<(THREE.Group | null)[]>([])
  const view = useRef<THREE.Mesh>(null)
  const st = useRef({ open: false, k: 0 })
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
    }
  }, [inv, R])
  useEffect(() => () => { round.paper.dispose(); round.wood.dispose() }, [round])
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
  const eye = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }, dt) => {
    const w = win.current
    const s = st.current
    if (!w) return
    inv.value.copy(w.matrixWorld).invert()
    // (where the eye is, in the window's own frame: the street's layers are looked through from there)
    if (view.current && ROUND_VIEW) ROUND_VIEW.uniforms.uCam.value.copy(view.current.worldToLocal(eye.copy(camera.position)))
    const want = s.open ? 1 : 0
    s.k += Math.sign(want - s.k) * Math.min(Math.abs(want - s.k), Math.min(dt, 0.1) * 1.6)
    const e = s.k * s.k * (3 - 2 * s.k)
    halves.current.forEach((h, i) => { if (h) h.position.z = (i ? 1 : -1) * e * (R + 0.02) })
  })
  const says = () => (st.current.open ? '點一下關上' : '點一下打開（左右拉開）')
  return (
    <group ref={win} name="round-shoji">
      {/* (outside, behind it all: the street, seen in depth through the window (ROUND_VIEW)) */}
      <mesh ref={view} position-x={-0.001} rotation-y={-Math.PI / 2} material={ROUND_VIEW ?? undefined}>
        <circleGeometry args={[R, 64]} />
      </mesh>
      <group onClick={(ev) => {
        ev.stopPropagation()
        if (getEdit().on) return
        st.current.open = !st.current.open
        slideDoorSound(st.current.open)
        setTip({ title: '圓窗', hint: says() })
      }}
        onPointerOver={(ev) => { if (getEdit().on) return; tipOver('圓窗', says()).onPointerOver(ev) }}
        onPointerOut={(ev) => { tipOver('圓窗', '').onPointerOut(ev) }}>
        {/* (the whole window to point at, its frame too, open or shut: an unseen disc out over the frame (the owner's); the pointer's rays
            don't mind it's unseen) */}
        <mesh position-x={-0.092} rotation-y={-Math.PI / 2} visible={false}>
          <circleGeometry args={[R + 0.08, 32]} />
        </mesh>
        {[0, 1].map((i) => (
          <group key={i} ref={(o) => { halves.current[i] = o }}>
            <mesh position-x={-0.004} rotation-y={-Math.PI / 2} material={round.paper}>
              <circleGeometry args={[R, 48, i ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
            </mesh>
            <mesh geometry={bars[i]} material={round.wood} />
          </group>
        ))}
      </group>
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
/** the light from outside about the round window, by the part of the day: its colour, and how strong (none by day, the sky's light all
 * over then) */
const SKY_GLOWS: { m: THREE.MeshBasicMaterial; looks: Record<Sky, [string, number]> }[] = []
function skyGlow(m: THREE.MeshBasicMaterial, looks: Record<Sky, [string, number]>) {
  SKY_GLOWS.push({ m, looks })
  const [c, o] = looks[skyNow()]
  m.color.set(c)
  m.opacity = o
  return m
}
if (typeof document !== 'undefined') onSky(() => { const s = skyNow(); for (const { m, looks } of SKY_GLOWS) { m.color.set(looks[s][0]); m.opacity = looks[s][1] } })
// (by night the moon's faint blue glow round the window and its shaft slanting in, dust drifting in it (WindowDust); at dusk the evening
// sun's, orange and stronger; at dawn only a faint rose glow round it (the morning sun's on the room's other side); by day none)
const WINDOW_HALO = skyGlow(new THREE.MeshBasicMaterial({ map: DAYLIGHT.halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  toneMapped: false }), { day: ['#8fc4ff', 0], dawn: ['#ffc6d4', 0.12], dusk: ['#ffc07c', 0.3], night: ['#8fc4ff', 0.22] })
const SUNBEAM = skyGlow(new THREE.MeshBasicMaterial({ map: DAYLIGHT.beam, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  toneMapped: false, side: THREE.DoubleSide }), { day: ['#78b2ff', 0], dawn: ['#ffd6de', 0], dusk: ['#ffb872', 0.22], night: ['#78b2ff', 0.15] })
/** the dust in the moon's shaft by night, in the evening sun's at dusk: specks drifting slowly down it and about, catching its light (in the
 * window's frame, as the shaft) */
// (24 of them, the owner's: fewer specks; they were 46)
const DUST_N = 24
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
    const sky = skyNow()
    o.visible = sky === 'night' || sky === 'dusk'
    if (!o.visible) return
    mat.color.set(sky === 'dusk' ? '#ffd8a8' : '#cfe4ff')
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
/** words fitted to a width: as big as `size` but never wider than `w` (measured in their own face), centred at x, y */
function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, size: number, ink: string, face = 'sans-serif', weight = 'bold', spacing = 0) {
  g.save()
  g.font = `${weight} ${size}px ${face}`
  const width = g.measureText(text).width + spacing * Math.max(0, [...text].length - 1)
  const k = Math.min(1, w / Math.max(1, width))
  g.font = `${weight} ${size * k}px ${face}`
  ;(g as unknown as { letterSpacing: string }).letterSpacing = `${spacing * k}px`
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, x + (spacing * k) / 2, y)
  g.restore()
}
/**
 * The plaque over each toilet's door (the owner's: some design to it, and its words in the language on screen): a board of pale keyaki, its
 * grain running along it, a dark rim and a fine gold line inside that; a round badge in the room's colour (indigo the men's, vermilion the
 * women's) with a white figure in it; the big character brushed in that colour (男, 女; in English MEN, WOMEN); and a band along its foot
 * in the colour with what it is in white (男廁 · MEN, 男性 · お手洗い, RESTROOM). Made once for each room and language.
 */
const WC_SIGN_MADE = new Map<string, THREE.Texture | null>()
function wcSign(who: 'm' | 'f', lang: string) {
  const key = `${who}|${lang}`
  if (!WC_SIGN_MADE.has(key)) WC_SIGN_MADE.set(key, canvasTex(320, 192, (g) => {
    const ink = who === 'm' ? '#24407a' : '#b8262a'
    const ja = lang.startsWith('ja'), en = lang.startsWith('en')
    g.save()
    const rim = new Path2D(); rim.roundRect(4, 4, 312, 184, 22)
    g.fillStyle = '#4a2c18'; g.fill(rim)
    const face = new Path2D(); face.roundRect(11, 11, 298, 170, 16)
    const wood = g.createLinearGradient(0, 11, 0, 181)
    wood.addColorStop(0, '#d9ad74'); wood.addColorStop(0.5, '#e8c590'); wood.addColorStop(1, '#cc9c62')
    g.fillStyle = wood; g.fill(face)
    g.save(); g.clip(face)
    g.strokeStyle = 'rgba(120,72,30,0.22)'; g.lineWidth = 1.2
    for (let k = 0; k < 17; k++) {
      const y0 = 12 + k * 10.5
      g.beginPath()
      for (let x = 0; x <= 320; x += 8) { const y = y0 + Math.sin(x / 55 + k * 0.9) * 4 + Math.sin(x / 17 + k) * 1.2; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y) }
      g.stroke()
    }
    const vg = g.createRadialGradient(160, 96, 60, 160, 96, 190)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(70,36,10,0.3)')
    g.fillStyle = vg; g.fillRect(0, 0, 320, 192)
    g.restore()
    g.strokeStyle = '#c9a24e'; g.lineWidth = 2
    g.beginPath(); g.roundRect(19, 19, 282, 154, 11); g.stroke()
    // (the band along its foot)
    g.fillStyle = ink; g.beginPath(); g.roundRect(28, 136, 264, 28, 6); g.fill()
    const band = en ? 'RESTROOM' : ja ? (who === 'm' ? '男性 · お手洗い' : '女性 · お手洗い') : (who === 'm' ? '男廁 · MEN' : '女廁 · WOMEN')
    fitText(g, band, 160, 151, 244, 18, '#fbf4e6', 'sans-serif', 'bold', en ? 4 : 2)
    // (the badge and its figure)
    const cx = 80, cy = 76, R = 44
    g.fillStyle = ink; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#f6ecd6'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, R - 6, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#fbf4e6'
    g.beginPath(); g.arc(cx, cy - 21, 7.5, 0, Math.PI * 2); g.fill()
    if (who === 'm') {
      g.beginPath(); g.roundRect(cx - 12, cy - 10, 24, 25, 5); g.fill()
      g.fillRect(cx - 10, cy + 12, 8, 20); g.fillRect(cx + 2, cy + 12, 8, 20)
    } else {
      g.beginPath(); g.moveTo(cx, cy - 11); g.lineTo(cx + 18, cy + 17); g.lineTo(cx - 18, cy + 17); g.closePath(); g.fill()
      g.fillRect(cx - 9, cy + 15, 6, 17); g.fillRect(cx + 3, cy + 15, 6, 17)
    }
    // (the big character, or the word)
    if (en) fitText(g, who === 'm' ? 'MEN' : 'WOMEN', 208, 78, 150, 60, ink, SIGN_FONT, 'bold', 2)
    else brushText(g, who === 'm' ? '男' : '女', 206, 76, 100, { fill: ink, edge: '#f6ecd6', shadow: 'rgba(60,30,10,0.35)', shine: '#ffffff' })
    g.restore()
  }))
  return WC_SIGN_MADE.get(key) ?? null
}

/** a family crest (紋) in one colour, centred at x, y, `R` its radius: 梅鉢 (plum blossom: five round petals, a dot in its heart and a ring of
 * small ones round it) or 桜 (cherry blossom: five petals each notched at its tip, stamens in its heart), after the owner's two references */
function crest(g: CanvasRenderingContext2D, kind: 'ume' | 'sakura', x: number, y: number, R: number, ink: string, ground: string) {
  g.save()
  g.translate(x, y)
  g.fillStyle = ink
  if (kind === 'ume') {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5
      g.beginPath(); g.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.345, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = ground; g.beginPath(); g.arc(0, 0, R * 0.3, 0, Math.PI * 2); g.fill()
    g.fillStyle = ink; g.beginPath(); g.arc(0, 0, R * 0.1, 0, Math.PI * 2); g.fill()
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5
      g.beginPath(); g.arc(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, R * 0.05, 0, Math.PI * 2); g.fill()
    }
  } else {
    for (let k = 0; k < 5; k++) {
      g.save()
      g.rotate((k * 2 * Math.PI) / 5)
      g.beginPath()
      g.moveTo(0, -R * 0.16)
      g.bezierCurveTo(-R * 0.22, -R * 0.3, -R * 0.46, -R * 0.62, -R * 0.32, -R * 0.9)
      g.quadraticCurveTo(-R * 0.2, -R * 1.03, -R * 0.08, -R * 0.99)
      g.lineTo(0, -R * 0.85)
      g.lineTo(R * 0.08, -R * 0.99)
      g.quadraticCurveTo(R * 0.2, -R * 1.03, R * 0.32, -R * 0.9)
      g.bezierCurveTo(R * 0.46, -R * 0.62, R * 0.22, -R * 0.3, 0, -R * 0.16)
      g.closePath(); g.fill()
      g.restore()
    }
    g.beginPath(); g.arc(0, 0, R * 0.08, 0, Math.PI * 2); g.fill()
    g.strokeStyle = ink; g.lineWidth = Math.max(1, R * 0.03)
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5
      g.beginPath(); g.moveTo(Math.cos(a) * R * 0.08, Math.sin(a) * R * 0.08); g.lineTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); g.stroke()
      g.beginPath(); g.arc(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22, R * 0.035, 0, Math.PI * 2); g.fill()
    }
  }
  g.restore()
}
/** the noren over each toilet's door (the owner's: longer, and close fitting: as wide as the doorway, the posts' inner faces just covered,
 * its top up over the head where it hangs from its rod, no gap showing the shoji above it): across both its panels, and down */
const WC_NOREN_W = 0.85, WC_NOREN_L = 0.6
/**
 * The noren over each toilet's door (the owner's: some pattern on them, cut in half down the middle): navy for the men's with a white
 * 梅鉢 across its middle, deep red for the women's with a white 桜, the slit between its two panels cutting the crest in half; a darker band
 * along its top where it's sewn over its rod, the crest small and tone on tone scattered over the rest, a white line along its hem, the
 * cotton's weave. One picture over both panels (each panel shows its half: ToiletDoor's noren), at the noren's own shape (a pixel as tall as
 * it's wide, the crest round).
 */
const wcNoren = (who: 'm' | 'f') => {
  const PX = 1024 / WC_NOREN_W, H = Math.round(WC_NOREN_L * PX)
  return canvasTex(1024, H, (g) => {
    const cloth = who === 'm' ? '#22335f' : '#8e2329'
    const kind = who === 'm' ? 'ume' : 'sakura'
    const band = Math.round(0.034 * PX), cy = Math.round(band + (H - band) * 0.47)
    g.save()
    g.fillStyle = cloth; g.fillRect(0, 0, 1024, H)
    // (the weave: fine threads either way)
    g.globalAlpha = 0.06
    g.fillStyle = '#ffffff'
    for (let x = 0; x < 1024; x += 3) g.fillRect(x, 0, 1, H)
    g.fillStyle = '#000000'
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, 1024, 1)
    g.globalAlpha = 1
    // (the small crests, tone on tone, clear of the big one)
    for (let r = 0, y = band + 50; y < H - 20; r++, y += 78) for (let x = (r % 2) * 56 + 40; x < 1024; x += 112) {
      if (Math.hypot(x - 512, y - cy) < 250) continue
      crest(g, kind, x, y, 22, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0)')
    }
    // (the band along its top, sewn over the rod)
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, 1024, band)
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, band, 1024, 3)
    // (the big crest across the middle, white, in a fine white ring)
    crest(g, kind, 512, cy, 178, '#f4efe4', cloth)
    g.strokeStyle = '#f4efe4'; g.lineWidth = 7
    g.beginPath(); g.arc(512, cy, 214, 0, Math.PI * 2); g.stroke()
    // (a white line along the hem)
    g.fillStyle = '#f4efe4'; g.fillRect(0, H - Math.round(0.022 * PX), 1024, 5)
    g.restore()
  })
}
const WC_NOREN = { m: wcNoren('m'), f: wcNoren('f') }
/**
 * The long noren hung across the way round to the toilet (the owner's: in through the door the washstand first, the toilet round the
 * corner), down to below the waist: linen, a dark band along its top over the rod, printed (the owner's, after his two pictures of wagara):
 * the men's green bamboo, a few stalks with their nodes and sprays of slender leaves, two paler ones behind for depth; the women's peonies,
 * three great layered blossoms, pink, red and cream round golden hearts, among their leaves; the linen's weave over it all. Nothing across
 * the slit between its two panels.
 */
/** the long noren inside: down to the waist (the owner's: shorter; it hung to the knee), and the opening it hangs across */
const WC_STALL_L = 0.9, WC_STALL_W = WC_ROOM.D - WC_ROOM.X0 - 0.06
const wcStallNoren = (who: 'm' | 'f') => {
  const H = Math.round(512 * WC_STALL_L / WC_STALL_W)
  return canvasTex(512, H, (g) => {
    // (a little random of its own, the same every time it's drawn)
    let seed = who === 'm' ? 7 : 11
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    g.save()
    const gr = g.createLinearGradient(0, 0, 0, H)
    if (who === 'm') { gr.addColorStop(0, '#f1efe2'); gr.addColorStop(1, '#dfe5cd') } else { gr.addColorStop(0, '#f9eee8'); gr.addColorStop(1, '#f0d8d0') }
    g.fillStyle = gr; g.fillRect(0, 0, 512, H)
    const leaf = (x: number, y: number, a: number, len: number, wid: number, col: string) => {
      g.save(); g.translate(x, y); g.rotate(a)
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.42, -wid, len, 0); g.quadraticCurveTo(len * 0.42, wid, 0, 0)
      g.fillStyle = col; g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1.2
      g.beginPath(); g.moveTo(len * 0.06, 0); g.lineTo(len * 0.86, 0); g.stroke()
      g.restore()
    }
    if (who === 'm') {
      // bamboo: a stalk from the top band to the hem, leaning a little; its nodes a dark ring with a pale lip above; sprays from some
      const stalk = (x0: number, x1: number, w: number, body: string, lit: string, ring: string, sprays: boolean) => {
        const at = (y: number) => x0 + (x1 - x0) * (y / H)
        g.lineCap = 'butt'
        g.strokeStyle = body; g.lineWidth = w
        g.beginPath(); g.moveTo(at(40), 40); g.lineTo(at(H), H); g.stroke()
        g.strokeStyle = lit; g.lineWidth = w * 0.22
        g.beginPath(); g.moveTo(at(40) - w * 0.22, 40); g.lineTo(at(H) - w * 0.22, H); g.stroke()
        for (let y = 70 + rnd() * 60; y < H - 30; y += 110 + rnd() * 50) {
          const x = at(y)
          g.fillStyle = ring; g.fillRect(x - w / 2 - 1.5, y, w + 3, 3.5)
          g.fillStyle = lit; g.fillRect(x - w / 2, y - 3, w, 2)
          if (!sprays || rnd() < 0.35) continue
          // (a spray off the node: a twig out to one side, a fan of slender leaves at its end)
          const side = x < 256 ? -1 : 1, s2 = rnd() < 0.3 ? -side : side
          const tx = x + s2 * (24 + rnd() * 18), ty = y + 14 + rnd() * 10
          g.strokeStyle = ring; g.lineWidth = 2
          g.beginPath(); g.moveTo(x, y + 2); g.quadraticCurveTo((x + tx) / 2, y + 2, tx, ty); g.stroke()
          const n = 3 + Math.floor(rnd() * 3)
          for (let k = 0; k < n; k++) {
            const a = (s2 > 0 ? 0.35 : Math.PI - 0.35) + s2 * (k - (n - 1) / 2) * 0.42 + (rnd() - 0.5) * 0.25
            leaf(tx, ty, a, 62 + rnd() * 30, 8 + rnd() * 3, ['#3f8a49', '#2f6e3c', '#58a05c'][k % 3])
          }
        }
      }
      // (two pale ones behind, then the near ones; none across the slit at the middle)
      stalk(150, 140, 14, 'rgba(150,190,140,0.55)', 'rgba(220,235,205,0.5)', 'rgba(110,150,100,0.5)', false)
      stalk(398, 412, 13, 'rgba(150,190,140,0.55)', 'rgba(220,235,205,0.5)', 'rgba(110,150,100,0.5)', false)
      stalk(84, 104, 26, '#4f9a55', '#a9d69c', '#2a5c33', true)
      stalk(206, 190, 21, '#3f8a49', '#9bcf8e', '#285a31', true)
      stalk(326, 344, 27, '#56a35a', '#b2dca3', '#2d6236', true)
      stalk(450, 436, 19, '#468f4f', '#a2d496', '#2a5c33', true)
    } else {
      // peonies (牡丹, as in the owner's reference): their three-lobed leaves first, then each blossom from the back, seen a little from
      // above: a ring of broad ruffled petals, deep at the heart and pale at the edge; a smaller ring; the golden heart of stamens; and the
      // cupped petals in front of it. Each kept to its own panel (the slit at the middle cuts through nothing)
      type Hue = { deep: string; mid: string; pale: string; line: string }
      const petal = (L: number, W: number, from: string, to: string, line: string, bumps: number) => {
        // (in the petal's own frame: its narrow base at the origin, its ruffled end out along +x; a few shallow scallops round the end,
        // a little notch where each two meet; faint veins from the base)
        const edge = (t: number) => { const a = t * 1.25; return [L * 0.6 + Math.cos(a) * L * 0.4, Math.sin(a) * W] }
        const gr = g.createLinearGradient(0, 0, L, 0)
        gr.addColorStop(0, from); gr.addColorStop(0.6, to); gr.addColorStop(1, to)
        g.beginPath()
        g.moveTo(0, -W * 0.22)
        const [sx, sy] = edge(-1)
        g.bezierCurveTo(L * 0.25, -W * 0.55, L * 0.5, -W * 1.05, sx, sy)
        for (let k = 0; k < bumps; k++) {
          const t0 = -1 + (k / bumps) * 2, t1 = -1 + ((k + 1) / bumps) * 2
          const [mx, my] = edge((t0 + t1) / 2), [ex, ey] = edge(t1)
          const out = 1 + 0.1 + rnd() * 0.06
          g.quadraticCurveTo(L * 0.6 + (mx - L * 0.6) * out, my * out, ex - (ex - L * 0.6) * 0.04, ey * 0.96)
        }
        g.bezierCurveTo(L * 0.5, W * 1.05, L * 0.25, W * 0.55, 0, W * 0.22)
        g.closePath()
        g.fillStyle = gr; g.fill()
        g.strokeStyle = line; g.lineWidth = 1.3; g.stroke()
        g.globalAlpha = 0.3
        g.strokeStyle = line; g.lineWidth = 0.9
        for (const t of [-0.55, -0.18, 0.18, 0.55]) {
          const [vx, vy] = edge(t)
          g.beginPath(); g.moveTo(L * 0.08, 0); g.quadraticCurveTo(vx * 0.45, vy * 0.3, vx * 0.78, vy * 0.78); g.stroke()
        }
        g.globalAlpha = 1
      }
      const peonyLeaf = (x: number, y: number, a: number, len: number, body: string, lit: string) => {
        // (a stalk, three pointed lobes at its end, the middle the longest; two-toned, a pale vein down each)
        g.save(); g.translate(x, y); g.rotate(a)
        g.strokeStyle = body; g.lineWidth = 2.2
        g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.3, 0); g.stroke()
        for (const [da, k] of [[-0.62, 0.68], [0.62, 0.68], [0, 1]]) {
          g.save(); g.translate(len * 0.3, 0); g.rotate(da)
          const l = len * 0.7 * k, w = l * 0.27
          g.beginPath(); g.moveTo(0, 0)
          g.bezierCurveTo(l * 0.3, -w * 1.1, l * 0.72, -w * 0.85, l, 0)
          g.bezierCurveTo(l * 0.72, w * 0.85, l * 0.3, w * 1.1, 0, 0)
          g.fillStyle = body; g.fill()
          g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(l * 0.3, -w * 1.1, l * 0.72, -w * 0.85, l, 0); g.closePath()
          g.fillStyle = lit; g.fill()
          g.strokeStyle = 'rgba(232,240,214,0.5)'; g.lineWidth = 1.1
          g.beginPath(); g.moveTo(l * 0.04, 0); g.lineTo(l * 0.86, 0); g.stroke()
          g.restore()
        }
        g.restore()
      }
      const blossom = (cx: number, cy: number, r: number, hue: Hue) => {
        g.save()
        const left = cx < 256
        g.beginPath(); g.rect(left ? 0 : 263, 40, 249, H - 40); g.clip()
        for (const a of [-0.35, 0.55, 1.45, 2.35, 3.35]) {
          const t = a + (rnd() - 0.5) * 0.3
          peonyLeaf(cx + Math.cos(t) * r * 0.45, cy + Math.sin(t) * r * 0.4, t, r * (0.95 + rnd() * 0.15), ['#2f5a3a', '#355f3d', '#2a5234'][Math.floor(rnd() * 3)], '#4f8a58')
        }
        // (the flower a little flattened, seen from above it)
        g.translate(cx, cy); g.scale(1, 0.84)
        const off = rnd() * 0.9
        for (let k = 0; k < 7; k++) {
          const a = off + (k / 7) * Math.PI * 2
          g.save(); g.rotate(a); g.translate(r * 0.08, 0)
          petal(r * (0.92 + rnd() * 0.12), r * 0.44, hue.deep, hue.pale, hue.line, 4)
          g.restore()
        }
        for (let k = 0; k < 6; k++) {
          const a = off + ((k + 0.5) / 6) * Math.PI * 2
          g.save(); g.rotate(a); g.translate(r * 0.05, 0)
          petal(r * 0.7, r * 0.36, hue.deep, hue.mid, hue.line, 3)
          g.restore()
        }
        // (the heart: golden stamens, a little above the middle)
        g.save(); g.translate(0, -r * 0.1)
        g.fillStyle = '#c9932e'
        g.beginPath(); g.ellipse(0, 0, r * 0.27, r * 0.19, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = '#e9c252'
        g.beginPath(); g.ellipse(0, -r * 0.02, r * 0.23, r * 0.15, 0, 0, Math.PI * 2); g.fill()
        for (let k = 0; k < 22; k++) {
          const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd())
          const x = Math.cos(a) * d * r * 0.22, y = Math.sin(a) * d * r * 0.14 - r * 0.02
          g.fillStyle = '#f6dc7a'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill()
          g.strokeStyle = '#a8701e'; g.lineWidth = 0.8; g.stroke()
        }
        g.restore()
        // (the cupped petals in front of it, up from below, their ruffled tops over the heart's lower half)
        for (let k = 0; k < 3; k++) {
          g.save(); g.translate((k - 1) * r * 0.3, r * 0.52); g.rotate(-Math.PI / 2 + (k - 1) * 0.38)
          petal(r * (0.6 + (k === 1 ? 0.06 : 0)), r * 0.3, hue.mid, hue.pale, hue.line, 3)
          g.restore()
        }
        g.restore()
      }
      blossom(140, H * 0.4, 92, { deep: '#d55a74', mid: '#ec8fa1', pale: '#fbd5dc', line: 'rgba(140,40,60,0.5)' })
      blossom(380, H * 0.6, 104, { deep: '#8f1a27', mid: '#c93744', pale: '#f0807f', line: 'rgba(80,10,20,0.55)' })
      blossom(158, H * 0.8, 76, { deep: '#e3a88c', mid: '#f4d7c4', pale: '#fffaf1', line: 'rgba(150,105,80,0.45)' })
    }
    // (the linen's weave over it all)
    g.globalAlpha = 0.07
    g.fillStyle = '#ffffff'
    for (let x = 0; x < 512; x += 3) g.fillRect(x, 0, 1, H)
    g.fillStyle = '#000000'
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, 512, 1)
    g.globalAlpha = 1
    g.fillStyle = who === 'm' ? '#2c4632' : '#6a1d26'; g.fillRect(0, 0, 512, 40)
    g.fillStyle = '#f4efe4'; g.fillRect(0, H - 20, 512, 4)
    g.restore()
  })
}
const WC_STALL_NOREN = { m: wcStallNoren('m'), f: wcStallNoren('f') }

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
/** the room's paper lamp, on its sensor */
/**
 * A toilet in the dark (its switch by the door off: the owner's): its rooms' insides dimmed, as the lamp's paper is, by a see-through black
 * box filling each (its faces toward the eye only, so whatever's in it is darkened once, seen from above or through the door); fading in
 * and out as the switch goes, not drawn at all while the light's on. `rooms`: each one's size across x, up and across z, and its middle.
 */
const WC_DARK = new THREE.BoxGeometry(1, 1, 1)
function WcDark({ who, rooms }: { who: 'm' | 'f'; rooms: [number, number, number, number, number][] }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(() => () => mat.dispose(), [mat])
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    const want = getLights().wc[who] ? 0 : 0.62
    mat.opacity += (want - mat.opacity) * 0.08
    if (group.current) group.current.visible = mat.opacity > 0.01
  })
  return (
    <group ref={group} visible={false}>
      {rooms.map(([sx, sy, sz, x, z], i) => <mesh key={i} geometry={WC_DARK} material={mat} position={[x, sy / 2, z]} scale={[sx, sy, sz]} renderOrder={4} />)}
    </group>
  )
}
function WcLamp({ who, at }: { who: 'm' | 'f'; at: [number, number, number] }) {
  const m = useRef<THREE.MeshBasicMaterial>(null)
  const k = useRef(0.4)
  useFrame(() => {
    // (on its own switch by the door (the owner's): lit while it's on, dark paper while it's off; it used to light only with someone there)
    k.current += ((getLights().wc[who] ? 1 : 0.12) - k.current) * 0.08
    m.current?.color.set('#fff1cc').multiplyScalar(k.current)
  })
  return <mesh geometry={WC_GEO.lamp} position={at}><meshBasicMaterial ref={m} color="#fff1cc" toneMapped={false} /></mesh>
}
/** a wall of the toilet's rooms, facing into them: charred cedar to the waist with a rail along it, cream plaster over; `len` along it, its
 * middle at `at`, turned `yaw` (unturned, it faces +z); the cedar's boards their own width whatever its length. `cut`: the wall that's cut
 * away for the view from outside (seen from behind, its faces aren't drawn), its rail a strip on its face, not a bar left floating */
function WcWall({ len, at, yaw, top, cut = false }: { len: number; at: [number, number, number]; yaw: number; top: number; cut?: boolean }) {
  const geo = useMemo(() => {
    const lower = new THREE.PlaneGeometry(len, 0.9)
    const uv = lower.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / 0.3), uv.getY(i) * (0.9 / 0.5))
    return { lower, upper: new THREE.PlaneGeometry(len, top - 0.9), rail: cut ? new THREE.PlaneGeometry(len, 0.035) : new THREE.BoxGeometry(len, 0.035, 0.03) }
  }, [len, top, cut])
  useEffect(() => () => { geo.lower.dispose(); geo.upper.dispose(); geo.rail.dispose() }, [geo])
  return (
    <group position={at} rotation-y={yaw}>
      <mesh geometry={geo.lower} position-y={0.45}><meshToonMaterial color="#ffffff" map={WC_CEDAR} /></mesh>
      <mesh geometry={geo.upper} position-y={0.9 + (top - 0.9) / 2}><meshToonMaterial color="#ece0c6" /></mesh>
      <mesh geometry={geo.rail} position={[0, 0.9, cut ? 0.003 : 0.012]}><meshToonMaterial color="#6a4428" /></mesh>
    </group>
  )
}
/** how thick the rooms' walls are drawn behind their faces (the owner's: the partitions between the men's and the women's, and between each
 * washroom and its toilet, were bare planes, paper-thin seen from above): the men's and the women's rooms 0.12 apart, half each */
const WC_T = 0.06
/** how far behind the shop's wall face (the rooms' x = 0) their walls' bodies begin: never in its face */
const WC_IN = 0.02
/** a stretch of solid wall in the rooms' frame, from x0 to x1, y0 to y1, z0 to z1 (either way round): its top and its cut end seen from
 * outside, in a plaster a touch deeper than the walls' faces */
function WcMass({ x, y, z }: { x: [number, number]; y: [number, number]; z: [number, number] }) {
  const [x0, x1] = [Math.min(...x), Math.max(...x)], [z0, z1] = [Math.min(...z), Math.max(...z)]
  return (
    <mesh position={[(x0 + x1) / 2, (y[0] + y[1]) / 2, (z0 + z1) / 2]}>
      <boxGeometry args={[x1 - x0, y[1] - y[0], z1 - z0]} /><meshToonMaterial color="#e2d4b6" />
    </mesh>
  )
}
/** a paper lamp on a wall, on a little wooden arm (the rooms have no ceiling: they're seen from above, cut open): its globe in its ring `out`
 * from the wall, at `at` on it, the wall facing `yaw` (unturned, +z) */
function WcSconce({ who, at, yaw }: { who: 'm' | 'f'; at: [number, number, number]; yaw: number }) {
  const out = 0.1
  return (
    <group position={at} rotation-y={yaw}>
      <WcLamp who={who} at={[0, 0, out]} />
      <StaticBatch>
        <mesh position={[0, 0, out]} rotation-x={Math.PI / 2}><torusGeometry args={[0.062, 0.004, 5, 18]} /><meshToonMaterial color="#3a2416" /></mesh>
        <mesh position={[0, 0.07, out / 2]}><boxGeometry args={[0.014, 0.014, out]} /><meshToonMaterial color="#5a3a22" /></mesh>
        <mesh position={[0, 0.035, out]}><cylinderGeometry args={[0.003, 0.003, 0.07, 5]} /><meshToonMaterial color="#3a2416" /></mesh>
        <mesh position={[0, 0.07, 0.006]}><boxGeometry args={[0.05, 0.05, 0.012]} /><meshToonMaterial color="#5a3a22" /></mesh>
      </StaticBatch>
    </group>
  )
}
/** a floor of hinoki boards, `wx` by `wz`, its middle at `at` (the boards their own width whatever its size) */
function WcFloor({ wx, wz, at }: { wx: number; wz: number; at: [number, number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(wx, wz)
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (wx / 0.4), uv.getY(i) * (wz / 0.4))
    return g
  }, [wx, wz])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} position={at} rotation-x={-Math.PI / 2}><meshToonMaterial color="#ffffff" map={WC_FLOOR} /></mesh>
}
/**
 * The rooms behind a toilet's door, in the Japanese way (the owner's: the door slid open shows the washstand and its mirror; the toilet's
 * round the corner). Straight in, the washroom: the washstand against its back wall facing the door (blender/wc.py: a hinoki counter on a
 * dark cedar cabinet with lattice doors, a Shigaraki bowl, a brass tap whose water runs at a click, a round mirror over it), a bamboo vase
 * of camellia on its counter, an indigo hand towel on a bamboo rod on the wall beside it, the お手洗い plaque, a slatted duckboard (簀の子)
 * before the washstand and the slippers by the door. Off its side, away from the other toilet, through an opening hung with a long noren,
 * the toilet's own little room: the toilet at its far end with its cistern to the wall (a small basin on its top), a shoji window over it,
 * the paper on its holder and the washlet's remote on one wall, the brush in the corner; in the women's the Otohime, the sanitary bin and a
 * basket of sanitary pads (the men's has no Otohime: the owner's). Floorboards of pale hinoki, charred-cedar planks to the waist and cream
 * plaster above, the walls between the rooms solid (WC_T behind each face), open above (no ceiling or beams: seen from above, cut open, the
 * owner had the dark beams taken away), a paper lamp on a wall of each room, lit on the switch by the door. Its frame: x from the door's wall back
 * (WC_ROOM.D deep), z across the door from its middle; the toilet's room is on the side `s`.
 */
function WcRoom({ w, h, who }: { w: number; h: number; who: 'm' | 'f' }) {
  const { D, E, X0 } = WC_ROOM
  const s = who === 'm' ? -1 : 1
  const top = h + 0.3
  const name = who === 'm' ? '男廁' : '女廁'
  // (the toilet's room: from X0 back to the back wall, from the washroom's side E on along the wall)
  const SW = D - X0, SX = (X0 + D) / 2, SZ = s * (w / 2 + E / 2)
  // (the long noren across the way into it: two panels, each its half of the one picture, a slit between)
  const OP = WC_STALL_W, NL = WC_STALL_L
  const noren = useMemo(() => [-1, 1].map((sd) => {
    const pw = (OP - 0.02) / 2
    const g = new THREE.PlaneGeometry(pw, NL)
    const uv = g.attributes.uv as THREE.BufferAttribute
    const u0 = sd < 0 ? 0 : (pw + 0.02) / OP, u1 = u0 + pw / OP
    for (let k = 0; k < uv.count; k++) uv.setX(k, u0 + uv.getX(k) * (u1 - u0))
    return { sd, g, x: SX + sd * (pw + 0.02) / 2 }
  }), [OP, NL, SX])
  useEffect(() => () => noren.forEach((n) => n.g.dispose()), [noren])
  const W2 = SW / 2
  // (the noren's rod: just under the lintel, in the middle of the wall's depth)
  const ROD_Y = h - 0.035, ROD_Z = w / 2 + WC_T / 2
  return (
    <group>
      {/* (dark in it while its switch by the door is off) */}
      <WcDark who={who} rooms={[[D, top - 0.03, w, D / 2, 0], [SW, top - 0.03, E, SX, SZ]]} />
      <StaticBatch>
      <WcFloor wx={D} wz={w} at={[D / 2, 0.004, 0]} />
      <WcFloor wx={SW} wz={E} at={[SX, 0.004, SZ]} />
      {/* the back wall, behind the washstand and on along the toilet's room; the washroom's other side; the short stretch by the door on the
          toilet's side, and the plaster over the way through; the toilet's room's near wall and its end */}
      <WcWall len={w + E} at={[D, 0, s * E / 2]} yaw={-Math.PI / 2} top={top} cut />
      <WcWall len={D} at={[D / 2, 0, -s * w / 2]} yaw={s > 0 ? 0 : Math.PI} top={top} />
      <WcWall len={X0} at={[X0 / 2, 0, s * w / 2]} yaw={s > 0 ? Math.PI : 0} top={top} />
      <WcWall len={E} at={[X0, 0, SZ]} yaw={Math.PI / 2} top={top} />
      <WcWall len={SW} at={[SX, 0, s * (w / 2 + E)]} yaw={s > 0 ? Math.PI : 0} top={top} />
      {/* the walls' bodies behind their faces, solid to the top (cut open at the back wall, seen from outside): the wall toward the other
          toilet's rooms (theirs the other half of it); by the door, the short wall and the depth of the shop's wall before the toilet's room,
          one block; over the way through, the plaster's lintel; the toilet's room's end. Each from a little behind the shop's wall (WC_IN):
          from it, their fronts were in its face and fought it, flickering, the wainscot beside the doors showing plaster (the owner saw
          both) */}
      <WcMass x={[WC_IN, D]} y={[0, top]} z={[-s * (w / 2 + 0.002), -s * (w / 2 + WC_T)]} />
      <WcMass x={[WC_IN, X0 - 0.002]} y={[0, top]} z={[s * (w / 2 + 0.002), s * (w / 2 + E + WC_T)]} />
      <WcMass x={[X0, D]} y={[h, top]} z={[s * w / 2, s * (w / 2 + WC_T)]} />
      <WcMass x={[X0, D]} y={[0, top]} z={[s * (w / 2 + E + 0.002), s * (w / 2 + E + WC_T)]} />
      {/* (the way through: a cedar post at the short wall's end, as deep as the wall; the noren's rod across it just under the lintel, in the
          wall's depth, from the post's face to the back wall's, each end in a little wooden socket (竿受け) fixed there: it hung on two
          brackets under the lintel that were fixed to nothing, the owner's) */}
      <mesh position={[X0 + 0.02, h / 2, s * (w / 2 + WC_T / 2 - 0.005)]}><boxGeometry args={[0.04, h, WC_T + 0.01]} /><meshToonMaterial color="#5a3a22" /></mesh>
      <mesh position={[(X0 + 0.04 + D) / 2, ROD_Y, s * ROD_Z]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.008, 0.008, D - X0 - 0.04, 8]} /><meshToonMaterial color="#3a2416" /></mesh>
      {[X0 + 0.04 + 0.011, D - 0.011].map((x) => <mesh key={x} position={[x, ROD_Y, s * ROD_Z]}><boxGeometry args={[0.022, 0.034, 0.034]} /><meshToonMaterial color="#5a3a22" /></mesh>)}
      </StaticBatch>
      {/* the long noren across the way to the toilet, its two panels hanging from the rod (the noren and the rod stand still: batched apart,
          their picture each its own) */}
      <Movable id={`wc2-${who}-noren`} label={`隔間暖簾（${name}）`}><StaticBatch>
        {noren.map(({ sd, g, x }) => (
          <mesh key={sd} geometry={g} position={[x, ROD_Y - NL / 2, s * ROD_Z]}>
            <meshToonMaterial color="#ffffff" map={WC_STALL_NOREN[who]} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </StaticBatch></Movable>
      {/* ---- the washroom: the washstand facing the door, its tap live (Restroom) */}
      <Movable id={`wc2-${who}-basin`} label={`洗手台與鏡子（${name}）`}>
        <group position={[D, 0, 0]}><WashstandLive who={who} /></group>
      </Movable>
      <Movable id={`wc2-${who}-vase`} label={`竹花瓶（${name}）`}><StaticBatch>
      {/* (a bamboo vase of camellia on the washstand's counter, beside the bowl) */}
      {/* (clear of the counter's back rail: it stood 2 mm into it (clips.mjs)) */}
      <group position={[D - 0.14, 0.764, -0.19]}>
        <mesh geometry={WC_GEO.pot} position-y={0.05}><meshToonMaterial color="#b8a060" /></mesh>
        {/* (its nodes: each ring lying round the tube (they stood upright, cutting through it in a jagged dark seam down its side), a little
            its inside just clear of it where it is (it tapers, 0.026 at its foot to 0.03 at its top)) */}
        {[0.02, 0.05, 0.08].map((y) => <mesh key={y} position-y={y} rotation-x={Math.PI / 2}><torusGeometry args={[0.026 + 0.004 * (y / 0.1) + 0.0023, 0.002, 4, 10]} /><meshToonMaterial color="#8a7a3a" /></mesh>)}
        <mesh position={[0.01, 0.17, 0.005]} rotation-z={0.15}><cylinderGeometry args={[0.0022, 0.0022, 0.14, 5]} /><meshToonMaterial color="#3a2a1a" /></mesh>
        <mesh position={[0.02, 0.24, 0.005]}><sphereGeometry args={[0.024, 8, 6]} /><meshToonMaterial color="#d8445a" /></mesh>
        {[0, 1.6, 3.2, 4.7].map((a) => (
          <mesh key={a} geometry={WC_GEO.leaf} position={[Math.cos(a) * 0.02, 0.15, Math.sin(a) * 0.02]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}>
            <meshToonMaterial color="#3f7a3a" />
          </mesh>
        ))}
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc2-${who}-towel`} label={`手巾架（${name}）`}><StaticBatch>
      {/* (the indigo hand towel on a bamboo rod on the wall beside the washstand) */}
      <group position={[D - 0.24, 0.98, -s * (w / 2 - 0.004)]} rotation-y={s > 0 ? 0 : Math.PI}>
        <mesh position-z={0.022} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.007, 0.007, 0.18, 8]} /><meshToonMaterial color="#b89a52" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.08, 0, 0.011]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.005, 0.005, 0.022, 6]} /><meshToonMaterial color="#5a3d22" /></mesh>)}
        <mesh position={[0, -0.11, 0.03]}><planeGeometry args={[0.12, 0.22]} /><meshToonMaterial color="#ffffff" map={WC_TENUGUI} side={THREE.DoubleSide} /></mesh>
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc2-${who}-plaque`} label={`廁所牌（${name}）`}><StaticBatch>
      <mesh position={[0.36, 1.52, -s * (w / 2 - 0.006)]} rotation-y={s > 0 ? 0 : Math.PI}><planeGeometry args={[0.3, 0.12]} /><meshToonMaterial color="#ffffff" map={WC_PLAQUE} /></mesh>
      </StaticBatch></Movable>
      <Movable id={`wc2-${who}-duck`} label={`簀之子踏板（${name}）`}><StaticBatch>
      {/* the slatted duckboard (簀の子) before the washstand, where hands are washed */}
      <group position={[D - 0.56, 0, 0]}>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[0, 0.02, (k - 4) * 0.052]}><boxGeometry args={[0.2, 0.02, 0.04]} /><meshToonMaterial color="#d8c08a" /></mesh>
        ))}
        {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.008, sd * 0.2]}><boxGeometry args={[0.2, 0.016, 0.03]} /><meshToonMaterial color="#6a4a28" /></mesh>)}
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-slippers`} label={`室內拖鞋（${name}）`}><StaticBatch>
      {/* (a pair of toilet slippers by the door: rounded soles, a cloth band over the toes, the toilet's own colour, set side by side toes out) */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[0.15, 0.03, sd * 0.055]} rotation-y={sd * 0.06}>
          <mesh position-y={0.008} scale={[0.13, 0.016, 0.046]}><cylinderGeometry args={[1, 1, 1, 18]} /><meshToonMaterial color="#e8dcc4" /></mesh>
          <mesh position-y={0.017} scale={[0.125, 0.004, 0.042]}><cylinderGeometry args={[1, 1, 1, 18]} /><meshToonMaterial color={who === 'm' ? '#2c3e66' : '#9a2a2a'} /></mesh>
          <mesh position={[-0.055, 0.024, 0]} rotation-x={Math.PI / 2} scale={[1, 1, 0.8]}><torusGeometry args={[0.04, 0.016, 6, 16, Math.PI]} /><meshToonMaterial color={who === 'm' ? '#2c3e66' : '#9a2a2a'} /></mesh>
        </group>
      ))}
      </StaticBatch></Movable>
      <Movable id={`wc2-${who}-lamp`} label={`紙燈（${name}）`}>
      {/* a paper lamp on the wall toward the other toilet, on its arm: on a motion sensor, bright while someone's in or the door's open, dim
          otherwise */}
      <WcSconce who={who} at={[D * 0.62, h - 0.02, -s * w / 2]} yaw={s > 0 ? 0 : Math.PI} />
      </Movable>
      {/* ---- the toilet's room, in its own frame: x from the way in (0) to its far end (E), z across it */}
      <group position={[SX, 0, s * w / 2]} rotation-y={-s * Math.PI / 2}>
        <Movable id={`wc2-${who}-toilet`} label={`馬桶（${name}）`}>
        {/* the toilet with its washlet, facing the way in, its cistern to the far wall (blender/wc.py; Restroom: its lid, flush, scrubbing) */}
        <ToiletLive who={who} at={[E - 0.4, 0, 0]} />
        </Movable>
        {/* (marks on the floor before it as it gets dirty) */}
        <WcMarks who={who} at={[0.03, 0.006, 0]} size={[0.3, 0.5]} />
        <StaticBatch>
        {/* (the shoji window by the toilet: washi in a dark lattice, lit from outside; on the back wall, the shop's outside, for both toilets
            alike (the owner's: on each one's end wall, they faced opposite ways)) */}
        <group position={[E - 0.42, 1.38, -s * (W2 - 0.006)]} rotation-y={s > 0 ? 0 : Math.PI}>
          <mesh position-z={0.0015}><planeGeometry args={[0.46, 0.34]} /><meshBasicMaterial color="#fcebc6" toneMapped={false} /></mesh>
          {[-1, 0, 1].map((k) => <mesh key={`v${k}`} position={[k * 0.115, 0, 0.003]}><planeGeometry args={[0.012, 0.34]} /><meshToonMaterial color="#3a2416" /></mesh>)}
          {[-0.5, 0.5].map((k) => <mesh key={`h${k}`} position={[0, k * 0.11, 0.003]}><planeGeometry args={[0.46, 0.012]} /><meshToonMaterial color="#3a2416" /></mesh>)}
          {[[0, 0.18, 0.5, 0.03], [0, -0.18, 0.5, 0.03], [-0.24, 0, 0.03, 0.4], [0.24, 0, 0.03, 0.4]].map(([x, y, sw, sh]) => (
            <mesh key={`${x}${y}`} position={[x, y, 0.004]}><planeGeometry args={[sw, sh]} /><meshToonMaterial color="#2e1d12" /></mesh>
          ))}
        </group>
        </StaticBatch>
        <Movable id={`wc2-${who}-remote`} label={`免治馬桶遙控器（${name}）`}>
          <group position={[E - 0.36, 0.86, W2]} rotation-y={Math.PI}><WcRemote who={who} /></group>
        </Movable>
        {/* (the Otohime in the women's only: the owner's) */}
        {who === 'f' && (
          <Movable id="wc2-f-oto" label="音姬（女廁）">
            <group position={[E, 1.0, W2 - 0.12]} rotation-y={-Math.PI / 2}><WcOtohime who={who} /></group>
          </Movable>
        )}
        <Movable id={`wc2-${who}-brush`} label={`馬桶刷（${name}）`}>
          <WcBrush who={who} at={[E - 0.08, 0, -W2 + 0.08]} bowl={[E - 0.43, 0.31, 0]} />
        </Movable>
        <Movable id={`wc2-${who}-paper`} label={`衛生紙架（${name}）`}>
          {/* the paper, on its walnut holder on the wall by the toilet (Restroom: thinning with use, a new roll at a click) */}
          <group position={[E - 0.36, 0.6, W2]} rotation-y={Math.PI}><WcPaper who={who} /></group>
        </Movable>
        {who === 'f' && (
          <Movable id="wc2-f-bin" label="生理用品垃圾桶（女廁）">
            <group position={[E - 0.1, 0, W2 - 0.1]} rotation-y={Math.PI}><WcBin /></group>
          </Movable>
        )}
        {who === 'f' && (
          <Movable id="wc2-f-pads" label="衛生棉（女廁）">
            {/* (the sanitary pads, free to take, on their shelf on the wall across from the paper) */}
            <group position={[E - 0.42, 0.98, -W2]}><WcPads /></group>
          </Movable>
        )}
        <Movable id={`wc2-${who}-lamp2`} label={`隔間紙燈（${name}）`}>
          {/* (the toilet's own lamp on its end wall, over the window) */}
          <WcSconce who={who} at={[E, h - 0.02, 0]} yaw={-Math.PI / 2} />
        </Movable>
      </group>
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
        if (!t) { t = new THREE.MeshToonMaterial({ name: src.name, color: src.color.clone(), map: src.map, side: src.name === 'WcDoorPaper' ? THREE.DoubleSide : THREE.FrontSide }); toon.set(src, t) }
        m.material = t
      })
      return root
    }
    // (each its parts folded together by material: a panel slides as one, a frame never moves; a panel was fourteen draws, the frame four)
    return { panel: () => mergeByMaterial(conv(gltf.scene.getObjectByName('WcDoorPanel')!.clone(true))), frame: () => mergeByMaterial(conv(gltf.scene.getObjectByName('WcDoorFrame')!.clone(true))) }
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
const doorAt = new THREE.Vector3()
function ToiletPanel({ who }: { who: 'm' | 'f' }) {
  const H = WC_H
  const g = useRef<THREE.Group>(null)
  const door = useWcDoor()
  // (the men's slides off one way, the women's the other, away from each other)
  const away = who === 'm' ? -1 : 1
  // (its own board of planks, like the staff's door (the owner's): the model's one great flat-sawn figure over the whole of it, before)
  const panel = useMemo(() => {
    const p = door.panel()
    p.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.Material).name === 'WcDoorBoard') m.material = new THREE.MeshToonMaterial({ name: 'WcDoorBoard', color: '#ffffff', map: WC_BOARD[who] })
    })
    return p
  }, [door, who])
  const k = useRef(0)
  const was = useRef(0)
  useFrame(({ camera }, dt) => {
    const d = TOILETS[who]
    const want = d.passing > 0 || d.open ? 1 : 0
    // (heard as it starts to move, opening or shutting, as loud as it's near (the owner's))
    if (want !== was.current) {
      was.current = want
      if (g.current) slideDoorSound(want === 1, Math.max(0, 1 - camera.position.distanceTo(g.current.getWorldPosition(doorAt)) / 12))
    }
    k.current += Math.sign(want - k.current) * Math.min(Math.abs(want - k.current), Math.min(dt, 0.1) * 1.8)
    // (first out of the doorway onto its track in front of the wall, clear of the frame's posts and the plaster, then along it, open (seen
    // open: run into the wall it was gone, and the owner wanted it there); shutting, the other way about)
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
/** the corner's cartons as blender/supplies.py lays them out on their print (1536 x 512, 750 px to the metre): each one's piece from x along
 * it, its front (and back) W x H at the top, an end D x H beside it, its top W x D under the front */
const CARTON_PIECES: { x: number; W: number; D: number; H: number; kind: 'tissue' | 'clean' }[] = [
  { x: 4, W: 330, D: 232.5, H: 202.5, kind: 'tissue' },
  { x: 576.5, W: 300, D: 217.5, H: 180, kind: 'tissue' },
  { x: 1104, W: 195, D: 150, H: 165, kind: 'clean' },
]
/**
 * The corner's cartons' print (the owner's: some design to them, and nothing printed running off a face: each face is drawn at its own
 * shape now, every word measured and made smaller till it fits): kraft board, its fluting showing, each face printed in one ink and a red:
 * the tissues' in navy, a band along the top (TISSUE PAPER), 衛生紙 big in brush lettering, ティッシュペーパー under it, a red tag (200抽 ×
 * 5盒) and a little box of tissues drawn at the side inside a fine double rule; their ends 衛生紙 again with this-way-up arrows and 天地無用;
 * their tops a round stamp. The cleaning things' the same in green: 清潔劑, 業務用洗剤, a spray bottle, 6本入.
 */
const CARTON_PRINT = canvasTex(1536, 512, (g) => {
  g.save()
  // (the board: kraft brown, its fluting showing faintly, a little mottled)
  g.fillStyle = '#c49c68'; g.fillRect(0, 0, 1536, 512)
  g.globalAlpha = 0.09
  g.fillStyle = '#5a3a1a'
  for (let k = 0; k < 1536; k += 4) g.fillRect(k, 0, 1, 512)
  g.globalAlpha = 1
  let seed = 3
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let k = 0; k < 160; k++) {
    const x = rnd() * 1536, y = rnd() * 512, r = 10 + rnd() * 40
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, k % 2 ? 'rgba(255,240,210,0.08)' : 'rgba(80,50,20,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.restore()
  /** words fitted to a box: as big as `size` but never wider than `w` (measured in their own face), centred at x, y */
  const fit = (text: string, x: number, y: number, w: number, size: number, ink: string, face = 'sans-serif', weight = 'bold', spacing = 0) => {
    g.save()
    g.font = `${weight} ${size}px ${face}`
    const width = g.measureText(text).width + spacing * Math.max(0, [...text].length - 1)
    const k = Math.min(1, w / Math.max(1, width))
    g.font = `${weight} ${size * k}px ${face}`
    ;(g as unknown as { letterSpacing: string }).letterSpacing = `${spacing * k}px`
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, x + (spacing * k) / 2, y)
    g.restore()
  }
  /** brush lettering fitted the same way */
  const brush = (text: string, x: number, y: number, w: number, size: number, ink: string) => {
    g.save()
    g.font = `bold ${size}px ${SIGN_FONT}`
    const k = Math.min(1, w / Math.max(1, g.measureText(text).width))
    g.restore()
    brushText(g, text, x, y, size * k, { fill: ink, shadow: 'rgba(60,40,20,0.15)' })
  }
  const round = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
  }
  for (const c of CARTON_PIECES) {
    const tissue = c.kind === 'tissue'
    const ink = tissue ? '#1e3a6a' : '#22603c', red = '#c0392b'
    // ---- its front (and back): W x H
    {
      g.save()
      const x0 = c.x, y0 = 0, W = c.W, H = c.H, m = Math.min(W, H) * 0.06
      g.beginPath(); g.rect(x0, y0, W, H); g.clip()
      // (a fine double rule round it)
      g.strokeStyle = ink; g.lineWidth = 2.5; g.strokeRect(x0 + m, y0 + m, W - 2 * m, H - 2 * m)
      g.lineWidth = 1; g.strokeRect(x0 + m + 4, y0 + m + 4, W - 2 * m - 8, H - 2 * m - 8)
      // (a band along its top, the English in it white)
      const bandH = H * 0.16
      g.fillStyle = ink; g.fillRect(x0 + m + 4, y0 + m + 4, W - 2 * m - 8, bandH)
      fit(tissue ? 'TISSUE PAPER' : 'CLEANING SUPPLIES', x0 + W / 2, y0 + m + 4 + bandH / 2, W - 2 * m - 24, bandH * 0.55, '#f4ead6', 'sans-serif', 'bold', bandH * 0.12)
      // (the name, big, brushed, on the left two thirds; the Japanese under it)
      const left = x0 + m + 10, colW = (W - 2 * m) * 0.6
      const body = y0 + m + 4 + bandH, bodyH = H - 2 * m - 8 - bandH
      brush(tissue ? '衛生紙' : '清潔劑', left + colW / 2, body + bodyH * 0.36, colW - 8, bodyH * 0.42, ink)
      fit(tissue ? 'ティッシュペーパー' : '業務用洗剤', left + colW / 2, body + bodyH * 0.68, colW - 8, bodyH * 0.13, ink, 'sans-serif', 'bold', 1)
      // (what's in it, white on a red tag at the foot of the left column)
      const tagW = colW * 0.72, tagH = bodyH * 0.17, tagX = left + (colW - tagW) / 2, tagY = body + bodyH * 0.8
      g.fillStyle = red; round(tagX, tagY, tagW, tagH, tagH * 0.35); g.fill()
      fit(tissue ? '200抽 × 5盒' : '2L × 6本入', tagX + tagW / 2, tagY + tagH / 2, tagW - 10, tagH * 0.7, '#fff6ea')
      // (a picture on the right: a box of tissues with one standing up out of it, or a spray bottle)
      const px = left + colW + (W - 2 * m - colW - 10) / 2, py = body + bodyH * 0.55, s2 = Math.min((W - 2 * m - colW) * 0.75, bodyH * 0.62)
      g.lineWidth = 2; g.strokeStyle = ink; g.lineJoin = 'round'
      if (tissue) {
        g.fillStyle = '#ffffff'
        g.fillRect(px - s2 * 0.45, py - s2 * 0.05, s2 * 0.9, s2 * 0.42); g.strokeRect(px - s2 * 0.45, py - s2 * 0.05, s2 * 0.9, s2 * 0.42)
        g.fillStyle = ink; g.fillRect(px - s2 * 0.45, py + s2 * 0.24, s2 * 0.9, s2 * 0.06)
        g.fillStyle = '#ffffff'
        g.beginPath(); g.moveTo(px - s2 * 0.16, py - s2 * 0.05); g.quadraticCurveTo(px - s2 * 0.1, py - s2 * 0.42, px + s2 * 0.02, py - s2 * 0.3)
        g.quadraticCurveTo(px + s2 * 0.12, py - s2 * 0.46, px + s2 * 0.18, py - s2 * 0.05); g.closePath(); g.fill(); g.stroke()
      } else {
        g.fillStyle = '#ffffff'
        round(px - s2 * 0.18, py - s2 * 0.12, s2 * 0.36, s2 * 0.55, s2 * 0.06); g.fill(); g.stroke()
        g.fillStyle = ink
        g.fillRect(px - s2 * 0.07, py - s2 * 0.24, s2 * 0.14, s2 * 0.12)
        g.beginPath(); g.moveTo(px - s2 * 0.07, py - s2 * 0.24); g.lineTo(px - s2 * 0.3, py - s2 * 0.22); g.lineTo(px - s2 * 0.3, py - s2 * 0.3); g.lineTo(px + s2 * 0.07, py - s2 * 0.32); g.closePath(); g.fill()
        g.fillStyle = '#8fd0a8'; g.fillRect(px - s2 * 0.18, py + s2 * 0.05, s2 * 0.36, s2 * 0.14)
      }
      g.restore()
    }
    // ---- its ends: D x H
    {
      g.save()
      const x0 = c.x + c.W, W = c.D, H = c.H, m = Math.min(W, H) * 0.07
      g.beginPath(); g.rect(x0, 0, W, H); g.clip()
      g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(x0 + m, m, W - 2 * m, H - 2 * m)
      brush(tissue ? '衛生紙' : '清潔劑', x0 + W / 2, H * 0.32, W - 2 * m - 16, H * 0.24, ink)
      // (this way up: two arrows over a bar, and 天地無用)
      g.fillStyle = ink
      const ay = H * 0.6, as = Math.min(W, H) * 0.09
      for (const ax of [x0 + W / 2 - as * 1.4, x0 + W / 2 + as * 1.4]) {
        g.beginPath(); g.moveTo(ax, ay - as); g.lineTo(ax - as * 0.8, ay); g.lineTo(ax + as * 0.8, ay); g.closePath(); g.fill()
        g.fillRect(ax - as * 0.28, ay, as * 0.56, as * 0.8)
      }
      g.fillRect(x0 + W / 2 - as * 2.6, ay + as * 1.05, as * 5.2, as * 0.22)
      fit('天地無用', x0 + W / 2, H * 0.84, W - 2 * m - 16, H * 0.09, ink, 'sans-serif', 'bold', 2)
      g.restore()
    }
    // ---- its top: W x D (its front edge at the foot)
    {
      g.save()
      const x0 = c.x, y0 = c.H, W = c.W, D = c.D
      g.beginPath(); g.rect(x0, y0, W, D); g.clip()
      // (a round stamp off to one side, clear of the tape down the middle)
      const r = Math.min(W * 0.17, D * 0.3), sx = x0 + W * 0.22, sy = y0 + D * 0.5
      g.strokeStyle = red; g.lineWidth = 2.5; g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.stroke()
      g.lineWidth = 1; g.beginPath(); g.arc(sx, sy, r * 0.82, 0, Math.PI * 2); g.stroke()
      brush(tissue ? '衛' : '潔', sx, sy - r * 0.12, r * 1.1, r * 0.95, red)
      fit(tissue ? '5盒入' : '6本入', sx, sy + r * 0.52, r * 1.3, r * 0.3, red)
      fit(tissue ? 'TISSUE · 衛生紙' : 'CLEANING · 清潔劑', x0 + W * 0.74, y0 + D * 0.5, W * 0.36, D * 0.1, ink, 'sans-serif', 'bold', 1)
      g.restore()
    }
  }
})
/** packing tape as it is: clear, a little yellow, glossy (the studio in it), the board's print through it (the owner's: it was an opaque
 * brown strip); made once, shared by every carton's */
let tapeMat: THREE.MeshStandardMaterial | null = null
export function clearTape() {
  if (!tapeMat) {
    tapeMat = new THREE.MeshStandardMaterial({ color: '#fbf3df', transparent: true, opacity: 0.32, roughness: 0.12, metalness: 0, depthWrite: false })
    reflectStudio(tapeMat)
  }
  return tapeMat
}
/**
 * The supplies in the corner by the drinks fridge (the owner's: tissue cartons and cleaning things, for the toilets and about the shop;
 * blender/supplies.py): the cartons of spare tissue boxes (the stock's), a pack of toilet rolls on them, a bucket and a carton of cleaning
 * things (the mop and the broom gone, the detergents boxed: the owner's); their tape clear, glossy and see-through. Pointed at, the cartons say how many spare boxes there are; clicked, the stock opens on its supplies.
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
        if (src.name === 'SupplyTape') t = clearTape()
        else {
          t = new THREE.MeshToonMaterial({ color: src.name === 'SupplyCartonPrint' ? '#ffffff' : src.color.clone(), map: src.name === 'SupplyCartonPrint' ? CARTON_PRINT : null })
          if (src.name === 'SupplyCartonPrint' && CARTON_PRINT) CARTON_PRINT.flipY = false
        }
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
/** the staff's door, its width along the wall (the toilets' own: the owner found it too narrow at 0.66) */
const STAFF_W = 0.82
/**
 * Behind the staff's door, inside its frame: the stair up to the floor above (the owner's: as the round window's view is, a picture in depth
 * on one flat pane, costing nothing; a stair painted flat on it once was only right from straight in front). The pane's two triangles find,
 * for each point, where the eye's line through it meets the stairwell behind: its side walls (cedar wainscot under plaster), the entry's
 * floor, the steps (treads and risers) climbing away to a landing, the ceiling sloping up over them, the far wall; and shade it there: warm
 * light from a paper lamp up on the landing (a shoji glowing on the far wall, and the way on round the corner to the left lit), the room's
 * own light coming in a little way at the door, the corners and the stair's creases darker, and the edges where the frame meets it darkest.
 * Units are the pane's (its middle at 0, the opening STAFF_W across and WC_H + 0.03 high; depth back into the wall).
 */
const STAFF_EYE = new THREE.Vector3()
const STAFF_STAIRS = (() => {
  const H = WC_H + 0.03, hw = STAFF_W / 2, yf = -H / 2
  const N = 11, rise = 0.19, run = 0.25, s0 = 0.55, D = s0 + N * run + 0.95
  const top = yf + N * rise, yc = yf + 2.15, sc = s0 + 0.55, k = rise / run, ycap = top + 2.1
  const f = (v: number) => v.toFixed(4)
  return new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3(0, 0, 3) } },
    vertexShader: `varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uCam;
varying vec3 vLocal;
const float HW = ${f(hw)}, YF = ${f(yf)}, RISE = ${f(rise)}, RUN = ${f(run)}, S0 = ${f(s0)}, D = ${f(D)}, TOP = ${f(top)};
const float YC = ${f(yc)}, SC = ${f(sc)}, K = ${f(k)}, YCAP = ${f(ycap)};
const int N = ${N};
float stairY(float s) { return s < S0 ? YF : YF + min(float(N), floor((s - S0) / RUN) + 1.0) * RISE; }
// (the stair's line along the walls, straight up its slope, not stepped (the owner's: the wainscot's top went up in a saw, plaster in its
// notches): from the floor a step before the first riser, up through the steps' nosings, level again over the landing)
float lineY(float s) { return YF + clamp(s - S0 + RUN, 0.0, float(N) * RUN) * K; }
// (wood: a grain along u, its rings wandering, two browns)
vec3 wood(float u, float v, vec3 a, vec3 b) {
  float g = 0.5 + 0.5 * sin(u * 70.0 + sin(v * 9.0 + u * 3.0) * 2.5);
  float plank = step(0.5, fract(v * 4.0 + 0.37)) * 0.06;
  return mix(a, b, g * 0.6) * (0.94 + plank);
}
void main() {
  vec3 dir = normalize(vLocal - uCam);
  // (x along the opening, y up, z here is depth back into the wall)
  vec3 o = vec3(vLocal.x, vLocal.y, 0.0);
  vec3 d = vec3(dir.x, dir.y, max(-dir.z, 0.001));
  float best = 1e9; int kind = 0; float t;
  vec3 p;
  // side walls (kind 1 left, 2 right)
  if (d.x > 0.0) { t = (HW - o.x) / d.x; if (t < best) { best = t; kind = 2; } }
  if (d.x < 0.0) { t = (-HW - o.x) / d.x; if (t < best) { best = t; kind = 1; } }
  // the entry's floor (3), the far wall (4)
  if (d.y < 0.0) { t = (YF - o.y) / d.y; if (t > 0.0 && t < best) { best = t; kind = 3; } }
  t = (D - o.z) / d.z; if (t < best) { best = t; kind = 4; }
  // the ceiling: flat over the entry, sloping up over the stair, flat again over the landing (5)
  if (d.y > 0.0) {
    t = (YC - o.y) / d.y; p = o + d * t; if (t < best && p.z < SC) { best = t; kind = 5; }
    t = (YCAP - o.y) / d.y; p = o + d * t; if (t < best && YC + (p.z - SC) * K >= YCAP) { best = t; kind = 5; }
  }
  float den = d.y - d.z * K;
  if (abs(den) > 1e-5) { t = (YC + (o.z - SC) * K - o.y) / den; p = o + d * t; if (t > 0.0 && t < best && p.z >= SC && p.y <= YCAP) { best = t; kind = 5; } }
  // the steps: each one's riser (6) and tread (7)
  for (int i = 0; i < N; i++) {
    float si = S0 + float(i) * RUN, y0 = YF + float(i) * RISE, y1 = y0 + RISE;
    t = (si - o.z) / d.z; p = o + d * t;
    if (t > 0.0 && t < best && p.y >= y0 && p.y <= y1) { best = t; kind = 6; }
    if (d.y < 0.0) {
      t = (y1 - o.y) / d.y; p = o + d * t;
      float s1 = i == N - 1 ? D : si + RUN;
      if (t > 0.0 && t < best && p.z >= si && p.z <= s1) { best = t; kind = 7; }
    }
  }
  p = o + d * best;
  vec3 n = kind == 1 ? vec3(1, 0, 0) : kind == 2 ? vec3(-1, 0, 0) : (kind == 3 || kind == 7) ? vec3(0, 1, 0) : kind == 5 ? vec3(0, -1, 0) : vec3(0, 0, -1);
  // its own colour (linear)
  vec3 c;
  float glow = 0.0;
  if (kind == 1 || kind == 2) {
    float lift = p.y - lineY(p.z);
    c = lift < 0.95 ? wood(p.y * 0.3, p.z * 1.7 + float(kind), vec3(0.12, 0.065, 0.032), vec3(0.18, 0.1, 0.05)) * (0.92 + 0.08 * step(0.5, fract(p.z * 6.0)))
      : vec3(0.42, 0.37, 0.29) * (0.96 + 0.04 * sin(p.z * 40.0 + p.y * 23.0));
    // (the skirting along the stair: a dark board its whole length, its top edge catching a little light)
    if (lift < 0.11) c = vec3(0.07, 0.04, 0.02) * (lift > 0.095 ? 1.8 : 1.0);
    // (the handrail on the right: a dark round rail parallel to the stair, lit along its top, a shadow under it on the wall)
    float rail = p.y - (lineY(p.z) + 0.8);
    if (kind == 2 && p.z > S0 - RUN) {
      if (abs(rail) < 0.022) c = mix(vec3(0.12, 0.065, 0.03), vec3(0.42, 0.25, 0.12), smoothstep(-0.022, 0.022, rail));
      else if (rail < -0.022 && rail > -0.07) c *= mix(0.45, 1.0, smoothstep(-0.022, -0.07, rail));
    }
    // (round the corner at the top, the way on: lit)
    if (kind == 1 && p.z > D - 0.85 && p.z < D - 0.1 && p.y > TOP && p.y < TOP + 1.85) { c = vec3(1.0, 0.7, 0.38); glow = 0.75; }
  } else if (kind == 3) {
    // (the entry's floor: boards running in, a dark seam between each two)
    c = wood(p.z * 0.6, p.x * 9.0, vec3(0.13, 0.072, 0.035), vec3(0.2, 0.11, 0.052)) * (1.0 - 0.55 * step(0.95, fract((p.x + HW) / 0.115)));
  } else if (kind == 7) {
    // (each tread two boards across, a seam between them, its front edge (the nosing) a little lighter, worn)
    float f = fract((p.z - S0) / RUN);
    c = wood(p.x * 1.3, p.z * 4.0 + floor(f * 2.0), vec3(0.14, 0.078, 0.038), vec3(0.22, 0.125, 0.06));
    c *= 1.0 - 0.5 * smoothstep(0.035, 0.0, abs(f - 0.5)) * step(p.z, S0 + float(N) * RUN);
    c *= 1.0 + 0.35 * smoothstep(0.08, 0.0, f) * step(p.z, S0 + float(N) * RUN);
  }
  else if (kind == 6) { c = wood(p.x, p.y * 5.0, vec3(0.09, 0.05, 0.025), vec3(0.14, 0.078, 0.038)); }
  else if (kind == 5) { c = vec3(0.12, 0.08, 0.05) * (0.9 + 0.1 * step(0.5, fract(p.z * 3.0))); }
  else {
    c = vec3(0.5, 0.44, 0.35);
    // (the far wall's shoji, lit from behind)
    if (p.y > TOP + 0.15 && p.y < TOP + 1.6 && abs(p.x + 0.04) < 0.26) {
      vec2 q = vec2((p.x + 0.04) / 0.52 + 0.5, (p.y - TOP - 0.15) / 1.45);
      float bar = step(0.92, fract(q.x * 3.0)) + step(0.94, fract(q.y * 5.0));
      c = mix(vec3(1.0, 0.78, 0.46), vec3(0.2, 0.12, 0.06), min(bar, 1.0));
      glow = 1.0 - min(bar, 1.0) * 0.8;
    }
  }
  // the lamp up on the landing: warm, falling off with distance; a little of the room's light at the door; a dim warmth over all
  vec3 L = vec3(-0.08, TOP + 0.95, D - 0.45);
  vec3 toL = L - p;
  float dl = length(toL);
  float lamp = 5.0 / (1.0 + dl * dl * 1.3) * (0.35 + 0.65 * max(dot(n, toL / dl), 0.0));
  float door = 0.3 * exp(-p.z * 2.6);
  // (and its light spilling down the stair: the steps further up and in the warmer, the treads most, what's seen of it through the door
  // lit from above)
  // (dim and quiet below, the owner's: only up toward the landing does the lamp's warmth come down)
  float spill = smoothstep(S0 + 4.0 * RUN, S0 + 10.0 * RUN, p.z) * (kind == 7 ? 1.2 : 0.7);
  vec3 light = vec3(0.045, 0.038, 0.03) + vec3(1.0, 0.58, 0.25) * (lamp * smoothstep(S0 + 2.0 * RUN, D, p.z) + spill) + vec3(0.85, 0.8, 0.72) * door;
  // the creases darker: the steps' inner corners, along the walls' feet, the walls' corners
  float ao = 1.0;
  if (kind == 7 || kind == 3) {
    float back = kind == 7 ? (S0 + (floor((p.z - S0) / RUN) + 1.0) * RUN - p.z) : (S0 - p.z);
    ao *= mix(0.45, 1.0, smoothstep(0.0, 0.07, back));
    ao *= mix(0.5, 1.0, smoothstep(0.0, 0.09, HW - abs(p.x)));
  }
  if (kind == 6) ao *= mix(0.55, 1.0, smoothstep(0.0, 0.06, p.y - (YF + floor((p.z - S0) / RUN + 0.5) * RISE)));
  if (kind == 1 || kind == 2) ao *= mix(0.45, 1.0, smoothstep(0.0, 0.12, p.y - stairY(p.z)));
  if (kind == 4) ao *= mix(0.5, 1.0, smoothstep(0.0, 0.1, HW - abs(p.x)));
  vec3 col = mix(c * light * ao, c, glow);
  // (the treads' and the floor's varnish: a soft sheen where they turn the lamp's light toward the eye)
  if (kind == 7 || kind == 3) {
    float sh = pow(max(dot(reflect(-toL / dl, n), -normalize(d)), 0.0), 18.0);
    col += vec3(1.0, 0.7, 0.4) * sh * (lamp + spill) * 0.12 * ao;
  }
  // the frame's edge: darker where the opening meets the posts, the sill and the head
  float edge = min(min(HW - abs(vLocal.x), vLocal.y - YF), ${f(H / 2)} - vLocal.y);
  col *= mix(0.25, 1.0, smoothstep(0.0, 0.07, edge));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  })
})()
/** a sliding door's lower board of cedar planks (the owner's: a natural grain, the staff door's first, then the toilets' after it, each its
 * own): four or five planks standing side by side, each its own width and tone, a fine straight grain up them that thickens and thins, a
 * darker streak down some, a soft arch of a flat-sawn figure on one or two, now and then a small knot with the grain parting round it, a dark
 * groove between each two; laid as the board's UVs run (glTF's way up). Every door's from its own seed, so no two are alike */
function plankBoard(seed: number, tones: string[]) {
  const t = canvasTex(256, 320, (g) => {
    let sd = seed
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647 }
    // (the planks' widths: unequal, filling the board)
    const n = tones.length, ws = tones.map(() => 0.7 + rnd() * 0.6), sum = ws.reduce((a, b) => a + b, 0)
    let x0 = 0
    for (let k = 0; k < n; k++) {
      const w = (ws[k] / sum) * 256, x1 = k === n - 1 ? 256 : x0 + w
      const pw = x1 - x0
      g.fillStyle = tones[k]; g.fillRect(x0, 0, pw + 1, 320)
      // (the tone drifting down the plank: a little lighter or darker in long soft bands)
      const drift = g.createLinearGradient(0, 0, 0, 320)
      for (let y = 0; y <= 4; y++) drift.addColorStop(y / 4, rnd() < 0.5 ? `rgba(255,236,200,${rnd() * 0.08})` : `rgba(40,20,8,${rnd() * 0.09})`)
      g.fillStyle = drift; g.fillRect(x0, 0, pw, 320)
      // (a darker streak down it, mineral or heartwood, on some)
      if (rnd() < 0.5) {
        const sx = x0 + 6 + rnd() * (pw - 16), sw = 3 + rnd() * 8
        const gr = g.createLinearGradient(sx, 0, sx + sw, 0)
        gr.addColorStop(0, 'rgba(50,26,12,0)'); gr.addColorStop(0.5, `rgba(50,26,12,${0.1 + rnd() * 0.12})`); gr.addColorStop(1, 'rgba(50,26,12,0)')
        g.fillStyle = gr; g.fillRect(sx, 0, sw, 320)
      }
      // (a knot or two, the grain to go round them)
      const knots: [number, number, number][] = []
      if (rnd() < 0.55) knots.push([x0 + 8 + rnd() * (pw - 16), 30 + rnd() * 260, 2.5 + rnd() * 3.5])
      // (the straight grain: fine lines up the plank, closer here and wider there, bending round a knot)
      const lines = Math.round(pw * (0.32 + rnd() * 0.2))
      for (let q = 0; q < lines; q++) {
        const x = x0 + 2 + rnd() * (pw - 4), dark = rnd() < 0.62
        g.strokeStyle = dark ? `rgba(60,34,18,${0.08 + rnd() * 0.2})` : `rgba(240,210,170,${0.06 + rnd() * 0.1})`
        g.lineWidth = 0.5 + rnd() * (dark ? 1.6 : 1)
        const ph = rnd() * 6, amp = 0.6 + rnd() * 1.6
        g.beginPath()
        for (let y = 0; y <= 320; y += 10) {
          let xx = x + Math.sin(y / (40 + amp * 20) + ph) * amp
          for (const [kx, ky, kr] of knots) { const dy = y - ky, d = Math.hypot(xx - kx, dy); if (d < kr * 5) xx += Math.sign(xx - kx || 1) * (kr * 5 - d) * 0.45 * Math.exp(-(dy * dy) / (kr * kr * 30)) }
          if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y)
        }
        g.stroke()
      }
      for (const [kx, ky, kr] of knots) {
        const gr = g.createRadialGradient(kx, ky, 0, kx, ky, kr * 1.8)
        gr.addColorStop(0, 'rgba(40,20,8,0.75)'); gr.addColorStop(0.5, 'rgba(70,38,18,0.45)'); gr.addColorStop(1, 'rgba(70,38,18,0)')
        g.fillStyle = gr; g.beginPath(); g.ellipse(kx, ky, kr * 1.4, kr * 1.9, 0, 0, Math.PI * 2); g.fill()
      }
      // (on some a soft arch of a flat-sawn figure, low in contrast, its own height)
      if (rnd() < 0.45) {
        const cx = x0 + pw * (0.35 + rnd() * 0.3), top = 40 + rnd() * 140, rings = 3 + Math.floor(rnd() * 4)
        for (let r = 0; r < rings; r++) {
          g.strokeStyle = `rgba(70,40,20,${0.15 - r * 0.02})`; g.lineWidth = 1 + rnd() * 0.8
          const sp = pw * 0.12 + r * pw * 0.07
          g.beginPath(); g.moveTo(cx - sp, 320); g.bezierCurveTo(cx - sp, top + r * 18 + 60, cx - 2 - r * 2, top + r * 14, cx, top + r * 14)
          g.bezierCurveTo(cx + 2 + r * 2, top + r * 14, cx + sp, top + r * 18 + 60, cx + sp, 320); g.stroke()
        }
      }
      // (the groove at its edge, a hair of light beside it)
      if (k) { g.fillStyle = 'rgba(30,16,8,0.75)'; g.fillRect(x0, 0, 2, 320); g.fillStyle = 'rgba(255,230,190,0.12)'; g.fillRect(x0 + 2, 0, 1, 320) }
      x0 = x1
    }
  })
  if (t) t.flipY = false
  return t
}
const STAFF_BOARD = plankBoard(13, ['#a2704a', '#8f6040', '#a87a52', '#966846'])
/** the toilets' doors' boards: the same planks, each door its own (the men's a shade cooler, the women's warmer) */
const WC_BOARD = { m: plankBoard(29, ['#9a6a46', '#8a5c3c', '#a27450', '#93663f', '#9c6c48']), f: plankBoard(47, ['#a87450', '#94643f', '#ad7c54', '#9b6a44']) }
/** 員工專用 on the staff's door, across its board below the waist (the owner's: on the door itself, on black; it was a plaque over it, half
 * behind the banner hung there), STAFF ONLY small under it: cream on a black plate with a fine cream rule round it, worn a little */
const STAFF_SIGN = canvasTex(512, 256, (g) => {
  g.save()
  g.fillStyle = '#141112'
  g.beginPath(); g.roundRect(6, 6, 500, 244, 14); g.fill()
  g.strokeStyle = 'rgba(243,231,204,0.75)'; g.lineWidth = 3
  g.beginPath(); g.roundRect(18, 18, 476, 220, 9); g.stroke()
  g.restore()
  brushText(g, '員工專用', 256, 104, 104, { fill: '#f3e7cc', shadow: 'rgba(0,0,0,0.5)', spacing: 10 })
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
 * door, its dark cedar frame on the plaster, the dark of the passage inside it, 員工專用 on black on its board; clicked it slides away from
 * the corner along the wall all the way open and back again, with the runners' sound (the owner's: it slid toward the corner, behind the
 * bamboo's pot, then only part way; run into the wall it was gone, and they wanted it seen), the panel turned about so its pull is at the
 * edge it's pulled by.
 */
function StaffDoor() {
  const door = useWcDoor()
  const frame = useMemo(() => door.frame(), [door])
  const { panel, sign } = useMemo(() => {
    const panel = door.panel()
    // (its own lower board, a natural grain of planks, and its pull a dark brown lacquer (the owner's), not the toilets' doors' black)
    panel.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const name = (m.material as THREE.Material).name
      if (name === 'WcDoorBoard') m.material = new THREE.MeshToonMaterial({ name, color: '#ffffff', map: STAFF_BOARD })
      else if (name === 'WcDoorLacquer') m.material = new THREE.MeshToonMaterial({ name, color: '#3a2215' })
    })
    // (the sign rides on the panel)
    const sign = new THREE.Group()
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.24),
      new THREE.MeshToonMaterial({ color: '#ffffff', map: STAFF_SIGN, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
    // (high on the board, just under the waist rail: the owner's; it sat in the board's middle)
    plate.position.set(-0.0372, 0.84, 0)
    plate.rotation.y = -Math.PI / 2
    sign.add(plate)
    return { panel, sign }
  }, [door])
  useEffect(() => () => { for (const o of sign.children) (o as THREE.Mesh).geometry.dispose() }, [sign])
  const g = useRef<THREE.Group>(null)
  const stairs = useRef<THREE.Mesh>(null)
  const st = useRef({ open: false, k: 0 })
  const narrow = STAFF_W / WC_W
  useFrame(({ camera }, dt) => {
    // (the eye, in the stair's pane's own frame: where its lines through the pane run on into the stairwell)
    if (stairs.current) STAFF_STAIRS.uniforms.uCam.value.copy(stairs.current.worldToLocal(STAFF_EYE.copy(camera.position)))
    const s = st.current
    const want = s.open ? 1 : 0
    s.k += Math.sign(want - s.k) * Math.min(Math.abs(want - s.k), Math.min(dt, 0.1) * 1.8)
    const ss = (a: number, b: number) => { const t = Math.min(1, Math.max(0, (s.k - a) / (b - a))); return t * t * (3 - 2 * t) }
    if (g.current) {
      // (out onto its track in front of the wall, then along it all the way open: clear of the doorway, the scroll beside it hung further
      // along for it (nudgeArt))
      g.current.position.x = -0.065 * ss(0, 0.25)
      g.current.position.z = ss(0.2, 1) * (STAFF_W - 0.02)
    }
  })
  const says = () => (st.current.open ? '點一下關上（員工休息室）' : '點一下打開（員工休息室）')
  return (
    <group name="staff-door">
      <group scale={[1, 1, narrow]}><primitive object={frame} /></group>
      {/* (the dark of the passage: right across the opening and on behind the posts, the head and the sill, so no plaster shows round its
          edges (the owner saw a pale strip down the side; it stopped 2.5 cm short of each post)) */}
      <mesh ref={stairs} position={[-0.004, (WC_H + 0.03) / 2, 0]} rotation-y={-Math.PI / 2} material={STAFF_STAIRS} raycast={() => {}}>
        <planeGeometry args={[STAFF_W + 0.06, WC_H + 0.03]} />
      </mesh>
      <group ref={g} onClick={(ev) => {
        ev.stopPropagation()
        if (getEdit().on) return
        st.current.open = !st.current.open
        slideDoorSound(st.current.open, Math.max(0, 1 - ev.distance / 8))
        setTip({ title: '員工專用門', hint: says() })
      }}
        onPointerOver={(ev) => { if (getEdit().on) return; tipOver('員工專用門', says()).onPointerOver(ev) }}
        onPointerOut={(ev) => { tipOver('員工專用門', '').onPointerOut(ev) }}>
        <group position={[-0.03, 0, 0]} scale={[1, 1, -narrow]}><primitive object={panel} /></group>
        {/* (on the board's face, a little above its middle, just clear of it) */}
        <primitive object={sign} />
      </group>
    </group>
  )
}
/**
 * The whole doorway, noren and plaque too, as one easy thing to point at: an unseen plane just in front of it (clicking it works the door, pointing
 * lights up the sliding panel and names it). Not merged, so it can be pointed at.
 */
/** a raycast that never finds anything: what's set on something not to be pointed at for now */
const NO_RAYCAST = () => {}
function ToiletHit({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = WC_H
  // (not there for the pointer while the door's open: what's inside is clicked through the doorway (the tap, the toilet), not the door (the
  // owner clicked the tap and got the door); the door's shut again by clicking its panel, slid aside)
  const hit = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = hit.current, d = TOILETS[who]
    if (m) m.raycast = d.open || d.passing > 0 ? NO_RAYCAST : THREE.Mesh.prototype.raycast
  })
  return (
      <mesh ref={hit} position={[-0.16, (H + 0.3) / 2, 0]} rotation-y={-Math.PI / 2}
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
/** the door noren's place: its cloth's plane (in front of the panel slid out onto its track, its face at -0.109), its top (up over the
 * head, WC_H to WC_H + 0.07), its rod's height (in front of the head's middle) and the slit between its panels */
const NOREN_X = -0.118, NOREN_TOP = WC_H + 0.08, NOREN_ROD_Y = WC_H + 0.05, NOREN_SLIT = 0.008
function ToiletDoor({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = WC_H
  const door = useWcDoor()
  const frame = useMemo(() => door.frame(), [door])
  const lang = useDocLang()
  // (the noren's two panels, each showing its half of the one picture: the slit between them cuts the crest in half)
  const noren = useMemo(() => [-1, 1].map((sd) => {
    const w = (WC_NOREN_W - NOREN_SLIT) / 2
    const geo = new THREE.PlaneGeometry(w, WC_NOREN_L)
    const u0 = sd < 0 ? 0 : 1 - w / WC_NOREN_W, u1 = u0 + w / WC_NOREN_W
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setX(k, u0 + uv.getX(k) * (u1 - u0))
    return { sd, geo, z: sd * (NOREN_SLIT + w) / 2 }
  }), [])
  useEffect(() => () => noren.forEach((n) => n.geo.dispose()), [noren])
  return (
    <group>
      {/* the frame round the opening: dark cedar posts, the head over them and the sill (blender/wcdoor.py) */}
      <primitive object={frame} />
      {/* (the sliding panel: ToiletPanel, not merged) and the little room behind it */}
      <WcRoom w={W} h={H} who={who} />
      {/* the noren, hung from its rod in front of the head: the rod on two little brackets off the head's face, just above the panel's
          way out onto its track (the panel slides out under it, and behind the cloth); the cloth just in front of the rod, its top band over
          it, up over the head (from the room seen from above, nothing of the shoji shows over it: the owner's) */}
      <mesh position={[NOREN_X + 0.008, NOREN_ROD_Y, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.006, 0.006, WC_NOREN_W + 0.05, 8]} />
        <meshToonMaterial color="#3a2416" />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[(NOREN_X + 0.008 - 0.07) / 2, NOREN_ROD_Y, sd * (WC_NOREN_W / 2 - 0.02)]}>
          <boxGeometry args={[-(NOREN_X + 0.008) - 0.07 + 0.002, 0.022, 0.014]} />
          <meshToonMaterial color="#3a2416" />
        </mesh>
      ))}
      {noren.map(({ sd, geo, z }) => (
        <mesh key={sd} geometry={geo} position={[NOREN_X, NOREN_TOP - WC_NOREN_L / 2, z]} rotation-y={-Math.PI / 2}>
          <meshToonMaterial color="#ffffff" map={WC_NOREN[who]} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the plaque over it, up on the wall clear of the noren's top */}
      <mesh position={[-0.075, NOREN_TOP + 0.13, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.4, 0.24]} />
        <meshToonMaterial color="#ffffff" map={wcSign(who, lang)} />
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
type KamiPart = 'shrine' | 'oranges' | 'sutra' | 'table' | 'flask' | 'cupstand' | 'doors' | 'ebisu' | 'bracket' | 'lantern'
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
      } else if (src.name === 'KamiLanternPaper') {
        // (the little lanterns' paper, lit from inside: drawn as it glows, its lattice dark across it, by day and by night)
        t = new THREE.MeshBasicMaterial({ color: '#ffe3b8', map: src.map })
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
    bracket: take('KamiBracket'), lantern: take('KamiLantern'),
    ebisu: (() => { const o = r.getObjectByName('KamiEbisu')!; o.removeFromParent(); return o })(), doors, shrine: r }
  // (what's left, the shrine itself, never moves: its hundred parts folded into a mesh per material)
  mergeByMaterial(r)
  return kamidanaParts
}
/** another of one of the shrine model's pieces (the shelf's two brackets, the two lanterns): a copy sharing its shapes and materials */
function KamiCopy({ part }: { part: KamiPart }) {
  const gltf = useGLTF(KAMIDANA_URL) as unknown as { scene: THREE.Group }
  useStudio()
  const obj = useMemo(() => kamidanaOf(gltf.scene)[part].clone(true), [gltf, part])
  return <primitive object={obj} />
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
/** the shrine drawn wider than it was modelled, across its front (along z): the owner's 1.1 (it was 1.25, too wide for its height) */
const SHRINE_WIDE = 1.1
/** and a little shallower front to back, its back still to the wall (the offerings' shelf in front of it as it was) */
const SHRINE_DEEP = 0.8
/** how far the doors swing open (radians): wide, square to the front and a little past (the owner's: the railing round the outside, nothing
 * across the front; it ran before the side bays' doors and beside the steps, and stopped them at 57° and 70°) */
const DOOR_SWING = { middle: 1.62, side: 1.7 }
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
        // (each leaf swings as one: its board, its gold crest and plates and its ink folded together by material (six leaves, some
        // twenty-five draws))
        mergeByMaterial(leaf)
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
      // (each leaf swings out to the front, the left one one way and the right the other, as far as it can without meeting the railing round
      // the deck (the owner saw them go through its posts and rails, swung 100°): the middle doors' hinges stand right behind the posts at the
      // foot of the steps, the side bays' leaves a short way behind the front rails)
      const sd = leaf.name.endsWith('-1') ? -1 : 1
      leaf.rotation.y = sd * k.current * (/^KamiM/.test(leaf.name) ? DOOR_SWING.middle : DOOR_SWING.side)
    }
  })
  return (
    <group onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setOpen((v) => !v); setTip({ title: '神棚門', hint: open ? '點一下打開' : '點一下關上' }) }}
      {...tipOver('神棚門', open ? '點一下關上' : '點一下打開')}>
      <primitive object={doors} />
    </group>
  )
}

/** how high the shrine stands on its table, in the model's units: its base (the model's foot, at 0) right on the table's top, a hair into it
 * so no line shows (it was 0.015 up: with the altar's own scale on top of the shrine's, 4.5 cm clear of the table in the room, the owner's
 * "floating apart") */
const SHRINE_LIFT = -0.0003
function Kamidana({ part = 'all' }: { part?: 'all' | 'shrine' | 'vase-1' | 'vase1' | 'cups' }) {
  return (
    <group>
      {/* the shrine itself, from blender/kamidana.py: a three-bay shrine in hinoki, its fittings gold */}
      {/* (its base down on the table's top: it stood 4.5 cm above it (the owner saw it floating, apart from its table)) */}
      {(part === 'all' || part === 'shrine') && <group position={[-0.14, SHRINE_LIFT, 0]}><KamidanaModel /></group>}
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
/** a band round a lantern's top or its foot, after the owner's two pattern sheets (their references 5a72cc81, 鱗, and 16be7e14, 立涌; before
 * them seigaiha and shippo from another sheet, thin seigaiha lines and 麻の葉, none of which would do), in one family of colour, indigo
 * (the owner's), multiplied into the paper at half strength (色彩增值、半透明 50%, the owner's: it was colour dodge for a while, the shapes
 * glowing out of a deep blue band), so the washi's fibres, ribs and glow come through every shape: on a pale blue ground, the shapes from deep
 * indigo to a light blue, fine dark lines round them. 鱗 (uroko): rows of scales, each a round-topped dome, every row lying over the one behind
 * it half a scale along; 立涌 (tatewaku): upright stripes of every width waving up the band together. Its width a whole number of repeats, so
 * it runs on round the lantern with no seam */
const BAND_COLOURS = ['#1d3468', '#2c4c8c', '#4568a8', '#6a8cc6', '#9ab2dc']
function patternBand(g: CanvasRenderingContext2D, W: number, y0: number, y1: number, kind: 'uroko' | 'tatewaku', flip = false) {
  const h = Math.ceil(y1 - y0)
  const sheet = document.createElement('canvas')
  sheet.width = W; sheet.height = h
  const s = sheet.getContext('2d')
  if (!s) return
  const rnd = seeded(kind === 'uroko' ? 47 : 53)
  // (the lines and flecks: the deepest indigo, the dye at its strongest)
  const LINE = '#13254d'
  /** a colour of the sheet, not the one just used (two the same side by side read as one) */
  let last = -1
  // (the navy a little more often than the rest, as the sheets have it: `deep`)
  const pick = (deep = false) => {
    const n = BAND_COLOURS.length + (deep ? 1 : 0)
    let k = Math.floor(rnd() * n) % BAND_COLOURS.length
    if (k === last) k = (k + 1) % BAND_COLOURS.length
    last = k
    return BAND_COLOURS[k]
  }
  /** watercolour: the shape just filled mottled lighter and darker, inside its own outline (`path` clipped to) */
  const mottle = (path: Path2D, x: number, y: number, r: number) => {
    s.save(); s.clip(path)
    for (let k = 0; k < 3; k++) {
      const cx = x + (rnd() - 0.5) * r, cy = y + (rnd() - 0.5) * r, rr = r * (0.5 + rnd() * 0.7)
      const gr = s.createRadialGradient(cx, cy, 0, cx, cy, rr)
      gr.addColorStop(0, k % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,30,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
      s.fillStyle = gr
      s.fillRect(cx - rr, cy - rr, rr * 2, rr * 2)
    }
    s.restore()
  }
  s.fillStyle = '#dce5f3'
  s.fillRect(0, 0, W, h)
  s.lineWidth = 1.5
  if (kind === 'uroko') {
    // (18 scales round it; the rows from the top down, each over the one before so only each scale's dome shows)
    const n = 18, R = W / n / 2, step = R * 0.8
    for (let row = 0, y = -R * 0.2; y < h + R; row++, y += step) {
      for (let k = -1; k <= n; k++) {
        const x = k * 2 * R + (row % 2 ? R : 0)
        const path = new Path2D()
        path.arc(x, y, R - 0.6, 0, Math.PI * 2)
        s.fillStyle = pick()
        s.fill(path)
        mottle(path, x, y - R * 0.3, R)
        s.strokeStyle = LINE
        s.stroke(path)
      }
    }
  } else {
    // (stripes of every width, 34 round it, their edges waving up the band together, a little out of step with each other)
    const N = 34, widths = Array.from({ length: N }, () => 0.5 + rnd() * 1.3)
    const sum = widths.reduce((a, b) => a + b, 0)
    const A = h * 0.085, lam = h * 0.58
    const edge = (x: number, y: number, ph: number) => x + A * Math.sin((2 * Math.PI * y) / lam + ph)
    let x = 0
    const phases = widths.map(() => (rnd() - 0.5) * 0.5)
    const colours: string[] = []
    for (let k = 0; k < N; k++) {
      const w = (widths[k] / sum) * W
      for (const shift of [0, W, -W]) {
        const x0 = x + shift, x1 = x + w + shift, p0 = phases[k], p1 = phases[(k + 1) % N]
        if (x1 + A < 0 || x0 - A > W) continue
        const path = new Path2D()
        path.moveTo(edge(x0, -2, p0), -2)
        for (let y = -2; y <= h + 2; y += 3) path.lineTo(edge(x0, y, p0), y)
        for (let y = h + 2; y >= -2; y -= 3) path.lineTo(edge(x1, y, p1), y)
        path.closePath()
        s.fillStyle = shift === 0 ? (colours[k] = pick(true)) : colours[k]
        s.fill(path)
        mottle(path, (x0 + x1) / 2, h / 2, Math.max(w, h * 0.5))
        s.strokeStyle = LINE
        s.stroke(path)
      }
      x += w
    }
  }
  // (a few flecks of the dye)
  s.fillStyle = LINE
  for (let k = 0; k < 70; k++) { s.beginPath(); s.arc(rnd() * W, rnd() * h, 0.6 + rnd() * 1.2, 0, Math.PI * 2); s.fill() }
  g.save()
  // (multiplied into the paper at half strength, as dye is, see-through: the upper band turned upside down, so the two face each other
  // across the lantern's middle)
  g.globalCompositeOperation = 'multiply'
  g.globalAlpha = 0.5
  if (flip) { g.translate(0, y0 + h); g.scale(1, -1); g.drawImage(sheet, 0, 0) } else g.drawImage(sheet, 0, y0)
  // (a fine line of indigo along either edge)
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = 1
  g.fillStyle = 'rgba(37,56,95,0.6)'
  g.fillRect(0, y0 - 5, W, 2.5)
  g.fillRect(0, y0 + h + 3, W, 2.5)
  g.restore()
}
/**
 * A lantern's paper (u round it, v up it: 1024 x 300, about as many pixels to the inch round its belly as up it, so what's painted on it
 * keeps its shape there). `lit`: glowing from within, warm, brightest in the middle of its belly; unlit, plain washi, a little cream (only
 * a little). Its bamboo ribs and the seams between its panels, the paper's fibres here and there, and a band round its lower belly (`band`:
 * 鱗 or 立涌, after the owner's pattern sheets; it had two sea bream painted on it, then thin seigaiha lines, then 麻の葉, then seigaiha and
 * shippo from another sheet).
 */
function lanternPaper(g: CanvasRenderingContext2D, lit: boolean, band: 'uroko' | 'tatewaku' = 'uroko') {
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
  // (its bands, one round its shoulder and one round its foot, mirrored (the owner's: top and bottom, the one the other way up), each out
  // toward its end so the white of the paper between them is wide (the owner's: wider))
  patternBand(g, W, H * 0.07, H * 0.27, band, true)
  patternBand(g, W, H * 0.73, H * 0.93, band)
}
const LANTERN_SKIN = signTexture(1024, 300, (g) => lanternPaper(g, true))
const PENDANT_GLOW = nightGlow(new THREE.SpriteMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffcf90' }), 0.35, 0.75)
const PENDANT_BLOOM = nightGlow(new THREE.SpriteMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffb870' }), 0, 0.28)
// (pulled toward the camera in depth so it never fights the bar's top under it, seen from far off)
const PENDANT_POOL = nightGlow(new THREE.MeshBasicMaterial({ map: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0.18, 0.42)
/** and the same paper with no light in it: plain washi, a little cream, its fibres and its band */
const LANTERN_SKIN_OFF = signTexture(1024, 300, (g) => lanternPaper(g, false))
const LANTERN_SHADE = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: LANTERN_SKIN, toneMapped: false, side: THREE.DoubleSide }), { offMap: LANTERN_SKIN_OFF })
/** every other lantern's: the same washi, its band 立涌 */
const LANTERN_SHADE_TATEWAKU = lampLit(new THREE.MeshBasicMaterial({ color: '#ffffff', map: signTexture(1024, 300, (g) => lanternPaper(g, true, 'tatewaku')),
  toneMapped: false, side: THREE.DoubleSide }), { offMap: signTexture(1024, 300, (g) => lanternPaper(g, false, 'tatewaku')) })
/** a pendant lamp, an oval washi lantern, its band 鱗 or 立涌 (`band` 0 or 1; the owner's: every one the plain lantern again, the round
 * one with 日式烤魚 and the fish taken down) */
function Pendant({ z, drop, pool, band = 0 }: { z: number; drop: number; pool: number; band?: number }) {
  return (
    <group position={[0, WALL_H, z]}>
      <mesh position-y={-drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {/* (a paper lantern: the oval of ribbed washi, a pale wooden ring at each end, a little ring at the top for the cord) */}
      {/* (a lamp casts no shadow: the moon threw the lit lanterns' onto the floor, well away under them) */}
      <group position-y={-drop - 0.13}>
        <mesh geometry={LANTERN_GEO} material={band ? LANTERN_SHADE_TATEWAKU : LANTERN_SHADE} />
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
function DiningWallImpl({ c, from, to, far, lampId, lampName, top, door, altar = false, clear = [], corner = false, hang = [], staffDoor }: { c: Counter; from: number; to: number; far: number
  /** prints hung here as well, where asked (along it) */
  hang?: { z: number; print: ArtKey }[]
  /** a staff-only door here (its middle, along it): nothing hung over it */
  staffDoor?: number
  /** the first of the room's two walls, whose start is the corner they meet in: its thickness runs on to close the corner, to where the other
   * wall's face truly is (along it) if given (its start, a hair beyond, is where its pictures and lamps are laid out from) */
  corner?: boolean | number
  /** stretches of it (along it) where something stands against it: nothing hung there, no post */
  clear?: [number, number][]
  /** its shelf an altar instead (by the door), and the omiki (御神酒) offered at it: when it was poured, and offering it again */
  altar?: boolean | { pouredAt: number | null; onPour: () => void }
  /** its pendant lamps' edit ids (this, then their number) and their name in the list (each counter's its own) */
  lampId: string
  lampName: string
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
    // (and on the back wall a second round window: the place nearest its spot)
    const extra = shelf && kept.length ? kept.reduce((m, z) => (Math.abs(z - ROUND_AT) < Math.abs(m - ROUND_AT) ? z : m), kept[0]) : null
    return kept
      .map((z, k) => ({ z, scroll: k % 2 ? SCROLLS[(start + k) % SCROLLS.length] : undefined, print: PRINTS[(start + k) % PRINTS.length],
        // (on the back wall, the plum scroll's place is a round window let into the plaster instead)
        round: (shelf && k % 2 === 1 && SCROLLS[(start + k) % SCROLLS.length] === 'plum') || z === extra,
        // (bare where a banner hung (every third place, but by the drinks fridges) and a big signboard (every fifth, between): they were taken
        // down (the owner's), their places still counted so the rest keep theirs)
        bare: z !== extra && ((k % 3 === 2 && isClear(z, 0.9)) || (k % 5 === 3 && k % 3 !== 2)) }))
      // (nothing where the staff's door is: taken out after the rest are given theirs, so they keep what they were)
      .filter((a) => staffDoor === undefined || Math.abs(a.z - staffDoor) > STAFF_W / 2 + 0.3)
      .concat(hang.map((h) => ({ z: h.z, scroll: undefined, print: h.print, round: false, bare: false })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l, from, to, mid, shelfZ, c.length, door, shelf, clear, staffDoor, hang.map((h) => `${h.z}${h.print}`).join()])
  // (the pictures just past the staff's door hung a little further along, clear of its frame (the owner's: the scroll there was right up
  // against it); each one's piece keeps its name, so where it's been moved by hand still holds)
  const nudgeArt = (z: number) => (staffDoor !== undefined && z > staffDoor && z - staffDoor < 1.6 ? 0.42 : 0)
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
        {/* (run right up to the doorways' frames (the owner's: these two sides weren't filled, the rail stopped short of the frames and the
            plaster showed between), and not across the little strip between the two doors) */}
        {spans.filter(([a, b, y0]) => y0 < WAINSCOT && b - a > 0.3).flatMap(([z0, z1]) => {
          const a = door !== undefined && z0 !== from ? z0 + 0.001 : z0, b = door !== undefined && z1 !== to ? z1 - 0.001 : z1
          // (and broken at the staff's door, short of its frame either side)
          const cut = staffDoor === undefined ? null : [staffDoor - STAFF_W / 2 - 0.07, staffDoor + STAFF_W / 2 + 0.07]
          const runs = cut && cut[0] < b && cut[1] > a ? [[a, cut[0]], [cut[1], b]].filter(([p, q]) => q - p > 0.02) : [[a, b]]
          return runs.map(([p, q]) => <Box key={`${z0}|${p}`} size={[0.05, 0.05, q - p]} color="#3a2416" position={[-0.02, WAINSCOT, (p + q) / 2]} />)
        })}
        <Box size={[0.08, 0.1, l]} color="#3a2416" position={[-0.03, WALL_H - 0.05, mid]} />
        {/* (no upright posts along it) */}
        {/* a frieze of seigaiha waves under the beam, and the pictures hung along the plaster */}
        <mesh position={[-0.004, WALL_H - 0.2, mid]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[l, 0.2]} />
          <meshToonMaterial color="#ffffff" map={frieze} />
        </mesh>
        <Box size={[0.03, 0.025, l]} color="#3a2416" position={[-0.01, WALL_H - 0.31, mid]} />
        </StaticBatch>
        {/* (everything below is its own piece in a batch of its own, so each can be moved by hand when the shop's shut: key G) */}
        {art.filter((a) => !a.bare).map((a) => (
          <Movable key={a.z} id={`art${from.toFixed(1)}_${a.z.toFixed(2)}`} label={`${a.round ? '圓窗' : a.scroll ? '掛軸' : '畫'}（${from.toFixed(0)}, ${a.z.toFixed(1)}）`}><StaticBatch>
            <group position={[0, a.round ? 1.4 : a.scroll ? 1.42 : 1.5, a.z + nudgeArt(a.z)]}>
              {a.round ? <RoundWindow /> : a.scroll ? <Scroll art={a.scroll} /> : <Framed art={a.print} />}
            </group>
          </StaticBatch>
          {/* (the moon's dust in its shaft by night, outside the batch: it drifts, and a batch's pieces stand still) */}
          {a.round && <group position={[0, 1.4, a.z + nudgeArt(a.z)]}><WindowDust /><RoundShoji /></group>}
          </Movable>
        ))}
        {/* (the supplies in the corner between the drinks fridges and the toilets' doorway) */}
        {/* (stood a slot off the wall: the men's door, open, slides along behind them, not through them) */}
        {supplies && <Movable id="supplies" label="衛生紙與清潔用品"><group position={[-0.13, 0, supplies.z]} rotation-y={-Math.PI / 2} scale={supplies.k}><CornerSupplies /></group></Movable>}
        {/* (the staff's door, where asked: up the stairs behind it, 員工專用) */}
        {staffDoor !== undefined && <Movable id="staffdoor" label="員工專用門"><group position={[0, 0, staffDoor]}><StaffDoor /></group></Movable>}
        {/* (the exit sign on the frieze by the way out, its arrow and running figure toward the door at the wall's end) */}
        {altar && <Movable id="exitsign" label="逃生出口燈"><group name="look-exit" position={[-0.045, 2.08, to - 0.62]} rotation-y={-Math.PI / 2}><ExitSign /></group></Movable>}
        {/* (by the way in, at hand height, between the shoe cupboard and the corner: the room's light switch, and beside it the door's lanterns'
            (the owner's: moved from by the round window; neither puts out the exit sign, the emergency light)) */}
        {altar && <Movable id="lightswitch-room" label="店內電燈開關"><group position={[-0.002, 1.12, to - GENKAN_SWITCH]}><LightSwitch circuit="room" /></group></Movable>}
        {altar && <Movable id="lightswitch-door" label="門口燈籠開關"><group position={[-0.002, 1.12, to - GENKAN_SWITCH + SWITCH_STEP]}><LightSwitch circuit="door" /></group></Movable>}
        {/* (and each toilet's lights' switch, slim, on the post between the two doors, each on its own door's side of it (the owner's): beside
            each door's outer side the door slid open over it) */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <Movable key={who} id={`wcswitch-${who}`} label={who === 'm' ? '男廁電燈開關' : '女廁電燈開關'}>
            <group position={[-WC_POST_FACE - 0.002, 1.12, door + (k ? 1 : -1) * WC_SWITCH_Z]}><LightSwitch circuit={who === 'm' ? 'wcM' : 'wcF'} slim /></group>
          </Movable>
        ))}
        {altar && <Movable id="altar" label="供桌"><StaticBatch><group position={[(-ALTAR_D / 2) * ALTAR_SCALE, ALTAR_Y, shelfZ]} scale={ALTAR_SCALE}><AltarTable />
          {/* hung on the wall on two cloud brackets (雲形の棚受け, blender/kamidana.py's KamiBracket, the owner's after their photo): an arm under
              the shelf ending in a cloud's head, the cloud stepping back down to the plate on the wall, which runs on below to a rounded end */}
          {[-0.35, 0.35].map((z) => <group key={z} position={[ALTAR_D / 2, -0.034, z]}><KamiCopy part="bracket" /></group>)}</group></StaticBatch></Movable>}
        {/* (the omiki poured, the motes rising over the shrine: not merged) */}
        {altar && <Movable id="altarfittings" label="供桌上的供品"><group name="look-altar" position={[(-ALTAR_D / 2) * ALTAR_SCALE, ALTAR_Y, shelfZ]} scale={ALTAR_SCALE}><Altar omiki={altar === true ? undefined : altar} /></group></Movable>}
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
      {/* pendant lamps over the bar's customer side, low: one between each two places, midway (the owner's: a lamp between one customer and
          the next; bar's lampsAlong), their bands 鱗 and 立涌 in turn */}
      {lampsAlong(c).map((z, i) => (
        <Movable key={i} id={`${lampId}${i}`} label={`吊燈（${lampName} ${i + 1}）`}><group position-x={0.05} userData={{ fade: true }}><Pendant z={z} drop={0.25} pool={top} band={i % 2} /></group></Movable>
      ))}
    </group>
  )
}

/**
 * The altar on the shelf by the door: the household shrine (神棚), a pair of sake flasks (御神酒徳利) and a cup set out before it, a
 * dish of oranges. Offering the sake (a click) fills the cup and makes the shrine itself glow for a minute.
 */
/** where the Ebisu sits, in the altar's frame (the shrine at the wall, scaled up, its middle bay's floor) */
const EBISU_AT: [number, number, number] = [0.29 + 1.25 * (-0.14 + 0.027), 1.25 * (SHRINE_LIFT + 0.045 + 0.04), 0]
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
/** where the two little lanterns stand on the shelf, in its frame: beside the shrine's base's front corners (its plinth out to 0.2475 across,
 * its front at 0.065), between it and the vases (from 0.325 across), behind the flask and the book */
const SHRINE_LAMP_X = 0.07, SHRINE_LAMP_Z = 0.288
/** where the flask stands, by the cups' stand (back 0.02 with them) */
const FLASK_X = -0.04
/** and its height: up over the beckoning cats' stand below it, by the door */
const ALTAR_Y = 1.42
/** how long the omiki offered stands there, and the extra custom it brings (ms) */
const OMIKI_MS = 180000
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
function Altar({ omiki }: { omiki?: { pouredAt: number | null; onPour: () => void } }) {
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
    const at = omiki?.pouredAt ?? null
    const left = at === null ? 0 : Math.max(0, 1 - (performance.now() - at) / OMIKI_MS)
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
  const offer = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; omiki?.onPour() }
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
        <group scale-x={SHRINE_DEEP}><group position={[-0.14, SHRINE_LIFT, 0]}>
          <ShrineDoors />
          <Movable id="ebisu" label="惠比壽石像"><group scale-x={1 / SHRINE_DEEP} {...nameOver('惠比壽石像', '七福神之一，保佑生意興隆、漁獲豐收')}><KamidanaModel part="ebisu" /></group></Movable>
        </group></group>
      </group></Movable>
      {/* (the vases and the cups beside it, each its own piece: not part of what's pointed at, they don't light with it; the vases not batched,
          a batch takes no clicks, and clicked they change their flowers) */}
      {/* the two little lanterns before the shrine (神前灯籠, the owner's after their photo): beside its base's front corners, between it and
          the vases, lit; clear of the side doors as they open, of the flask and of the book */}
      {[-1, 1].map((sd) => (
        <Movable key={sd} id={`shrinelamp${sd}`} label={sd < 0 ? '神前燈籠（左）' : '神前燈籠（右）'}>
          <group position={[SHRINE_LAMP_X, 0, sd * SHRINE_LAMP_Z]} scale={SC} {...nameOver('神前燈籠', '供在神前的小木燈籠，點著燈')}><StaticBatch><KamiCopy part="lantern" /></StaticBatch><ContactShadow r={0.032} /></group>
        </Movable>
      ))}
      <Movable id="vase-1" label="花瓶（左）"><group position-x={ALTAR_D / 2} scale={SC}><Kamidana part="vase-1" /></group></Movable>
      <Movable id="vase1" label="花瓶（右）"><group position-x={ALTAR_D / 2} scale={SC}><Kamidana part="vase1" /></group></Movable>
      <Movable id="shrinecups" label="清酒杯與琉璃台"><group ref={cupsRef} position-x={ALTAR_D / 2 + CUPS_SHIFT} scale={SC} {...nameOver('清酒杯', '供神的酒杯；點御神酒壺倒酒')}><StaticBatch><Kamidana part="cups" /></StaticBatch></group></Movable>
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
      <Movable id="sutra" label="經書"><group {...nameOver('經書', '般若心經，供在神前')}><Sutra /></group></Movable>
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
      <Movable id="oranges" label="橘子盤"><group name="look-oranges" position={[-0.176, 0, 0.002]} scale={0.76} {...nameOver('椪柑', '供品，圓滿吉祥')}><KamidanaModel part="oranges" /><ContactShadow r={0.07} /></group></Movable>
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
    // (the cabinet never moves and the door swings as one: each's parts and ink folded together by material (some ten draws a fridge))
    mergeByMaterial(root)
    mergeByMaterial(pivot)
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
const FRIDGE_DOOR_AT = new THREE.Vector3()
function FridgeDoorImpl({ n = 0 }: { n?: number }) {
  const { W, D } = FRIDGE
  const { door, doorRoot } = useFreezer(n)
  const open = useRef(0)
  const mist = useRef(0)
  // (the door's state lives outside React: leave it shut when the shop's let go, so it doesn't come back open)
  useEffect(() => () => { FRIDGE_STATE[n].open = false; FRIDGE_STATE[n].passing = 0 }, [n])
  // (heard: its seal let go as it starts to swing open, a muffled knock as it swings shut (the owner's), as loud as it's near)
  const heard = useRef(0)
  useFrame(({ camera }, dt) => {
    const want = FRIDGE_STATE[n].passing > 0 || FRIDGE_STATE[n].open ? 1 : 0
    const near = () => Math.max(0, 1 - door.getWorldPosition(FRIDGE_DOOR_AT).distanceTo(camera.position) / 12)
    if (want && !heard.current) { heard.current = 1; coolerDoorSound(true, near()) }
    else if (!want && heard.current && open.current < 0.04) { heard.current = 0; coolerDoorSound(false, near()) }
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
  // (what the shelves' batch was made with: each place's drink, an empty one as the drink that's its own (its home), so a place emptied and
  // filled again (a customer's drink taken, the stocker's carried out) is only hidden and shown in the batch; only a place holding another
  // drink than it was made with (one dragged across, two swapped) makes it again. Made again at every change before, both fridges' hundred
  // and sixty bottles, it was a stall each time a customer took a drink)
  const [baked, setBaked] = useState(() => bakedShelves(n))
  const batch = useRef<BatchParts | null>(null)
  const shown = useRef<{ now: string; api: BatchParts | null }>({ now: '', api: null })
  useFrame((_, dt) => {
    if (seen.current !== FRIDGE_STOCK.ver) {
      seen.current = FRIDGE_STOCK.ver
      setVer((v) => v + 1)
      if (FRIDGE_STOCK.units[n].some((row, r) => row.some((id, k) => id !== null && id !== baked[r]?.[k]))) setBaked(bakedShelves(n))
    }
    // (each place's bottles shown or hidden in the batch as the stock is now; the one being carried, its front bottle hidden)
    const api = batch.current
    const now = `${FRIDGE_STOCK.ver}|${lifted}`
    if (api && (shown.current.now !== now || shown.current.api !== api)) {
      shown.current = { now, api }
      FRIDGE_STOCK.units[n].forEach((row, r) => row.forEach((id, k) => {
        api.show(`f${r}-${k}`, id !== null && lifted !== `${r}-${k}`)
        api.show(`b${r}-${k}`, id !== null)
      }))
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
      // (carried within the boss's reach, set down where he'd come for it or held right over him: he glows, to say it's for him)
      const boss = scene.getObjectByName('BossFollow')
      if (boss && !BOSS_DRINK.at) {
        const bp = boss.getWorldPosition(new THREE.Vector3())
        const mid = bp.clone().add(new THREE.Vector3(0, 0.6, 0))
        BOSS_FX.hover = (!!onTable && bp.setY(onTable.y).distanceTo(onTable) < 3) || raycaster.ray.distanceToPoint(mid) < 0.6
      } else BOSS_FX.hover = false
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
      BOSS_FX.hover = false
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
          // (handed him: a flash of the glow)
          BOSS_FX.glowAt = performance.now()
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
  const bakedKey = baked.map((row) => row.join(',')).join('|')
  // (made once for what it was baked with, so the stock changing doesn't redraw the hundred and sixty bottles under the batch)
  const ranks = useMemo(() => baked.map((row, r) => row.map((id, k) => {
    const sh = FRIDGE_UNITS[n].shelves
    const sp = new THREE.Vector3((k - (sh[r].ids.length - 1) / 2) * sh[r].pitch, sh[r].y, 0.16), step = sh[r].pitch * 1.02
    const deep = Math.max(1, Math.floor(RANK_DEPTH / step))
    return [
      <group key={`f${r}-${k}`} position={sp.toArray()} userData={{ batchPart: `f${r}-${k}` }}><DrinkBottle id={id} lit /></group>,
      <group key={`b${r}-${k}`} userData={{ batchPart: `b${r}-${k}` }}>
        {Array.from({ length: deep }, (_, j) => (
          <group key={j} position={[sp.x + (((k * 7 + j * 3) % 5) - 2) * 0.003, sp.y, sp.z - step * (j + 1)]} rotation-y={((k + j) % 3 - 1) * 0.25}>
            <DrinkBottle id={id} lit />
          </group>
        ))}
      </group>,
    ]
  })), [baked, n])
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
          one batch, each place's front bottle and ranks a part of it, hidden while the place is empty (and the front one while it's carried);
          a hair of play in each so the rows aren't ruled) */}
      <StaticBatch key={`ranks${n}|${bakedKey}`} parts={batch}>{ranks}</StaticBatch>
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
/** a fridge's places as its shelves' batch is made with them: each its drink, or (empty) the drink that's its own */
const bakedShelves = (n: number) => FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => (id ?? FRIDGE_UNITS[n].shelves[r].ids[k]) as DrinkId))
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
function DrinkBottleRaw({ id, lit = false, wet = false }: { id: DrinkId; lit?: boolean; wet?: boolean }) {
  const d = DRINKS.find((x) => x.id === id)!
  const kind = KIND_OF[id]
  const label = lit ? LABEL_LIT : LABEL_MAT
  const glassMat = kind === 'can' ? (lit ? CAN_LIT : CAN) : (lit ? GLASS_LIT : GLASS)
  // (the glass itself: the beer's brown, the ramune's pale aqua, the rest clear; the PET clear and thinner; its tint and clearness in its vertices)
  const glass = (g: THREE.BufferGeometry) => kind === 'can' ? g
    : tinted(g, id === 'beer' ? '#5a3010' : id === 'ramune' ? '#a8dcea' : kind === 'pet' ? '#f2f6f8' : '#eef4f2', id === 'beer' ? 0.88 : kind === 'pet' ? 0.22 : 0.28)
  // (the drink in it: its own colour, a little see-through (the milk not at all))
  const fill = (g: THREE.BufferGeometry) => tinted(g, id === 'ramune' ? '#dff4fa' : id === 'sake' ? '#f6f2de' : d.color,
    id === 'milk' ? 1 : id === 'ramune' || id === 'sake' || id === 'sports' ? 0.45 : 0.85)
  // (turned so its label's name faces +z)
  if (d.shape === 'can' && id !== 'cola' && id !== 'greenTea') return (
    // a can: printed all over, its silver top and rim
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.can} material={glassMat} />
      <mesh geometry={labelGeo(BOTTLE_GEO.canLabel, id)} position-y={0.046} material={label} />
      {wet && <mesh geometry={BOTTLE_GEO.canLabel} position-y={0.046} material={DEW} scale={[1.012, 1, 1.012]} />}
      <mesh geometry={BOTTLE_GEO.canTop} position-y={0.0905} material={glassMat} />
      <mesh geometry={tinted(BOTTLE_GEO.canRim, '#aeb3b9')} position-y={0.09} material={PARTS} />
      <mesh geometry={tinted(BOTTLE_GEO.canTab, '#d8dce0')} position={[0, 0.0928, 0.002]} material={PARTS} />
    </group>
  )
  if (d.shape === 'small') return (
    // the little cultured milk bottle: waisted, a red foil top
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={labelGeo(BOTTLE_GEO.small, id)} position-y={0.036} material={label} />
      {wet && <mesh geometry={BOTTLE_GEO.small} position-y={0.036} material={DEW} scale={[1.02, 1, 1.02]} />}
      <mesh geometry={tinted(BOTTLE_GEO.smallTop, d.cap)} position-y={0.074} material={PARTS} />
    </group>
  )
  // the bottles proper, each shaped as it is in a shop: the beer's long neck, the sake's slim shoulder, the big tea bottle
  const shaped = id === 'beer' ? BOTTLE_SHAPE.beer : id === 'sake' ? BOTTLE_SHAPE.sake : id === 'oolong' ? BOTTLE_SHAPE.pet
    : id === 'cola' || id === 'greenTea' || id === 'sports' ? BOTTLE_SHAPE.pet500 : id === 'milk' ? BOTTLE_SHAPE.milk : null
  const drinkKey = id === 'beer' ? 'beer' : id === 'sake' ? 'sake' : id === 'oolong' ? 'pet' : id === 'milk' ? 'milk' : 'pet500'
  if (shaped) return (
    <group rotation-y={-Math.PI / 2}>
      {/* (the drink inside, seen through the glass or plastic: made before the bottle, so at the same depth it is drawn first and the bottle over it) */}
      <mesh geometry={fill(BOTTLE_DRINK[drinkKey])} material={FILL} />
      <mesh geometry={glass(shaped.body)} material={glassMat} />
      {wet && <mesh geometry={shaped.body} material={DEW} scale={[1.006, 1, 1.006]} />}
      <mesh geometry={labelGeo(shaped.label, id)} position-y={shaped.labelY} material={label} />
      <mesh geometry={tinted(shaped.cap, d.cap)} position-y={shaped.capY} material={PARTS} />
      {/* (the foil round the beer's neck, the sake's paper collar) */}
      {shaped.foil && <mesh geometry={tinted(shaped.foil, id === 'beer' ? '#d4b04a' : '#f4efe2')} position-y={shaped.foilY} material={PARTS} />}
    </group>
  )
  // the ramune: its pale aqua glass, the fizzy drink in it, the glass marble held up in the neck's pinch, the blue plastic cap, a paper band
  return (
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={fill(BOTTLE_GEO.ramuneDrink)} material={FILL} />
      <mesh geometry={BOTTLE_GEO.marble} position-y={0.1402} material={MARBLE} />
      <mesh geometry={glass(BOTTLE_GEO.ramune)} material={glassMat} />
      {wet && <mesh geometry={BOTTLE_GEO.ramune} material={DEW} scale={[1.006, 1, 1.006]} />}
      <mesh geometry={labelGeo(BOTTLE_GEO.ramuneLabel, id)} position-y={0.055} material={label} />
      <mesh geometry={tinted(BOTTLE_GEO.ramuneCap, d.cap)} position-y={0.182} material={PARTS} />
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
/**
 * The drinks' looks, shared by them all, so a fridge's eighty bottles are a handful of draws (each drink's own glass, label, drink and cap
 * had been a material each: some fifty draws for the two fridges). Every label in one picture (LABEL_ATLAS, a cell each, a margin of itself
 * round it), and how each is finished (its clear coat, how rough, how metallic: a can's printed aluminium, the sake's washi) in a little
 * picture laid the same way (LABEL_FINISH, a pixel a cell); the glass and the PET one see-through material, each drink's tint and how clear
 * it is in its vertices; the drink inside likewise; the caps, foils and rims one toon material, their colours in their vertices; the cans'
 * aluminium one. In a fridge's light, a glowing twin of each.
 */
const CELL_W = LABEL_W + 16, CELL_H = LABEL_H + 16, ATLAS_COLS = 4, ATLAS_ROWS = Math.ceil(DRINKS.length / 4)
const cellOf = (id: DrinkId) => { const i = DRINKS.findIndex((d) => d.id === id); return { c: i % ATLAS_COLS, r: Math.floor(i / ATLAS_COLS) } }
const LABEL_ATLAS = (() => {
  const t = canvasTex(CELL_W * ATLAS_COLS, CELL_H * ATLAS_ROWS, (g) => {
    for (const d of DRINKS) {
      const { c, r } = cellOf(d.id), x0 = c * CELL_W, y0 = r * CELL_H
      g.save()
      g.beginPath(); g.rect(x0 + 8, y0 + 8, LABEL_W, LABEL_H); g.clip()
      g.translate(x0 + 8, y0 + 8)
      drawLabel(g, d.id, d.label)
      g.restore()
      // (its margin: across, the other edge (it wraps round the bottle); up and down, its own edge drawn out)
      const cv = g.canvas
      g.drawImage(cv, x0 + LABEL_W, y0 + 8, 8, LABEL_H, x0, y0 + 8, 8, LABEL_H)
      g.drawImage(cv, x0 + 8, y0 + 8, 8, LABEL_H, x0 + 8 + LABEL_W, y0 + 8, 8, LABEL_H)
      g.drawImage(cv, x0, y0 + 8, CELL_W, 1, x0, y0, CELL_W, 8)
      g.drawImage(cv, x0, y0 + 7 + LABEL_H, CELL_W, 1, x0, y0 + 8 + LABEL_H, CELL_W, 8)
    }
  })
  if (t) t.anisotropy = 4
  return t
})()
const LABEL_FINISH = (() => {
  const data = new Uint8Array(ATLAS_COLS * ATLAS_ROWS * 4)
  for (const d of DRINKS) {
    const { c, r } = cellOf(d.id), kind = KIND_OF[d.id]
    // (red: its clear coat; green: how rough; blue: how metallic, as three's maps read them)
    const [coat, rough, metal] = kind === 'can' ? [0, 0.28, 0.55] : d.id === 'sake' ? [0, 0.8, 0] : [0.6, 0.3, 0]
    data.set([coat * 255, rough * 255, metal * 255, 255], ((ATLAS_ROWS - 1 - r) * ATLAS_COLS + c) * 4)
  }
  const t = new THREE.DataTexture(data, ATLAS_COLS, ATLAS_ROWS)
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()
/** a drink's label shape, its UVs into its cell of the atlas (made once a shape a drink) */
const LABEL_GEO = new Map<string, THREE.BufferGeometry>()
function labelGeo(g: THREE.BufferGeometry, id: DrinkId) {
  const key = `${g.uuid}|${id}`
  let out = LABEL_GEO.get(key)
  if (!out) {
    out = g.clone()
    const uv = out.attributes.uv as THREE.BufferAttribute, { c, r } = cellOf(id)
    const AW = CELL_W * ATLAS_COLS, AH = CELL_H * ATLAS_ROWS
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (c * CELL_W + 8 + uv.getX(i) * LABEL_W) / AW, 1 - (r * CELL_H + 8 + (1 - uv.getY(i)) * LABEL_H) / AH)
    LABEL_GEO.set(key, out)
  }
  return out
}
/** a shape with a colour (and, given, how clear it is) in its every vertex, for a material shared by many colours (made once a colour) */
const TINTED = new Map<string, THREE.BufferGeometry>()
function tinted(g: THREE.BufferGeometry, hex: string, alpha?: number) {
  const key = `${g.uuid}|${hex}|${alpha ?? ''}`
  let out = TINTED.get(key)
  if (!out) {
    out = g.clone()
    const c = new THREE.Color(hex), n = out.attributes.position.count, k = alpha === undefined ? 3 : 4, a = new Float32Array(n * k)
    for (let i = 0; i < n; i++) { a[i * k] = c.r; a[i * k + 1] = c.g; a[i * k + 2] = c.b; if (k === 4) a[i * k + 3] = alpha! }
    out.setAttribute('color', new THREE.BufferAttribute(a, k))
    TINTED.set(key, out)
  }
  return out
}
/** a glow the colour of what's glowing: its emissive times its vertices' colour */
function glowByVertex<M extends THREE.Material>(m: M, key: string) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor.rgb;') }
  m.customProgramCacheKey = () => key
  return m
}
const LABEL_MAT = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: LABEL_ATLAS, roughnessMap: LABEL_FINISH, metalnessMap: LABEL_FINISH, clearcoatMap: LABEL_FINISH,
  roughness: 1, metalness: 1, clearcoat: 1 })
const LABEL_LIT = LABEL_MAT.clone()
LABEL_LIT.emissive = new THREE.Color('#ffffff'); LABEL_LIT.emissiveMap = LABEL_ATLAS; LABEL_LIT.emissiveIntensity = 0.3
const GLASS = new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.06, clearcoat: 0.95, clearcoatRoughness: 0.04, transparent: true,
  depthWrite: false, specularIntensity: 1 })
const GLASS_LIT = glowByVertex(GLASS.clone(), 'bottle-glass-lit')
GLASS_LIT.emissive = new THREE.Color('#ffffff'); GLASS_LIT.emissiveIntensity = 0.32
const CAN = new THREE.MeshStandardMaterial({ color: '#d4d8dc', metalness: 0.9, roughness: 0.25 })
const CAN_LIT = CAN.clone()
CAN_LIT.emissive = new THREE.Color('#d4d8dc'); CAN_LIT.emissiveIntensity = 0.32
reflectStudio(GLASS, GLASS_LIT, CAN, CAN_LIT, LABEL_MAT, LABEL_LIT)
/** the drink in each bottle: its colour and how clear in its vertices, lit a touch from within so it glows in the fridge */
const FILL = glowByVertex(new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.15, transparent: true, depthWrite: false,
  emissive: '#ffffff', emissiveIntensity: 0.12 }), 'bottle-fill')
/** the caps, foils, collars and rims: their colours in their vertices */
const PARTS = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true })
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
/**
 * A weeping willow (柳) in a tall glazed pot (blender/willow.py; the owner's: its quality up, its faces not too many: it was a pot, a stick,
 * fourteen tubes and 140 little cones, 2,128 triangles; now 1,540): a celadon pot run pale from the rim, a slender trunk, six branches arching
 * over, and its long twigs hanging, each two crossed strips of a painted twig and its leaves, drawn double-sided and cut out by their alpha
 * (no ink line round them: it would draw their strips' edges)
 */
const WILLOW_URL = import.meta.env.BASE_URL + 'models/willow.glb'
useGLTF.preload(WILLOW_URL)
function WillowModel() {
  const gltf = useGLTF(WILLOW_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('Willow')!.clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        const leaves = src.name === 'WillowLeaves'
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, side: leaves ? THREE.DoubleSide : THREE.FrontSide, alphaTest: leaves ? 0.5 : 0 })
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, (m) => /Leaves|Soil/.test(m.name), { width: 0.004, weld: true })
    return r
  }, [gltf])
  return <primitive object={obj} />
}
/** plastic crates of bottles (P箱), stacked by the fridges, where the stock's seen to (blender/bottlecrate.py: the owner's, their hand-holds
 * cut through and plastic to look at; they were boxes with a black slot painted on) */
const CRATE_URL = import.meta.env.BASE_URL + 'models/bottlecrate.glb'
useGLTF.preload(CRATE_URL)
/** the brewer's name moulded white on a crate's long sides: ビール big, 20本入 · 中瓶 under it, on clear (the planes over the smooth panels) */
const CRATE_LETTERS = canvasTex(600, 128, (g) => {
  g.save()
  g.fillStyle = '#f6efe4'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `900 62px ${SIGN_FONT}`
  g.fillText('ビール', 300, 50)
  g.font = '700 25px "Arial Black", sans-serif'
  ;(g as unknown as { letterSpacing: string }).letterSpacing = '2px'
  g.fillText('20本入 · 中瓶', 300, 103)
  g.restore()
})
/** the crate's moulded red plastic, glossy (the studio's light in it), and its lettering: made once, shared */
let crateMats: { plastic: THREE.MeshStandardMaterial; letters: THREE.MeshToonMaterial } | null = null
const crateMatsOf = () => {
  if (!crateMats) {
    const plastic = new THREE.MeshStandardMaterial({ color: '#c3302a', roughness: 0.36, metalness: 0, envMapIntensity: 0.85 })
    reflectStudio(plastic)
    if (CRATE_LETTERS) CRATE_LETTERS.flipY = false
    crateMats = { plastic, letters: new THREE.MeshToonMaterial({ color: '#ffffff', map: CRATE_LETTERS, alphaTest: 0.45 }) }
  }
  return crateMats
}
function CrateModel() {
  useStudio()
  const gltf = useGLTF(CRATE_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('BottleCrate')!.clone(true)
    r.position.set(0, 0, 0)
    const m = crateMatsOf()
    r.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = /Letters/.test(mesh.name) ? m.letters : m.plastic
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    inkModel(r, (q) => /Letters/.test(q.name), { width: 0.0012, weld: true })
    return r
  }, [gltf])
  return <primitive object={obj} />
}
/**
 * The bottle crates (P箱) by the fridges, the brewer's red plastic, two stacked (blender/bottlecrate.py: ribbed sides, a hand-hold cut
 * through each, a grid of cells inside), its brown beer bottles standing in the cells, their necks and caps up out of it
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
        // (the tape clear, as packing tape is (the owner's: it was an opaque brown strip))
        t = /Tape/.test(src.name) ? clearTape() : new THREE.MeshToonMaterial({ color: k ? '#ffffff' : src.color.clone(), map: print ?? src.map })
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
  const W = 0.36, D = 0.29
  const cols = 5, rows = 4
  return (
    <group>
      {[0, 1].map((k) => (
        <group key={k} position={[k * 0.03 - 0.015, k * 0.272, 0]} rotation-y={k * 0.1}>
          <CrateModel />
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
        // (the badge's word: a little picture (SpeakerBadgePrint) on a quad a hair proud of it, its letters the picture's alpha)
        if (src.transparent) Object.assign(t, { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })
        t.name = src.name
        toon.set(src, t)
      }
      m.material = t
      m.castShadow = SPEAKER_INKED.test(m.name)
    })
    inkModel(root, (m) => !SPEAKER_INKED.test(m.name), { width: 0.004, weld: true })
    // (drawn a few parts at a time; the arm and its bracket, which reach back to the corner wherever it's put, on their own; the woofer's cone,
    // dust cap and surround on their own too, to thump with the music)
    mergeByMaterial(root, (o) => /^Speaker(Arm|Mount)/.test(o.name) || /^Speaker(Cone|DustCap|Surround)$/.test(o.name))
    const thump = ['SpeakerCone', 'SpeakerDustCap', 'SpeakerSurround'].map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o)
      .map((o) => ({ o, z: o.position.z, s: o.scale.clone() }))
    let grille: THREE.Object3D | null = null
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === 'SpeakerGrille') grille = m })
    const g = grille as THREE.Object3D | null
    return { root, led: led as THREE.MeshBasicMaterial | null, toon: [...toon.values()], thump, grille: g ? { o: g, z: g.position.z } : null }
  }, [gltf])
  // (the bass while the music plays (the owner's): every half beat at 120 a minute the woofer's cone pushes out along the speaker's face and
  // swells a little, then springs back; the grille in front of it, which hides most of it, nudged out with it)
  const beat = useRef(0)
  useFrame((_, dt) => {
    const k = off ? 0 : Math.exp(-((beat.current = (beat.current + Math.min(dt, 0.1)) % 0.5) / 0.5) * 9)
    for (const t of model.thump) { t.o.position.z = t.z + 0.005 * k; t.o.scale.copy(t.s).multiplyScalar(1 + 0.04 * k) }
    if (model.grille) model.grille.o.position.z = model.grille.z + 0.002 * k
  })
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
/** the exit sign's pane (blender/exitsign.py's PW, PH): a little shorter than it was (the owner's: 0.42) */
const EXIT_PANE = { w: 0.38, h: 0.155 }
/** the exit sign's face, as Taiwan's edge-lit ones: green, lit; in the very middle a white doorway with the running figure leaving by it, its
 * step a line under it as wide either side (the owner's: the sign balanced about the doorway; its step ran out to the right only, and the
 * doorway sat wherever EXIT and the words left it); EXIT spaced out in the middle of the half to its left, the words in the language on
 * screen in the middle of the half to its right, set smaller if they don't fit; each centred on the pane's middle by its own letters' height */
const exitFace = (lang: string) => {
  const words = lang === 'ja' ? '非常口' : lang === 'en' ? 'WAY OUT' : '緊急出口'
  const H = 378, W = Math.round((H * EXIT_PANE.w) / EXIT_PANE.h)
  return canvasTex(W, H, (g) => {
    const MID = H / 2
    // (the ground: a bright green, a little brighter toward the top edge where the light comes in)
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#36dc7c'); grad.addColorStop(1, '#1cb75f')
    g.fillStyle = grad; g.fillRect(0, 0, W, H)
    const edge = g.createLinearGradient(0, 0, 0, 70)
    edge.addColorStop(0, 'rgba(255,255,255,0.32)'); edge.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = edge; g.fillRect(0, 0, W, 70)
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round'
    g.textBaseline = 'alphabetic'; g.textAlign = 'left'
    // (the doorway in the middle, its step overhanging it as much either side; each half beside it what's left, less a margin and a gap)
    const DOOR = 150, LIP = 20, wIcon = DOOR + 2 * LIP
    const MARGIN = 40, GAP = 36
    const half = (W - wIcon) / 2 - MARGIN - GAP
    // (EXIT's letters with a space between each, closer if they don't fit their half)
    const EXIT_FONT = '600 92px "Arial", "Helvetica", sans-serif'
    g.font = EXIT_FONT
    const letters = 'EXIT'.split('').map((ch) => ({ ch, w: g.measureText(ch).width }))
    const inked = letters.reduce((a, l) => a + l.w, 0)
    const TRACK = Math.max(6, Math.min(22, (half - inked) / (letters.length - 1)))
    const wExit = inked + TRACK * (letters.length - 1)
    const exitM = g.measureText('EXIT')
    let size = lang === 'en' ? 76 : 96
    const wordFont = (px: number) => (lang === 'en' ? `700 ${px}px "Arial", "Helvetica", sans-serif` : `700 ${px}px "Noto Sans TC", "Noto Sans JP", "Microsoft JhengHei", sans-serif`)
    g.font = wordFont(size)
    let wWords = g.measureText(words).width
    if (wWords > half) { size = Math.floor((size * half) / wWords); g.font = wordFont(size); wWords = g.measureText(words).width }
    // (each line of letters set so the middle of its own glyphs is the pane's middle)
    const centred = (m: TextMetrics) => MID + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
    g.font = EXIT_FONT
    let x = MARGIN + (half - wExit) / 2
    const yExit = centred(exitM)
    for (const l of letters) { g.fillText(l.ch, x, yExit); x += l.w + TRACK }
    // (the doorway: a white frame, open, the green showing through it, the figure running out through it to the right, its step under it)
    const x0 = W / 2 - DOOR / 2, top = MID - 118, foot = MID + 118
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
    g.fillRect(x0 - LIP, foot - 10, wIcon, 12)
    // (the words, in the middle of the half to the right)
    g.font = wordFont(size)
    g.fillText(words, W / 2 + wIcon / 2 + GAP + (half - wWords) / 2, centred(g.measureText(words)))
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
/** the exit sign's light round its pane (EXIT_PANE in its frame, on a sheet 0.2 wider and 0.35 high: 516 px a unit), and the wider light it
 * throws on the wall behind */
const EXIT_HALO = softRect(Math.round((EXIT_PANE.w + 0.2) * 516), 180, Math.round(EXIT_PANE.w * 516), 80, 26)
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
        <planeGeometry args={[EXIT_PANE.w + 0.2, 0.35]} />
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
/** the slim one (スリムスイッチ, 3.4 cm by 12): the toilets', on the post between their two doors */
const SWITCH_SLIM_URL = import.meta.env.BASE_URL + 'models/lightswitch-slim.glb'
/**
 * The light switch on the wall by the door (blender/lightswitch.py): an ivory wide rocker at hand height. A click puts the shop's lights out
 * or on again (scene/lightsStore; the lamps and the room's light follow it): the rocker rocks over, and while the lights are out its
 * little guide light (ホタル) glows green, to find it by in the dark. Facing -x (the wall's own frame: the room).
 */
/** how far from the wall's end by the way in the room's switch is (the door lanterns' a plate's width nearer the way in; the owner moved
 * the pair 0.54 further in along the wall) */
const GENKAN_SWITCH = 0.86
const SWITCH_STEP = 0.11
/** the toilets' two switches, slim, side by side on the post between their doors (the owner's: beside each door, on its outer side, the
 * door slid open covered it): each on its own door's half of the post (the two doors' frames meet there, a post 6 cm wide each, 6 deep),
 * how far from the middle, and how far out from the wall the post's face is */
const WC_SWITCH_Z = 0.03
const WC_POST_FACE = 0.06
/** each switch's name, and what pressing it does */
const SWITCH_SAYS: Record<Circuit, { title: string; on: string; off: string }> = {
  room: { title: '店內電燈', on: '點一下關燈', off: '點一下開燈' },
  door: { title: '門口燈籠', on: '點一下熄掉燈籠', off: '點一下點亮燈籠' },
  wcM: { title: '男廁電燈', on: '點一下關燈', off: '點一下開燈' },
  wcF: { title: '女廁電燈', on: '點一下關燈', off: '點一下開燈' },
}
function LightSwitch({ circuit = 'room', slim = false }: { circuit?: Circuit; slim?: boolean }) {
  const on = lightOn(useLights(), circuit)
  const [lit, setLit] = useState(false)
  const tag = () => { const say = SWITCH_SAYS[circuit]; setTip({ title: say.title, hint: lightOn(getLights(), circuit) ? say.on : say.off }) }
  const press = (e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; pressLightSwitch(circuit); lightSwitchSound(lightOn(getLights(), circuit)); tag() }
  const gltf = useGLTF(slim ? SWITCH_SLIM_URL : SWITCH_URL) as unknown as { scene: THREE.Group }
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
useGLTF.preload(SWITCH_SLIM_URL)

/**
 * The sacks of white rice by the sake (blender/ricesacks.py; the owner's: the room-temperature stock wants rice, its sacks piled by the sake,
 * for the rice balls, grilled with soy sauce): three unopened burlap sacks, two lying and one stood against them, each printed by the game:
 * 白米 big in black over its weave, 新米 in red above, its weight under, a red seal. Pointed at, they say how much rice there is; clicked, the
 * stock opens on its room-temperature tab, at the rice
 */
const RICE_URL = import.meta.env.BASE_URL + 'models/ricesacks.glb'
useGLTF.preload(RICE_URL)
const riceSackPrint = (weave: CanvasImageSource | null) => canvasTex(512, 512, (g) => {
  g.save()
  if (weave) g.drawImage(weave, 0, 0, 512, 512)
  else { g.fillStyle = '#c9b48c'; g.fillRect(0, 0, 512, 512) }
  // (printed onto the weave: multiplied, so the threads show through the ink)
  g.globalCompositeOperation = 'multiply'
  g.globalAlpha = 0.9
  g.strokeStyle = '#b3261e'; g.lineWidth = 7
  g.strokeRect(92, 112, 328, 288)
  g.lineWidth = 2.5
  g.strokeRect(104, 124, 304, 264)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = '#b3261e'
  g.font = `900 46px ${SIGN_FONT}`
  g.fillText('新米', 256, 162)
  g.fillStyle = '#1a1612'
  g.font = `900 150px ${SIGN_FONT}`
  g.fillText('白米', 256, 262)
  g.font = '700 30px "Noto Sans JP", "Yu Gothic", sans-serif'
  g.fillText('精白米 30kg', 256, 356)
  // (the seal, a red ring with 米 in it, at the box's corner)
  g.strokeStyle = '#b3261e'; g.lineWidth = 6
  g.beginPath(); g.arc(404, 392, 34, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#b3261e'
  g.font = `900 38px ${SIGN_FONT}`
  g.fillText('米', 404, 394)
  g.restore()
})
function RiceSacks() {
  const gltf = useGLTF(RICE_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('RiceSacks')!.clone(true)
    r.position.set(0, 0, 0)
    let mat: THREE.Material | null = null
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (!mat) {
        const src = m.material as THREE.MeshStandardMaterial
        // (the print's top toward the sack's far side, reading along its length from the room (flipped as a canvas is, unlike a glTF's own
        // pictures: kept glTF's way it came out mirrored))
        const t = riceSackPrint((src.map?.image as CanvasImageSource | undefined) ?? null)
        mat = new THREE.MeshToonMaterial({ color: '#ffffff', map: t })
      }
      m.material = mat
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, () => false, { width: 0.004, weld: true })
    return mergeByMaterial(r)
  }, [gltf])
  const says = () => {
    const n = SUPPLIES.has('Onigiri')
    return n < 0 ? '做飯糰用的白米（配醬油烤）・點一下看常溫區' : `白米 ${n} 份・做飯糰用（配醬油烤）・點一下看常溫區`
  }
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('白米袋', says()).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver('白米袋', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('ambient', 'sack', undefined, 'Onigiri') }}>
      <primitive object={obj} />
    </group>
  )
}
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
      {/* (its place and turn outside its batch: the object axes in edit mode follow the turn of what's inside a piece down to its first group
          of more than one thing, and a batch is two (the owner saw its object and world places read the same)) */}
      {/* (the sacks of rice beside the sake, between it and the willow (the owner's circle)) */}
      <Movable id="ricesacks" label="白米袋">
        <group position={at(3.5, 2.97)} rotation-y={face + 0.15}><RiceSacks /></group>
      </Movable>
      <Movable id="willow" label="柳樹">
        <group position={at(3.55, 2.95)} rotation-y={1.4} scale={0.9}><StaticBatch><WillowModel /></StaticBatch></group>
      </Movable>
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
