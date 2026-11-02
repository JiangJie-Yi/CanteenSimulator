/**
 * A normal map from a height picture (a canvas painted in greys: lighter is higher), for what's painted rather than modelled to look raised
 * and sunk in the light (a stamped coin's characters, a hammered face's fine lines): each pixel's slope from its neighbours either side,
 * `strength` how steep a full step from black to white is. The canvas it's drawn into, the same size.
 */
export function normalFromHeight(h: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const w = h.width, hh = h.height
  const src = h.getContext('2d')!.getImageData(0, 0, w, hh).data
  const out = document.createElement('canvas')
  out.width = w
  out.height = hh
  const g = out.getContext('2d')!
  const img = g.createImageData(w, hh)
  const d = img.data
  const at = (x: number, y: number) => src[(Math.min(hh - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4] / 255
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      // (the slope across and down the picture; its rows run down the model's v, as a glTF model's pictures are read)
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      d[i] = (-dx / l * 0.5 + 0.5) * 255
      d[i + 1] = (dy / l * 0.5 + 0.5) * 255
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return out
}
