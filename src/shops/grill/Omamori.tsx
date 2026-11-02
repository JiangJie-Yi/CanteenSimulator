// An omamori on the till's desk (the owner's: 開運招福, after their picture of one; blender/omamori.py): a red brocade pouch, cherry
// blossom and gold waves on it, a white label with 開運招福 down it in the signs' brush lettering, a white flower knot on top. The pouch's
// picture is painted here (its front on the left half, its back on the right), lettered again once the signs' font is in.
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { brushText, SIGN_FONT, signTexture } from '@/scene/signFont'
import { nameOver } from './bar'

const URL = import.meta.env.BASE_URL + 'models/omamori.glb'
useGLTF.preload(URL)

/** a five-petalled cherry blossom at (x, y), `r` across, turned `a` */
function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, light: string, dark: string) {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  for (let k = 0; k < 5; k++) {
    g.rotate((Math.PI * 2) / 5)
    g.beginPath()
    g.moveTo(0, 0)
    g.bezierCurveTo(r * 0.35, -r * 0.25, r * 0.55, -r * 0.95, 0.12 * r, -r)
    g.lineTo(0, -r * 0.86)
    g.lineTo(-0.12 * r, -r)
    g.bezierCurveTo(-r * 0.55, -r * 0.95, -r * 0.35, -r * 0.25, 0, 0)
    g.fillStyle = light
    g.fill()
  }
  g.fillStyle = dark
  g.beginPath()
  g.arc(0, 0, r * 0.22, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#e8b84a'
  for (let k = 0; k < 5; k++) {
    const t = (k / 5) * Math.PI * 2 + 0.6
    g.beginPath()
    g.arc(Math.cos(t) * r * 0.32, Math.sin(t) * r * 0.32, r * 0.06, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

/** one face of the pouch, `x0` along, `w` wide, `h` tall: red brocade woven fine, gold waves rising from its foot, blossom scattered, a
 * gold line round its edge; on its front a white label with 開運招福 down it and a red seal, on its back 御守 in gold */
function face(g: CanvasRenderingContext2D, x0: number, w: number, h: number, back: boolean) {
  g.save()
  g.beginPath()
  g.rect(x0, 0, w, h)
  g.clip()
  const grad = g.createLinearGradient(x0, 0, x0, h)
  grad.addColorStop(0, '#d42433')
  grad.addColorStop(1, '#a8121f')
  g.fillStyle = grad
  g.fillRect(x0, 0, w, h)
  // (the weave: fine crossing threads, a shade lighter and darker)
  g.globalAlpha = 0.12
  g.strokeStyle = '#ffd0c0'
  g.lineWidth = 1
  for (let k = -h; k < w + h; k += 5) {
    g.beginPath(); g.moveTo(x0 + k, 0); g.lineTo(x0 + k + h, h); g.stroke()
  }
  g.strokeStyle = '#5a0008'
  for (let k = -h; k < w + h; k += 7) {
    g.beginPath(); g.moveTo(x0 + k, h); g.lineTo(x0 + k + h, 0); g.stroke()
  }
  g.globalAlpha = 1
  // (gold waves, 青海波, rising from the foot: rows of nested arcs, each lower row in front)
  const R = w * 0.13
  for (let row = 3; row >= 0; row--) {
    const cy = h - row * R * 0.55 + R * 0.2
    for (let k = -1; k <= 6; k++) {
      const cx = x0 + k * R * 1.6 + (row % 2) * R * 0.8
      for (let ring = 0; ring < 3; ring++) {
        g.beginPath()
        g.arc(cx, cy, R * (1 - ring * 0.3), Math.PI, 0)
        g.fillStyle = ring === 0 ? '#a8121f' : ring === 1 ? '#c41a2b' : '#a8121f'
        g.fill()
        g.lineWidth = 2
        g.strokeStyle = '#e9b949'
        g.stroke()
      }
    }
  }
  // (blossom over the brocade above the waves)
  const spots: [number, number, number][] = [[0.18, 0.12, 0.09], [0.8, 0.2, 0.1], [0.12, 0.46, 0.07], [0.86, 0.52, 0.08], [0.5, 0.06, 0.06], [0.2, 0.7, 0.06], [0.82, 0.74, 0.06]]
  for (const [u, v, s] of spots) blossom(g, x0 + u * w, v * h, s * w * 1.6, u * 7, '#fbd3dd', '#d9566f')
  // (a gold line round its edge)
  g.strokeStyle = '#e9b949'
  g.lineWidth = 3
  g.strokeRect(x0 + 7, 7, w - 14, h - 14)
  if (!back) {
    // (the label: white, rounded, a red frame with a gold line in it; 開運招福 down it; a little red seal at its foot)
    const lw = w * 0.42, lh = h * 0.62, lx = x0 + (w - lw) / 2, ly = h * 0.15
    g.fillStyle = '#fbf8f0'
    g.beginPath()
    g.roundRect(lx, ly, lw, lh, 6)
    g.fill()
    g.lineWidth = 5
    g.strokeStyle = '#b8141f'
    g.stroke()
    g.lineWidth = 1.5
    g.strokeStyle = '#d9a73a'
    g.beginPath()
    g.roundRect(lx + 6, ly + 6, lw - 12, lh - 12, 4)
    g.stroke()
    const chars = ['開', '運', '招', '福']
    const size = Math.min(lw * 0.72, (lh - 24) / 4.2)
    chars.forEach((c, i) => brushText(g, c, lx + lw / 2, ly + 14 + size * (i + 0.55), size, { fill: '#1a1210', weight: '400' }))
    g.fillStyle = '#c41a2b'
    g.fillRect(lx + lw - 16, ly + lh - 20, 10, 12)
  } else {
    g.save()
    g.font = `bold ${w * 0.26}px ${SIGN_FONT}`
    brushText(g, '御', x0 + w / 2, h * 0.36, w * 0.26, { fill: '#f0c75a', edge: '#7a0a12' })
    brushText(g, '守', x0 + w / 2, h * 0.36 + w * 0.3, w * 0.26, { fill: '#f0c75a', edge: '#7a0a12' })
    g.restore()
  }
  g.restore()
}

/** the omamori, standing (its foot's middle at the origin, its front toward +z): pointed at, it says what it is */
export function Omamori() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.getObjectByName('Omamori')!.clone(true)
    r.position.set(0, 0, 0)
    const pic = signTexture(512, 412, (g, w, h) => { face(g, 0, w / 2, h, false); face(g, w / 2, w / 2, h, true) })
    // (a glTF model's pictures are read top row first: the canvas too, or it's upside down)
    if (pic) pic.flipY = false
    const pouch = new THREE.MeshToonMaterial({ color: '#ffffff', map: pic })
    const cord = new THREE.MeshToonMaterial({ color: '#f6f4ee' })
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = /Pouch/.test(m.name) ? pouch : cord
      m.castShadow = false
      m.receiveShadow = true
    })
    inkModel(r, (m) => !/Pouch/.test(m.name), { width: 0.0006, weld: true })
    // (folded together by material: its cord's loops and ends were each a draw)
    mergeByMaterial(r)
    return r
  }, [gltf])
  return (
    <group {...nameOver('御守', '開運招福：保佑生意興隆')}>
      <primitive object={obj} />
    </group>
  )
}
