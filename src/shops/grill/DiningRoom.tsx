import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { StaticBatch } from '@/scene/StaticBatch'
import { glowOnly } from '@/scene/hoverGlow'
import { brushText, signTexture } from '@/scene/signFont'
import { STAFF_DOOR, DRINKS, FRIDGE, FRIDGE_STATE, FRIDGE_STOCK, FRIDGE_UNITS, moveDrink, moveOut, pullOut, putBack, restockDrink, tableHit, TOILETS, WC_SLIDE, WC_W, handOver, type Counter, type DrinkId } from './bar'
import { LuckyCat } from './LuckyCat'
import { Steam } from '@/scene/Steam'

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
}
type ArtKey = keyof typeof ART
const PRINTS: ArtKey[] = ['fuji', 'wave', 'koi']
const SCROLLS: ArtKey[] = ['calligraphy', 'plum']

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
function BannerRow({ zs }: { zs: number[] }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  // (the same every time: a mix of cloths and lengths, a wide banner every so often taking three places)
  const items = useMemo(() => {
    const out: { z: number; look: number; len: number; w: number; wide: boolean }[] = []
    for (let k = 0; k < zs.length; k++) {
      if (k % 7 === 3 && k + 2 < zs.length) {
        out.push({ z: zs[k + 1], look: (k * 3) % HBANNER_LOOKS.length, len: 0.2, w: 0.62, wide: true })
        k += 2
      } else {
        const look = (k * 5 + 3) % NOBORI_LOOKS.length
        out.push({ z: zs[k], look, len: 0.36 + 0.09 * ((k * 7) % 4), w: NOBORI_LOOKS[look].shape === 'rect' ? 0.15 : 0.17, wide: false })
      }
    }
    return out
  }, [zs])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      g.rotation.x = Math.sin(t * 0.9 + i * 1.3) * 0.05
      g.rotation.z = Math.sin(t * 0.7 + i) * 0.04
    })
  })
  const z0 = zs[0], z1 = zs[zs.length - 1]
  return (
    <group>
      <mesh position={[0, 0, (z0 + z1) / 2]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.004, 0.004, z1 - z0 + 0.3, 5]} /><meshBasicMaterial color="#2a1a10" />
      </mesh>
      {items.map((it, i) => (
        <group key={i} position={[0, 0, it.z]} ref={(g) => { refs.current[i] = g }}>
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

/** an isshōbin of sake: a tall bottle, its label */
function Bottle({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <group position={[0, 0, x]}>
      <mesh position-y={0.11}>
        <cylinderGeometry args={[0.04, 0.042, 0.22, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.25}>
        <cylinderGeometry args={[0.014, 0.036, 0.08, 10]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.3}>
        <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
        <meshToonMaterial color="#d8c8a0" />
      </mesh>
      <mesh position={[-0.041, 0.11, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.05, 0.1]} />
        <meshToonMaterial color={label} />
      </mesh>
    </group>
  )
}

/** the plaque over the toilet door: お手洗い, and 廁所 under it */
/** a toilet's door's height */
const WC_H = 1.85
/** a stretch of the wall (the wall's own frame: z along it, y up), plaster or the dark wainscot, the plaster's
 * pattern laid from the wall's own z so stretches side by side run on into each other */
function WallPiece({ z0, z1, y0, y1, plaster = false }: { z0: number; z1: number; y0: number; y1: number; plaster?: boolean }) {
  const map = useMemo(() => {
    if (!plaster || !PLASTER) return null
    const t = PLASTER.clone()
    t.repeat.set((z1 - z0) / 1.2, (y1 - y0) / 1.2)
    t.offset.set(-z1 / 1.2, y0 / 1.2)
    t.needsUpdate = true
    return t
  }, [z0, z1, y0, y1, plaster])
  return (
    <mesh position={[0, (y0 + y1) / 2, (z0 + z1) / 2]} rotation-y={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[z1 - z0, y1 - y0]} />
      <meshToonMaterial color={plaster ? '#ffffff' : '#5e4029'} map={map} />
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
      {/* the slatted duckboard (簀の子) before the toilet, and the slippers by the door */}
      <group position={[D - 0.54, 0, 0]}>
        {Array.from({ length: 9 }, (_, k) => (
          <mesh key={k} position={[0, 0.02, (k - 4) * 0.052]}><boxGeometry args={[0.4, 0.02, 0.04]} /><meshToonMaterial color="#d8c08a" /></mesh>
        ))}
        {[-1, 1].map((sd) => <mesh key={sd} position={[0, 0.008, sd * 0.2]}><boxGeometry args={[0.4, 0.016, 0.03]} /><meshToonMaterial color="#6a4a28" /></mesh>)}
      </group>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0.07, 0.018, sd * 0.1]} rotation-y={sd * 0.1}>
          <boxGeometry args={[0.2, 0.03, 0.08]} /><meshToonMaterial color={accent} />
        </mesh>
      ))}
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
      {/* the paper, in a wooden holder on the other wall, and the plaque over it */}
      <group position={[D - 0.3, 0.55, w / 2 - 0.05]}>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.14, 0.12, 0.012]} /><meshToonMaterial color="#8a5a30" /></mesh>
        <mesh geometry={WC_GEO.roll} position={[0, 0, 0]} rotation-x={Math.PI / 2}><meshToonMaterial color="#fafaf6" /></mesh>
        {[-1, 1].map((sd) => <mesh key={sd} position={[sd * 0.06, 0, 0]}><boxGeometry args={[0.012, 0.1, 0.07]} /><meshToonMaterial color="#8a5a30" /></mesh>)}
      </group>
      <mesh position={[D * 0.45, 1.5, w / 2 - 0.006]} rotation-y={Math.PI}><planeGeometry args={[0.3, 0.12]} /><meshToonMaterial color="#ffffff" map={WC_PLAQUE} /></mesh>
      {/* a paper lamp, lit, overhead, in a wooden cage */}
      <mesh geometry={WC_GEO.lamp} position={[D / 2, h + 0.1, 0]}><meshBasicMaterial color="#fff1cc" toneMapped={false} /></mesh>
      <mesh position={[D / 2, h + 0.1, 0]}><torusGeometry args={[0.062, 0.004, 5, 18]} /><meshToonMaterial color="#3a2416" /></mesh>
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
    <group ref={g} onClick={(ev) => { ev.stopPropagation(); TOILETS[who].open = !TOILETS[who].open }}
      {...handOver}>
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

/** a bunch of flowers in a white vase with a blue band: stems up from its mouth, a blossom and a leaf or two on each */
const BLOOMS = ['#f48fb1', '#fbfaf6', '#ffd54f', '#ef5350', '#ce93d8', '#ff9a62', '#fff0a0']
const BOUQUET_GEO = {
  vase: new THREE.CylinderGeometry(0.02, 0.024, 0.07, 14),
  neck: new THREE.CylinderGeometry(0.014, 0.02, 0.02, 14),
  band: new THREE.CylinderGeometry(0.0245, 0.0245, 0.012, 14),
  stem: new THREE.CylinderGeometry(0.0013, 0.0013, 1, 5),
  bloom: new THREE.SphereGeometry(0.014, 10, 8),
  heart: new THREE.SphereGeometry(0.005, 8, 6),
  leaf: new THREE.ConeGeometry(0.01, 0.034, 5),
}
function Bouquet({ lean = 0 }: { lean?: number }) {
  // (seven blooms fanned over the vase's mouth, the tall ones in the middle; the same every time)
  const stems = [[0, 0.17, 0], [-0.03, 0.14, 0.01], [0.03, 0.145, -0.01], [-0.016, 0.115, -0.03], [0.018, 0.12, 0.03],
    [-0.04, 0.1, -0.01], [0.04, 0.105, 0.012]]
  return (
    <group rotation-z={lean}>
      <mesh geometry={BOUQUET_GEO.vase} position-y={0.035}><meshToonMaterial color="#f4f1ea" /></mesh>
      <mesh geometry={BOUQUET_GEO.band} position-y={0.03}><meshToonMaterial color="#3a5a9a" /></mesh>
      <mesh geometry={BOUQUET_GEO.neck} position-y={0.08}><meshToonMaterial color="#f4f1ea" /></mesh>
      {stems.map(([x, y, z], k) => {
        const len = Math.hypot(x, y - 0.09, z)
        return (
          <group key={k}>
            <mesh geometry={BOUQUET_GEO.stem} position={[x / 2, 0.09 + (y - 0.09) / 2, z / 2]} scale={[1, len, 1]}
              rotation={[Math.atan2(z, y - 0.09), 0, -Math.atan2(x, y - 0.09)]}><meshToonMaterial color="#3a7a2a" /></mesh>
            <mesh geometry={BOUQUET_GEO.bloom} position={[x, y, z]} scale={[1, 0.8, 1]}><meshToonMaterial color={BLOOMS[k % BLOOMS.length]} /></mesh>
            <mesh geometry={BOUQUET_GEO.heart} position={[x, y + 0.008, z]}><meshToonMaterial color="#e8a82a" /></mesh>
            <mesh geometry={BOUQUET_GEO.leaf} position={[x * 0.55 + (k % 2 ? -0.012 : 0.012), 0.115, z * 0.55]} rotation-z={k % 2 ? 0.7 : -0.7}>
              <meshToonMaterial color="#3a8a2a" />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/**
 * The household shrine (神棚) up on the wall: a shelf on two brackets, a little shrine of pale hinoki on a stepped base
 * with a railing, its two doors and a roof with the crossed finials (千木) and the short logs (鰹木) along its ridge,
 * a bouquet in a vase either side, the cups of rice, salt and water before it, and the sacred rope (注連縄) with its
 * paper streamers hung across the front.
 */
function Kamidana({ shelf = true }: { shelf?: boolean }) {
  const HIN = '#e2c89a'
  const GRAIN = '#cfae78'
  const RED = '#a8541e'
  return (
    <group>
      {shelf && <Box size={[0.26, 0.03, 0.78]} color="#c9a46a" position={[-0.13, 0, 0]} />}
      {shelf && [-0.3, 0.3].map((z) => <Box key={z} size={[0.16, 0.12, 0.03]} color="#a8844e" position={[-0.07, -0.07, z]} />)}
      {/* the shrine: a stepped base, the railing, body, doors and roof */}
      <group position={[-0.14, 0.015, 0]}>
        <Box size={[0.18, 0.02, 0.36]} color={GRAIN} position-y={0.01} />
        <Box size={[0.16, 0.02, 0.33]} color={HIN} position-y={0.03} />
        {/* (three steps down the front) */}
        {[0, 1, 2].map((k) => <Box key={k} size={[0.02, 0.008, 0.07 - k * 0.006]} color="#d8bc88" position={[-0.09 - k * 0.018, 0.016 - k * 0.004, 0]} />)}
        {/* (the railing round the platform, a post at each corner) */}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[0.012, 0.05, 0.012]} color={RED} position={[sx * 0.073, 0.065, sz * 0.153]} />
        )))}
        <Box size={[0.008, 0.01, 0.31]} color={RED} position={[-0.073, 0.082, 0]} />
        {[-1, 1].map((sz) => <Box key={sz} size={[0.15, 0.01, 0.008]} color={RED} position={[0, 0.082, sz * 0.153]} />)}
        <Box size={[0.12, 0.16, 0.24]} color={HIN} position-y={0.12} />
        {/* (the doors: two leaves with a dark seam between, a gold fitting on each, a lintel over them) */}
        {[-1, 1].map((sd) => (
          <group key={sd}>
            <mesh position={[-0.0612, 0.12, sd * 0.0275]} rotation-y={-Math.PI / 2}>
              <planeGeometry args={[0.05, 0.125]} /><meshToonMaterial color="#c8a868" />
            </mesh>
            <mesh position={[-0.0616, 0.12, sd * 0.0275]} rotation-y={-Math.PI / 2}>
              <planeGeometry args={[0.036, 0.11]} /><meshToonMaterial color="#d6b878" />
            </mesh>
            <mesh position={[-0.0625, 0.12, sd * 0.008]} rotation-y={-Math.PI / 2}>
              <circleGeometry args={[0.005, 10]} /><meshBasicMaterial color="#d4b04a" />
            </mesh>
          </group>
        ))}
        <mesh position={[-0.0618, 0.12, 0]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.004, 0.125]} /><meshBasicMaterial color={INK} />
        </mesh>
        <Box size={[0.014, 0.012, 0.15]} color="#6a5038" position={[-0.064, 0.19, 0]} />
        {/* (the roof: two planks of cypress bark sloping down from the ridge, a modest eave all round, each edged with a thin darker
            board; the ridge capped in gold, the crossed finials (千木) rising at both ends and the short logs (鰹木) laid across it) */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.066, 0.225, 0]} rotation-z={-sd * 0.5}>
            <mesh><boxGeometry args={[0.15, 0.012, 0.3]} /><meshToonMaterial color="#8a6a44" /></mesh>
            <mesh position={[sd * -0.001, -0.0085, 0]}><boxGeometry args={[0.152, 0.005, 0.304]} /><meshToonMaterial color="#4a3622" /></mesh>
            {[-1, 1].map((e) => <mesh key={e} position={[0, 0.0045, e * 0.1485]}><boxGeometry args={[0.15, 0.006, 0.006]} /><meshToonMaterial color="#4a3622" /></mesh>)}
          </group>
        ))}
        <Box size={[0.026, 0.014, 0.31]} color="#d4b04a" position-y={0.272} />
        {[-1, 1].flatMap((sz) => [-1, 1].map((lean) => (
          <Box key={`${sz}${lean}`} size={[0.008, 0.012, 0.085]} color="#d8b878" position={[0, 0.3, sz * 0.158]} rotation-x={lean * 0.62} />
        )))}
        {[-0.065, 0, 0.065].map((z) => (
          <mesh key={z} position={[0, 0.285, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.008, 0.008, 0.075, 10]} /><meshToonMaterial color="#d4b04a" />
          </mesh>
        ))}
      </group>
      {/* the bouquets in their vases, leaning in a little, and the cups */}
      {[-1, 1].map((sd) => (
        <group key={sd} position={[-0.15, 0.015, sd * 0.3]}><Bouquet lean={sd * -0.08} /></group>
      ))}
      {[-0.13, 0, 0.13].map((z) => (
        <mesh key={z} position={[-0.235, 0.03, z * 0.6]}>
          <cylinderGeometry args={[0.012, 0.01, 0.025, 10]} />
          <meshToonMaterial color="#f4f1ea" />
        </mesh>
      ))}
      {/* the rope across the front, sagging, and its zigzag paper shide */}
      {Array.from({ length: 9 }, (_, i) => {
        const z = -0.36 + i * 0.09
        return (
          <mesh key={i} position={[-0.27, 0.04 - 0.03 * (1 - (z / 0.36) ** 2), z]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.014, 0.014, 0.095, 8]} />
            <meshToonMaterial color="#d8c08a" />
          </mesh>
        )
      })}
      {[-0.2, 0, 0.2].map((z) => (
        <mesh key={z} position={[-0.275, -0.02, z]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[0.035, 0.11]} />
          <meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

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
function Pendant({ z, drop, pool }: { z: number; drop: number; pool: number }) {
  return (
    <group position={[0, WALL_H, z]}>
      <mesh position-y={-drop / 2}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <group position-y={-drop - 0.09}>
        <mesh>
          <sphereGeometry args={[0.11, 16, 10]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
        <mesh scale={1.06}>
          <sphereGeometry args={[0.11, 16, 10]} />
          <meshBasicMaterial color={INK} side={THREE.BackSide} />
        </mesh>
        {[0.1, -0.1].map((y) => (
          <mesh key={y} position-y={y}>
            <cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
            <meshToonMaterial color={INK} />
          </mesh>
        ))}
        <sprite scale={0.75}>
          <spriteMaterial map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.55} />
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
export function DiningWall({ c, from, to, far, lamps, top, door, shrine, altar = false, clear = [] }: { c: Counter; from: number; to: number; far: number
  /** stretches of it (along it) where something stands against it: nothing hung there, no post */
  clear?: [number, number][]
  /** its shelf an altar instead (by the door): a command flag in the censer, and incense (lit when, and lighting more) */
  altar?: boolean | { litAt: number | null; onLight: () => void }
  lamps: number
  /** the bar top's height, where the lamps' light falls */
  top: number
  /** where along it the sliding door to the toilet is, if it has one */
  door?: number
  /** where along it the little household shrine (神棚) is put up, if it has one */
  shrine?: number }) {
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
  const shelfZ = door !== undefined && Math.abs(door - (mid + l * 0.3)) < 1.3 ? mid - l * 0.3 : mid + l * 0.3
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
    return spots.filter((z) => (!shelf || Math.abs(z - shelfZ) > 0.85) && isClear(z, 0.3) && (door === undefined || Math.abs(z - door) > 0.95)
      && (shrine === undefined || Math.abs(z - shrine) > 0.75) && (door === undefined || Math.abs(z - door) > WC_W * 2 + 0.3))
      .map((z, k) => ({ z, scroll: k % 2 ? SCROLLS[(start + k) % SCROLLS.length] : undefined, print: PRINTS[(start + k) % PRINTS.length],
        // (a banner every third place along the wall, in turn)
        nobori: k % 3 === 2 ? Math.floor(k / 3 + start) % NOBORI_LOOKS.length : undefined,
        // (and a big signboard every fifth, between)
        kanban: k % 5 === 3 && k % 3 !== 2 ? Math.floor(k / 5 + start) % KANBAN_LOOKS.length : undefined }))
  }, [l, from, to, mid, shelfZ, c.length, door, shrine, shelf, clear])
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
        <StaticBatch key={`${from}|${to}|${door}|${shrine}|${!!altar}`}>
        {/* the plaster over the wainscot, open where the toilets' doors are (a strip between them, and over them) */}
        {spans.map(([z0, z1, y0]) => (
          <group key={`${z0}|${y0}`}>
            <WallPiece z0={z0} z1={z1} y0={Math.max(WAINSCOT, y0)} y1={WALL_H} plaster />
            {y0 < WAINSCOT && <WallPiece z0={z0} z1={z1} y0={0} y1={WAINSCOT} />}
          </group>
        ))}
        {/* posts, the rail over the wainscot and the beam along the top */}
        {/* (the rail broken where the toilets' doorways are) */}
        {spans.filter(([, , y0]) => y0 < WAINSCOT).map(([z0, z1]) => <Box key={z0} size={[0.05, 0.05, z1 - z0]} color="#3a2416" position={[-0.02, WAINSCOT, (z0 + z1) / 2]} />)}
        <Box size={[0.08, 0.1, l]} color="#3a2416" position={[-0.03, WALL_H - 0.05, mid]} />
        {[from, mid - l / 6, mid + l / 6, to].filter((z) => z === from || z === to || (door === undefined || Math.abs(z - door) > WC_W * 2 + 0.2) && isClear(z, 0.05)).map((z) => (
          <Box key={z} size={[0.07, WALL_H, 0.08]} color="#3a2416" position={[-0.03, WALL_H / 2, z]} />
        ))}
        {/* a frieze of seigaiha waves under the beam, and the pictures hung along the plaster */}
        <mesh position={[-0.004, WALL_H - 0.2, mid]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[l, 0.2]} />
          <meshToonMaterial color="#ffffff" map={frieze} />
        </mesh>
        <Box size={[0.03, 0.025, l]} color="#3a2416" position={[-0.01, WALL_H - 0.31, mid]} />
        {art.map((a) => (
          <group key={a.z} position={[0, a.scroll ? 1.42 : 1.5, a.z]}>
            {a.nobori !== undefined ? null : a.kanban !== undefined ? <Kanban i={a.kanban} /> : a.scroll ? <Scroll art={a.scroll} /> : <Framed art={a.print} />}
          </group>
        ))}
        {/* the toilets, the men's and the women's, side by side */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletDoor who={who} /></group>
        ))}
        {shrine !== undefined && <group position={[0, 1.78, shrine]}><Kamidana /></group>}
        {/* the shelf: sake bottles, two crocks and the cat; or, by the door, the altar */}
        {altar ? <group position={[-ALTAR_D / 2, ALTAR_Y, shelfZ]}><Box size={[ALTAR_D, 0.03, 0.9]} color="#6a4428" position-y={-0.015} />
          {/* held off the wall on two carved brackets (持ち送り): a curved knee from the wall up under the shelf */}
          {[-0.35, 0.35].map((z) => (
            <mesh key={z} geometry={SHELF_BRACKET} position={[ALTAR_D / 2, -0.03, z - 0.015]}><meshToonMaterial color="#3a2416" /></mesh>
          ))}</group>
          : shelf && <>
        <group position={[-0.1, 1.08, shelfZ]}>
          <Box size={[0.2, 0.03, 0.9]} color="#6a4428" position-y={-0.015} />
          {[-0.35, 0.35].map((z) => <Box key={z} size={[0.18, 0.08, 0.025]} color="#3a2416" position={[0.04, -0.06, z]} />)}
          <Bottle x={-0.32} color="#2f5a3a" label="#f2ead8" />
          <Bottle x={-0.22} color="#5a3a22" label="#f2ead8" />
          <Bottle x={-0.12} color="#2f5a3a" label="#e8d06a" />
          <mesh position={[0, 0.06, 0.04]}>
            <cylinderGeometry args={[0.05, 0.06, 0.12, 12]} />
            <meshToonMaterial color="#8a5a34" />
          </mesh>
          <mesh position={[0, 0.06, 0.15]}>
            <cylinderGeometry args={[0.04, 0.05, 0.1, 12]} />
            <meshToonMaterial color="#3e4a5a" />
          </mesh>
          <group position={[0, 0, 0.3]} rotation-y={-Math.PI / 2}><LuckyCat kind={3} height={0.3} still /></group>
        </group>
          </>}
        </StaticBatch>
        {/* (the strings of banners overhead, clear of the altar, the fridges and the toilets' doors) */}
        {(() => {
          const zs: number[] = []
          for (let z = from + 0.25; z < to - 0.25; z += 0.21) {
            if (altar && Math.abs(z - shelfZ) < 0.62) continue
            if (!isClear(z, 0.1)) continue
            if (door !== undefined && Math.abs(z - door) < WC_W + 0.3) continue
            zs.push(z)
          }
          return zs.length > 1 ? <group position={[-0.42, 2.18, 0]}><BannerRow zs={zs} /></group> : null
        })()}
        {/* (the banners sway: not merged) */}
        {art.filter((a) => a.nobori !== undefined).map((a) => <group key={`n${a.z}`} position={[0, 1.08, a.z]}><Nobori i={a.nobori!} /></group>)}
        {/* (the toilets' doors slide: not merged) */}
        {door !== undefined && (['m', 'f'] as const).map((who, k) => (
          <group key={who} name={`look-wc-${who}`} position-z={door + (k ? 1 : -1) * (WC_W / 2 + 0.06)}><ToiletPanel who={who} /></group>
        ))}
        {/* (the altar's flag stirs, its incense smokes: not merged) */}
        {altar && <group name="look-altar" position={[-ALTAR_D / 2, ALTAR_Y, shelfZ]}><Altar incense={altar === true ? undefined : altar} /></group>}
      </group>
      {/* pendant lamps over the bar's customer side, low */}
      {Array.from({ length: lamps }, (_, i) => {
        const z = (i - (lamps - 1) / 2) * (c.length / lamps)
        return <group key={i} position-x={0.05}><Pendant z={z} drop={0.5} pool={top} /></group>
      })}
    </group>
  )
}

const ALTAR_GEO = {
  // a round-bellied sake flask with a long slim neck and a flared lip (徳利), in white glaze
  tokkuri: new THREE.LatheGeometry([[0, 0], [0.022, 0], [0.034, 0.008], [0.04, 0.026], [0.038, 0.05], [0.028, 0.072], [0.016, 0.088], [0.0115, 0.104],
    [0.0108, 0.128], [0.0135, 0.14], [0.015, 0.146], [0.0128, 0.15], [0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 20),
  cord: new THREE.TorusGeometry(0.0128, 0.0022, 6, 18),
  knot: new THREE.SphereGeometry(0.0045, 6, 5),
  shide: new THREE.PlaneGeometry(0.02, 0.05),
  cup: new THREE.CylinderGeometry(0.03, 0.017, 0.016, 16),
  sake: new THREE.CircleGeometry(0.026, 16),
  fruit: new THREE.SphereGeometry(0.03, 12, 8),
  leaf: new THREE.ConeGeometry(0.01, 0.026, 6),
  dish: new THREE.CylinderGeometry(0.08, 0.06, 0.015, 18),
}
/** the paper label stuck on each tokkuri: 御神酒 down it in black on white, a red seal */
const SAKE_LABEL = canvasTex(48, 96, (g) => {
  g.fillStyle = '#fbf8ef'
  g.fillRect(0, 0, 48, 96)
  g.strokeStyle = '#b8261c'
  g.lineWidth = 2
  g.strokeRect(3, 3, 42, 90)
  ;[...'御神酒'].forEach((ch, k) => brushText(g, ch, 24, 20 + k * 25, 22, { fill: '#1a0d06' }))
})
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
/** the altar shelf's depth, out from the wall: the god at the back, raised, the censer before him */
const ALTAR_D = 0.58
/** and its height: up over the beckoning cats' stand below it, by the door */
const ALTAR_Y = 1.42
/** how long the sake offered stands there, and the extra custom it brings (ms) */
const INCENSE_MS = 180000
function Altar({ incense }: { incense?: { litAt: number | null; onLight: () => void } }) {
  const doorGlow = useRef<THREE.MeshBasicMaterial>(null)
  const aura = useRef<THREE.SpriteMaterial>(null)
  const sake = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // (offered, the sake stands in its cup for a minute and the shrine glows, then goes quiet; then another can be offered)
    const at = incense?.litAt ?? null
    const left = at === null ? 0 : Math.max(0, 1 - (performance.now() - at) / INCENSE_MS)
    const on = left > 0
    const k = on ? Math.min(1, left * 8) : 0
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.4)
    if (sake.current) sake.current.visible = on
    if (doorGlow.current) doorGlow.current.opacity = k * 0.8 * pulse
    if (aura.current) aura.current.opacity = k * 0.5 * pulse
  })
  const offer = (e: { stopPropagation: () => void }) => { e.stopPropagation(); incense?.onLight() }
  // (the shrine's front, in the altar's frame: its doors' plane, and the roof's)
  const SC = 1.25
  const doorX = ALTAR_D / 2 - (0.14 + 0.0645) * SC
  const doorY = (0.015 + 0.12) * SC
  const flask = (z: number, key: string) => (
    <group key={key} position={[-0.2, 0, z]} onClick={offer} {...(incense ? handOver : {})}>
      <mesh geometry={ALTAR_GEO.tokkuri} castShadow><meshToonMaterial color="#f6f4ee" /></mesh>
      <mesh geometry={ALTAR_GEO.tokkuri} scale={1.03}><meshBasicMaterial color="#2a1a10" side={THREE.BackSide} /></mesh>
      {/* (a red cord round the neck with its knot, a paper shide hanging from it, a small label on the belly) */}
      <mesh geometry={ALTAR_GEO.cord} position-y={0.112} rotation-x={Math.PI / 2}><meshToonMaterial color="#c4302a" /></mesh>
      <mesh geometry={ALTAR_GEO.knot} position={[-0.0128, 0.112, 0]}><meshToonMaterial color="#c4302a" /></mesh>
      <mesh geometry={ALTAR_GEO.shide} position={[-0.0165, 0.088, 0]} rotation-y={-Math.PI / 2}><meshToonMaterial color="#fbfaf6" side={THREE.DoubleSide} /></mesh>
      <mesh position={[-0.0405, 0.04, 0]} rotation-y={-Math.PI / 2}><planeGeometry args={[0.03, 0.06]} /><meshToonMaterial color="#ffffff" map={SAKE_LABEL} /></mesh>
      <mesh position={[0, 0.07, 0]} visible={false}><boxGeometry args={[0.1, 0.16, 0.1]} /></mesh>
    </group>
  )
  return (
    <group>
      {/* the household shrine (神棚) on the shelf, up against the wall, a size larger than it hung up on a wall */}
      <group position-x={ALTAR_D / 2} scale={SC}><StaticBatch><Kamidana shelf={false} /></StaticBatch></group>
      {/* the shrine's own glow while the offering stands: its doors lit, and a warm light behind it all round */}
      <mesh position={[doorX, doorY, 0]} rotation-y={-Math.PI / 2} renderOrder={3}>
        <planeGeometry args={[0.112 * SC, 0.128 * SC]} />
        <meshBasicMaterial ref={doorGlow} color="#ffd48a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
      </mesh>
      <sprite position={[ALTAR_D / 2 - 0.02, 0.2, 0]} scale={[0.95, 0.75, 1]}>
        <spriteMaterial ref={aura} map={GLOW} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0} />
      </sprite>
      {/* the offering of sake (御神酒): a pair of white flasks either side of the oranges, and a flat cup before them that the
          sake's poured into: click any of them (or the shrine) to make the offering */}
      {flask(-0.22, 'fl')}
      {flask(0.22, 'fr')}
      <group position={[-0.24, 0, -0.1]} onClick={offer} {...(incense ? handOver : {})}>
        <mesh geometry={ALTAR_GEO.cup} position-y={0.008}><meshToonMaterial color="#f6f4ee" /></mesh>
        <mesh geometry={ALTAR_GEO.cup} position-y={0.008} scale={1.06}><meshBasicMaterial color="#2a1a10" side={THREE.BackSide} /></mesh>
        <mesh ref={sake} geometry={ALTAR_GEO.sake} position-y={0.0175} rotation-x={-Math.PI / 2} visible={false}>
          <meshBasicMaterial color="#f2dc8a" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.02, 0]} visible={false}><boxGeometry args={[0.1, 0.08, 0.1]} /></mesh>
      </group>
      {/* the oranges on their dish, a leaf on the top one */}
      <group position={[-0.17, 0, 0]}>
        <mesh geometry={ALTAR_GEO.dish} position-y={0.008}><meshToonMaterial color="#e8e2d2" /></mesh>
        {[[0, 0.035, -0.02], [-0.02, 0.035, 0.025], [0.025, 0.035, 0.02], [0, 0.085, 0.008]].map((pt, k) => (
          <mesh key={k} geometry={ALTAR_GEO.fruit} position={pt as [number, number, number]}><meshToonMaterial color="#f08a1a" /></mesh>
        ))}
        <mesh geometry={ALTAR_GEO.leaf} position={[0, 0.118, 0.008]} rotation-z={0.3}><meshToonMaterial color="#3a7a2a" /></mesh>
      </group>
    </group>
  )
}

/**
 * The drinks fridge customers help themselves from: a dark cabinet with a glass door, lit inside, four shelves of
 * bottles (beer, sake, oolong tea, ramune), a lit sign over it, the door's long handle. Faces +z (out of the wall).
 */
export function DrinkFridge({ n = 0 }: { n?: number }) {
  const { W, H, D } = FRIDGE
  const rows = [0.2, 0.47, 0.74, 1.01, 1.28]
  return (
    <StaticBatch>
      {/* the cabinet: its back part solid, open at the front between its sides, top and foot, lit inside */}
      <Inked geometry={FRIDGE_GEO.body} color="#2a2c30" position={[0, H / 2, -D / 2 + 0.06]} scale={[W, H, 0.12]} grow={1.01} />
      {[-1, 1].map((sd) => <Box key={sd} size={[0.045, H, D]} color="#2a2c30" position={[sd * (W / 2 - 0.022), H / 2, 0]} />)}
      <Box size={[W, 0.16, D]} color="#2a2c30" position={[0, 0.08, 0]} />
      <Box size={[W, 0.12, D]} color="#2a2c30" position={[0, H - 0.06, 0]} />
      <mesh position={[0, H / 2 + 0.02, -D / 2 + 0.121]}><planeGeometry args={[W - 0.09, H - 0.28]} /><meshBasicMaterial color="#e4edf2" /></mesh>
      {/* (the light strip down each side inside) */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (W / 2 - 0.046), H / 2 + 0.02, 0]} rotation-y={-sd * Math.PI / 2}><planeGeometry args={[D - 0.05, H - 0.3]} /><meshBasicMaterial color="#f4f8fb" /></mesh>
      ))}
      {rows.map((y) => (
        <group key={y} position-y={y}>
          <mesh position={[0, -0.01, 0]}><boxGeometry args={[W - 0.09, 0.012, D - 0.12]} /><meshToonMaterial color="#9aa2a8" /></mesh>
          {/* (the drinks themselves are FridgeStock's: they come and go, and can be moved) */}
        </group>
      ))}
      {/* the lit sign on top, and the vents at its foot */}
      <mesh position={[0, H + 0.1, D / 2 - 0.01]}><planeGeometry args={[W, 0.18]} /><meshBasicMaterial color="#ffffff" map={FRIDGE_SIGNS[n]} toneMapped={false} /></mesh>
      <Box size={[W, 0.19, 0.06]} color="#1c1d20" position={[0, H + 0.1, D / 2 - 0.045]} />
      {[0, 1, 2, 3].map((k) => <Box key={k} size={[W - 0.2, 0.012, 0.004]} color="#16171a" position={[0, 0.04 + k * 0.025, D / 2 + 0.002]} />)}
    </StaticBatch>
  )
}
/**
 * The fridge's door: a glass door in a dark frame, hinged on the fridge's left with a long handle on its right, swinging
 * open (out into the room) when someone's at the fridge or when it's clicked, and shutting after; while it's open the cold
 * pours out of it in a low white mist.
 */
export function FridgeDoor({ n = 0 }: { n?: number }) {
  const { W, H, D } = FRIDGE
  const hinge = useRef<THREE.Group>(null)
  const open = useRef(0)
  const mist = useRef(0)
  // (the door's state lives outside React: leave it shut when the shop's let go, so it doesn't come back open)
  useEffect(() => () => { FRIDGE_STATE[n].open = false; FRIDGE_STATE[n].passing = 0 }, [n])
  useFrame((_, dt) => {
    const want = FRIDGE_STATE[n].passing > 0 || FRIDGE_STATE[n].open ? 1 : 0
    open.current += Math.sign(want - open.current) * Math.min(Math.abs(want - open.current), Math.min(dt, 0.1) * 2.2)
    const e = open.current * open.current * (3 - 2 * open.current)
    if (hinge.current) hinge.current.rotation.y = -e * (Math.PI / 2)
    mist.current = e
  })
  return (
    <group>
      <group ref={hinge} position={[-W / 2, 0, D / 2]} onClick={(ev) => { ev.stopPropagation(); FRIDGE_STATE[n].open = !FRIDGE_STATE[n].open }} {...handOver}>
        <mesh position={[W / 2, H / 2 + 0.02, 0.004]}><planeGeometry args={[W - 0.06, H - 0.26]} />
          <meshBasicMaterial color="#cfe4f0" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} /></mesh>
        {[-1, 1].map((sd) => <Box key={sd} size={[0.035, H - 0.24, 0.025]} color="#3a3c42" position={[W / 2 + sd * (W / 2 - 0.03), H / 2 + 0.02, 0.01]} />)}
        {[0.16, H - 0.12].map((y) => <Box key={y} size={[W - 0.03, 0.035, 0.025]} color="#3a3c42" position={[W / 2, y, 0.01]} />)}
        <Box size={[0.025, 0.6, 0.035]} color="#b8bcc0" position={[W - 0.08, H / 2 + 0.05, 0.04]} />
        {[-1, 1].map((sd) => <Box key={sd} size={[0.01, H - 0.3, 0.01]} color="#9aa0a6" position={[W / 2 + sd * (W / 2 - 0.05), H / 2 + 0.02, 0.0]} />)}
      </group>
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
  const slotAt = (r: number, k: number) => new THREE.Vector3((k - (shelves[r].ids.length - 1) / 2) * shelves[r].pitch, shelves[r].y, 0.09)
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
          g.position.set(o.x, 0, o.z)
          g.quaternion.identity()
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
    // (a drink in the fridge only with its door open: the glass is in the way otherwise)
    if (from.kind === 'slot' && !doorOpen()) return
    ev.stopPropagation()
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
        if (from.kind === 'slot') pullOut(n, [from.r, from.k], x, z)
        else {
          FRIDGE_STOCK.out[from.i].x = x
          FRIDGE_STOCK.ver++
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
          onPointerOver={(ev) => { if (doorOpen()) { document.body.style.cursor = 'grab'; glowOnly(ev.eventObject) } }}
          onPointerOut={() => { document.body.style.cursor = ''; glowOnly(null) }}>
          <DrinkBottle id={id} />
        </group>
      )))}
      {/* (and a rank behind each, stood a little further back: a shelf of drinks is never one deep) */}
      {FRIDGE_STOCK.units[n].map((row, r) => row.map((id, k) => id && (
        <group key={`b${r}-${k}`} position={[slotAt(r, k).x + (k % 2 ? 0.012 : -0.012), slotAt(r, k).y, slotAt(r, k).z - 0.1]}>
          <DrinkBottle id={id} />
        </group>
      )))}
      {/* (what's been taken out, stood on the floor before the fridge) */}
      {FRIDGE_STOCK.out.map((o, i) => o.unit === n && (
        <group key={`o${i}-${o.id}`} ref={reg(`o${i}`)} position={[o.x, 0, o.z]} onPointerDown={(ev) => begin({ kind: 'out', i }, ev)}
          onPointerOver={(ev) => { document.body.style.cursor = 'grab'; glowOnly(ev.eventObject) }} onPointerOut={() => { document.body.style.cursor = ''; glowOnly(null) }}>
          <DrinkBottle id={o.id} />
        </group>
      ))}
    </group>
  )
}
/** a bottle of one of the drinks, standing (its foot at the origin): its glass or can, its label printed round it,
 * its neck and cap */
/** how much bigger each drink stands than it's modelled, to be the size it is in a shop (a 350 ml can is 12 cm tall) */
const DRINK_SCALE: Record<DrinkId, number> = { beer: 1.08, sake: 1.12, oolong: 1.12, ramune: 1.3, beerCan: 1.38, highball: 1.38, coffee: 1.38, greenTea: 1.32,
  cola: 1.32, yakult: 1.12, sports: 1.32, milk: 1.3, chuhai: 1.38 }
export function DrinkBottle({ id }: { id: DrinkId }) {
  return <group scale={DRINK_SCALE[id]}><DrinkBottleRaw id={id} /></group>
}
function DrinkBottleRaw({ id }: { id: DrinkId }) {
  const d = DRINKS.find((x) => x.id === id)!
  const look = BOTTLE_LOOK[id]
  // (turned so its label's name faces +z)
  if (d.shape === 'can' && id !== 'cola' && id !== 'greenTea') return (
    // a can: printed all over, its silver top and rim
    <group rotation-y={-Math.PI / 2}>
      <mesh geometry={BOTTLE_GEO.can} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canLabel} position-y={0.046} material={look.label} />
      <mesh geometry={BOTTLE_GEO.canTop} position-y={0.0905} material={look.glass} />
      <mesh geometry={BOTTLE_GEO.canRim} position-y={0.09} rotation-x={Math.PI / 2}><meshToonMaterial color="#aeb3b9" /></mesh>
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
const bottleBody = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18)
const BOTTLE_SHAPE = {
  // a brown long-necked beer bottle, a gold foil at its neck
  beer: { body: bottleBody([[0, 0], [0.024, 0], [0.0275, 0.005], [0.0275, 0.12], [0.0235, 0.145], [0.0145, 0.17], [0.0125, 0.2],
    [0.0135, 0.206], [0.0135, 0.21], [0, 0.21]]), label: new THREE.CylinderGeometry(0.0282, 0.0282, 0.07, 18, 1, true), labelY: 0.065,
    cap: new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 14), capY: 0.213, foil: new THREE.CylinderGeometry(0.0138, 0.0155, 0.04, 14), foilY: 0.18 },
  // the glass milk bottle: a wide mouth, a paper cap pressed down over it, a paper label round its middle
  milk: { body: bottleBody([[0, 0], [0.02, 0], [0.0225, 0.005], [0.0225, 0.085], [0.02, 0.098], [0.0175, 0.106], [0.0175, 0.118], [0, 0.118]]),
    label: new THREE.CylinderGeometry(0.0228, 0.0228, 0.06, 18, 1, true), labelY: 0.05,
    cap: new THREE.CylinderGeometry(0.0195, 0.0195, 0.006, 16), capY: 0.121, foil: new THREE.CylinderGeometry(0.0182, 0.0188, 0.014, 16) as THREE.BufferGeometry | null, foilY: 0.112 },
  // the 500 ml plastic bottle: a ribbed foot, a label round its middle, a coloured cap
  pet500: { body: bottleBody([[0, 0], [0.019, 0], [0.0235, 0.006], [0.0235, 0.1], [0.021, 0.125], [0.0135, 0.145], [0.0105, 0.152],
    [0.0105, 0.158], [0, 0.158]]), label: new THREE.CylinderGeometry(0.0238, 0.0238, 0.075, 18, 1, true), labelY: 0.07,
    cap: new THREE.CylinderGeometry(0.0118, 0.0118, 0.012, 14), capY: 0.164, foil: null as THREE.BufferGeometry | null, foilY: 0 },
  // a clear slim sake bottle with a round shoulder, a paper collar under the red cap
  sake: { body: bottleBody([[0, 0], [0.022, 0], [0.0245, 0.004], [0.0245, 0.12], [0.0225, 0.15], [0.014, 0.178], [0.0105, 0.2],
    [0.0115, 0.206], [0, 0.206]]), label: new THREE.CylinderGeometry(0.0249, 0.0249, 0.085, 18, 1, true), labelY: 0.07,
    cap: new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 14), capY: 0.21, foil: new THREE.CylinderGeometry(0.0112, 0.0125, 0.012, 14), foilY: 0.196 },
  // the big plastic tea bottle: wide, a ribbed foot, a green label round its middle
  pet: { body: bottleBody([[0, 0], [0.026, 0], [0.032, 0.008], [0.032, 0.012], [0.0305, 0.02], [0.032, 0.028], [0.032, 0.17],
    [0.028, 0.2], [0.017, 0.225], [0.0135, 0.236], [0.0135, 0.246], [0, 0.246]]), label: new THREE.CylinderGeometry(0.0326, 0.0326, 0.1, 18, 1, true),
    labelY: 0.1, cap: new THREE.CylinderGeometry(0.0145, 0.0145, 0.014, 14), capY: 0.252, foil: null as THREE.BufferGeometry | null, foilY: 0 },
}
const BOTTLE_GEO = {
  body: new THREE.CylinderGeometry(0.026, 0.028, 0.13, 14),
  label: new THREE.CylinderGeometry(0.0285, 0.0295, 0.06, 14, 1, true),
  neck: new THREE.CylinderGeometry(0.012, 0.026, 0.04, 12),
  cap: new THREE.CylinderGeometry(0.013, 0.013, 0.01, 12),
  can: bottleBody([[0, 0], [0.0168, 0], [0.0198, 0.004], [0.0212, 0.011], [0.0212, 0.078], [0.0202, 0.084], [0.0184, 0.0885], [0.0178, 0.09], [0, 0.09]]),
  canLabel: new THREE.CylinderGeometry(0.0215, 0.0215, 0.07, 18, 1, true),
  canTop: new THREE.CylinderGeometry(0.0172, 0.0178, 0.004, 18),
  canTab: new THREE.CylinderGeometry(0.0062, 0.0062, 0.0014, 12),
  canRim: new THREE.TorusGeometry(0.0178, 0.0013, 5, 18),
  small: new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.02], [0.013, 0.036], [0.016, 0.056], [0.015, 0.072], [0, 0.072]]
    .map(([x, y]) => new THREE.Vector2(x, y - 0.036)), 16),
  smallTop: new THREE.CylinderGeometry(0.0155, 0.0155, 0.004, 14),
}
/** each drink's label: its colours and its name round it, the shop's own small print */
const BOTTLE_LOOK = Object.fromEntries(DRINKS.map((d) => {
  const lbl = d.label
  const tall = d.shape !== 'bottle' || d.id === 'oolong' || d.id === 'sake' || d.id === 'sports'
  const tex = canvasTex(128, tall ? 96 : 48, (g) => {
    const h = tall ? 96 : 48
    g.fillStyle = lbl[0]
    g.fillRect(0, 0, 128, h)
    g.fillStyle = lbl[1]
    g.fillRect(0, 4, 128, 3)
    g.fillRect(0, h - 7, 128, 3)
    if (d.shape === 'can') {
      // (a can's design: a band of colour across it, a few bubbles, its name upright down it)
      g.globalAlpha = 0.25
      g.fillRect(0, h * 0.62, 128, h * 0.12)
      g.globalAlpha = 1
    }
    // (a small picture on each face: the coffee's bean, the beer's wheat ear, the highball's bubbles, the chuhai's fruit, the milk's cow spot)
    for (const cx of [32, 96]) {
      g.save()
      g.translate(cx, d.shape === 'can' ? h * 0.3 : h * 0.28)
      if (d.id === 'coffee') {
        g.fillStyle = '#f2e2c0'
        g.beginPath()
        g.ellipse(0, 0, 8, 5.5, -0.5, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#4a2a18'
        g.lineWidth = 1.6
        g.beginPath()
        g.moveTo(-6, 3)
        g.quadraticCurveTo(0, -1, 6, -3)
        g.stroke()
      } else if (d.id === 'beerCan' || d.id === 'beer') {
        g.strokeStyle = '#7a1a12'
        g.fillStyle = '#7a1a12'
        g.lineWidth = 1.4
        g.beginPath()
        g.moveTo(0, 8)
        g.lineTo(0, -8)
        g.stroke()
        for (let k = -2; k <= 1; k++) for (const sd of [-1, 1]) {
          g.beginPath()
          g.ellipse(sd * 3.4, k * 4, 2.6, 1.3, sd * -0.7, 0, Math.PI * 2)
          g.fill()
        }
      } else if (d.id === 'highball') {
        g.fillStyle = '#e8c45a'
        for (const [bx, by, br] of [[-5, 4, 2.2], [3, 6, 1.6], [-1, -2, 1.8], [5, -4, 2.4], [-6, -6, 1.5]]) {
          g.beginPath()
          g.arc(bx, by, br, 0, Math.PI * 2)
          g.fill()
        }
      } else if (d.id === 'chuhai') {
        g.fillStyle = '#ffd84a'
        g.beginPath()
        g.arc(0, 0, 8, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = '#fff6c8'
        g.lineWidth = 1.2
        for (let k = 0; k < 6; k++) {
          g.beginPath()
          g.moveTo(0, 0)
          g.lineTo(Math.cos(k * 1.047) * 7, Math.sin(k * 1.047) * 7)
          g.stroke()
        }
      } else if (d.id === 'milk') {
        g.fillStyle = '#3a6ab0'
        g.beginPath()
        g.ellipse(-4, -1, 3.5, 2.6, 0.3, 0, Math.PI * 2)
        g.ellipse(4, 2, 3, 2.2, -0.2, 0, Math.PI * 2)
        g.fill()
      } else if (d.id === 'sports') {
        g.strokeStyle = '#1f6fb8'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(-8, 3)
        g.quadraticCurveTo(-3, -6, 2, 0)
        g.quadraticCurveTo(6, 4, 9, -3)
        g.stroke()
      }
      g.restore()
    }
    g.font = `bold ${d.shape === 'small' ? 16 : lbl[2].length > 4 ? 15 : 20}px "Zen Antique", "Noto Serif TC", serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // (twice round, so it reads from either side)
    g.fillText(lbl[2], 32, h / 2)
    g.fillText(lbl[2], 96, h / 2)
  })
  return [d.id, {
    glass: new THREE.MeshToonMaterial({ color: d.color, transparent: d.glass, opacity: d.glass ? 0.82 : 1 }),
    label: new THREE.MeshToonMaterial({ color: '#ffffff', map: tex }),
  }]
})) as unknown as Record<DrinkId, { glass: THREE.Material; label: THREE.Material }>
const FRIDGE_GEO = { body: new THREE.BoxGeometry(1, 1, 1) }
/** each fridge's sign: 飲料 · ドリンク, white on red; 酒類 · お酒, on indigo */
const FRIDGE_SIGNS = FRIDGE_UNITS.map((u, n) => canvasTex(192, 48, (g) => {
  g.fillStyle = n ? '#1c2a4a' : '#b8261c'
  g.fillRect(0, 0, 192, 48)
  g.strokeStyle = n ? 'rgba(232,196,90,0.8)' : 'rgba(255,230,160,0.7)'
  g.lineWidth = 1.4
  g.strokeRect(4, 4, 184, 40)
  brushText(g, `${u.sign[0]} · ${u.sign[1]}`, 96, 25, 26, { fill: '#fff6e0', edge: n ? '#0a1020' : '#7a0e0a', shadow: 'rgba(0,0,0,0.5)', shine: '#ffffff', spacing: 1 })
}))

/** straw wrapping round a sake barrel (菰), the brewer's mark in red and black on its front (the middle, -z) */
const KOMO = canvasTex(256, 96, (g) => {
  g.fillStyle = '#d8c48e'
  g.fillRect(0, 0, 256, 96)
  for (let x = 0; x < 256; x += 3) {
    g.strokeStyle = x % 6 ? 'rgba(120,90,40,0.35)' : 'rgba(250,240,200,0.4)'
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + 1, 96)
    g.stroke()
  }
  // the mark: a red disc, the name brushed in black over it, and a band of black either side
  g.fillStyle = '#f4ead2'
  g.fillRect(96, 10, 64, 76)
  g.fillStyle = '#b8261c'
  g.beginPath()
  g.arc(128, 40, 22, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1c1410'
  g.font = 'bold 30px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('聞', 128, 41)
  g.font = 'bold 15px serif'
  g.fillText('銘酒', 128, 74)
})
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
/** a straw-wrapped sake barrel (菰樽), its lid and its two ropes, standing on its end; its mark faces `-z` */
function SakeBarrel() {
  return (
    <group>
      <Inked geometry={PROP_GEO.barrel} color="#ffffff" map={KOMO} position-y={0.21} grow={1.03} side={THREE.DoubleSide} />
      <mesh geometry={PROP_GEO.barrelTop} position-y={0.42} rotation-x={-Math.PI / 2}><meshToonMaterial color="#c9a46a" /></mesh>
      {[0.07, 0.35].map((y) => (
        <mesh key={y} geometry={PROP_GEO.rope} position-y={y} rotation-x={Math.PI / 2}><meshToonMaterial color="#5a3a1e" /></mesh>
      ))}
    </group>
  )
}
/** a clump of bamboo in a glazed pot: a few stalks, leaves in tufts at their joints */
function PottedBamboo() {
  const stalks = [[0.04, 0.02, 1.25, 0.05], [-0.05, 0.03, 1.05, -0.08], [0.0, -0.06, 0.9, 0.1]]
  return (
    <group>
      <Inked geometry={PROP_GEO.pot} color="#2c4a5c" position-y={0.13} />
      <mesh position-y={0.255} rotation-x={-Math.PI / 2}><circleGeometry args={[0.14, 16]} /><meshToonMaterial color="#4a3020" /></mesh>
      {stalks.map(([x, z, h, lean], i) => (
        <group key={i} position={[x, 0.25, z]} rotation-z={lean}>
          <mesh geometry={PROP_GEO.stalk} position-y={h / 2} scale={[1, h, 1]}><meshToonMaterial color="#6f8a3a" /></mesh>
          {[0.55, 0.75, 0.95].filter((k) => k * h < h).map((k) => (
            <group key={k} position-y={k * h}>
              {[0, 2.1, 4.2].map((a) => (
                <mesh key={a} geometry={PROP_GEO.leaf} position={[Math.cos(a + i) * 0.09, 0.02, Math.sin(a + i) * 0.09]}
                  rotation={[Math.sin(a + i) * 1.1, 0, -Math.cos(a + i) * 1.1]}>
                  <meshToonMaterial color={i % 2 ? '#4f7a32' : '#5f8c3a'} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
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
function BottleCrates() {
  return (
    <group>
      {[0, 1].map((k) => (
        <group key={k} position={[k * 0.04 - 0.02, k * 0.2, 0]} rotation-y={k * 0.12}>
          <Inked geometry={PROP_GEO.crate} color={k ? '#b8322a' : '#c0442e'} position-y={0.1} />
          {[-0.1, 0, 0.1].flatMap((x) => [-0.06, 0.06].map((z) => (
            <mesh key={`${x}${z}`} geometry={PROP_GEO.bottle} position={[x, 0.17, z]}><meshToonMaterial color="#3a2a1a" /></mesh>
          )))}
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
 * The mat that marks where the staff go in and out (関係者専用): a woven rug of deep red with a border of indigo and cream, a
 * seigaiha wave band inside it, the words in its middle, and a fringe at both ends.
 */
const STAFF_MAT = canvasTex(256, 160, (g) => {
  g.fillStyle = '#7a2a22'
  g.fillRect(0, 0, 256, 160)
  // (the weave, fine lines across and along)
  g.strokeStyle = 'rgba(0,0,0,0.16)'
  for (let x = 0; x < 256; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke() }
  g.strokeStyle = 'rgba(255,220,170,0.07)'
  for (let y = 0; y < 160; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke() }
  // (the borders: indigo, then cream, then a thin gold line)
  g.fillStyle = '#1f3a68'
  g.fillRect(0, 0, 256, 160)
  g.fillStyle = '#f0e2bc'
  g.fillRect(8, 8, 240, 144)
  g.fillStyle = '#7a2a22'
  g.fillRect(14, 14, 228, 132)
  g.strokeStyle = '#d4b04a'
  g.lineWidth = 2
  g.strokeRect(20, 20, 216, 120)
  // (a band of seigaiha waves along each long side)
  g.strokeStyle = 'rgba(244,239,226,0.55)'
  g.lineWidth = 1.4
  for (const y0 of [34, 128]) for (let col = 0; col < 14; col++) for (const r of [8, 5.5, 3]) {
    g.beginPath()
    g.arc(30 + col * 14.6, y0, r, Math.PI, 0)
    g.stroke()
  }
  brushText(g, '関係者専用', 128, 81, 38, { fill: '#f4e8c8', shadow: 'rgba(0,0,0,0.4)', spacing: 4 })
  // (a pair of cranes' worth of small gold diamonds at the corners)
  g.fillStyle = '#d4b04a'
  for (const [x, y] of [[32, 54], [224, 54], [32, 108], [224, 108]]) {
    g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill()
  }
})
function StaffMat() {
  return (
    <group>
      {/* (the rug's body, a little thick and a shade darker, under its face; a soft shadow round it on the boards) */}
      <mesh position={[0, 0.006, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.56, 1.0]} /><meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} /></mesh>
      <mesh position={[0, 0.011, 0]}><boxGeometry args={[1.5, 0.014, 0.94]} /><meshToonMaterial color="#1a2c50" /></mesh>
      <mesh position={[0, 0.0188, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[1.5, 0.94]} /><meshToonMaterial color="#ffffff" map={STAFF_MAT} /></mesh>
      {/* (the fringe at both ends, tassels of cream cord) */}
      {[-1, 1].flatMap((sd) => Array.from({ length: 30 }, (_, k) => (
        <mesh key={`${sd}${k}`} position={[sd * 0.76, 0.012, (k - 14.5) * 0.031]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.004, 0.004, 0.06, 4]} /><meshToonMaterial color="#e8d8a8" />
        </mesh>
      )))}
    </group>
  )
}
export function ShopProps({ counters }: { counters: Counter[] }) {
  const c0 = counters[0]
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(c0.along, along).addScaledVector(c0.lay, lay)
  // (their fronts toward the room's open side, where the camera is)
  const face = Math.atan2(-c0.lay.x, -c0.lay.z)
  return (
    <StaticBatch>
      <group position={at(3.3, 3.2)} rotation-y={face + 0.3}>
        <group position-x={-0.21}><SakeBarrel /></group>
        <group position-x={0.21} rotation-y={0.4}><SakeBarrel /></group>
        <group position-y={0.43} rotation-y={-0.2}><SakeBarrel /></group>
      </group>
      {/* plants about the room: a willow by the sake barrels in the front corner; bamboo by the till's end, by the door
          (none against the side wall: the two drinks fridges stand there) */}
      <group position={at(3.62, 2.25)} rotation-y={1.4} scale={0.9}><PottedWillow /></group>
      <group position={at(STAFF_DOOR.along, STAFF_DOOR.lay)} rotation-y={face + Math.PI} scale={0.64}><StaffMat /></group>
      <group position={at(-2.75, 3.8)} rotation-y={0.4}><PottedBamboo /></group>
      <group position={at(1.45, 0.62)} rotation-y={face}><BottleCrates /></group>
    </StaticBatch>
  )
}
