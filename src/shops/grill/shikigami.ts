// The paper laid at each place at the bar (敷紙, item 310, the owner's, 2026-11-18: 「這張借你參考發揮」, a woodblock illustration of an Edo
// eating house: each diner their own tray, a long plate of grilled fish, sake poured from a choshi, a lattice screen between the seats):
// each place given its own setting, as a counter does with a printed paper, and the print on it in the manner of that book's pictures, the
// shop's own scene and not that one: the hearth's frame, the charcoal glowing in it, fish on skewers leaning in to the fire, smoke curling
// off them, a fan; a tokkuri and its cup; the shop's name brushed big down the right, 炭火焼魚 beside it, a verse of the owner's own and a
// red seal; the middle left plain for the plate. Sumi line on cream washi, a double rule round it. One picture for every place.
const INK = '#1d1712'
const BRUSH = '"LXGW WenKai TC", "Noto Serif TC", serif'
/** a seeded random sequence, so the paper's fibres and the charcoal fall the same each time */
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

/** the paper's size (px): its 0.60 by 0.34 m, a pixel as long one way as the other */
export const SHIKI_SIZE: [number, number] = [1024, 580]

/** a fish on a skewer leaning into the fire, its head down: `x, y` where the skewer's foot is in the ash, `a` its lean, `s` its size */
function fishOnSkewer(g: CanvasRenderingContext2D, x: number, y: number, a: number, s: number) {
  g.save()
  g.translate(x, y)
  g.rotate(a)
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'
  // (the skewer, from the ash up through the fish, out over its tail)
  g.lineWidth = s * 0.03
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.5); g.stroke()
  // (the fish along it, curved as it's threaded (踊り串), its head down toward the ash)
  g.lineWidth = s * 0.028
  g.beginPath()
  g.moveTo(0, -s * 0.28)
  g.bezierCurveTo(s * 0.2, -s * 0.45, s * 0.14, -s * 0.85, -s * 0.06, -s * 1.08)
  g.bezierCurveTo(-s * 0.12, -s * 0.85, -s * 0.2, -s * 0.5, 0, -s * 0.28)
  g.stroke()
  // (its tail, its eye, its gill, its fins; the skin's char in a few short strokes)
  g.beginPath(); g.moveTo(-s * 0.06, -s * 1.08); g.lineTo(-s * 0.18, -s * 1.25); g.moveTo(-s * 0.06, -s * 1.08); g.lineTo(s * 0.08, -s * 1.24); g.stroke()
  g.fillStyle = INK
  g.beginPath(); g.arc(s * 0.04, -s * 0.36, s * 0.025, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.moveTo(s * 0.1, -s * 0.44); g.quadraticCurveTo(s * 0.02, -s * 0.47, -s * 0.06, -s * 0.42); g.stroke()
  g.beginPath(); g.moveTo(s * 0.12, -s * 0.66); g.lineTo(s * 0.22, -s * 0.72); g.moveTo(-s * 0.12, -s * 0.7); g.lineTo(-s * 0.2, -s * 0.66); g.stroke()
  g.lineWidth = s * 0.015
  for (let k = 0; k < 5; k++) { const yy = -s * (0.55 + k * 0.09); g.beginPath(); g.moveTo(-s * 0.04, yy); g.lineTo(s * 0.06, yy - s * 0.03); g.stroke() }
  g.restore()
}

/** smoke rising off the fire: a few long strokes curling, thinning as they go */
function smoke(g: CanvasRenderingContext2D, x: number, y: number, h: number, rnd: () => number) {
  g.save()
  g.strokeStyle = INK; g.lineCap = 'round'
  for (let k = 0; k < 3; k++) {
    g.lineWidth = 2.4 - k * 0.6
    g.globalAlpha = 0.85 - k * 0.18
    const x0 = x + (k - 1) * h * 0.18
    g.beginPath(); g.moveTo(x0, y)
    g.bezierCurveTo(x0 + h * 0.25, y - h * 0.3, x0 - h * 0.25, y - h * 0.55, x0 + h * (0.1 + rnd() * 0.1), y - h * (0.85 + rnd() * 0.15))
    g.stroke()
  }
  g.restore()
}

/** the paper (cream washi, its fibres) with the print on it; `zh` only for nothing: it's the shop's own print, in Japanese, as the reference */
export function paintShikigami(g: CanvasRenderingContext2D) {
  const [W, H] = SHIKI_SIZE
  const rnd = seeded(310)
  g.setTransform(1, 0, 0, 1, 0, 0)
  // (the washi: cream, a little uneven, long fibres through it)
  g.fillStyle = '#e9ddc2'
  g.fillRect(0, 0, W, H)
  for (let k = 0; k < 900; k++) {
    g.strokeStyle = rnd() < 0.5 ? 'rgba(160, 130, 90, 0.18)' : 'rgba(255, 250, 235, 0.45)'
    g.lineWidth = 0.6 + rnd() * 0.8
    const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 6 + rnd() * 22
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
  // (a double rule round it)
  g.strokeStyle = INK
  g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44)
  g.lineWidth = 1.2; g.strokeRect(31, 31, W - 62, H - 62)
  // ---- the print, its left third: the hearth's frame in a slant, the charcoal heaped in it, three fish leaning in, the smoke, a fan
  g.save()
  g.beginPath(); g.rect(36, 36, W * 0.38, H - 72); g.clip()
  const fx = 62, fy = H * 0.7, fw = W * 0.29, fd = H * 0.16
  // (the frame: a box seen from a little above, its rim thick)
  g.lineWidth = 3.2; g.lineJoin = 'round'
  g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + fw, fy); g.lineTo(fx + fw + fd * 0.6, fy - fd); g.lineTo(fx + fd * 0.6, fy - fd); g.closePath(); g.stroke()
  g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy + H * 0.1); g.lineTo(fx + fw, fy + H * 0.1); g.lineTo(fx + fw, fy); g.stroke()
  g.beginPath(); g.moveTo(fx + fw, fy + H * 0.1); g.lineTo(fx + fw + fd * 0.6, fy + H * 0.1 - fd); g.lineTo(fx + fw + fd * 0.6, fy - fd); g.stroke()
  // (the frame's grain: a few lines along it)
  g.lineWidth = 1
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(fx + 6, fy + (H * 0.1 * k) / 4); g.lineTo(fx + fw - 6, fy + (H * 0.1 * k) / 4 + (rnd() - 0.5) * 3); g.stroke() }
  // (the charcoal: rounded lumps along the frame's well, each with a crack or two, the glow as bare paper among the black)
  for (let k = 0; k < 16; k++) {
    const cx = fx + 16 + rnd() * (fw - 20) + (fd * 0.3), cy = fy - fd * (0.2 + rnd() * 0.6)
    g.fillStyle = INK
    g.beginPath(); g.ellipse(cx, cy, 9 + rnd() * 7, 5 + rnd() * 3, rnd() * 0.6 - 0.3, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#eee4cc'; g.lineWidth = 1.2
    g.beginPath(); g.moveTo(cx - 4, cy - 1); g.lineTo(cx + 3, cy + 1); g.stroke()
  }
  // (three fish leaning in from the ash toward the fire, the smoke off them)
  ;[[fx + fw * 0.2, -0.32, H * 0.17], [fx + fw * 0.5, -0.12, H * 0.185], [fx + fw * 0.8, 0.1, H * 0.172]].forEach(([x, a, s]) => {
    fishOnSkewer(g, x, fy - fd * 0.45, a, s)
    smoke(g, x - 10, fy - fd * 0.45 - s * 1.55, H * 0.12, rnd)
  })
  // (a fan (団扇) leaning on the frame's corner, its ribs fanned)
  const ux = fx + fw - 10, uy = fy + H * 0.06
  g.save(); g.translate(ux, uy); g.rotate(-0.5)
  g.lineWidth = 2.4; g.strokeStyle = INK
  g.beginPath(); g.ellipse(0, -46, 34, 38, 0, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 1
  for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(0, -10); g.lineTo(Math.sin(k * 0.3) * 33, -46 - Math.cos(k * 0.3) * 37); g.stroke() }
  g.lineWidth = 4; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 30); g.stroke()
  g.restore()
  // (the tokkuri and its cup on a little tray before the fire)
  const tx = fx + 40, ty = H - 52
  g.lineWidth = 2.2; g.strokeStyle = INK
  g.beginPath(); g.moveTo(tx - 22, ty); g.bezierCurveTo(tx - 30, ty - 40, tx - 6, ty - 46, tx - 7, ty - 66); g.lineTo(tx + 7, ty - 66)
  g.bezierCurveTo(tx + 6, ty - 46, tx + 30, ty - 40, tx + 22, ty); g.closePath(); g.stroke()
  g.beginPath(); g.ellipse(tx, ty - 66, 9, 3, 0, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.moveTo(tx - 14, ty - 26); g.quadraticCurveTo(tx, ty - 22, tx + 14, ty - 26); g.stroke()
  g.beginPath(); g.moveTo(tx + 40, ty); g.lineTo(tx + 34, ty - 14); g.lineTo(tx + 62, ty - 14); g.lineTo(tx + 56, ty); g.closePath(); g.stroke()
  g.beginPath(); g.moveTo(tx - 40, ty + 2); g.lineTo(tx + 80, ty + 2); g.stroke()
  g.restore()
  // ---- the middle: a few maple leaves falling, faint, the plate's place left plain
  g.save()
  g.globalAlpha = 0.35; g.fillStyle = INK
  for (const [x, y, r, a] of [[W * 0.46, H * 0.18, 13, 0.4], [W * 0.62, H * 0.12, 10, -0.6], [W * 0.56, H * 0.86, 12, 1.1]]) {
    g.save(); g.translate(x, y); g.rotate(a)
    g.beginPath()
    for (let k = 0; k < 5; k++) {
      const a0 = -Math.PI / 2 + (k * Math.PI * 2) / 5
      g.lineTo(Math.cos(a0) * r, Math.sin(a0) * r)
      g.lineTo(Math.cos(a0 + Math.PI / 5) * r * 0.42, Math.sin(a0 + Math.PI / 5) * r * 0.42)
    }
    g.closePath(); g.fill(); g.restore()
  }
  g.restore()
  // ---- the right: the shop's name brushed big down it, 炭火焼魚 beside it, a verse in small columns, the red seal
  g.fillStyle = INK
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const nx = W - 104
  g.font = `700 100px ${BRUSH}`
  ;['聞', '野'].forEach((ch, i) => g.fillText(ch, nx, H * 0.2 + i * 108))
  g.font = `700 40px ${BRUSH}`
  ;[...'炭火焼魚'].forEach((ch, i) => g.fillText(ch, nx - 96, H * 0.15 + i * 44))
  // (the verse: the owner's own, in two columns, right to left)
  g.font = `400 27px ${BRUSH}`
  ;['炭の香や', '串の雫に秋の声'].forEach((line, c) => [...line].forEach((ch, i) => g.fillText(ch, nx - 150 - c * 34, H * 0.5 + i * 30)))
  // (the seal: a red square, 聞 in it reversed out)
  g.fillStyle = '#b3261c'
  g.fillRect(nx - 28, H - 112, 56, 56)
  g.fillStyle = '#e9ddc2'
  g.font = `700 38px ${BRUSH}`
  g.fillText('聞', nx, H - 83)
}
