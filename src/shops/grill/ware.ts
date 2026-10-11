// The shop's tableware, painted: one set of 染付 (indigo on cream) for every plate and dish at the grill — the big
// plate, the side dishes and the customers' plates at the bar — and the lathe shape with its picture laid flat.
import * as THREE from 'three'
import { QUALITY } from '@/scene/quality'

/** phones have little GPU memory: the big painted textures are drawn at full size, then handed over at half */
export function forPhone(c: HTMLCanvasElement) {
  const max = QUALITY.canvasMax
  if (c.width <= max && c.height <= max) return c
  const k = max / Math.max(c.width, c.height)
  const out = document.createElement('canvas')
  out.width = Math.round(c.width * k)
  out.height = Math.round(c.height * k)
  out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height)
  return out
}

/**
 * Painted ware in the 染付 manner, as a top-down picture for a plate or dish: indigo on a warm cream glaze. A
 * patterned rim band between fine double lines (青海波 waves on the plate, 雷紋 key-fret on the dish), and in the
 * well a motif drawn the way a painter does it, a dark outline (骨描き) filled with a paler indigo wash (濃み):
 * a stand of bamboo with node rings, tapering brush leaves, ground grass and a cloud (竹), or a gnarled plum
 * branch with outlined blossoms, stamens, buds and a few falling petals (梅). The glaze has faint iron specks and
 * a fine crackle.
 */
function wareTexture(motif: 'bamboo' | 'plum' | 'cloud') {
  if (typeof document === 'undefined') return null
  const S = 1536
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const ink = '#24427f'
  const wash = 'rgba(58, 96, 170, 0.42)'
  // (濃淡: a deeper wash for what's near, a paler one for what's far)
  const deep = 'rgba(38, 70, 140, 0.62)'
  const pale = 'rgba(80, 118, 190, 0.22)'
  const cx = S / 2
  const cy = S / 2
  let seed = motif === 'bamboo' ? 7 : motif === 'plum' ? 13 : 29
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

  // glaze: warm cream, a little uneven, with iron specks and a faint crackle
  const glaze = g.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.5)
  glaze.addColorStop(0, '#f6f1e6')
  glaze.addColorStop(1, '#ece4d3')
  g.fillStyle = glaze
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${90 + rnd() * 40}, ${70 + rnd() * 20}, 50, ${0.15 + rnd() * 0.35})`
    g.beginPath()
    g.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 1.6, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = 'rgba(120, 104, 80, 0.12)'
  g.lineWidth = 0.8
  for (let i = 0; i < 70; i++) {
    let x = rnd() * S
    let y = rnd() * S
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 60
      y += (rnd() - 0.5) * 60
      g.lineTo(x, y)
    }
    g.stroke()
  }

  const ring = (r: number, w: number) => {
    g.strokeStyle = ink
    g.lineWidth = w
    g.beginPath()
    g.arc(cx, cy, r * S, 0, Math.PI * 2)
    g.stroke()
  }
  /** a brush stroke along a path, thick at the start and tapering to the end */
  const stroke = (pts: [number, number][], w0: number, w1: number, color = ink) => {
    const left: [number, number][] = []
    const right: [number, number][] = []
    pts.forEach(([x, y], i) => {
      const [ax, ay] = pts[Math.max(0, i - 1)]
      const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
      const len = Math.hypot(bx - ax, by - ay) || 1
      const nx = -(by - ay) / len
      const ny = (bx - ax) / len
      const w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2
      left.push([x + nx * w, y + ny * w])
      right.push([x - nx * w, y - ny * w])
    })
    g.fillStyle = color
    g.beginPath()
    g.moveTo(...left[0])
    for (const p of left.slice(1)) g.lineTo(...p)
    for (const p of right.reverse()) g.lineTo(...p)
    g.closePath()
    g.fill()
  }
  /** a leaf: a pointed brush shape from its base toward `ang`, washed, then its outline and midrib inked */
  const leaf = (x: number, y: number, ang: number, len: number, wid: number) => {
    g.save()
    g.translate(x, y)
    g.rotate(ang)
    g.beginPath()
    g.moveTo(0, 0)
    g.quadraticCurveTo(len * 0.35, -wid, len, 0)
    g.quadraticCurveTo(len * 0.35, wid * 0.9, 0, 0)
    g.fillStyle = wash
    g.fill()
    g.strokeStyle = ink
    g.lineWidth = 3.2
    g.stroke()
    g.lineWidth = 1.8
    g.beginPath()
    g.moveTo(len * 0.05, 0)
    g.quadraticCurveTo(len * 0.5, -wid * 0.12, len * 0.92, 0)
    g.stroke()
    // the deeper wash down one half, and fine veins off the midrib
    g.fillStyle = deep
    g.beginPath()
    g.moveTo(len * 0.05, 0)
    g.quadraticCurveTo(len * 0.35, -wid * 0.9, len * 0.95, 0)
    g.quadraticCurveTo(len * 0.5, -wid * 0.1, len * 0.05, 0)
    g.fill()
    g.lineWidth = 0.9
    for (let k = 1; k < 5; k++) {
      const x = len * (0.15 + k * 0.16)
      g.beginPath()
      g.moveTo(x, -wid * 0.04)
      g.lineTo(x + len * 0.08, -wid * 0.42 * (1 - k * 0.15))
      g.stroke()
    }
    g.restore()
  }

  // rim: a broad band between fine double lines, filled with the border pattern
  const R0 = 0.4
  const R1 = 0.47
  ring(0.478, 3)
  ring(R1, 6)
  ring(R0, 4)
  ring(R0 - 0.012, 1.6)
  g.save()
  g.beginPath()
  g.arc(cx, cy, R1 * S - 3, 0, Math.PI * 2)
  g.arc(cx, cy, R0 * S + 2, 0, Math.PI * 2, true)
  g.clip()
  g.fillStyle = 'rgba(58, 96, 170, 0.16)'
  g.fillRect(0, 0, S, S)
  g.strokeStyle = ink
  {
    // 青海波: rows of nested fan-shaped arcs, the waves overlapping all round the rim (the same on every piece)
    const n = 56
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < n; k++) {
        const a = ((k + row * 0.5) / n) * Math.PI * 2
        const rr = (R0 + 0.01 + row * 0.022) * S
        const x = cx + Math.cos(a) * rr
        const y = cy + Math.sin(a) * rr
        // (each wave washed behind its arcs, so the rows read as overlapping scales)
        g.fillStyle = row % 2 ? pale : 'rgba(58, 96, 170, 0.12)'
        g.beginPath()
        g.arc(x, y, 4 * S / 1024 * 9 * 0.95, a + Math.PI, a + Math.PI * 2)
        g.fill()
        for (let q = 4; q >= 1; q--) {
          g.lineWidth = (q === 4 ? 2.4 : 1.3) * S / 1024
          g.beginPath()
          g.arc(x, y, q * 7.5 * S / 1024, a + Math.PI * 1.0, a + Math.PI * 2.0)
          g.stroke()
        }
      }
    }
  }
  g.restore()
  // 口紅: the lip glazed iron-brown, the way good 染付 is finished
  g.strokeStyle = 'rgba(120, 70, 40, 0.75)'
  g.lineWidth = 9 * S / 1024
  g.beginPath()
  g.arc(cx, cy, 0.494 * S, 0, Math.PI * 2)
  g.stroke()
  // a fine dotted line just inside the band
  g.fillStyle = ink
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2
    g.beginPath()
    g.arc(cx + Math.cos(a) * (R0 - 0.026) * S, cy + Math.sin(a) * (R0 - 0.026) * S, 1.8, 0, Math.PI * 2)
    g.fill()
  }

  if (motif === 'bamboo') {
    // a cloud drifting top right, in the wash with an inked edge
    g.save()
    g.translate(S * 0.64, S * 0.26)
    g.scale(1.7, 1.7)
    g.fillStyle = wash
    g.strokeStyle = ink
    g.lineWidth = 2
    for (const [x, y, r] of [[0, 0, 26], [30, -8, 22], [56, 2, 18], [24, 14, 20]] as [number, number, number][]) {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
    g.restore()
    // ground: a low bank with grass tufts
    stroke([[S * 0.24, S * 0.765], [S * 0.4, S * 0.745], [S * 0.56, S * 0.755], [S * 0.74, S * 0.775]], 10, 2.5)
    for (let k = 0; k < 20; k++) {
      const x = S * (0.26 + k * 0.024)
      const y = S * (0.758 - Math.sin(k) * 0.006)
      stroke([[x, y], [x + (rnd() - 0.5) * 26, y - 26 - rnd() * 24]], 5, 0.8)
    }
    // far off, a pale stand of bamboo in a light wash, no outline (it reads as mist and distance)
    for (const [x0, lean, h] of [[0.62, -0.03, 0.5], [0.68, 0.02, 0.42], [0.3, 0.04, 0.44]]) {
      g.save()
      g.strokeStyle = pale
      g.lineWidth = 12 * S / 1024
      g.beginPath()
      g.moveTo(S * x0, S * 0.76)
      g.lineTo(S * (x0 + lean), S * (0.76 - h))
      g.stroke()
      g.restore()
      for (let q = 0; q < 6; q++) {
        const yy = S * (0.76 - h * (0.4 + q * 0.1))
        g.save()
        g.translate(S * (x0 + lean * (0.4 + q * 0.1)), yy)
        g.rotate((q % 2 ? -0.5 : Math.PI + 0.5) + (rnd() - 0.5) * 0.4)
        g.fillStyle = pale
        g.beginPath()
        g.moveTo(0, 0)
        g.quadraticCurveTo(30 * S / 1024, -10 * S / 1024, 70 * S / 1024, 0)
        g.quadraticCurveTo(30 * S / 1024, 9 * S / 1024, 0, 0)
        g.fill()
        g.restore()
      }
    }
    // three stalks, each its own thickness and lean, with node rings and short side twigs
    for (const [x0, lean, h, w] of [[0.44, 0.06, 0.52, 32], [0.57, -0.06, 0.46, 25], [0.33, 0.11, 0.36, 18]]) {
      const bx = S * x0
      const by = S * 0.755
      const tx = bx + S * lean
      const ty = by - S * h
      // the stalk washed pale, inked down both edges
      g.save()
      g.lineCap = 'butt'
      g.strokeStyle = wash
      g.lineWidth = w
      g.beginPath()
      g.moveTo(bx, by)
      g.lineTo(tx, ty)
      g.stroke()
      g.restore()
      const len = Math.hypot(tx - bx, ty - by)
      const nx = -(ty - by) / len
      const ny = (tx - bx) / len
      for (const sd of [-1, 1]) {
        stroke([[bx + nx * sd * w / 2, by + ny * sd * w / 2], [tx + nx * sd * w * 0.35, ty + ny * sd * w * 0.35]], 4.5, 2.2)
      }
      const nodes = 4 + Math.round(h * 4)
      for (let k = 1; k < nodes; k++) {
        const t = k / nodes
        const jx = bx + (tx - bx) * t
        const jy = by + (ty - by) * t
        const ww = w * (1 - t * 0.5) * 0.75
        stroke([[jx - nx * ww, jy - ny * ww - 3], [jx, jy + 3], [jx + nx * ww, jy + ny * ww - 3]], 6, 3.5)
        if (k > 1 && k % 2 === 0) {
          // a twig off the node, and a fan of leaves at its end
          const sd = k % 4 === 0 ? 1 : -1
          const ex = jx + sd * S * 0.09
          const ey = jy - S * 0.045
          stroke([[jx, jy], [jx + sd * S * 0.045, jy - S * 0.026], [ex, ey]], 5, 2)
          for (let q = 0; q < 5; q++) {
            const ang = (sd > 0 ? -0.25 : Math.PI + 0.25) + sd * (q - 1.8) * 0.4 + (rnd() - 0.5) * 0.2
            leaf(ex, ey, ang, 80 + rnd() * 40, 15 + rnd() * 4)
          }
        }
      }
      // leaves at the top of the stalk
      for (let q = 0; q < 4; q++) leaf(tx, ty, -Math.PI / 2 + (q - 1.5) * 0.5 + lean, 84 + rnd() * 30, 15)
    }
  } else if (motif === 'cloud') {
    // 瑞雲: auspicious clouds drifting across the well, each a curling head with a long trailing tail, in the
    // deep and pale washes, outlined; and a line of geese flying over
    const cloud = (x: number, y: number, k: number, flip: number) => {
      g.save()
      g.translate(x, y)
      g.scale(flip * k, k)
      // the tail, a long tapering band
      g.fillStyle = pale
      g.strokeStyle = ink
      g.lineWidth = 3 / k
      g.beginPath()
      g.moveTo(-10, 18)
      g.bezierCurveTo(-90, 26, -170, 10, -260, 28)
      g.bezierCurveTo(-170, 0, -90, -8, -10, -14)
      g.closePath()
      g.fill()
      g.stroke()
      // the head: three curls, each a spiral
      for (const [hx, hy, r] of [[0, 0, 34], [44, -14, 28], [78, 4, 22]] as [number, number, number][]) {
        g.fillStyle = wash
        g.beginPath()
        g.arc(hx, hy, r, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        g.beginPath()
        for (let q = 0; q <= 40; q++) {
          const a = q * 0.35
          const rr = r * (0.85 - q * 0.019)
          const px = hx + Math.cos(a) * rr
          const py = hy + Math.sin(a) * rr
          if (q) g.lineTo(px, py)
          else g.moveTo(px, py)
        }
        g.stroke()
      }
      g.restore()
    }
    cloud(S * 0.62, S * 0.36, 1.25, 1)
    cloud(S * 0.42, S * 0.56, 1.05, -1)
    cloud(S * 0.66, S * 0.7, 0.85, 1)
    // geese, three V shapes going off up to the left
    g.strokeStyle = ink
    g.lineWidth = 3.2
    for (const [x, y, k] of [[0.34, 0.3, 1], [0.27, 0.36, 0.85], [0.4, 0.4, 0.75]] as [number, number, number][]) {
      g.beginPath()
      g.moveTo(S * x - 26 * k, S * y - 8 * k)
      g.quadraticCurveTo(S * x - 10 * k, S * y - 14 * k, S * x, S * y)
      g.quadraticCurveTo(S * x + 12 * k, S * y - 16 * k, S * x + 30 * k, S * y - 12 * k)
      g.stroke()
    }
  } else {
    // the branch: a thick gnarled bough from lower left, one twig forking up, one out to the right
    stroke([[S * 0.2, S * 0.74], [S * 0.3, S * 0.66], [S * 0.36, S * 0.6], [S * 0.47, S * 0.55], [S * 0.6, S * 0.46],
      [S * 0.76, S * 0.38]], 36, 7)
    stroke([[S * 0.36, S * 0.6], [S * 0.37, S * 0.5], [S * 0.33, S * 0.4], [S * 0.36, S * 0.3]], 18, 4)
    stroke([[S * 0.52, S * 0.52], [S * 0.6, S * 0.56], [S * 0.7, S * 0.57]], 13, 3.5)
    // a thin new moon behind the branch, in the pale wash
    g.save()
    g.fillStyle = pale
    g.beginPath()
    g.arc(S * 0.66, S * 0.27, S * 0.075, 0, Math.PI * 2)
    g.arc(S * 0.685, S * 0.255, S * 0.068, 0, Math.PI * 2, true)
    g.fill()
    g.restore()
    // the bark: dark dots and short strokes down the bough (苔点)
    g.fillStyle = ink
    for (let k = 0; k < 40; k++) {
      const t = rnd()
      const x = S * (0.2 + t * 0.56) + (rnd() - 0.5) * 20
      const y = S * (0.74 - t * 0.36) + (rnd() - 0.5) * 16
      g.beginPath()
      g.ellipse(x, y, 3 + rnd() * 4, 2 + rnd() * 2, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
    // knots and short spurs along it
    for (const [x, y] of [[0.29, 0.67], [0.44, 0.565], [0.62, 0.45]]) {
      stroke([[S * x, S * y], [S * (x + 0.02), S * (y - 0.035)]], 6, 1.5)
    }
    const blossom = (x: number, y: number, r: number, turn: number) => {
      for (let k = 0; k < 5; k++) {
        const a = turn + (k / 5) * Math.PI * 2
        const px = x + Math.cos(a) * r * 0.58
        const py = y + Math.sin(a) * r * 0.58
        g.beginPath()
        g.arc(px, py, r * 0.5, 0, Math.PI * 2)
        g.fillStyle = wash
        g.fill()
        // (deeper at the petal's base, toward the heart)
        g.fillStyle = deep
        g.beginPath()
        g.arc(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32, r * 0.22, 0, Math.PI * 2)
        g.fill()
        g.strokeStyle = ink
        g.lineWidth = 3.4
        g.beginPath()
        g.arc(px, py, r * 0.5, 0, Math.PI * 2)
        g.stroke()
        // the little notch at each petal's tip
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0)
        g.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86)
        g.stroke()
      }
      // the stamens: fine lines out from the heart, each tipped with a dot
      g.lineWidth = 1.2
      for (let k = 0; k < 9; k++) {
        const a = turn + (k / 9) * Math.PI * 2
        const ex = x + Math.cos(a) * r * 0.42
        const ey = y + Math.sin(a) * r * 0.42
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(ex, ey)
        g.stroke()
        g.fillStyle = ink
        g.beginPath()
        g.arc(ex, ey, 2, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = ink
      g.beginPath()
      g.arc(x, y, r * 0.12, 0, Math.PI * 2)
      g.fill()
    }
    const blooms: [number, number, number][] = [[0.44, 0.52, 64], [0.63, 0.4, 56], [0.33, 0.35, 50], [0.7, 0.57, 42],
      [0.27, 0.63, 38], [0.53, 0.63, 32]]
    blooms.forEach(([x, y, r], i) => blossom(S * x, S * y, r, i * 0.7))
    // buds: small closed rounds on short stalks
    for (const [x, y] of [[0.78, 0.36], [0.37, 0.29], [0.57, 0.47], [0.24, 0.7]]) {
      stroke([[S * x - 10, S * y + 10], [S * x, S * y]], 3, 1.5)
      g.beginPath()
      g.arc(S * x, S * y, 9, 0, Math.PI * 2)
      g.fillStyle = wash
      g.fill()
      g.strokeStyle = ink
      g.lineWidth = 2
      g.stroke()
    }
    // a few petals drifting down
    for (const [x, y, a] of [[0.6, 0.7, 0.3], [0.68, 0.66, 1.4], [0.48, 0.74, 2.2]]) {
      g.save()
      g.translate(S * x, S * y)
      g.rotate(a)
      g.beginPath()
      g.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2)
      g.fillStyle = wash
      g.fill()
      g.strokeStyle = ink
      g.lineWidth = 1.8
      g.stroke()
      g.restore()
    }
  }
  const t = new THREE.CanvasTexture(forPhone(c))
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
/**
 * the shop's one set of ware, all with the same waves round the rim and the same brown lip: bamboo on the big
 * plates, plum blossom on the side dishes, clouds on the customers' plates at the bar
 */
export const BAMBOO_WARE = wareTexture('bamboo')
export const PLUM_WARE = wareTexture('plum')
export const CLOUD_WARE = wareTexture('cloud')

/** Lathe geometry for ware, with UVs projected straight down so a painted picture lies flat in the well. */
export function wareGeometry(profile: [number, number][], R: number) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 64)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, 0.5 - pos.getZ(i) / (2 * R))
  uv.needsUpdate = true
  return g
}
