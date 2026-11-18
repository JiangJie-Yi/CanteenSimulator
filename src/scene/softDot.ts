import * as THREE from 'three'

/**
 * A round dot for point particles (item 242: the sparks, the ash and the seasonings' grains were drawn as squares, the ash as 5 cm grey
 * tiles over the fire): white, its alpha solid through the middle and falling off smoothly to nothing at the rim. One for the shop, made at
 * load; a material takes it as its `map` (its colours and alpha from the points' own).
 */
export const SOFT_DOT = (() => {
  if (typeof document === 'undefined') return null
  const n = 32, c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const img = g.createImageData(n, n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const r = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2
    const a = Math.max(0, Math.min(1, (1 - r) / 0.45))
    const i = (y * n + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
    img.data[i + 3] = Math.round(255 * a * a * (3 - 2 * a))
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
