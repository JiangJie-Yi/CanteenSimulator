// No picture held finer than the machine can afford (the owner's: on a Mac with 8 GB, whose graphics share the memory, the shop's pictures
// came to some 740 MB and the GPU process gave up). Before a texture is first uploaded, a picture larger than the cap on either side is
// drawn into a canvas scaled to fit and used in its place: on a Mac or a laptop on its battery 512, elsewhere 1024 (`?tex=<px>` in the
// address to try another). A picture the game paints into its own canvas and repaints later (a sign once its font's in, the shop's day
// and night) keeps its full canvas aside, and each time it's marked changed it's drawn into the small one again.
import * as THREE from 'three'
import { isMac } from '@/game/navInput'
import { lowPower } from './power'

const asked = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('tex')) : 0
const onMac = typeof navigator !== 'undefined' && isMac(navigator.platform, navigator.userAgent)
/** the largest side a picture's held at */
export const texCap = () => asked > 0 ? asked : (onMac || lowPower()) ? 512 : 1024

type Picture = HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLImageElement
const isPicture = (x: unknown): x is Picture => (typeof HTMLCanvasElement !== 'undefined' && x instanceof HTMLCanvasElement)
  || (typeof OffscreenCanvas !== 'undefined' && x instanceof OffscreenCanvas)
  || (typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap)
  || (typeof HTMLImageElement !== 'undefined' && x instanceof HTMLImageElement && x.complete && x.naturalWidth > 0)
const sizeOf = (p: Picture) => p instanceof HTMLImageElement ? [p.naturalWidth, p.naturalHeight] : [p.width, p.height]

const done = new WeakSet<object>()
const needsUpdate = Object.getOwnPropertyDescriptor(THREE.Texture.prototype, 'needsUpdate')!.set!

function shrink(full: Picture, small: HTMLCanvasElement) {
  const g = small.getContext('2d')!
  g.clearRect(0, 0, small.width, small.height)
  g.imageSmoothingQuality = 'high'
  g.drawImage(full as CanvasImageSource, 0, 0, small.width, small.height)
}

/** the texture's picture brought within the cap (once per picture) */
export function capTexture(t: THREE.Texture | null | undefined) {
  if (!t || !t.isTexture || (t as THREE.DataTexture).isDataTexture || (t as THREE.CubeTexture).isCubeTexture || t.isRenderTargetTexture) return
  const src = t.source
  if (done.has(src)) return
  const full = src.data
  if (!isPicture(full)) return
  done.add(src)
  const [w, h] = sizeOf(full)
  const cap = texCap()
  if (w <= cap && h <= cap) return
  const k = cap / Math.max(w, h)
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round(w * k))
  small.height = Math.max(1, Math.round(h * k))
  shrink(full, small)
  // (a bitmap is uploaded as it is, whatever flipY says; a canvas would be flipped: kept as the bitmap was)
  if (typeof ImageBitmap !== 'undefined' && full instanceof ImageBitmap) t.flipY = false
  src.data = small
  src.needsUpdate = true
  // (the game's own canvas, repainted later: each time it's marked changed, drawn into the small one again)
  if (!(full instanceof ImageBitmap) && !(full instanceof HTMLImageElement)) {
    Object.defineProperty(t, 'needsUpdate', {
      configurable: true,
      set(v: boolean) { if (v) shrink(full, small); needsUpdate.call(this, v) },
    })
  }
}

const SLOTS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'bumpMap', 'lightMap', 'specularMap',
  'displacementMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'iridescenceMap',
  'transmissionMap', 'thicknessMap', 'anisotropyMap', 'specularColorMap', 'specularIntensityMap'] as const

/** every picture a material draws with, the shader's own uniforms too */
export function capMaterial(m: THREE.Material) {
  const a = m as unknown as Record<string, unknown>
  for (const k of SLOTS) capTexture(a[k] as THREE.Texture)
  const u = (m as THREE.ShaderMaterial).uniforms
  if (u) for (const key in u) capTexture(u[key]?.value as THREE.Texture)
}
