import * as THREE from 'three'
import { colourVertices } from './StaticBatch'
import { isDummyMap, isFlatNormal } from './materialNormalize'

/**
 * A model drawn in one material however many it came with, so that merged by material (StaticBatch's mergeByMaterial) it's a draw or two
 * where it was a score: every picture on it packed into one atlas (a canvas, each picture ringed by a margin of itself, so its edges still
 * wrap round as they did), each mesh's UVs moved onto its picture's place in the atlas; the plain-coloured meshes pointed at a white patch
 * in it, their colour carried by their vertices (and a picture's tint by the vertices of what wears it). `pick` says which meshes (the
 * rest are left as they are); `make` makes the one material from the atlas. The meshes' geometries are made their own (copies) first.
 * Their UVs must lie within 0..1 (a picture tiled over a mesh can't be packed).
 */
type Patch = { img: CanvasImageSource; w: number; h: number; x: number; y: number }
/** a picture into its patch (`p`), and round it a margin of itself as it wraps: drawn three by three, kept to its own patch */
function drawPatch(g: CanvasRenderingContext2D, p: Patch, img: CanvasImageSource, pad: number) {
  g.save()
  g.beginPath()
  g.rect(p.x - pad, p.y - pad, p.w + 2 * pad, p.h + 2 * pad)
  g.clip()
  // (a see-through picture (a face's features, the glasses' frames: scene/faceSheet) kept see-through: the white under it cleared)
  if ((img as { seeThrough?: boolean }).seeThrough) g.clearRect(p.x - pad, p.y - pad, p.w + 2 * pad, p.h + 2 * pad)
  // (at the patch's own size: a normal map may be made at another than its picture's)
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.drawImage(img, p.x + dx * p.w, p.y + dy * p.h, p.w, p.h)
  g.restore()
}
/**
 * A picture of an atlas made by `atlasModel` drawn again (the owner's clothes recoloured, item 376): `was`, the picture it was made with
 * (its image), its patch drawn over with `now` (the same size), its wrapped margin with it, and the atlas sent to the GPU again. Nothing
 * else of the figure is made again (its shape, its material, its shader). False when the material isn't an atlas or had no such picture.
 */
export function repaintPatch(mat: THREE.Material, was: unknown, now: CanvasImageSource): boolean {
  const made = mat.userData.atlas as { patches: Map<unknown, Patch>; pad: number; canvas: HTMLCanvasElement } | undefined
  const p = made?.patches.get(was)
  const atlas = (mat as THREE.MeshStandardMaterial).map
  if (!p || !atlas) return false
  // (into the atlas as it was made, at its full size: what's uploaded may be a smaller copy of it (scene/textureCap), drawn from it again
  // as the atlas is marked changed)
  drawPatch(made!.canvas.getContext('2d')!, p, now, made!.pad)
  atlas.needsUpdate = true
  return true
}
export function atlasModel(root: THREE.Object3D, pick: (m: THREE.Mesh) => boolean, make: (atlas: THREE.Texture, normals: THREE.Texture | null) => THREE.Material, pad = 16): THREE.Material | null {
  if (typeof document === 'undefined') return null
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !Array.isArray(m.material) && pick(m)) meshes.push(m) })
  if (!meshes.length) return null
  const pics = new Map<unknown, Patch>()
  // (and each picture's normal map, where its material has one of its own: packed beside it in an atlas of normals laid out the same)
  const normalsOf = new Map<unknown, CanvasImageSource>()
  // (a picture of its own: not the white one scene/materialNormalize gives a material without, which is data, not a picture to draw)
  const picOf = (mt: THREE.MeshStandardMaterial) => (mt.map && !isDummyMap(mt.map) ? mt.map : null)
  for (const m of meshes) {
    const img = picOf(m.material as THREE.MeshStandardMaterial)?.image as (CanvasImageSource & { width: number; height: number }) | undefined
    if (img && img.width && !pics.has(img)) pics.set(img, { img, w: img.width, h: img.height, x: 0, y: 0 })
    const nm = (m.material as THREE.MeshStandardMaterial).normalMap
    if (img && nm && !isFlatNormal(nm) && (nm.image as { width?: number } | undefined)?.width) normalsOf.set(img, nm.image as CanvasImageSource)
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
  for (const p of list) drawPatch(g, p, p.img, pad)
  g.fillStyle = '#ffffff'
  g.fillRect(white.x - WHITE / 2, white.y - WHITE / 2, WHITE, WHITE)
  const atlas = new THREE.CanvasTexture(canvas)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.flipY = false
  atlas.anisotropy = 4
  // (the normals' atlas: flat (128, 128, 255) where a part has none of its own)
  let normals: THREE.CanvasTexture | null = null
  if (normalsOf.size) {
    const nc = document.createElement('canvas')
    nc.width = W
    nc.height = H
    const ng = nc.getContext('2d')!
    ng.fillStyle = 'rgb(128, 128, 255)'
    ng.fillRect(0, 0, W, H)
    for (const p of list) { const n = normalsOf.get(p.img); if (n) drawPatch(ng, p, n, pad) }
    normals = new THREE.CanvasTexture(nc)
    normals.colorSpace = THREE.NoColorSpace
    normals.flipY = false
    normals.anisotropy = 4
  }
  const mat = make(atlas, normals)
  // (where the white patch is, for what's added to the figure after (a clipboard, a tray): plain colours, their UVs on it)
  mat.userData.whiteUv = [white.x / W, white.y / H]
  // (and where each picture went, to be drawn again (repaintPatch))
  mat.userData.atlas = { patches: pics, pad, canvas }
  for (const m of meshes) {
    const src = m.material as THREE.MeshStandardMaterial
    const pic = picOf(src)
    const p = pic ? pics.get(pic.image) : undefined
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
