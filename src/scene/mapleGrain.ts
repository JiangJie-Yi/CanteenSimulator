import * as THREE from 'three'

/**
 * Pale maple (or birch) plywood for the counters, after the reference: a warm cream ground, broad "cathedral" arches in
 * the grain drawn as fine orange contour lines, and a faint fine streaking along the boards. Made once, tileable both ways,
 * the grain running along x.
 */
let made: THREE.CanvasTexture | null | undefined
export function mapleTexture() {
  if (made !== undefined) return made
  if (typeof document === 'undefined') return (made = null)
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const img = g.createImageData(S, S)
  const TAU = Math.PI * 2
  // (periodic, so the tile has no seam: whole-number waves across it)
  const warp = (x: number, y: number) => {
    const u = (x / S) * TAU, v = (y / S) * TAU
    return 0.9 * Math.sin(u + 0.7 * Math.sin(v * 2 + 1.3)) + 0.55 * Math.sin(2 * u + v + 2.1) + 0.3 * Math.sin(3 * u - 2 * v + 0.4)
  }
  const streak = (x: number, y: number) => {
    const u = (x / S) * TAU, v = (y / S) * TAU
    return Math.sin(v * 37 + 2 * Math.sin(u * 3)) * 0.5 + Math.sin(v * 61 + u * 2) * 0.5
  }
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // (the grain's own field: rows of arches; its lines are where the field crosses a whole number)
      const f = (y / S) * 6 + warp(x, y) * 0.55
      const d = Math.abs(f - Math.round(f))
      const line = Math.max(0, 1 - d / 0.07)
      const fine = streak(x, y)
      let r = 244 - fine * 6, gg = 214 - fine * 7, b = 172 - fine * 9
      const k = line * line * 0.5
      r = r * (1 - k) + 226 * k
      gg = gg * (1 - k) + 160 * k
      b = b * (1 - k) + 104 * k
      // (a little broad mottling)
      const m = Math.sin((x / S) * TAU * 2 + Math.sin((y / S) * TAU * 3)) * 3
      const i = (y * S + x) * 4
      img.data[i] = r + m
      img.data[i + 1] = gg + m
      img.data[i + 2] = b + m
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return (made = t)
}
