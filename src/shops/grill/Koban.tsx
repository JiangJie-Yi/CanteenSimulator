// A koban (小判), the old oval gold coin, standing in its little lacquered stand between the beckoning cats at the door (the owner's, after
// a Sketchfab model they pointed to; blender/koban.py, a coin of 48 faces). Its faces are painted here: its raised rim, the hammer's fine
// lines across them (茣蓙目), the
// paulownia in its fan-shaped frame stamped at top and foot, 壹両 and 光次 with the mint's mark down the middle, the little stamps on the
// back; and the same painted again in greys for how high each part stands, made into a normal map, so the stamps stand up and the lines
// sink in the light. Real gold: it shines with the studio's reflections, as the shrine's metal does.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { normalFromHeight } from '@/scene/normalFromHeight'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { brushText, signTexture } from '@/scene/signFont'
import { reflectStudio } from '@/scene/studio'
import { nameOver } from './bar'

const URL = import.meta.env.BASE_URL + 'models/koban.glb'
useGLTF.preload(URL)

/** the picture: the front's cell on the left, the back's on the right, each the coin's own shape (0.075 by 0.14, as blender/koban.py
 * unwraps it: down to 0.92 of the picture), the edge's plain strip under them */
const S = 1024, CELL = { w: S / 2, h: S * 0.92 }
type Mode = 'colour' | 'height'

/** the paulownia in its fan-shaped frame (扇枠桐), stamped at (x, y), `r` its frame's reach: the fan opens upward */
function kiri(g: CanvasRenderingContext2D, x: number, y: number, r: number, mode: Mode) {
  const raised = mode === 'height' ? '#ffffff' : '#f2cf6c'
  const edge = mode === 'height' ? '#c8c8c8' : '#8c5e18'
  g.save()
  g.translate(x, y)
  // (the frame: a fan, its ribs' ends a scalloped arc above, a little arc below)
  const a0 = -Math.PI / 2 - 0.62, a1 = -Math.PI / 2 + 0.62
  const r0 = r * 0.28, cy = r * 0.62
  g.beginPath()
  g.arc(0, cy, r, a0, a1)
  g.arc(0, cy, r0, a1, a0, true)
  g.closePath()
  g.fillStyle = mode === 'height' ? '#a0a0a0' : '#e6bd58'
  g.fill()
  g.lineWidth = r * 0.07
  g.strokeStyle = edge
  g.stroke()
  // (the paulownia inside: three leaves at its foot, three stalks of flowers over them, 3–5–3)
  g.fillStyle = raised
  g.strokeStyle = edge
  g.lineWidth = r * 0.03
  for (const [dx, a, s] of [[0, 0, 1], [-0.3, -0.75, 0.82], [0.3, 0.75, 0.82]]) {
    g.save()
    g.translate(dx * r, cy - r0 - r * 0.12)
    g.rotate(a)
    g.beginPath()
    g.ellipse(0, -r * 0.13 * s, r * 0.09 * s, r * 0.15 * s, 0, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.restore()
  }
  for (const [dx, n] of [[-0.24, 3], [0, 5], [0.24, 3]]) {
    for (let k = 0; k < n; k++) {
      g.beginPath()
      g.arc(dx * r, cy - r0 - r * 0.42 - k * r * 0.085, r * 0.04, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
  }
  g.restore()
}

/** characters stamped down the coin, in the signs' brush lettering, centred at x from y down, each `size` */
function stamp(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, mode: Mode) {
  g.save()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  ;[...text].forEach((ch, k) => {
    const cy = y + k * size * 1.02
    if (mode === 'height') {
      g.filter = 'blur(1.2px)'
      brushText(g, ch, x, cy, size, { fill: '#ffffff' })
      g.filter = 'none'
    } else brushText(g, ch, x, cy, size, { fill: '#f4d272', edge: '#8c5e18' })
  })
  g.restore()
}

/** the mint's mark (花押) under 光次: a flourish of the brush, a loop and a long stroke through it */
function kao(g: CanvasRenderingContext2D, x: number, y: number, r: number, mode: Mode) {
  g.save()
  g.translate(x, y)
  g.lineCap = 'round'
  g.strokeStyle = mode === 'height' ? '#ffffff' : '#7e5414'
  g.lineWidth = r * 0.16
  g.beginPath()
  g.moveTo(-r * 0.9, -r * 0.1)
  g.bezierCurveTo(-r * 0.3, -r * 0.9, r * 0.6, -r * 0.6, r * 0.2, 0)
  g.bezierCurveTo(-r * 0.1, r * 0.5, r * 0.8, r * 0.6, r * 0.95, r * 0.1)
  g.moveTo(-r * 0.7, r * 0.35)
  g.lineTo(r * 0.8, r * 0.35)
  g.stroke()
  g.restore()
}

/** one face, in its cell from x0: the face inside the rim, its fine lines, and (the front) the stamps and characters, (the back) its
 * little round stamps */
function face(g: CanvasRenderingContext2D, x0: number, back: boolean, mode: Mode) {
  const { w, h } = CELL
  const cx = x0 + w / 2, cy = h / 2
  g.save()
  g.beginPath()
  g.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
  g.clip()
  if (mode === 'colour') {
    // (the gold: warm and bright in the middle, deeper toward the rim)
    const grad = g.createRadialGradient(cx - w * 0.12, cy - h * 0.18, w * 0.05, cx, cy, h * 0.55)
    grad.addColorStop(0, '#fbe08c')
    grad.addColorStop(0.5, '#e4b24a')
    grad.addColorStop(1, '#bb8530')
    g.fillStyle = grad
  } else g.fillStyle = '#808080'
  g.fillRect(x0, 0, w, h)
  // (the raised rim round the edge (the model's face is flat: the owner's, as few faces as can be), a fine groove inside it)
  const rim = w * 0.065
  g.save()
  if (mode === 'height') g.filter = 'blur(2px)'
  g.lineWidth = rim
  g.strokeStyle = mode === 'height' ? '#d0d0d0' : '#f3d27a'
  g.beginPath()
  g.ellipse(cx, cy, w / 2 - rim / 2, h / 2 - rim / 2, 0, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = w * 0.012
  g.strokeStyle = mode === 'height' ? '#5c5c5c' : '#9a6a20'
  g.beginPath()
  g.ellipse(cx, cy, w / 2 - rim - w * 0.006, h / 2 - rim - w * 0.006, 0, 0, Math.PI * 2)
  g.stroke()
  g.restore()
  // (inside the rim: the hammer's fine lines straight across, close together, each a little uneven)
  g.save()
  g.beginPath()
  g.ellipse(cx, cy, w / 2 - w * 0.07, h / 2 - w * 0.07, 0, 0, Math.PI * 2)
  g.clip()
  g.strokeStyle = mode === 'height' ? '#5a5a5a' : 'rgba(120, 78, 18, 0.42)'
  for (let y = 4, k = 0; y < h; y += 7, k++) {
    g.lineWidth = 1.6 + 0.8 * Math.sin(k * 1.7)
    g.beginPath()
    g.moveTo(x0, y + Math.sin(k * 0.9) * 0.6)
    g.lineTo(x0 + w, y + Math.sin(k * 1.3 + 1) * 0.6)
    g.stroke()
  }
  g.restore()
  if (!back) {
    kiri(g, cx, h * 0.13, w * 0.24, mode)
    kiri(g, cx, h * 0.79, w * 0.24, mode)
    stamp(g, '壹両', cx, h * 0.3, w * 0.25, mode)
    stamp(g, '光次', cx, h * 0.53, w * 0.2, mode)
    kao(g, cx, h * 0.7, w * 0.12, mode)
  } else {
    // (the back: three little round stamps, a ring with a mark in it)
    for (const [fx, fy] of [[0.5, 0.33], [0.38, 0.55], [0.62, 0.7]]) {
      g.beginPath()
      g.arc(x0 + w * fx, h * fy, w * 0.07, 0, Math.PI * 2)
      g.lineWidth = w * 0.018
      g.strokeStyle = mode === 'height' ? '#ffffff' : '#8c5e18'
      g.stroke()
      g.beginPath()
      g.arc(x0 + w * fx, h * fy, w * 0.025, 0, Math.PI * 2)
      g.fillStyle = mode === 'height' ? '#ffffff' : '#f2cf6c'
      g.fill()
    }
  }
  g.restore()
}

function paint(g: CanvasRenderingContext2D, mode: Mode) {
  g.fillStyle = mode === 'height' ? '#808080' : '#d4a144'
  g.fillRect(0, 0, S, S)
  face(g, 0, false, mode)
  face(g, CELL.w, true, mode)
}

/** the koban on its stand (its foot's middle at the origin, its front toward +z): pointed at, it says what it is */
export function Koban() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('Koban')!.clone(true)
    r.position.set(0, 0, 0)
    const pic = signTexture(S, S, (g) => paint(g, 'colour'))
    // (a glTF model's pictures are read top row first: these too, or they're upside down)
    if (pic) pic.flipY = false
    let bump: THREE.CanvasTexture | null = null
    if (typeof document !== 'undefined') {
      const hc = document.createElement('canvas')
      hc.width = hc.height = S
      paint(hc.getContext('2d')!, 'height')
      bump = new THREE.CanvasTexture(normalFromHeight(hc, 4))
      bump.flipY = false
      bump.anisotropy = 4
    }
    // (brighter (the owner's): the studio's reflection 1.6 times as strong, a smoother polish, and its own picture glowing a little warm, so
    // it's gold even where the room's dim)
    const gold = new THREE.MeshStandardMaterial({ color: '#ffffff', map: pic, normalMap: bump, metalness: 1, roughness: 0.24, envMapIntensity: 1.6,
      emissive: '#6a4a14', emissiveMap: pic, emissiveIntensity: 0.45 })
    const line = new THREE.MeshStandardMaterial({ color: '#d9a944', metalness: 1, roughness: 0.35 })
    const lacquer = new THREE.MeshToonMaterial({ color: '#1c130f' })
    reflectStudio(gold, line)
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = m.name === 'KobanCoin' ? gold : m.name === 'KobanStandLine' ? line : lacquer
      m.castShadow = false
      m.receiveShadow = true
    })
    inkModel(r, (m) => m.name === 'KobanStandLine', { width: 0.0008, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return (
    <group {...nameOver('小判金幣', '招財納福的金幣')}>
      <primitive object={obj} />
    </group>
  )
}
