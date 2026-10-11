import * as THREE from 'three'

/*
 * Cloth for the customers' clothes, drawn on a small canvas and tiled: a business suit's pinstripe, a flannel shirt's
 * plaid, a child's striped tee, the yukata's hemp-leaf (麻の葉) and its flowers, an aloha shirt's hibiscus, a
 * cardigan's little flowers, a knit's ribs, a sailor skirt's pleats. Each is drawn in the colour of the garment, so
 * the material over it stays white. (Made once per pattern and colour.)
 */
export type Pattern = 'pinstripe' | 'glen' | 'plaid' | 'border' | 'asanoha' | 'hibiscus' | 'floret' | 'knit' | 'pleats'

const cache = new Map<string, THREE.Texture>()

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)))
  return `#${c.getHexString()}`
}

function draw(p: Pattern, base: string, g: CanvasRenderingContext2D, S: number) {
  g.fillStyle = base
  g.fillRect(0, 0, S, S)
  const dark = shade(base, -0.12), light = shade(base, 0.18)
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, c: string) => {
    g.strokeStyle = c
    g.lineWidth = w
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  switch (p) {
    case 'pinstripe':
      for (let x = 8; x < S; x += 16) line(x, 0, x, S, 1.4, light)
      break
    case 'glen':
      // a fine check, two tones crossing
      for (let k = 0; k < S; k += 8) {
        line(k, 0, k, S, k % 32 === 0 ? 2.5 : 1, dark)
        line(0, k, S, k, k % 32 === 0 ? 2.5 : 1, dark)
      }
      break
    case 'plaid': {
      // flannel: broad bands of a darker tone both ways, a thin pale line through them
      g.globalAlpha = 0.45
      g.fillStyle = dark
      g.fillRect(0, 0, S, S * 0.35)
      g.fillRect(0, 0, S * 0.35, S)
      g.globalAlpha = 1
      line(0, S * 0.65, S, S * 0.65, 3, light)
      line(S * 0.65, 0, S * 0.65, S, 3, light)
      line(0, S * 0.17, S, S * 0.17, 1.5, '#1c1c1c')
      line(S * 0.17, 0, S * 0.17, S, 1.5, '#1c1c1c')
      break
    }
    case 'border':
      // a striped tee: white bands
      g.fillStyle = '#f6f3ea'
      for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 14)
      break
    case 'asanoha': {
      // hemp-leaf: six-pointed stars of fine white lines on a triangle grid
      const h = S / 4
      g.strokeStyle = 'rgba(255,255,255,0.75)'
      g.lineWidth = 1.4
      for (let j = 0; j <= 4; j++) {
        for (let i = 0; i <= 4; i++) {
          const cx = i * h + (j % 2 ? h / 2 : 0), cy = j * h
          for (let a = 0; a < 6; a++) {
            const t = (a / 6) * Math.PI * 2
            g.beginPath()
            g.moveTo(cx, cy)
            g.lineTo(cx + Math.cos(t) * h * 0.58, cy + Math.sin(t) * h * 0.58)
            g.stroke()
          }
        }
      }
      // and a scatter of flowers over it
      for (const [x, y] of [[0.25, 0.3], [0.75, 0.75], [0.7, 0.2]]) flower(g, x * S, y * S, S * 0.09, '#f4efe2', '#e8c45a')
      break
    }
    case 'hibiscus':
      for (const [x, y, r] of [[0.28, 0.3, 0.16], [0.78, 0.7, 0.14], [0.8, 0.15, 0.08], [0.2, 0.82, 0.09]]) {
        flower(g, x * S, y * S, r * S, '#f4efe2', '#e85a3a', 5, 0.5)
      }
      // leaves between
      g.fillStyle = shade(base, 0.12)
      for (const [x, y, a] of [[0.55, 0.42, 0.6], [0.45, 0.62, -0.8], [0.05, 0.5, 1.4]]) {
        g.save()
        g.translate(x * S, y * S)
        g.rotate(a)
        g.beginPath()
        g.ellipse(0, 0, S * 0.1, S * 0.035, 0, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
      break
    case 'floret':
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        flower(g, (i + (j % 2) * 0.5 + 0.25) * S / 4, (j + 0.5) * S / 4, S * 0.04, light, '#d8a040')
      }
      break
    case 'knit':
      // ribs, and a cable twisting down the middle
      for (let x = 0; x < S; x += 8) line(x, 0, x, S, 2, dark)
      g.strokeStyle = light
      g.lineWidth = 3
      for (let y = 0; y < S; y += 24) {
        g.beginPath()
        g.moveTo(S * 0.4, y)
        g.bezierCurveTo(S * 0.6, y + 6, S * 0.6, y + 18, S * 0.4, y + 24)
        g.stroke()
      }
      break
    case 'pleats':
      for (let x = 0; x < S; x += 16) {
        g.fillStyle = dark
        g.fillRect(x, 0, 5, S)
        line(x + 5, 0, x + 5, S, 1, light)
      }
      break
  }
}

/** a flower of n round petals, with a centre */
function flower(g: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, middle: string, n = 5, size = 0.45) {
  g.fillStyle = petal
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2
    g.beginPath()
    g.arc(x + Math.cos(t) * r * 0.55, y + Math.sin(t) * r * 0.55, r * size, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = middle
  g.beginPath()
  g.arc(x, y, r * 0.25, 0, Math.PI * 2)
  g.fill()
}

/** the cloth, tiled so many times round and up the garment */
export function cloth(p: Pattern, base: string, repeat: [number, number]): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const key = `${p}|${base}|${repeat.join('x')}`
  let t = cache.get(key)
  if (!t) {
    const S = 128
    const c = document.createElement('canvas')
    c.width = c.height = S
    draw(p, base, c.getContext('2d')!, S)
    t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(...repeat)
    t.anisotropy = 4
    cache.set(key, t)
  }
  return t
}
