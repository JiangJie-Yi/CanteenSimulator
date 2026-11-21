import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { StaticBatch } from '@/scene/StaticBatch'
import { getClock } from '@/ui/clockStore'
import { nameOver } from './bar'

/**
 * The cat wall clock (item 477, the owner's, 2026-11-21: 「這邊增加一個喵咪掛鐘」; blender/catclock.py): our own, a calico cat sitting up,
 * its round belly the clock's case and the dial on it, its face over it, a red collar and a gold bell at its neck, its paws at its foot,
 * its tail hanging under it for the pendulum. Its hands on the shop's own clock (eased round, the clock moving on by the second), its tail
 * swung; the head's front and the dial painted here in one picture (the face on its left half, the dial on its right), as the drinks
 * fridge's sign is. In the scene from the first, its programs made at loading.
 */
const URL = import.meta.env.BASE_URL + 'models/catclock.glb'
useGLTF.preload(URL)

/** the picture: the face on its left half (its square laid over the head's 17 cm), the dial on its right (over the dial's 14 cm) */
function paintPrint() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // ---- the face: white, a black patch about its left ear and a ginger one about its right (calico), eyes shut in a smile, a pink nose,
  // a little ω of a mouth, rosy cheeks, three whiskers a side
  g.fillStyle = '#f7f2e8'; g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#2e2826'
  g.beginPath(); g.moveTo(0, 0); g.lineTo(104, 0); g.bezierCurveTo(98, 40, 70, 66, 30, 74); g.bezierCurveTo(16, 76, 4, 70, 0, 64); g.closePath(); g.fill()
  g.fillStyle = '#e3953f'
  g.beginPath(); g.moveTo(256, 0); g.lineTo(150, 0); g.bezierCurveTo(156, 44, 190, 76, 230, 86); g.bezierCurveTo(244, 88, 252, 84, 256, 78); g.closePath(); g.fill()
  g.fillStyle = '#f4b6ae'
  for (const x of [72, 184]) { g.beginPath(); g.ellipse(x, 150, 17, 10, 0, 0, Math.PI * 2); g.fill() }
  g.strokeStyle = '#2e2826'; g.lineWidth = 7
  for (const x of [90, 166]) { g.beginPath(); g.moveTo(x - 18, 126); g.quadraticCurveTo(x, 104, x + 18, 126); g.stroke() }
  g.fillStyle = '#e8828a'
  g.beginPath(); g.moveTo(118, 136); g.lineTo(138, 136); g.quadraticCurveTo(128, 152, 128, 150); g.closePath(); g.fill()
  g.strokeStyle = '#5a3a34'; g.lineWidth = 4
  g.beginPath(); g.moveTo(128, 148); g.quadraticCurveTo(122, 164, 113, 158); g.moveTo(128, 148); g.quadraticCurveTo(134, 164, 143, 158); g.stroke()
  g.strokeStyle = '#6a5a54'; g.lineWidth = 3
  for (const [y0, y1] of [[140, 132], [150, 150], [160, 168]]) {
    g.beginPath(); g.moveTo(58, y0); g.lineTo(8, y1); g.moveTo(198, y0); g.lineTo(248, y1); g.stroke()
  }
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

const SAYS = nameOver('【掛鐘】三毛貓掛鐘', '尾巴當鐘擺左右搖，指針跟著店裡的時間走')
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
  useFrame(({ clock }, dt) => {
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
