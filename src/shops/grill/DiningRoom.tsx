import { BambooModel } from './BarFurnish'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { StaticBatch } from '@/scene/StaticBatch'
import { glowLeave, glowOnly } from '@/scene/hoverGlow'
import { inkModel } from '@/scene/inkHull'
import { reflectStudio, useStudio } from '@/scene/studio'
import type { Lang } from '@/data/i18n'
import { useGLTF } from '@react-three/drei'
import { brushText, signTexture } from '@/scene/signFont'
import { fridgesOf, farOf, STAFF_DOOR, DRINKS, FRIDGE, FRIDGE_STATE, FRIDGE_STOCK, FRIDGE_UNITS, moveDrink, moveOut, tipOver, handOver, POINTER_HINT, pullOut, putBack, restockDrink, tableHit, TOILETS, WC_SLIDE, WC_W, type Counter, type DrinkId } from './bar'
import { Movable } from './Movable'
import { getEdit } from './edit'
import { Steam } from '@/scene/Steam'
import { setTip } from '@/scene/hoverTip'
import { getBgmOff, setBgmOff, useBgmOff } from '@/ui/bgmStore'

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

/** a red seal stamped in a corner */
const seal = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = '#b8261c'
  g.fillRect(x, y, s, s)
  g.strokeStyle = '#f4e6cc'
  g.lineWidth = 1.5
  g.strokeRect(x + 3, y + 3, s - 6, s - 6)
}

/** the frieze under the beam: seigaiha, overlapping waves of rings in indigo on cream */
const SEIGAIHA = canvasTex(64, 32, (g) => {
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
      }
    }
  }
}, true)

/** the pictures on the wall, each drawn here (no outside pictures): prints in frames and hanging scrolls */
const ART = {
  // Fuji under a red sun, bands of cloud across it
  fuji: canvasTex(256, 180, (g) => {
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
  wave: canvasTex(256, 180, (g) => {
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
  koi: canvasTex(256, 180, (g) => {
    g.fillStyle = '#1f3440'
    g.fillRect(0, 0, 256, 180)
    g.strokeStyle = 'rgba(200,230,240,0.25)'
    g.lineWidth = 2
    for (const [x, y] of [[60, 50], [190, 130]]) for (let r = 10; r < 50; r += 12) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke() }
    const fish = (x: number, y: number, a: number, spots: string) => {
      g.save(); g.translate(x, y); g.rotate(a)
      g.fillStyle = '#f6f0e4'
      g.beginPath(); g.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.moveTo(-30, 0); g.lineTo(-52, -12); g.lineTo(-48, 0); g.lineTo(-52, 12); g.fill()
      g.fillStyle = spots
      g.beginPath(); g.ellipse(8, -2, 14, 8, 0.3, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.ellipse(-14, 3, 9, 6, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    fish(110, 70, 0.4, '#d8432a')
    fish(150, 120, -2.6, '#e8902a')
    seal(g, 14, 150, 16)
  }),
  // calligraphy: 一期一會 brushed down the paper
  calligraphy: canvasTex(96, 256, (g) => {
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
  plum: canvasTex(96, 256, (g) => {
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
  akaFuji: canvasTex(512, 360, (g) => {
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
  rainBridge: canvasTex(512, 360, (g) => {
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
  kabuki: canvasTex(200, 476, (g) => {
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
  bijin: canvasTex(200, 476, (g) => {
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
    noboriCache.set(i, signTexture(96, 296, (g) => {
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
    hbannerCache.set(i, signTexture(320, 96, (g) => {
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
/** `start`, `step`: which cloths it takes in turn (two strings taking every other one, offset by one, never show the same cloth side by side) */
function BannerRow({ zs, start = 0, step = 1, x0 = 0, x1 = 0 }: { zs: number[]; start?: number; step?: number; x0?: number; x1?: number }) {
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
        out.push({ z: zs[k], look, len: 0.36 + 0.09 * ((k * 7) % 4), w: NOBORI_LOOKS[look].shape === 'rect' ? 0.15 : 0.17, wide: false })
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
  const z0 = zs[0], z1 = zs[zs.length - 1]
  // (the rope runs from x0 at the first place to x1 at the last: a slant gives a string that crosses another)
  const xAt = (z: number) => (z1 > z0 ? x0 + ((x1 - x0) * (z - z0)) / (z1 - z0) : x0)
  const yaw = Math.atan2(x1 - x0, z1 - z0)
  return (
    <group>
      <group position={[(x0 + x1) / 2, 0, (z0 + z1) / 2]} rotation-y={yaw}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.004, 0.004, Math.hypot(x1 - x0, z1 - z0) + 0.3, 5]} /><meshBasicMaterial color="#2a1a10" />
        </mesh>
      </group>
      {items.map((it, i) => (
        <group key={i} position={[xAt(it.z), 0, it.z]} ref={(g) => { refs.current[i] = g }}>
          {it.wide ? (
            <>
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[0, -0.05, sd * (it.w / 2 - 0.03)]}><cylinderGeometry args={[0.0025, 0.0025, 0.1, 4]} /><meshBasicMaterial color="#2a1a10" /></mesh>
              ))}
              <mesh position={[0, -0.1 - it.len / 2, 0]} rotation-y={-Math.PI / 2}>
                <planeGeometry args={[it.w, it.len]} /><meshToonMaterial color="#ffffff" map={hbannerTex(it.look)} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, -0.1 - it.len, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.004, 0.004, it.w, 5]} /><meshToonMaterial color="#2a1a10" /></mesh>
            </>
          ) : (
            <>
              <mesh position={[0, -0.01, 0]}><boxGeometry args={[0.012, 0.02, it.w + 0.02]} /><meshToonMaterial color="#e8dcc0" /></mesh>
              {[-1, 1].map((sd) => (
                <mesh key={sd} position={[0, -0.03, sd * (it.w / 2 + 0.012)]}><cylinderGeometry args={[0.004, 0.004, 0.05, 5]} /><meshToonMaterial color="#c8a050" /></mesh>
              ))}
              <mesh position={[0, -it.len - 0.035, 0]}><cylinderGeometry args={[0.003, 0.003, 0.012, 4]} /><meshToonMaterial color="#c8a050" /></mesh>
              <mesh position={[0, -it.len / 2 - 0.02, 0]} rotation-y={-Math.PI / 2} geometry={CLOTH_GEO} scale={[it.w, it.len, 1]}>
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
          <sphereGeometry args={[0.013, 8, 6]} /><meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={halo} args={[undefined, undefined, built.bulbs.length]} renderOrder={2}>
          <sphereGeometry args={[0.034, 8, 6]} /><meshBasicMaterial color="#ffc060" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={globe} args={[undefined, undefined, built.pegs.length]}>
          <sphereGeometry args={[0.03, 10, 8]} /><meshBasicMaterial color="#ffd9a0" toneMapped={false} />
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
  const W = 0.5, H = 0.36
  return (
    <group>
      <mesh position-x={-0.012}>
        <boxGeometry args={[0.02, H + 0.05, W + 0.05]} />
        <meshToonMaterial color="#2e1d12" />
      </mesh>
      <mesh position-x={-0.024} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
    </group>
  )
}

/** the round window's paper: lit warm from behind, brightest in the middle, the shadows of bamboo outside falling on it */
const ROUND_PAPER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(256, 236, 20, 256, 256, 280)
  gr.addColorStop(0, '#fff6e2'); gr.addColorStop(0.6, '#f6dfb4'); gr.addColorStop(1, '#d9a868')
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512)
  // (the fibres of the washi)
  g.strokeStyle = 'rgba(160,120,70,0.12)'; g.lineWidth = 1
  for (let k = 0; k < 160; k++) { const x = (k * 97) % 512, y = (k * 233) % 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + (k % 5) - 2); g.stroke() }
  // (bamboo outside: soft grey-green shadows of culms and leaves)
  g.fillStyle = 'rgba(70,80,50,0.28)'
  for (const [x, w, lean] of [[120, 16, 0.04], [190, 12, -0.03], [360, 18, 0.02], [420, 11, -0.05]] as [number, number, number][]) {
    g.save(); g.translate(x, 512); g.rotate(lean); g.fillRect(-w / 2, -520, w, 520)
    for (let y = 60; y < 520; y += 95) g.fillRect(-w / 2 - 2, -y, w + 4, 3)
    g.restore()
  }
  for (let k = 0; k < 26; k++) {
    const x = 90 + (k * 53) % 360, y = 60 + (k * 71) % 230, a = (k % 7) * 0.5 - 1.4
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(26, 0, 30, 6, 0, 0, Math.PI * 2); g.fill(); g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/**
 * A round window (丸窓) let into the plaster: a deep reveal of wood round it, a thick turned frame of warm keyaki, and inside, a light
 * lattice over washi lit from outside, bamboo's shadows on it
 */
function RoundWindow() {
  const R = 0.4
  const lat = [-0.2, 0, 0.2]
  return (
    <group>
      {/* (the reveal, the wall's thickness lined in wood) */}
      <mesh position-x={-0.03} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[R + 0.004, R + 0.004, 0.06, 64, 1, true]} />
        <meshToonMaterial color="#7a4e2c" side={THREE.BackSide} />
      </mesh>
      {/* (the paper, set back in the reveal) */}
      <mesh position-x={-0.004} rotation-y={-Math.PI / 2}>
        <circleGeometry args={[R, 64]} />
        <meshBasicMaterial map={ROUND_PAPER} toneMapped={false} />
      </mesh>
      {/* (the lattice: three bars each way, their ends let into the reveal) */}
      {lat.map((k) => {
        const L = 2 * Math.sqrt(R * R - k * k)
        return (
          <group key={k}>
            <mesh position={[-0.012, 0, k]}><boxGeometry args={[0.016, L, 0.018]} /><meshToonMaterial color="#8a5a34" /></mesh>
            <mesh position={[-0.012, k, 0]}><boxGeometry args={[0.016, 0.018, L]} /><meshToonMaterial color="#8a5a34" /></mesh>
          </group>
        )
      })}
      {/* (the frame: a thick ring of warm wood standing proud of the wall, a fine darker bead inside it) */}
      <mesh position-x={-0.05} rotation-y={Math.PI / 2}>
        <torusGeometry args={[R + 0.035, 0.04, 14, 72]} />
        <meshToonMaterial color="#a8703e" />
      </mesh>
      <mesh position-x={-0.062} rotation-y={Math.PI / 2}>
        <torusGeometry args={[R + 0.004, 0.012, 8, 72]} />
        <meshToonMaterial color="#5a361c" />
      </mesh>
      {/* (a little sill under it) */}
      <mesh position={[-0.05, -R - 0.06, 0]}><boxGeometry args={[0.1, 0.03, 0.5]} /><meshToonMaterial color="#8a5a34" /></mesh>
    </group>
  )
}

/** a hanging scroll: the painting on paper mounted in brocade, its cord over a nail, a weighted rod at the foot */
function Scroll({ art }: { art: ArtKey }) {
  const W = 0.26, H = 0.62
  return (
    <group>
      <mesh position-x={-0.006} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W + 0.06, H + 0.26]} />
        <meshToonMaterial color="#6a4a3a" />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[-0.007, s * (H / 2 + 0.06), 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W + 0.06, 0.03]} />
          <meshToonMaterial color="#b0904a" />
        </mesh>
      ))}
      <mesh position-x={-0.008} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[W, H]} />
        <meshToonMaterial color="#ffffff" map={ART[art]} />
      </mesh>
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

/** the plaster: warm cream, faintly mottled */
const PLASTER = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#efe3cb'
  g.fillRect(0, 0, 128, 128)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 260; k++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '150,120,80' : '255,250,235'},${0.05 + rnd() * 0.08})`
    g.beginPath()
    g.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 7, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
})()

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
/** upright boards of warm brown wood, each with its own tone and grain, for the wall's foot (the wainscot) */
const WALL_BOARDS = canvasTex(128, 128, (g) => {
  g.fillStyle = '#6a4a2e'
  g.fillRect(0, 0, 128, 128)
  const tones = ['#6e4c30', '#5f4128', '#76553a', '#684830', '#6a4a2c', '#5a3e26', '#74523a', '#644530']
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i]
    g.fillRect(i * 16 + 1, 0, 14, 128)
    g.strokeStyle = 'rgba(30,14,4,0.35)'
    g.lineWidth = 1
    for (let k = 0; k < 7; k++) {
      g.beginPath()
      g.moveTo(i * 16 + 2 + k * 2, 0)
      g.bezierCurveTo(i * 16 + 1 + k * 2, 40, i * 16 + 4 + k * 2, 90, i * 16 + 2 + k * 2, 128)
      g.stroke()
    }
    g.strokeStyle = 'rgba(255,220,170,0.1)'
    for (let k = 0; k < 3; k++) {
      g.beginPath()
      g.moveTo(i * 16 + 4 + k * 4, 0)
      g.lineTo(i * 16 + 5 + k * 4, 128)
      g.stroke()
    }
    // (a knot now and then)
    if (i % 3 === 1) {
      g.fillStyle = 'rgba(40,20,8,0.55)'
      g.beginPath()
      g.ellipse(i * 16 + 8, 30 + i * 9, 3, 5, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.5)'
  for (let i = 0; i < 8; i++) g.fillRect(i * 16, 0, 1.2, 128)
}, true)
function WallPiece({ z0, z1, y0, y1, plaster = false }: { z0: number; z1: number; y0: number; y1: number; plaster?: boolean }) {
  const map = useMemo(() => {
    const src = plaster ? PLASTER : WALL_BOARDS
    if (!src) return null
    const t = src.clone()
    if (plaster) {
      t.repeat.set((z1 - z0) / 1.2, (y1 - y0) / 1.2)
      t.offset.set(-z1 / 1.2, y0 / 1.2)
    } else {
      // (boards a hand's width across, running up)
      t.repeat.set((z1 - z0) / 0.64, (y1 - y0) / 0.9)
      t.offset.set(-z1 / 0.64, 0)
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
/** shoji paper, faintly fibred */
const SHOJI = canvasTex(64, 64, (g) => {
  g.fillStyle = '#f4ecd8'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = 'rgba(150,120,80,0.12)'
  for (let k = 0; k < 30; k++) {
    g.beginPath()
    const x = (k * 37) % 64, y = (k * 23) % 64
    g.moveTo(x, y)
    g.lineTo(x + 6, y + 3)
    g.stroke()
  }
})

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
  roll: new THREE.CylinderGeometry(0.04, 0.04, 0.09, 12),
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
      <Movable id={`wc-${who}-toilet`} label={`馬桶（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* the toilet, facing the door */}
      <group position={[D - 0.22, 0, 0]}>
        <mesh geometry={WC_GEO.foot} position-y={0.14}><meshToonMaterial color="#f6f6f2" /></mesh>
        <mesh geometry={WC_GEO.bowl} position-y={0.36} rotation-x={Math.PI} scale={[1.15, 0.7, 1]}><meshToonMaterial color="#f6f6f2" side={THREE.DoubleSide} /></mesh>
        <mesh geometry={WC_GEO.seat} position={[-0.02, 0.37, 0]} rotation-x={-Math.PI / 2} scale={[1.15, 1, 1]}><meshToonMaterial color="#e8d4a8" /></mesh>
        <mesh geometry={WC_GEO.tank} position={[0.13, 0.55, 0]}><meshToonMaterial color="#f6f6f2" /></mesh>
        {/* (a small basin on the cistern's top to wash the hands in as it fills, its tap curving over it) */}
        <mesh geometry={WC_GEO.basin} position={[0.13, 0.725, -0.06]} scale={[0.8, 1, 0.8]}><meshToonMaterial color="#f6f6f2" /></mesh>
        <mesh position={[0.17, 0.78, -0.06]}><cylinderGeometry args={[0.006, 0.006, 0.07, 6]} /><meshToonMaterial color="#b8bcc0" /></mesh>
        <mesh position={[0.15, 0.815, -0.06]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.006, 0.006, 0.045, 6]} /><meshToonMaterial color="#b8bcc0" /></mesh>
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-vase`} label={`竹花瓶（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      <group position={[D - 0.22, 0, 0]}>
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
      <group position={[D - 0.54, 0, 0]}>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[0, 0.02, (k - 4) * 0.052]}><boxGeometry args={[0.4, 0.02, 0.04]} /><meshToonMaterial color="#d8c08a" /></mesh>
        ))}
        {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.008, sd * 0.2]}><boxGeometry args={[0.4, 0.016, 0.03]} /><meshToonMaterial color="#6a4a28" /></mesh>)}
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-slippers`} label={`室內拖鞋（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0.07, 0.018, sd * 0.1]} rotation-y={sd * 0.1}>
          <boxGeometry args={[0.2, 0.03, 0.08]} /><meshToonMaterial color={accent} />
        </mesh>
      ))}
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-basin`} label={`石洗手台與鏡子（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* a stone basin on a wooden shelf by the side wall, a bamboo dipper laid across it, a round mirror in a wooden frame
          over it, the indigo hand towel on a rod */}
      <group position={[D * 0.45, 0, -w / 2 + 0.12]}>
        <mesh position={[0, 0.74, 0]}><boxGeometry args={[0.28, 0.035, 0.2]} /><meshToonMaterial color="#b88a52" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.11, 0.66, 0]}><boxGeometry args={[0.025, 0.14, 0.16]} /><meshToonMaterial color="#6a4428" /></mesh>)}
        <mesh geometry={WC_GEO.basin} position-y={0.79}><meshToonMaterial color="#6a6e70" /></mesh>
        <mesh position={[0, 0.82, 0]}><circleGeometry args={[0.075, 18]} /><meshBasicMaterial color="#9ab8c4" /></mesh>
        <mesh position={[0.02, 0.835, 0.03]} rotation-z={Math.PI / 2} rotation-y={0.3}><cylinderGeometry args={[0.005, 0.005, 0.26, 5]} /><meshToonMaterial color="#c8b070" /></mesh>
        <mesh position={[-0.13, 0.84, 0.03]}><cylinderGeometry args={[0.028, 0.024, 0.04, 10]} /><meshToonMaterial color="#c8b070" /></mesh>
        <mesh position={[0, 1.3, -0.115]}><circleGeometry args={[0.13, 24]} /><meshBasicMaterial color="#c8d8e0" /></mesh>
        <mesh position={[0, 1.3, -0.117]}><circleGeometry args={[0.16, 24]} /><meshToonMaterial color="#6a4428" /></mesh>
        <mesh position={[0.24, 1.0, -0.1]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.005, 0.005, 0.12, 5]} /><meshToonMaterial color="#c8b070" /></mesh>
        <mesh position={[0.24, 0.9, -0.098]}><planeGeometry args={[0.1, 0.2]} /><meshToonMaterial color="#ffffff" map={WC_TENUGUI} side={THREE.DoubleSide} /></mesh>
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-paper`} label={`衛生紙架（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* the paper, in a wooden holder on the other wall, and the plaque over it */}
      <group position={[D - 0.3, 0.55, w / 2 - 0.05]}>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.14, 0.12, 0.012]} /><meshToonMaterial color="#8a5a30" /></mesh>
        <mesh geometry={WC_GEO.roll} position={[0, 0, 0]} rotation-x={Math.PI / 2}><meshToonMaterial color="#fafaf6" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.06, 0, 0]}><boxGeometry args={[0.012, 0.1, 0.07]} /><meshToonMaterial color="#8a5a30" /></mesh>)}
      </group>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-plaque`} label={`廁所牌（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      <mesh position={[D * 0.45, 1.5, w / 2 - 0.006]} rotation-y={Math.PI}><planeGeometry args={[0.3, 0.12]} /><meshToonMaterial color="#ffffff" map={WC_PLAQUE} /></mesh>
      </StaticBatch></Movable>
      <Movable id={`wc-${who}-lamp`} label={`紙燈（${who === 'm' ? '男廁' : '女廁'}）`}><StaticBatch>
      {/* a paper lamp, lit, overhead, in a wooden cage */}
      <mesh geometry={WC_GEO.lamp} position={[D / 2, h + 0.1, 0]}><meshBasicMaterial color="#fff1cc" toneMapped={false} /></mesh>
      <mesh position={[D / 2, h + 0.1, 0]}><torusGeometry args={[0.062, 0.004, 5, 18]} /><meshToonMaterial color="#3a2416" /></mesh>
      </StaticBatch></Movable>
    </group>
  )
}
/**
 * A toilet's door itself: one whole sliding panel, wood below, shoji paper on a lattice above. It slides aside into
 * the wall when someone goes in or comes out, or when it's clicked (and back again with another click).
 */
function ToiletPanel({ who }: { who: 'm' | 'f' }) {
  const W = WC_W, H = WC_H
  const g = useRef<THREE.Group>(null)
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
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; TOILETS[who].open = !TOILETS[who].open }}
      {...tipOver('廁所門', '點一下開關')}>
      <group position={[-0.03, H / 2, 0]}>
        <mesh position-y={0.2} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[W - 0.02, H - 0.44]} />
          <meshToonMaterial color="#ffffff" map={SHOJI} />
        </mesh>
        <Box size={[0.02, 0.4, W - 0.02]} color="#6a4428" position={[-0.002, -H / 2 + 0.2, 0]} />
        {[-1, 1].map((sd) => <Box key={sd} size={[0.024, H - 0.02, 0.03]} color="#5a3a22" position={[-0.006, 0, sd * (W / 2 - 0.025)]} />)}
        {[-0.5, -0.17, 0.17, 0.5].map((k) => <Box key={k} size={[0.016, H - 0.46, 0.014]} color="#5a3a22" position={[-0.008, 0.2, k * (W - 0.06) / 1.1]} />)}
        {[0, 1, 2, 3, 4].map((k) => <Box key={k} size={[0.016, 0.018, W - 0.04]} color="#5a3a22" position={[-0.008, -H / 2 + 0.41 + k * (H - 0.46) / 4, 0]} />)}
        {/* the hand-hold, sunk in the wood */}
        <mesh position={[-0.014, -0.1, W / 2 - 0.09]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.006, 12]} />
          <meshToonMaterial color="#2a1a10" />
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
        onClick={(ev) => { ev.stopPropagation(); if (getEdit().on) return; TOILETS[who].open = !TOILETS[who].open }}
        onPointerOver={(ev) => {
          ev.stopPropagation()
          // (the sliding panel lights up, not the plane)
          let top: THREE.Object3D | null = ev.eventObject
          while (top && !top.getObjectByName(`look-wc-${who}`)) top = top.parent
          glowOnly(top?.getObjectByName(`look-wc-${who}`))
          setTip({ title: '廁所門', hint: '點一下開關' })
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
  return (
    <group>
      {/* the frame round the opening */}
      {[-1, 1].map((sd) => <Box key={sd} size={[0.06, H + 0.06, 0.06]} color="#3a2416" position={[-0.03, H / 2, sd * (W / 2 + 0.03)]} />)}
      <Box size={[0.07, 0.07, W + 0.12]} color="#3a2416" position={[-0.035, H + 0.035, 0]} />
      <Box size={[0.05, 0.025, W + 0.12]} color="#3a2416" position={[-0.03, 0.012, 0]} />
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
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      m.material = src.name === 'VasePorcelain'
        ? new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 })
        : src.name === 'VaseLeaf'
          ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, side: THREE.DoubleSide })
      m.castShadow = true
    })
    inkModel(r, (m) => /Leaves|Mum|Stems/.test(m.name), { width: 0.0008, weld: true })
    return r
  }, [gltf])
  return <group rotation-z={lean}><primitive object={root} /></group>
}
VASE_URLS.forEach((u) => useGLTF.preload(u))
/** a vase whose flowers change at a click: the sakaki with small chrysanthemums first, then the white and gold, then the pink and crimson; each
 * time set at a slightly different turn and lean, so the two sides never look stamped out alike */
function BouquetPick({ lean = 0 }: { lean?: number }) {
  const [v, setV] = useState(0)
  const turn = useMemo(() => (Math.random() - 0.5) * 1.2, [v])
  const tilt = useMemo(() => (Math.random() - 0.5) * 0.06, [v])
  return (
    <group rotation-y={turn} onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setV((x) => (x + 1) % VASE_URLS.length) }}
      {...tipOver('供花', '點一下換一組花')}>
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
/** the shrine drawn wider than it was modelled, across its front (along z): the owner's 1.25 */
const SHRINE_WIDE = 1.25
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
  useFrame((_, dt) => {
    k.current += ((open || BLESSING.on ? 1 : 0) - k.current) * Math.min(1, dt * 4)
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
        <group key={sd} position={[-0.15, 0.015, sd * 0.3]}><BouquetPick lean={sd * -0.08} /><ContactShadow r={0.05} y={-0.014} /></group>
      ))}
      {/* the cups' stand (blender/kamidana.py), the cups on it */}
      {(part === 'all' || part === 'cups') && <group position={[-0.3, 0, 0]}><KamidanaModel part="cupstand" /><ContactShadow r={0.15} /></group>}
      {(part === 'all' || part === 'cups') && [-0.09, 0, 0.09].map((z) => (
        <group key={z} position={[-0.3, 0.03, z]}>
          {/* (a cup with a wall of its own: a thick rim, a foot ring, a floor, the sake poured in is seen in it) */}
          <mesh geometry={SAKE_CUP} position-y={-0.0125}><meshToonMaterial color="#f4f1ea" /></mesh>
          <mesh geometry={SAKE_CUP} position-y={-0.0125} scale={[1.05, 1.03, 1.05]}><meshBasicMaterial color="#5a4a3a" side={THREE.BackSide} /></mesh>
          {/* (a soft shadow under it on the stand) */}
          <group position-y={-0.0125}><ContactShadow r={0.02} y={0.0004} /></group>
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
const LANTERN_GEO = (() => {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 24; i++) {
    const y = -LANTERN_END + (2 * LANTERN_END * i) / 24
    pts.push(new THREE.Vector2(Math.sqrt(Math.max(0, LANTERN_R ** 2 - y * y)), y))
  }
  return new THREE.LatheGeometry(pts, 28)
})()
/** thin washi in fine horizontal ribs, lit from within: bright cream in the middle of the belly, warmer toward its ends, a faint seam between each of the panels */
const LANTERN_SKIN = signTexture(128, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#f2b878')
  grad.addColorStop(0.22, '#ffe2b0')
  grad.addColorStop(0.5, '#fff6e0')
  grad.addColorStop(0.78, '#ffe2b0')
  grad.addColorStop(1, '#f2b878')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 256)
  // (the bamboo ribs it's wound on: a fine line every few pixels, a shade darker, with a pale one beside it)
  for (let y = 2; y < 256; y += 5) {
    g.fillStyle = 'rgba(190,130,70,0.22)'
    g.fillRect(0, y, 128, 1.3)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    g.fillRect(0, y + 1.5, 128, 1)
  }
  // (the seams between its panels)
  g.fillStyle = 'rgba(200,140,80,0.16)'
  for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 1.4, 256)
})
function Pendant({ z, drop, pool }: { z: number; drop: number; pool: number }) {
  return (
    <group position={[0, WALL_H, z]}>
      <mesh position-y={-drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      {/* (a paper lantern: the oval of ribbed washi, a pale wooden ring at each end, a little ring at the top for the cord) */}
      <group position-y={-drop - 0.13}>
        <mesh geometry={LANTERN_GEO}>
          <meshBasicMaterial color="#ffffff" map={LANTERN_SKIN} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
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
        <sprite scale={0.85}>
          <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.6} color="#ffcf90" />
        </sprite>
      </group>
      {/* (the pool of light on the bar top below, down from the lamp's height) */}
      <mesh position-y={pool - WALL_H + 0.004} rotation-x={-Math.PI / 2} renderOrder={1}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.32} />
      </mesh>
    </group>
  )
}

/**
 * One counter's stretch of the room: the wall behind its aisle (from/to along it, in the counter's own frame), and
 * pendant lamps over it.
 */
export function DiningWall({ c, from, to, far, lamps, top, door, altar = false, clear = [], corner = false }: { c: Counter; from: number; to: number; far: number
  /** the first of the room's two walls, whose start is the corner they meet in: its thickness runs on to close the corner */
  corner?: boolean
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
  // (moved along the wall away from the door, the owner's wish: more room round it)
  const shelfZ = shelfZ0 + (door !== undefined ? Math.sign(shelfZ0 - door) || 1 : 1) * 0.35
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
    return spots.filter((z) => (!shelf || Math.abs(z - shelfZ) > 0.85 * ALTAR_SCALE) && isClear(z, 0.3) && (door === undefined || Math.abs(z - door) > 0.95)
      && (door === undefined || Math.abs(z - door) > WC_W * 2 + 0.3))
      .map((z, k) => ({ z, scroll: k % 2 ? SCROLLS[(start + k) % SCROLLS.length] : undefined, print: PRINTS[(start + k) % PRINTS.length],
        // (on the back wall, the plum scroll's place is a round window let into the plaster instead)
        round: shelf && k % 2 === 1 && SCROLLS[(start + k) % SCROLLS.length] === 'plum',
        // (a banner every third place along the wall, in turn)
        // (none by the drinks fridges: the wall there is left plain)
        nobori: k % 3 === 2 && isClear(z, 0.9) ? Math.floor(k / 3 + start) % NOBORI_LOOKS.length : undefined,
        // (and a big signboard every fifth, between)
        kanban: k % 5 === 3 && k % 3 !== 2 ? Math.floor(k / 5 + start) % KANBAN_LOOKS.length : undefined }))
  }, [l, from, to, mid, shelfZ, c.length, door, shelf, clear])
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
      <group ref={wall} position-x={-far}>
        {/* (all of it standing still: drawn merged, a few meshes for the whole wall) */}
        <StaticBatch key={`${from}|${to}|${door}|${!!altar}`}>
        {/* the plaster over the wainscot, open where the toilets' doors are (a strip between them, and over them) */}
        {/* (the wall's thickness: a slab behind it, the base's dark wood, full height, over the toilets' doorways only above them) */}
        {/* (down through the base's own thickness too, which stops at the room's outline, short of the wall's) */}
        {spans.map(([z0, z1, y0]) => {
          const lo = y0 > 0 ? y0 : -BASE_DEPTH
          const z0e = corner && z0 === from ? z0 - WALL_T - 0.012 : z0
          return (
            <mesh key={`t${z0}|${y0}`} position={[WALL_T / 2 + 0.012, (lo + WALL_H) / 2, (z0e + z1) / 2]}>
              <boxGeometry args={[WALL_T, WALL_H - lo, z1 - z0e]} /><meshToonMaterial color="#3d2414" />
            </mesh>
          )
        })}
        {/* (at the corner, the sliver between this wall's face and its slab where the other wall's slab ends: filled, so the two walls' tops
            meet without a slot) */}
        {corner && (
          <mesh position={[0.006, (WALL_H - BASE_DEPTH) / 2, from - 0.012 - WALL_T / 2]}>
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
        {spans.filter(([a, b, y0]) => y0 < WAINSCOT && b - a > 0.3).map(([z0, z1]) => {
          const a = door !== undefined && z0 !== from ? z0 + 0.09 : z0, b = door !== undefined && z1 !== to ? z1 - 0.09 : z1
          return <Box key={z0} size={[0.05, 0.05, b - a]} color="#3a2416" position={[-0.02, WAINSCOT, (a + b) / 2]} />
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
            <group position={[0, a.round ? 1.55 : a.scroll ? 1.42 : 1.5, a.z]}>
              {a.kanban !== undefined ? <Kanban i={a.kanban} /> : a.round ? <RoundWindow /> : a.scroll ? <Scroll art={a.scroll} /> : <Framed art={a.print} />}
            </group>
          </StaticBatch></Movable>
        ))}
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
              {/* (two strings: one along the wall, one slanting out over the aisle; each takes every other cloth, so none repeats beside another) */}
              <Movable id={`banners${from.toFixed(1)}a`} label={`旗幟串 1（${from.toFixed(0)}）`}><group position={[0, 2.22, 0]} userData={{ fade: true }}><BannerRow zs={zs.filter((_, k) => k % 2 === 0)} start={0} step={2} x0={-0.3} x1={-0.3} /></group></Movable>
              <Movable id={`banners${from.toFixed(1)}b`} label={`旗幟串 2（${from.toFixed(0)}）`}><group position={[0, 2.0, 0]} userData={{ fade: true }}><BannerRow zs={zs.filter((_, k) => k % 2 === 1)} start={1} step={2} x0={-0.5} x1={-1.2} /></group></Movable>
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
        return <Movable key={i} id={`pendant${i}`} label={`吊燈 ${i + 1}`}><group position-x={0.05} userData={{ fade: true }}><Pendant z={z} drop={0.25} pool={top} /></group></Movable>
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
/** the cups and their stand set out from where they were worked out: where the owner put them in the edit panel (X −0.015) */
const CUPS_SHIFT = -0.015
/** where the Ebisu's feet are, on his pedestal (the ring of light spreads out from there) */
// (where the shrine's back stands, ALTAR_D / 2, and the Ebisu brought back toward it with the shrine's shallower depth)
const EBISU_FEET: [number, number, number] = [0.29 + (0.145 - 0.29) * SHRINE_DEEP, 0.077, 0]
/** where the cups stand along the shelf's depth (the offering's light comes from there) */
const CUPS_FX = 0.29 - 0.375 + CUPS_SHIFT
/** the altar shelf's depth, out from the wall: the god at the back, raised, the censer before him */
/** the whole shrine area drawn a size larger, its back still against the wall */
const ALTAR_SCALE = 1.2
const ALTAR_D = 0.58
/** and its height: up over the beckoning cats' stand below it, by the door */
const ALTAR_Y = 1.42
/** how long the sake offered stands there, and the extra custom it brings (ms) */
const INCENSE_MS = 180000
/** the small shrine's offering table (blender/kamidana.py's KamiTable): three keyaki boards, a dark lip with a gold line inside it, gold front
 * corners, the arched apron below; in the altar's own frame (its top's surface at y = 0, its front at x = -D/2) */
function AltarTable() {
  return <KamidanaModel part="table" />
}
function Sutra() {
  return (
    <group position={[-0.12, 0.001, -0.34]} rotation-y={-Math.PI / 2}><KamidanaModel part="sutra" /></group>
  )
}
function Altar({ incense }: { incense?: { litAt: number | null; onLight: () => void } }) {
  // (the offering: one flask pours clear sake into the three cups in turn, the stream and the cups filling; then it's set back)
  const flaskRef = useRef<THREE.Group>(null)
  const flaskShadow = useRef<THREE.Group>(null)
  const streamRef = useRef<THREE.Mesh>(null)
  const liquid = useRef<(THREE.Mesh | null)[]>([null, null, null])
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
    BLESSING.on = on && (performance.now() - (at ?? 0)) / 1000 > 3.6
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
    const CUP_X = ALTAR_D / 2 - 0.375 + CUPS_SHIFT, CUP_TOP = 0.05, POUR_Y = 0.085
    const cupZ = [-0.1125, 0, 0.1125]
    const rest = { x: -0.06, y: 0, z: 0.3 }
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
      m.position.y = KAMI_SC * (0.03 - 0.0125 + h)
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
      <Movable id="shrinecups" label="清酒杯與琉璃台"><group position-x={ALTAR_D / 2 + CUPS_SHIFT} scale={SC} {...nameOnly('清酒杯', '供神的酒杯；點御神酒壺倒酒')}><StaticBatch><Kamidana part="cups" /></StaticBatch></group></Movable>
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
      <Movable id="flask" label="御神酒壺"><group ref={flaskRef} position={[-0.06, 0, 0.3]}>{flask(0, 'f')}</group>
        {/* (its shadow stays on the stand where it stood: fading and spreading as it's lifted off, not carried up with it) */}
        <group ref={flaskShadow} position={[-0.06, 0, 0.3]}><ContactShadow r={0.055} /></group></Movable>
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
      {/* (in front of the cups' stand, a little smaller: where the owner set it in the edit panel (X −0.010, Z −0.203)) */}
      <Movable id="oranges" label="橘子盤"><group name="look-oranges" position={[-0.216, 0, 0.002]} scale={0.8} {...nameOnly('椪柑', '供品，圓滿吉祥')}><KamidanaModel part="oranges" /><ContactShadow r={0.07} /></group></Movable>
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
        m.castShadow = true
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
export function DrinkFridge({ n = 0 }: { n?: number }) {
  const { W, H, D } = FRIDGE
  const { body } = useFreezer(n)
  return (
    <group>
      <primitive object={body} />
      {/* the cove lights (槽燈): a narrow slot let into each inner side, a thin line of white light deep in it, and
          the light washing softly along the wall, shelf and drinks beside it (up each side only) */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (W / 2 - 0.075), H / 2 - 0.02, D / 2 - 0.1]}>
          <mesh><boxGeometry args={[0.03, H - 0.46, 0.03]} /><meshBasicMaterial color="#202226" /></mesh>
          <mesh position={[-sd * 0.0085, 0, 0.0155]}><boxGeometry args={[0.008, H - 0.5, 0.004]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
          <mesh position={[-sd * 0.014, 0, -0.17]} rotation-y={sd * Math.PI / 2}><planeGeometry args={[0.45, H - 0.46]} />
            <meshBasicMaterial map={COVE_WASH} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.75} side={THREE.DoubleSide} /></mesh>
        </group>
      ))}
      {/* the lit sign standing on top of the cabinet: a slim dark box with the board on its front, slanted a little back */}
      <group position={[0, H + 0.03, D / 2 - 0.1]} rotation-x={-0.12}>
        <mesh position={[0, 0.1, -0.02]}><boxGeometry args={[W * 0.92, 0.2, 0.06]} /><meshToonMaterial color="#1c1d20" /></mesh>
        <mesh position={[0, 0.1, 0.0115]}><planeGeometry args={[W * 0.86, 0.17]} /><meshBasicMaterial color="#ffffff" map={FRIDGE_SIGNS[n]} toneMapped={false} /></mesh>
        {/* (a strip of light round the sign's edge: little bulbs in a row, warm white, and a glowing bar along its foot) */}
        {Array.from({ length: 13 }, (_, k) => (
          <mesh key={`t${k}`} position={[-W * 0.43 + (k * W * 0.86) / 12, 0.205, 0.012]}><sphereGeometry args={[0.009, 8, 6]} /><meshBasicMaterial color={k % 2 ? '#ffe9a8' : '#fff6d8'} toneMapped={false} /></mesh>
        ))}
        {[-1, 1].map((sd) => Array.from({ length: 4 }, (_, k) => (
          <mesh key={`s${sd}${k}`} position={[sd * W * 0.45, 0.04 + k * 0.045, 0.012]}><sphereGeometry args={[0.009, 8, 6]} /><meshBasicMaterial color="#ffe9a8" toneMapped={false} /></mesh>
        )))}
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
export function FridgeDoor({ n = 0 }: { n?: number }) {
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
      {/* the mist, low at the foot of the open door, rolling out over the floor */}
      <group position={[0, 0.05, D / 2 + 0.1]}>
        <Steam width={W * 0.9} height={0.5} opacity={0.5} layers={2} color="#eaf6ff" shade="#bcd8ec" speed={0.06} level={mist} />
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
export function FridgeStock({ n = 0 }: { n?: number }) {
  const root = useRef<THREE.Group>(null)
  const { camera, gl, raycaster } = useThree()
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null
  const [, setVer] = useState(0)
  const seen = useRef(-1)
  const clock = useRef(0)
  const objs = useRef(new Map<string, THREE.Group>())
  const dragKey = useRef<string | null>(null)
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
    // (the shop puts one back every forty seconds, where one's been taken)
    clock.current += Math.min(dt, 0.1)
    if (clock.current > 40) {
      clock.current = 0
      restockDrink(n)
    }
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
      grp.quaternion.identity()
      if (onTable) {
        const w: [number, number, number] = [onTable.x, onTable.y, onTable.z]
        grp.position.set(0, 0, 0)
        if (from.kind === 'slot') pullOut(n, [from.r, from.k], 0, 0.5, w)
        else moveOut(from.i, w)
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
          onPointerOver={(ev) => { if (doorOpen()) { document.body.style.cursor = 'grab'; glowOnly(ev.eventObject) } setTip({ title: drinkName(id), hint: doorOpen() ? '拖出來，放到桌上或客人面前' : '先點櫃門打開' }) }}
          onPointerOut={(ev) => { document.body.style.cursor = ''; glowLeave(ev.eventObject); setTip(null) }}>
          <DrinkBottle id={id} lit />
        </group>
      )))}
      {/* (and a rank behind each, stood a little further back: a shelf of drinks is never one deep) */}
      {FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => id && (
        <group key={`b${r}-${k}`} position={[slotAt(r, k).x + (k % 2 ? 0.012 : -0.012), slotAt(r, k).y, slotAt(r, k).z - 0.13]}>
          <DrinkBottle id={id} lit />
        </group>
      )))}
      {FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => id && (
        <group key={`c${r}-${k}`} position={[slotAt(r, k).x + (k % 2 ? -0.01 : 0.01), slotAt(r, k).y, slotAt(r, k).z - 0.26]}>
          <DrinkBottle id={id} lit />
        </group>
      )))}
      {/* (what's been taken out, stood on the floor before the fridge) */}
      {FRIDGE_STOCK.out.map((o, i) => o.unit === n && (
        <group key={`o${i}-${o.id}`} ref={reg(`o${i}`)} position={[o.x, 0, o.z]} onPointerDown={(ev) => begin({ kind: 'out', i }, ev)}
          onPointerOver={(ev) => { document.body.style.cursor = 'grab'; glowOnly(ev.eventObject); setTip({ title: drinkName(o.id), hint: '拖曳移動，放回櫃子或遞給客人' }) }} onPointerOut={(ev) => { document.body.style.cursor = ''; glowLeave(ev.eventObject); setTip(null) }}>
          <DrinkBottle id={o.id} />
        </group>
      ))}
    </group>
  )
}
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
export function DrinkBottle({ id, lit = false }: { id: DrinkId; lit?: boolean }) {
  return <group scale={DRINK_SCALE[id]}><DrinkBottleRaw id={id} lit={lit} /></group>
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
function DrinkBottleRaw({ id, lit = false }: { id: DrinkId; lit?: boolean }) {
  const d = DRINKS.find((x) => x.id === id)!
  const look = lit ? litLook(id) : BOTTLE_LOOK[id]
  // (turned so its label's name faces +z)
  if (d.shape === 'can' && id !== 'cola' && id !== 'greenTea') return (
    // a can: printed all over, its silver top and rim
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.can} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canLabel} position-y={0.046} material={look.label} />
      <mesh geometry={BOTTLE_GEO.canTop} position-y={0.0905} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canRim} position-y={0.09}><meshToonMaterial color="#aeb3b9" /></mesh>
      <mesh geometry={BOTTLE_GEO.canTab} position={[0, 0.0928, 0.002]}><meshToonMaterial color="#d8dce0" /></mesh>
    </group>
  )
  if (d.shape === 'small') return (
    // the little cultured milk bottle: waisted, a red foil top
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.small} position-y={0.036} material={look.label} />
      <mesh geometry={BOTTLE_GEO.smallTop} position-y={0.074}><meshToonMaterial color={d.cap} /></mesh>
    </group>
  )
  // the bottles proper, each shaped as it is in a shop: the beer's long neck, the sake's slim shoulder, the big tea bottle
  const shaped = id === 'beer' ? BOTTLE_SHAPE.beer : id === 'sake' ? BOTTLE_SHAPE.sake : id === 'oolong' ? BOTTLE_SHAPE.pet
    : id === 'cola' || id === 'greenTea' || id === 'sports' ? BOTTLE_SHAPE.pet500 : id === 'milk' ? BOTTLE_SHAPE.milk : null
  if (shaped) return (
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={shaped.body} material={look.glass} />
      <mesh geometry={shaped.label} position-y={shaped.labelY} material={look.label} />
      <mesh geometry={shaped.cap} position-y={shaped.capY}><meshToonMaterial color={d.cap} /></mesh>
      {/* (the foil round the beer's neck, the sake's paper collar) */}
      {shaped.foil && <mesh geometry={shaped.foil} position-y={shaped.foilY}><meshToonMaterial color={id === 'beer' ? '#d4b04a' : '#f4efe2'} /></mesh>}
    </group>
  )
  return (
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.body} position-y={0.065} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.label} position-y={0.06} material={look.label} />
      <mesh geometry={BOTTLE_GEO.neck} position-y={0.145} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.cap} position-y={0.169}><meshToonMaterial color={d.cap} /></mesh>
    </group>
  )
}
/** a bottle turned from its profile: the points of (radius, height) from its foot up to its mouth */
const bottleBody = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 10)
const BOTTLE_SHAPE = {
  // a brown long-necked beer bottle, a gold foil at its neck
  beer: { body: bottleBody([[0, 0], [0.024, 0], [0.0275, 0.005], [0.0275, 0.12], [0.0235, 0.145], [0.0145, 0.17], [0.0125, 0.2],
    [0.0135, 0.206], [0.0135, 0.21], [0, 0.21]]), label: new THREE.CylinderGeometry(0.0282, 0.0282, 0.07, 10, 1, true), labelY: 0.065,
    cap: new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 9), capY: 0.213, foil: new THREE.CylinderGeometry(0.0138, 0.0155, 0.04, 9), foilY: 0.18 },
  // the glass milk bottle: a wide mouth, a paper cap pressed down over it, a paper label round its middle
  milk: { body: bottleBody([[0, 0], [0.02, 0], [0.0225, 0.005], [0.0225, 0.085], [0.02, 0.098], [0.0175, 0.106], [0.0175, 0.118], [0, 0.118]]),
    label: new THREE.CylinderGeometry(0.0228, 0.0228, 0.06, 10, 1, true), labelY: 0.05,
    cap: new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 9), capY: 0.121, foil: new THREE.CylinderGeometry(0.0182, 0.0188, 0.014, 9) as THREE.BufferGeometry | null, foilY: 0.112 },
  // the 500 ml plastic bottle: a ribbed foot, a label round its middle, a coloured cap
  pet500: { body: bottleBody([[0, 0], [0.019, 0], [0.0235, 0.006], [0.0235, 0.1], [0.021, 0.125], [0.0135, 0.145], [0.0105, 0.152],
    [0.0105, 0.158], [0, 0.158]]), label: new THREE.CylinderGeometry(0.0238, 0.0238, 0.075, 10, 1, true), labelY: 0.07,
    cap: new THREE.CylinderGeometry(0.0118, 0.0118, 0.012, 9), capY: 0.164, foil: null as THREE.BufferGeometry | null, foilY: 0 },
  // a clear slim sake bottle with a round shoulder, a paper collar under the red cap
  sake: { body: bottleBody([[0, 0], [0.022, 0], [0.0245, 0.004], [0.0245, 0.12], [0.0225, 0.15], [0.014, 0.178], [0.0105, 0.2],
    [0.0115, 0.206], [0, 0.206]]), label: new THREE.CylinderGeometry(0.0249, 0.0249, 0.085, 10, 1, true), labelY: 0.07,
    cap: new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 9), capY: 0.21, foil: new THREE.CylinderGeometry(0.0112, 0.0125, 0.012, 9), foilY: 0.196 },
  // the big plastic tea bottle: wide, a ribbed foot, a green label round its middle
  pet: { body: bottleBody([[0, 0], [0.026, 0], [0.032, 0.008], [0.032, 0.012], [0.0305, 0.02], [0.032, 0.028], [0.032, 0.17],
    [0.028, 0.2], [0.017, 0.225], [0.0135, 0.236], [0.0135, 0.246], [0, 0.246]]), label: new THREE.CylinderGeometry(0.0326, 0.0326, 0.1, 10, 1, true),
    labelY: 0.1, cap: new THREE.CylinderGeometry(0.0145, 0.0145, 0.014, 9), capY: 0.252, foil: null as THREE.BufferGeometry | null, foilY: 0 },
}
const BOTTLE_GEO = {
  body: new THREE.CylinderGeometry(0.026, 0.028, 0.13, 9),
  label: new THREE.CylinderGeometry(0.0285, 0.0295, 0.06, 9, 1, true),
  neck: new THREE.CylinderGeometry(0.012, 0.026, 0.04, 8),
  cap: new THREE.CylinderGeometry(0.013, 0.013, 0.01, 8),
  can: bottleBody([[0, 0], [0.0168, 0], [0.0198, 0.004], [0.0212, 0.011], [0.0212, 0.078], [0.0202, 0.084], [0.0184, 0.0885], [0.0178, 0.09], [0, 0.09]]),
  canLabel: new THREE.CylinderGeometry(0.0215, 0.0215, 0.07, 10, 1, true),
  canTop: new THREE.CylinderGeometry(0.0172, 0.0178, 0.004, 10),
  canTab: new THREE.CylinderGeometry(0.0062, 0.0062, 0.0014, 8),
  canRim: new THREE.CylinderGeometry(0.0182, 0.0182, 0.0026, 10, 1, true),
  small: new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.02], [0.013, 0.036], [0.016, 0.056], [0.015, 0.072], [0, 0.072]]
    .map(([x, y]) => new THREE.Vector2(x, y - 0.036)), 9),
  smallTop: new THREE.CylinderGeometry(0.0155, 0.0155, 0.004, 9),
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
  const glass = kind === 'can'
    ? new THREE.MeshStandardMaterial({ color: '#d4d8dc', metalness: 0.9, roughness: 0.25 })
    : kind === 'glass'
      ? new THREE.MeshPhysicalMaterial({ color: d.color, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: d.id === 'beer' ? 0.92 : 0.6, specularIntensity: 1 })
      : kind === 'pet'
        ? new THREE.MeshPhysicalMaterial({ color: d.color, roughness: 0.12, clearcoat: 0.8, transparent: true, opacity: 0.72 })
        : new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.4 })
  const label = kind === 'can'
    ? new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex, metalness: 0.55, roughness: 0.28 })
    : new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: tex, roughness: d.id === 'sake' ? 0.8 : 0.3, clearcoat: d.id === 'sake' ? 0 : 0.6 })
  reflectStudio(glass as THREE.MeshStandardMaterial, label as THREE.MeshStandardMaterial)
  return [d.id, { glass, label }]
})) as unknown as Record<DrinkId, { glass: THREE.Material; label: THREE.Material }>
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
const BARRELS_URL = import.meta.env.BASE_URL + 'models/kazaridaru_sake_barrels_lowpoly_remesh.glb'
/** a stack of decorative sake barrels (飾り樽) with a stack of plates beside it (the model's second part), the downloaded model (its floor left out), toon-shaded and inked, stood on the floor, ~0.9 tall */
function SakeStack({ part }: { part: number }) {
  const gltf = useGLTF(BARRELS_URL) as unknown as { scene: THREE.Group }
  const stack = useMemo(() => {
    const root = gltf.scene.clone(true)
    const floors: THREE.Object3D[] = []
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const geo = m.geometry
      geo.computeBoundingBox()
      const sz = geo.boundingBox!.getSize(new THREE.Vector3())
      // (the model's floor plane is flat: not drawn, and taken out altogether so it gets no outline and no part in the piece's size)
      if (sz.y < 0.01 && sz.x > 1.5) { floors.push(m); return }
      const src = m.material as THREE.MeshStandardMaterial
      m.material = new THREE.MeshToonMaterial({ color: '#ffffff', map: src.map ?? null })
      m.castShadow = true
    })
    for (const f of floors) f.removeFromParent()
    // (sized and set down as the whole stack, then only one of its two clusters of barrels kept: each is its own piece to move)
    const clusters: THREE.Object3D[] = []
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) clusters.push(o) })
    const box = new THREE.Box3().setFromObject(root)
    clusters.forEach((c, i) => { if (i !== part) c.removeFromParent() })
    inkModel(root)
    const size = box.getSize(new THREE.Vector3())
    const k = 0.9 / (size.y || 1)
    const c = box.getCenter(new THREE.Vector3())
    const out = new THREE.Group()
    root.position.set(-c.x, -box.min.y, -c.z)
    out.add(root)
    out.scale.setScalar(k)
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
/**
 * The mat that marks where the staff go in and out (関係者専用): a tatami mat, woven rush in pale straw green with the dark
 * cloth border (heri) along its two long sides, the words on a cream plaque in its middle.
 */
/** the tatami top: fine rush weave along the mat, uneven in tone, with the heri sewn along both long edges */
const TATAMI_TEX = canvasTex(512, 256, (g) => {
  g.fillStyle = '#b7b178'
  g.fillRect(0, 0, 512, 256)
  // (the rush: thin strands side by side, each a little lighter or darker, with now and then a pale fleck)
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let y = 0; y < 256; y += 2) {
    const t = rnd()
    g.fillStyle = `rgba(${t < 0.5 ? '96,100,52' : '236,228,160'},${0.1 + rnd() * 0.16})`
    g.fillRect(0, y, 512, 1 + (rnd() < 0.3 ? 1 : 0))
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(250,244,190,${0.15 + rnd() * 0.2})`
    g.fillRect(rnd() * 512, rnd() * 256, 6 + rnd() * 18, 1)
  }
  // (the weft stitching across the mat, a fine twill)
  g.strokeStyle = 'rgba(80,80,40,0.10)'
  g.lineWidth = 1
  for (let x = 0; x < 512; x += 6) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, 236); g.stroke() }
  // (the heri: dark indigo cloth with a thin cream line each side of it and a row of small diamonds)
  for (const y of [0, 236]) {
    g.fillStyle = '#1d2540'
    g.fillRect(0, y, 512, 20)
    g.fillStyle = '#c9b98a'
    g.fillRect(0, y === 0 ? 17 : 236, 512, 1.5)
    g.fillStyle = 'rgba(201,185,138,0.55)'
    for (let x = 6; x < 512; x += 16) {
      g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + 4, y + 6); g.lineTo(x + 8, y + 10); g.lineTo(x + 4, y + 14); g.closePath(); g.fill()
    }
  }
  // (the ends: a sewn edge, a shade darker)
  g.fillStyle = 'rgba(60,60,30,0.28)'
  g.fillRect(0, 20, 3, 216); g.fillRect(509, 20, 3, 216)
})
/** the mat that marks where the staff go in and out: a flat tatami mat, the words keyed on its middle */
const MAT = { w: 1.5, d: 0.75, h: 0.03 }
function StaffMat({ lang: _lang }: { lang: Lang }) {
  const mats = useMemo(() => {
    const side = new THREE.MeshToonMaterial({ color: '#8e8a5a' })
    const top = new THREE.MeshToonMaterial({ color: '#ffffff', map: TATAMI_TEX })
    return [side, side, top, side, side, side]
  }, [])
  return (
    <group>
      <mesh position={[0, MAT.h / 2, 0]} material={mats}>
        <boxGeometry args={[MAT.w, MAT.h, MAT.d]} />
      </mesh>
    </group>
  )
}
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
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, alphaTest: grille ? 0.5 : 0, side: grille ? THREE.DoubleSide : THREE.FrontSide })
        t.name = src.name
        toon.set(src, t)
      }
      m.material = t
      m.castShadow = SPEAKER_INKED.test(m.name)
    })
    inkModel(root, (m) => !SPEAKER_INKED.test(m.name), { width: 0.004, weld: true })
    return { root, led: led as THREE.MeshBasicMaterial | null, toon: [...toon.values()] }
  }, [gltf])
  useEffect(() => { model.led?.color.set(off ? '#d02a2a' : '#3ddc6a') }, [model, off])
  // (the arm reaches back to the room's corner and the bracket sits in it: found by a ray from the arm's joint straight back, every half second,
  // so it still fits wherever the speaker's been moved to)
  const { scene: room, camera } = useThree()
  const reachAt = useRef(0)
  useFrame((st) => {
    if (st.clock.elapsedTime - reachAt.current < 0.5) return
    reachAt.current = st.clock.elapsedTime
    const reach = model.root.getObjectByName('SpeakerArmReach'), mount = model.root.getObjectByName('SpeakerMount')
    if (!reach || !mount) return
    reach.updateWorldMatrix(true, false)
    const from = reach.getWorldPosition(new THREE.Vector3())
    const back = new THREE.Vector3(0, 0, -1).transformDirection(reach.matrixWorld)
    const ray = new THREE.Raycaster(from, back, 0.03, 2)
    ray.camera = camera
    ray.params.Line = { threshold: 0 }
    ray.params.Points = { threshold: 0 }
    const mine = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (o === model.root || o.userData.fade || o.userData.editHandle) return true; return false }
    const hit = ray.intersectObjects(room.children, true).find((h) => (h.object as THREE.Mesh).isMesh && !mine(h.object))
    if (!hit) return
    const k = reach.getWorldScale(new THREE.Vector3()).z || 1
    const len = Math.max(0.05, hit.distance / k)
    reach.scale.z = len / SPEAKER_ARM
    mount.position.z = reach.position.z - len
  })
  // (pointed at, it lifts a little out of the dark, to say it can be clicked)
  useEffect(() => { for (const t of model.toon) t.emissive.set(lit ? '#2a2a30' : '#000000') }, [model, lit])
  return (
    <group name="look-speaker" onClick={press} onPointerOver={(e: { stopPropagation: () => void }) => { e.stopPropagation(); if (getEdit().on) return; setLit(true); handOver.onPointerOver(e as never); tag() }}
      onPointerOut={(e: { stopPropagation: () => void }) => { setLit(false); handOver.onPointerOut(e as never); setTip(null) }} >
      <MusicNotes playing={!off} />
      {/* (the handlers on a group round it: a primitive's own aren't attached) */}
      <primitive object={model.root} />
    </group>
  )
}
useGLTF.preload(SPEAKER_URL)

export function ShopProps({ counters, lang = 'zh' }: { counters: Counter[]; lang?: Lang }) {
  const c0 = counters[0]
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(c0.along, along).addScaledVector(c0.lay, lay)
  // (their fronts toward the room's open side, where the camera is)
  const face = Math.atan2(-c0.lay.x, -c0.lay.z)
  const fr = useMemo(() => fridgesOf(counters), [counters])
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
    <>
      <Movable id="speaker" label="音箱" baseTurn={[0, 45, 0]}><group position={speaker.p} rotation-y={speaker.yaw}><WallSpeaker /></group></Movable>
      {[0, 1].map((part) => (
        <Movable key={part} id={part ? 'sake2' : 'sake'} label={part ? '餐盤堆' : '酒樽'}><StaticBatch key={lang}>
          <group position={at(3.55, 3.6)} rotation-y={face + 0.3}>
            <group rotation-y={Math.PI / 2}><SakeStack part={part} /></group>
          </group>
        </StaticBatch></Movable>
      ))}
      {/* plants about the room: a willow by the sake barrels in the front corner; bamboo by the till's end, by the door
          (none against the side wall: the two drinks fridges stand there) */}
      <Movable id="willow" label="柳樹"><StaticBatch key={lang}>
        <group position={at(3.55, 2.95)} rotation-y={1.4} scale={0.9}><PottedWillow /></group>
      </StaticBatch></Movable>
      <Movable id="staffmat" label="員工專用墊"><StaticBatch key={lang}>
        <group position={at(STAFF_DOOR.along, STAFF_DOOR.lay)} rotation-y={face + Math.PI} scale={0.64}><StaffMat lang={lang} /></group>
      </StaticBatch></Movable>
      <Movable id="bamboo" label="竹盆栽"><StaticBatch key={lang}>
        <group position={cornerAt} rotation-y={0.4}><BambooModel /></group>
      </StaticBatch></Movable>
      {/* (the crates of red bottles against the side wall just along from the fridges, clear of the men's door's slide) */}
      {fr && <Movable id="crates" label="酒箱"><StaticBatch key={lang}>
        <group position={crateAt} rotation-y={Math.atan2(counters[1].lay.x, counters[1].lay.z)}><BottleCrates /></group>
      </StaticBatch></Movable>}
    </>
  )
}
