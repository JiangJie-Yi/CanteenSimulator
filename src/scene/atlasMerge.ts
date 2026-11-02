import * as THREE from 'three'
import { colourVertices } from './StaticBatch'

/**
 * A model drawn in one material however many it came with, so that merged by material (StaticBatch's mergeByMaterial) it's a draw or two
 * where it was a score: every picture on it packed into one atlas (a canvas, each picture ringed by a margin of itself, so its edges still
 * wrap round as they did), each mesh's UVs moved onto its picture's place in the atlas; the plain-coloured meshes pointed at a white patch
 * in it, their colour carried by their vertices (and a picture's tint by the vertices of what wears it). `pick` says which meshes (the
 * rest are left as they are); `make` makes the one material from the atlas. The meshes' geometries are made their own (copies) first.
 * Their UVs must lie within 0..1 (a picture tiled over a mesh can't be packed).
 */
export function atlasModel(root: THREE.Object3D, pick: (m: THREE.Mesh) => boolean, make: (atlas: THREE.Texture) => THREE.Material, pad = 16): THREE.Material | null {
  if (typeof document === 'undefined') return null
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !Array.isArray(m.material) && pick(m)) meshes.push(m) })
  if (!meshes.length) return null
  type Pic = { img: CanvasImageSource; w: number; h: number; x: number; y: number }
  const pics = new Map<unknown, Pic>()
  for (const m of meshes) {
    const img = (m.material as THREE.MeshStandardMaterial).map?.image as (CanvasImageSource & { width: number; height: number }) | undefined
    if (img && img.width && !pics.has(img)) pics.set(img, { img, w: img.width, h: img.height, x: 0, y: 0 })
  }
  // (packed in shelves, the tallest first, across a sheet a power of two wide; a white patch for the plain after them)
  const list = [...pics.values()].sort((a, b) => b.h - a.h)
  const area = list.reduce((s, p) => s + (p.w + 2 * pad) * (p.h + 2 * pad), 0)
  const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)))
  const W = pow2(Math.max(64, Math.sqrt(area * 1.15), ...list.map((p) => p.w + 2 * pad)))
  let x = 0, y = 0, rowH = 0
  for (const p of list) {
    if (x + p.w + 2 * pad > W) { x = 0; y += rowH; rowH = 0 }
    p.x = x + pad
    p.y = y + pad
    x += p.w + 2 * pad
    rowH = Math.max(rowH, p.h + 2 * pad)
  }
  const WHITE = 16
  if (x + WHITE > W) { x = 0; y += rowH; rowH = 0 }
  const white = { x: x + WHITE / 2, y: y + WHITE / 2 }
  rowH = Math.max(rowH, WHITE)
  const H = pow2(y + rowH)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  // (opaque all over, white where nothing's drawn: a patch's edge or the white patch the plain parts point at, in the small mips of a far
  // view, never takes in a see-through black corner (the figure's fade is hashed on its alpha, and the plain parts greyed with it))
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  for (const p of list) {
    // (the picture, and round it a margin of itself as it wraps: drawn three by three, kept to its own patch)
    g.save()
    g.beginPath()
    g.rect(p.x - pad, p.y - pad, p.w + 2 * pad, p.h + 2 * pad)
    g.clip()
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.drawImage(p.img, p.x + dx * p.w, p.y + dy * p.h)
    g.restore()
  }
  g.fillStyle = '#ffffff'
  g.fillRect(white.x - WHITE / 2, white.y - WHITE / 2, WHITE, WHITE)
  const atlas = new THREE.CanvasTexture(canvas)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.flipY = false
  atlas.anisotropy = 4
  const mat = make(atlas)
  for (const m of meshes) {
    const src = m.material as THREE.MeshStandardMaterial
    const p = src.map ? pics.get(src.map.image) : undefined
    const geo = m.geometry.clone()
    const uv = geo.attributes.uv as THREE.BufferAttribute | undefined
    const n = geo.attributes.position.count
    const out = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      if (p && uv) { out[i * 2] = (p.x + uv.getX(i) * p.w) / W; out[i * 2 + 1] = (p.y + uv.getY(i) * p.h) / H }
      // (a picture but no UVs to place it by (the owner's headband's knot ends): it drew the picture's corner, and draws it still)
      else if (p) { out[i * 2] = (p.x + 0.5) / W; out[i * 2 + 1] = (p.y + 0.5) / H }
      else { out[i * 2] = white.x / W; out[i * 2 + 1] = white.y / H }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(out, 2))
    colourVertices(geo, src.color ?? new THREE.Color('#ffffff'))
    m.geometry = geo
    m.material = mat
  }
  return mat
}
