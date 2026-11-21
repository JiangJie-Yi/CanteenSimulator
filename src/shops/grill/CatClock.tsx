import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { StaticBatch } from '@/scene/StaticBatch'
import { getClock } from '@/ui/clockStore'
import { nameOver } from './bar'

/**
 * The cat wall clock (item 477, the owner's, 2026-11-21: 「這邊增加一個喵咪掛鐘」; a black cat since item 483: 「貓咪時鐘要黑貓」;
 * blender/catclock.py): our own, a black cat sitting up,
 * its round belly the clock's case and the dial on it, its face over it, a red collar and a gold bell at its neck, its paws at its foot,
 * its tail hanging under it for the pendulum. Its hands on the shop's own clock (eased round, the clock moving on by the second), its tail
 * swung; the head's front and the dial painted here in one picture (the face on its left half, the dial on its right), as the drinks
 * fridge's sign is. In the scene from the first, its programs made at loading.
 */
const URL = import.meta.env.BASE_URL + 'models/catclock.glb'
useGLTF.preload(URL)

/** the eyes' middles and their size on the face's square (px): big (item 512, the owner's 「大大的貓咪眼」: at 37 across 74 of the face's 256
 * they were a cat's own eyes, not the picture's that fill the upper face), each two fifths of the face across, their rims all but meeting */
const EYES = [[75, 98], [181, 98]] as const, EYE_R = 50
/**
 * The face (a black cat's since item 483, the owner's 「貓咪時鐘要黑貓」; its eyes after the owner's picture since item 484: 「貓咪的眼睛掛鐘
 * 可以參考這個」): its fur; two big round eyes, set in raised rims (a dark grey ring, lit along its top, shaded under), warm cream-yellow,
 * their pupils tall dark ovals turned a little in, a glint on each; `lid` 0 open → 1 shut, the fur drawn down over them to a lid's edge; a
 * pink nose, a little ω of a mouth in pale pink, cheeks a soft rose, three cream whiskers a side. On the picture's left half only.
 */
function paintFace(g: CanvasRenderingContext2D, lid: number) {
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.fillStyle = '#2b2727'; g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#6e3e46'
  for (const x of [50, 206]) { g.beginPath(); g.ellipse(x, 176, 15, 9, 0, 0, Math.PI * 2); g.fill() }
  EYES.forEach(([x, y], i) => {
    // (the rim: raised, its top caught by the light, its foot in shade)
    g.fillStyle = '#463d3d'
    g.beginPath(); g.arc(x, y, EYE_R + 8, 0, Math.PI * 2); g.fill()
    g.lineWidth = 3.5
    g.strokeStyle = '#6f6464'
    g.beginPath(); g.arc(x, y, EYE_R + 6, Math.PI * 1.05, Math.PI * 1.85); g.stroke()
    g.strokeStyle = '#141010'
    g.beginPath(); g.arc(x, y, EYE_R + 6, Math.PI * 0.1, Math.PI * 0.9); g.stroke()
    // (the eye: cream-yellow, lighter toward its top left)
    const shade = g.createRadialGradient(x - 15, y - 18, 4, x, y, EYE_R)
    shade.addColorStop(0, '#fff7d2'); shade.addColorStop(0.65, '#f2db86'); shade.addColorStop(1, '#d9b554')
    g.fillStyle = shade
    g.beginPath(); g.arc(x, y, EYE_R, 0, Math.PI * 2); g.fill()
    // (its pupil, tall, turned in toward the nose a little, and its glints)
    const px = x + (i === 0 ? 5 : -5)
    g.fillStyle = '#1d1512'
    g.beginPath(); g.ellipse(px, y + 3, 17, 35, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath(); g.arc(px - 7, y - 15, 7.5, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.arc(px + 7, y + 17, 3.3, 0, Math.PI * 2); g.fill()
    // (the lid: the fur drawn down over it to a curved edge, its edge a dark line)
    if (lid > 0.02) {
      const edge = y - EYE_R + lid * EYE_R * 2
      g.save()
      g.beginPath(); g.arc(x, y, EYE_R + 1, 0, Math.PI * 2); g.clip()
      g.fillStyle = '#2b2727'
      g.beginPath(); g.moveTo(x - EYE_R - 2, y - EYE_R - 2); g.lineTo(x + EYE_R + 2, y - EYE_R - 2); g.lineTo(x + EYE_R + 2, edge)
      g.quadraticCurveTo(x, edge + 12 * (1 - lid * 0.6), x - EYE_R - 2, edge); g.closePath(); g.fill()
      g.restore()
      g.strokeStyle = '#151010'; g.lineWidth = 3
      const half = Math.sqrt(Math.max(0, EYE_R * EYE_R - (edge - y) ** 2))
      if (lid < 0.95) { g.beginPath(); g.moveTo(x - half, edge); g.quadraticCurveTo(x, edge + 12 * (1 - lid * 0.6), x + half, edge); g.stroke() }
      // (shut: the lid's line across the eye's middle, a soft curve down, so it reads as an eye shut, not an empty ring)
      else { g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - EYE_R * 0.78, y + 2); g.quadraticCurveTo(x, y + EYE_R * 0.5, x + EYE_R * 0.78, y + 2); g.stroke() }
    }
  })
  g.fillStyle = '#ec8c94'
  g.beginPath(); g.moveTo(118, 156); g.lineTo(138, 156); g.quadraticCurveTo(128, 172, 128, 170); g.closePath(); g.fill()
  g.strokeStyle = '#e9b3ac'; g.lineWidth = 4
  g.beginPath(); g.moveTo(128, 168); g.quadraticCurveTo(122, 184, 113, 178); g.moveTo(128, 168); g.quadraticCurveTo(134, 184, 143, 178); g.stroke()
  // (the whiskers out from under the big eyes, lower and further out)
  g.strokeStyle = '#efe6d6'; g.lineWidth = 3
  for (const [y0, y1] of [[166, 158], [175, 175], [184, 192]]) {
    g.beginPath(); g.moveTo(44, y0); g.lineTo(4, y1); g.moveTo(212, y0); g.lineTo(252, y1); g.stroke()
  }
  g.restore()
}
/** the picture: the face on its left half (its square laid over the head's 17 cm), the dial on its right (over the dial's 14 cm) */
function paintPrint() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.lineCap = 'round'
  g.lineJoin = 'round'
  PRINT_CANVAS = c
  paintFace(g, 0)
  // ---- the dial: cream, a ring near its edge, twelve ticks (the quarters bold), its quarters' numbers, a little grilled fish under its
  // middle (the shop's)
  const X = 384, Y = 128
  g.fillStyle = '#fbf3df'; g.fillRect(256, 0, 256, 256)
  g.strokeStyle = '#d6c39a'; g.lineWidth = 5
  g.beginPath(); g.arc(X, Y, 118, 0, Math.PI * 2); g.stroke()
  g.strokeStyle = '#4a3a30'
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, q = k % 3 === 0
    g.lineWidth = q ? 8 : 4
    g.beginPath(); g.moveTo(X + Math.sin(a) * (q ? 96 : 102), Y - Math.cos(a) * (q ? 96 : 102)); g.lineTo(X + Math.sin(a) * 110, Y - Math.cos(a) * 110); g.stroke()
  }
  g.fillStyle = '#4a3a30'
  g.font = 'bold 34px Georgia, "Times New Roman", serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'
  for (const [n, a] of [['12', 0], ['3', 0.25], ['6', 0.5], ['9', 0.75]] as const) g.fillText(n, X + Math.sin(a * Math.PI * 2) * 74, Y - Math.cos(a * Math.PI * 2) * 74 + 2)
  // (the fish: a ginger body, its tail, a darker back line; no eye)
  g.fillStyle = '#e3953f'
  g.beginPath(); g.ellipse(X - 4, Y + 40, 17, 8, 0, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.moveTo(X + 10, Y + 40); g.lineTo(X + 24, Y + 31); g.lineTo(X + 22, Y + 40); g.lineTo(X + 24, Y + 49); g.closePath(); g.fill()
  g.strokeStyle = '#b8682a'; g.lineWidth = 2.5
  g.beginPath(); g.moveTo(X - 16, Y + 37); g.quadraticCurveTo(X - 4, Y + 33, X + 8, Y + 37); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false
  t.anisotropy = 4
  return t
}
let PRINT: THREE.CanvasTexture | null = null
/** the picture's own canvas (the texture's may be a smaller copy, scene/textureCap: painted here, copied over as it's marked changed) */
let PRINT_CANVAS: HTMLCanvasElement | null = null
/** how shut its eyes are drawn now, in steps (a blink's few pictures, painted only as it changes) */
let LID_NOW = 0

const SAYS = nameOver('【掛鐘】黑貓掛鐘', '尾巴當鐘擺左右搖，指針跟著店裡的時間走')
/** the shortest way round from one angle to another */
const turnBy = (from: number, to: number) => ((((to - from + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI

export const CatClock = memo(function CatClock() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const r = (gltf.scene.getObjectByName('CatClock') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    PRINT ??= paintPrint()
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: src.name === 'CatClockPrint' ? '#ffffff' : src.color.clone(), map: src.name === 'CatClockPrint' ? PRINT : null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      // (its own shadow's not worth the cost on a wall: none cast, its things' shadows taken)
      m.receiveShadow = true
    })
    // (what moves (the hands, the tail) taken out to a group of its own beside it: the body batched (its plain colours drawn as one), these
    // not)
    const moving = new THREE.Group()
    const hour = r.getObjectByName('CatClockHour')!, minute = r.getObjectByName('CatClockMinute')!, tail = r.getObjectByName('CatClockTail')!
    moving.add(hour, minute, tail)
    inkModel(r, () => false, { width: 0.0012, weld: true })
    inkModel(moving, () => false, { width: 0.0012, weld: true })
    return { r, moving, hour, minute, tail }
  }, [gltf])
  const at = useRef({ h: NaN, m: NaN })
  // (a blink now and then (item 484): every three to seven seconds, a fifth of them twice over; the lids down and up in a sixth of a second)
  const blink = useRef({ next: 2 + Math.random() * 3, at: -1, twice: false })
  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime, b = blink.current
    if (b.at < 0 && now > b.next) { b.at = now; b.twice = Math.random() < 0.2 }
    let lid = 0
    if (b.at >= 0) {
      const s = now - b.at, len = 0.17
      if (s < len) lid = Math.sin((s / len) * Math.PI)
      else if (b.twice && s > len + 0.08 && s < len * 2 + 0.08) lid = Math.sin(((s - len - 0.08) / len) * Math.PI)
      else if (s >= (b.twice ? len * 2 + 0.08 : len)) { b.at = -1; b.next = now + 3 + Math.random() * 4 }
    }
    // (dev: the lids held where asked, to look at them: window.__catLid = 0 … 1)
    if (import.meta.env.DEV) { const held = (window as unknown as { __catLid?: number }).__catLid; if (typeof held === 'number') lid = held }
    const step = Math.round(lid * 4) / 4
    if (import.meta.env.DEV) (window as unknown as { __catLidNow?: number }).__catLidNow = step
    if (step !== LID_NOW && PRINT && PRINT_CANVAS) {
      LID_NOW = step
      paintFace(PRINT_CANVAS.getContext('2d')!, step)
      PRINT.needsUpdate = true
    }
    const min = getClock().minute
    const hTo = (((min / 60) % 12) / 12) * Math.PI * 2, mTo = ((min % 60) / 60) * Math.PI * 2
    const a = at.current
    // (the hands eased round to the time (it moves on by the second), the short way, never spun back the long way at midnight)
    if (!Number.isFinite(a.h)) { a.h = hTo; a.m = mTo }
    const k = Math.min(1, Math.min(dt, 0.1) * 6)
    a.h += turnBy(a.h, hTo) * k
    a.m += turnBy(a.m, mTo) * k
    parts.hour.rotation.z = -a.h
    parts.minute.rotation.z = -a.m
    // (the tail swung as a pendulum: a second and a half each way and back)
    parts.tail.rotation.z = Math.sin((clock.elapsedTime * Math.PI * 2) / 1.5) * 0.17
  })
  return (
    <group>
      <StaticBatch plain><primitive object={parts.r} /></StaticBatch>
      <primitive object={parts.moving} />
      {/* (pointed at: what it is, a tag (no glow), the cursor an arrow) */}
      <mesh visible={false} position={[0, -0.02, 0.03]} {...SAYS}><boxGeometry args={[0.24, 0.57, 0.06]} /></mesh>
    </group>
  )
})
