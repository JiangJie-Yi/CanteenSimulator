import * as THREE from 'three'
import { reflectStudio } from '@/scene/studio'

/**
 * The beckoning cats' own touches (items 429, 432, the owner's, 2026-11-21: 「鈴鐺須做好，增加一些米克斯斑紋，硬幣加厚」「這招財貓的金幣背後有點怪」):
 *
 * - a bell (鈴, suzu) made as one is: round, a raised band round its middle, under it the slit across its foot ending in a round hole each
 *   end (painted, dark), a loop on its top; polished brass, the studio's light in it. One shape for every cat, set over each one's own bell
 *   (theirs a plain gold ball) at its own size;
 * - their coats marked as Taiwan's street cats' (米克斯) are, each its own way (a ginger tabby, a brown tabby saddle, black patches, a grey
 *   tabby): worked out on the cat itself (where each point of its picture lies on it, so a patch runs on across its picture's seams), on its
 *   back, its sides and the crown of its head, only where its picture is white fur (its face, collar, coin and bell left as they are);
 * - and a coin's thickness (`thicken`: a plate stood out along its thinnest way, about its middle).
 */

// ---------------------------------------------------------------------------------------------------------------------------- the bell
/** the bell's outline from its foot up, its middle at the origin (radius 1): rounding in to the hole at its foot, out to the band, the band
 * standing a little proud, up and in to its top */
const SUZU_PROF: [number, number][] = [[0.22, -0.97], [0.55, -0.83], [0.82, -0.56], [0.96, -0.22], [0.98, -0.1], [1.08, -0.08], [1.08, 0.08],
  [0.98, 0.1], [0.94, 0.3], [0.8, 0.6], [0.52, 0.86], [0.2, 0.98]]
/** its picture: brass, a little darker toward its foot, the band lit, the slit across its foot (front and back, u 0.25 and 0.75 round it)
 * ending in a round hole each end */
const SUZU_TEX = (() => {
  if (typeof document === 'undefined') return null
  const W = 256, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, '#8a6a22'); grad.addColorStop(0.45, '#d8b04a'); grad.addColorStop(0.5, '#f4d878'); grad.addColorStop(0.55, '#d8b04a'); grad.addColorStop(1, '#e8c460')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // (the slit: from the foot (v 0, the canvas's foot) up to just under the band, across the bell at u 0.25 and 0.75; a round hole at its top)
  g.fillStyle = '#1c1206'
  for (const u of [0.25, 0.75]) {
    const x = u * W
    g.fillRect(x - 4, H * 0.62, 8, H * 0.38)
    g.beginPath(); g.arc(x, H * 0.62, 8, 0, Math.PI * 2); g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
/** the bell's shape (radius 1, its middle at the origin): turned twelve round; its loop a small ring standing on its top */
export const SUZU_GEO = (() => {
  const body = new THREE.LatheGeometry(SUZU_PROF.map(([r, y]) => new THREE.Vector2(r, y)), 12)
  // (its picture's v up the outline: the lathe's own v runs along it, the foot at 0)
  const loop = new THREE.TorusGeometry(0.26, 0.085, 4, 8).translate(0, 1.18, 0)
  const uv = loop.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.9)
  const g = mergeTwo(body, loop)
  body.dispose(); loop.dispose()
  return g
})()
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const A = a.index ? a.toNonIndexed() : a, B = b.index ? b.toNonIndexed() : b
  const g = new THREE.BufferGeometry()
  for (const k of ['position', 'normal', 'uv']) {
    const x = A.attributes[k] as THREE.BufferAttribute, y = B.attributes[k] as THREE.BufferAttribute
    const arr = new Float32Array(x.array.length + y.array.length)
    arr.set(x.array as Float32Array, 0); arr.set(y.array as Float32Array, x.array.length)
    g.setAttribute(k, new THREE.BufferAttribute(arr, x.itemSize))
  }
  if (A !== a) A.dispose()
  if (B !== b) B.dispose()
  return g
}
/** its brass: the studio's light in it, both its sides (the lathe's foot is open) */
export const SUZU_MAT = (() => {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', map: SUZU_TEX, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide, envMapIntensity: 1.1 })
  reflectStudio(m)
  return m
})()
/** the bell's shape set at `at`, `r` its radius (a copy, its own) */
export function suzuAt(at: THREE.Vector3, r: number) {
  return SUZU_GEO.clone().scale(r, r, r).translate(at.x, at.y, at.z)
}

// ---------------------------------------------------------------------------------------------------------------------------- the coin
/** a plate made thicker: stood out `k` times along its thinnest way about its middle (its box's) */
export function thicken(g: THREE.BufferGeometry, k: number) {
  g.computeBoundingBox()
  const b = g.boundingBox!, size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3())
  const axis = size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const v = p.getComponent(i, axis)
    p.setComponent(i, axis, (axis === 0 ? c.x : axis === 1 ? c.y : c.z) + (v - (axis === 0 ? c.x : axis === 1 ? c.y : c.z)) * k)
  }
  p.needsUpdate = true
  g.computeVertexNormals()
  g.boundingBox = null
  g.boundingSphere = null
  g.computeBoundingSphere()
  return g
}

// ---------------------------------------------------------------------------------------------------------------------------- the coats
export type Coat = 'ginger' | 'saddle' | 'tux' | 'grey'
/** a hash's value noise in three dimensions, smooth, 0..1 */
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const h = (a: number, b: number, c: number) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return n - Math.floor(n) }
  const u = s(xf), v = s(yf), w = s(zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w)
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/**
 * What the coat is at a point of the cat (its own frame: y up from its feet, +z its front; `u` 0 at its feet .. 1 its crown, `side` -1..1
 * across, the surface's normal `n`, `p` the point in the cat's heights): a colour and how much of it
 */
function coatAt(coat: Coat, u: number, side: number, n: THREE.Vector3, p: THREE.Vector3, out: [number, number, number, number]) {
  // (where a coat shows from the front too, as on a street cat seen face on: its crown and forehead (from a little over its eyes up), its
  // sides, its shoulders and its back; its muzzle, chest and belly kept white (facing front, low on its head and below))
  const crown = smooth(0.66, 0.76, u)
  const back = smooth(0.3, -0.2, n.z) * smooth(0.12, 0.3, u)
  const sides = smooth(0.45, 0.8, Math.abs(n.x)) * smooth(0.2, 0.4, u) * smooth(0.85, 0.6, u)
  const where = Math.min(1, Math.max(crown, back, sides))
  const f = 7
  const nz = vnoise(p.x * f + 3.1, p.y * f + 7.7, p.z * f + 1.3)
  const fine = vnoise(p.x * 19 + 1.7, p.y * 19 + 4.1, p.z * 19 + 8.3)
  if (coat === 'ginger') {
    // (a ginger tabby: ginger over its crown, its sides and back, darker stripes round it wavering; on its forehead the stripes run up it)
    const stripe = 0.5 + 0.5 * Math.sin((crown > 0.5 ? p.x * 46 : u * 34) + nz * 3.2 + fine * 1.5)
    const k = smooth(0.2, 0.42, where + (nz - 0.5) * 0.45)
    const st = smooth(0.55, 0.8, stripe)
    out[0] = 0.88 - 0.26 * st; out[1] = 0.56 - 0.22 * st; out[2] = 0.26 - 0.12 * st; out[3] = k
  } else if (coat === 'saddle') {
    // (a brown tabby cap over its crown and ears and a saddle down its back, its sides white: 白底虎斑)
    const cap = smooth(0.7, 0.78, u + (nz - 0.5) * 0.08)
    const saddle = back * smooth(0.45, 0.6, nz + 0.25)
    const stripe = smooth(0.6, 0.85, 0.5 + 0.5 * Math.sin((cap > 0.5 ? p.x * 42 : u * 30) + nz * 2.6 + fine))
    out[0] = 0.58 - 0.3 * stripe; out[1] = 0.47 - 0.26 * stripe; out[2] = 0.37 - 0.2 * stripe; out[3] = Math.max(cap, saddle)
  } else if (coat === 'tux') {
    // (black patches, ragged: one over its right ear and eye (as so many street cats have), one over its back, a few spots on its sides)
    const eye = smooth(0.0, 0.25, side + (nz - 0.5) * 0.3) * smooth(0.6, 0.7, u + (fine - 0.5) * 0.05)
    const patch = smooth(0.52, 0.58, nz + back * 0.35 - 0.1) * Math.max(back, sides * 0.7)
    out[0] = 0.11; out[1] = 0.1; out[2] = 0.11; out[3] = Math.max(eye, patch)
  } else {
    // (a grey tabby: grey over its crown, its sides and back, dark stripes; its forehead's stripes run up it, as a tabby's M)
    const stripe = smooth(0.56, 0.8, 0.5 + 0.5 * Math.sin((crown > 0.5 ? p.x * 48 : u * 32 - side * 0.8) + nz * 3 + fine * 1.4))
    const k = smooth(0.22, 0.45, where + (nz - 0.5) * 0.5)
    out[0] = 0.62 - 0.32 * stripe; out[1] = 0.6 - 0.32 * stripe; out[2] = 0.57 - 0.3 * stripe; out[3] = k
  }
}
const coated = new Map<string, THREE.Texture>()
/**
 * The cat's picture with its coat worked on (made once for a picture and a coat): each triangle of its parts that are on this picture laid
 * out in the picture (a mask of MASK across), each point of it found on the cat (its place and its normal, in the cat's own frame, `box` its
 * extent there), the coat worked out there; then laid over the picture where the picture is white fur, the mask spread a few points out past
 * its triangles so it runs on over their seams
 */
export function coatPicture(tex: THREE.Texture, parts: THREE.BufferGeometry[], box: THREE.Box3, coat: Coat): THREE.Texture {
  const key = `${tex.uuid}|${coat}`
  const hit = coated.get(key)
  if (hit) return hit
  const img = tex.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img || typeof document === 'undefined' || !img.width) return tex
  const M = 512
  const col = new Float32Array(M * M * 3), alpha = new Float32Array(M * M)
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3())
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3()
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3(), n = new THREE.Vector3()
  const out: [number, number, number, number] = [0, 0, 0, 0]
  for (const g of parts) {
    const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute
    if (!uv || !nor) continue
    const idx = g.index
    const tris = (idx ? idx.count : pos.count) / 3
    for (let t = 0; t < tris; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      const x0 = uv.getX(i0) * M, y0 = uv.getY(i0) * M, x1 = uv.getX(i1) * M, y1 = uv.getY(i1) * M, x2 = uv.getX(i2) * M, y2 = uv.getY(i2) * M
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
      if (Math.abs(den) < 1e-9) continue
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2)
      na.fromBufferAttribute(nor, i0); nb.fromBufferAttribute(nor, i1); nc.fromBufferAttribute(nor, i2)
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(M - 1, Math.ceil(Math.max(x0, x1, x2)))
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(M - 1, Math.ceil(Math.max(y0, y1, y2)))
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5
          const w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den
          const w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den
          const w2 = 1 - w0 - w1
          if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue
          p.set(0, 0, 0).addScaledVector(a, w0).addScaledVector(b, w1).addScaledVector(c, w2)
          n.set(0, 0, 0).addScaledVector(na, w0).addScaledVector(nb, w1).addScaledVector(nc, w2).normalize()
          const u = (p.y - box.min.y) / (size.y || 1), side = (p.x - mid.x) / (size.x / 2 || 1)
          coatAt(coat, u, side, n, p.clone().sub(box.min).divideScalar(size.y || 1), out)
          const k = y * M + x
          if (out[3] > alpha[k]) { alpha[k] = out[3]; col[k * 3] = out[0]; col[k * 3 + 1] = out[1]; col[k * 3 + 2] = out[2] }
        }
      }
    }
  }
  // (spread out two points past the triangles' edges, so no seam shows a line of white)
  for (let pass = 0; pass < 2; pass++) {
    const a2 = alpha.slice(), c2 = col.slice()
    for (let y = 1; y < M - 1; y++) for (let x = 1; x < M - 1; x++) {
      const k = y * M + x
      if (alpha[k] > 0) continue
      for (const d of [1, -1, M, -M]) if (alpha[k + d] > a2[k]) { a2[k] = alpha[k + d]; c2[k * 3] = col[(k + d) * 3]; c2[k * 3 + 1] = col[(k + d) * 3 + 1]; c2[k * 3 + 2] = col[(k + d) * 3 + 2] }
    }
    alpha.set(a2); col.set(c2)
  }
  const W = img.width, H = img.height
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g2 = cv.getContext('2d', { willReadFrequently: true })!
  g2.drawImage(img, 0, 0)
  const data = g2.getImageData(0, 0, W, H)
  const d = data.data
  // (the picture's rows as the texture reads them: its v from the top when it isn't flipped (glTF's))
  const flip = tex.flipY
  for (let y = 0; y < H; y++) {
    const my = Math.min(M - 1, Math.floor(((flip ? H - 1 - y : y) + 0.5) / H * M))
    for (let x = 0; x < W; x++) {
      const k = my * M + Math.min(M - 1, Math.floor((x + 0.5) / W * M))
      const al = alpha[k]
      if (al <= 0.01) continue
      const o = (y * W + x) * 4
      const r = d[o] / 255, gg = d[o + 1] / 255, bb = d[o + 2] / 255
      // (white fur only: light, and hardly coloured)
      const hi = Math.max(r, gg, bb), lo = Math.min(r, gg, bb)
      const fur = smooth(0.62, 0.78, lo) * smooth(0.2, 0.08, hi - lo)
      const m = al * fur
      if (m <= 0.01) continue
      // (the fur's own shading kept: the coat's colour times how bright the fur is there)
      const shade = Math.min(1, hi / 0.92)
      d[o] = Math.round(255 * (r * (1 - m) + col[k * 3] * shade * m))
      d[o + 1] = Math.round(255 * (gg * (1 - m) + col[k * 3 + 1] * shade * m))
      d[o + 2] = Math.round(255 * (bb * (1 - m) + col[k * 3 + 2] * shade * m))
    }
  }
  g2.putImageData(data, 0, 0)
  const t = new THREE.CanvasTexture(cv)
  t.flipY = tex.flipY
  t.colorSpace = tex.colorSpace
  t.wrapS = tex.wrapS
  t.wrapT = tex.wrapT
  t.anisotropy = tex.anisotropy
  t.userData.coatOf = tex
  coated.set(key, t)
  return t
}
/** whether the coats are worked out as the cats load: only for scripts/bake-cat-coats.mjs (the page opened with ?bakecoats, in development);
 * the models' pictures carry them already (baked, item 429: a tenth of a second a picture on the page's thread, nine of them) */
export const BAKE_COATS = !!import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('bakecoats')
// (in development, the coats worked out, for scripts/bake-cat-coats.mjs to write into the models' pictures)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __coats?: Map<string, THREE.Texture> }).__coats = coated
