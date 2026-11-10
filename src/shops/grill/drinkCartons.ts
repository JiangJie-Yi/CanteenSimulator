// The drinks' cardboard cases' print (blender/drinkcartons.py lays each case's faces out on it): kraft board printed in one or two inks, as
// the cases at the back of a Japanese bar are (the owner's, 2026-11-10: the print was one 2:1 picture laid over each face whatever its
// shape, an end's squashed and the one end mirrored, a big flat block of colour across each; the tape broke off at the edges; the board had
// no feel of board). Every face drawn at one scale (930 px to the metre), right reading from outside it: each drink's row its long side
// (front and back) and its end beside it; the top one for all. On each side the drink's name big, its English, what's in it, two cans drawn,
// this way up (天地無用), a JAN bar code and the recycling marks; on each end a die-cut handhole, the name, the best-before and lot inked on;
// the top its flaps' seam and an inspection stamp. The board's flutes, its crushed edges, its creases and the handholes in a normal map.
import * as THREE from 'three'
import { signTexture, SIGN_FONT } from '@/scene/signFont'
import { normalFromHeight } from '@/scene/normalFromHeight'
import { reflectStudio } from '@/scene/studio'
import type { DrinkId } from './bar'

/** the print's layout (blender/drinkcartons.py's PX, TW, TH, SIDE_X, END_X, ROW0, ROW, TOP_X, TOP_Y): pixels from its top left */
const PX = 930, TW = 1024, TH = 1024
const SIDE_X = 4, END_X = 384, ROW0 = 4, ROW = 202, TOP_X = 650, TOP_Y = 4
/** a case's size (the model's: 0.40 long, 0.21 tall, 0.28 deep), on the print */
const W = 0.4 * PX, H = 0.21 * PX, D = 0.28 * PX

type Kind = {
  /** the name, big, in the sign's face */
  name: string
  en: string
  /** a line of what it is, small under the English */
  sub: string
  /** its two inks: the print's, and the second for its accents */
  ink: string
  accent: string
  alcohol: boolean
  /** its JAN code's first twelve digits (the thirteenth worked out) */
  jan: string
  /** best before and lot, inked on its end */
  lot: string
}
/** what each case holds, in the order of the model's rows (blender/drinkcartons.py's PRINT_OF): the canned drinks come by the case */
export const CARTON_DRINKS: DrinkId[] = ['beerCan', 'greenTea', 'cola', 'highball', 'chuhai']
const KINDS: Record<string, Kind> = {
  beerCan: { name: '生ビール', en: 'DRAFT BEER', sub: '麦芽100%  アルコール分5%', ink: '#1b315a', accent: '#b4291f', alcohol: true, jan: '458221430001', lot: '2027.05 L3B' },
  greenTea: { name: '緑茶', en: 'JAPANESE GREEN TEA', sub: '国産茶葉100%  無香料', ink: '#25603a', accent: '#8b6a24', alcohol: false, jan: '458221430102', lot: '2027.08 T1K' },
  cola: { name: 'コーラ', en: 'COLA', sub: '炭酸飲料  よく冷やして', ink: '#a82a22', accent: '#1d1a18', alcohol: false, jan: '458221430209', lot: '2027.03 C2R' },
  highball: { name: 'ハイボール', en: 'HIGHBALL  WHISKY & SODA', sub: 'アルコール分7%', ink: '#1a2846', accent: '#9a6a1c', alcohol: true, jan: '458221430306', lot: '2027.04 H5A' },
  chuhai: { name: 'チューハイ', en: 'CHU-HI  LEMON', sub: 'レモン果汁3%  アルコール分5%', ink: '#a32c5c', accent: '#2f6a2a', alcohol: true, jan: '458221430403', lot: '2027.02 S4L' },
}
const RED = '#bf3326'
const SANS = '"Yu Gothic", "YuGothic", "Hiragino Sans", "Meiryo", "Noto Sans JP", sans-serif'
const MONO = '"Consolas", "Courier New", monospace'

/** a seeded random (the same board every time) */
const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

/** EAN-13's bars for twelve digits: its check digit worked out, and the 95 modules (1 a bar) */
function ean13(twelve: string) {
  const d = [...twelve].map(Number)
  const sum = d.reduce((t, x, i) => t + x * (i % 2 ? 3 : 1), 0)
  d.push((10 - (sum % 10)) % 10)
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
  const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
  const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
  const parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGGL', 'LGLGLG', 'LGGLGL'][d[0]]
  let bits = '101'
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? L : G)[d[i]]
  bits += '01010'
  for (let i = 7; i <= 12; i++) bits += R[d[i]]
  bits += '101'
  return { digits: d.join(''), bits }
}

/** the board itself over the whole print: kraft, mottled, its fibres, the flutes showing faintly through the liner (upright) */
function board(g: CanvasRenderingContext2D) {
  g.fillStyle = '#c39b66'; g.fillRect(0, 0, TW, TH)
  const rnd = random(5)
  for (let k = 0; k < 220; k++) {
    const x = rnd() * TW, y = rnd() * TH, r = 14 + rnd() * 46
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, k % 2 ? 'rgba(236,212,170,0.1)' : 'rgba(96,62,28,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // (the flutes: a faint shade every 7.4 px, the corrugation under the liner (C flute, 8 mm); faint: stronger, they striped the board)
  g.fillStyle = 'rgba(90,58,26,0.035)'
  for (let x = 0; x < TW; x += 7.4) g.fillRect(x, 0, 2.4, TH)
  // (its fibres: short hairs, lighter and darker)
  for (let k = 0; k < 5200; k++) {
    const x = rnd() * TW, y = rnd() * TH, a = rnd() * Math.PI, l = 2 + rnd() * 5
    g.strokeStyle = rnd() < 0.5 ? 'rgba(110,74,38,0.22)' : 'rgba(238,214,174,0.25)'
    g.lineWidth = 0.6
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
  }
}

/** a face's worn edges: lighter where the board's crushed along them, and a little grime along its foot (`foot`: the face stands on it) */
function wear(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, foot: boolean, seed: number) {
  const rnd = random(seed)
  g.save()
  g.beginPath(); g.rect(x, y, w, h); g.clip()
  // (each edge a band fading in from it: from (x0, y0) to (x1, y1) over the rectangle rx, ry, rw, rh)
  const edge = (x0: number, y0: number, x1: number, y1: number, r: [number, number, number, number], c: string) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1)
    gr.addColorStop(0, c); gr.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'))
    g.fillStyle = gr; g.fillRect(...r)
  }
  const lite = 'rgba(232,206,160,0.55)'
  edge(x, y, x, y + 5, [x, y, w, 5], lite)
  edge(x, y, x + 5, y, [x, y, 5, h], lite)
  edge(x + w, y, x + w - 5, y, [x + w - 5, y, 5, h], lite)
  if (foot) edge(x, y + h, x, y + h - 14, [x, y + h - 14, w, 14], 'rgba(70,46,24,0.3)')
  else edge(x, y + h, x, y + h - 5, [x, y + h - 5, w, 5], lite)
  // (a few nicks and scuffs along the edges: the liner rubbed thin, a shade lighter (whiter, they read as splashes of paint))
  for (let k = 0; k < 10; k++) {
    const t = rnd(), side = Math.floor(rnd() * 4), r = 1 + rnd() * 2
    const px = side === 0 ? x + t * w : side === 1 ? x + w - 1 : side === 2 ? x + t * w : x + 1
    const py = side === 0 ? y + 1 : side === 1 ? y + t * h : side === 2 ? y + h - 1 : y + t * h
    g.fillStyle = 'rgba(214,180,128,0.45)'
    g.beginPath(); g.ellipse(px, py, r * 1.6, r, rnd() * Math.PI, 0, Math.PI * 2); g.fill()
  }
  g.restore()
}

/** words fitted into a width: at `size` unless that's wider than `w`, then smaller till they fit; drawn at x, y as `align` says */
function fit(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, size: number, ink: string, o: {
  face?: string; weight?: string; spacing?: number; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {}) {
  g.save()
  const face = o.face ?? SANS, weight = o.weight ?? '700', sp = o.spacing ?? 0
  g.font = `${weight} ${size}px ${face}`
  const width = g.measureText(text).width + sp * Math.max(0, [...text].length - 1)
  const k = Math.min(1, w / Math.max(1, width))
  g.font = `${weight} ${size * k}px ${face}`
  ;(g as unknown as { letterSpacing: string }).letterSpacing = `${sp * k}px`
  g.fillStyle = ink; g.textAlign = o.align ?? 'left'; g.textBaseline = o.base ?? 'alphabetic'
  g.fillText(text, x, y)
  g.restore()
  return width * k
}

/** this way up (ISO 780): two arrows side by side over a bar, w wide, its top left at x, y */
function thisWayUp(g: CanvasRenderingContext2D, x: number, y: number, w: number, ink: string) {
  const h = w * 0.86, aw = w * 0.42
  g.fillStyle = ink
  for (const cx of [x + aw / 2, x + w - aw / 2]) {
    g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + aw / 2, y + h * 0.42); g.lineTo(cx - aw / 2, y + h * 0.42); g.closePath(); g.fill()
    g.fillRect(cx - aw * 0.17, y + h * 0.4, aw * 0.34, h * 0.42)
  }
  g.fillRect(x, y + h * 0.88, w, h * 0.12)
}

/** a can drawn in line, its band in the second ink: its top left x, y, w wide (its height the 350 ml can's, 1.85 times its width) */
function can(g: CanvasRenderingContext2D, x: number, y: number, w: number, ink: string, accent: string, mark: string) {
  const h = w * 1.85, lw = Math.max(1.2, w * 0.045)
  g.save()
  g.lineWidth = lw; g.strokeStyle = ink; g.lineJoin = 'round'
  // (its body, the neck narrowing to the lid, the lid's rim an ellipse)
  const neck = w * 0.1, rim = w * 0.11
  g.fillStyle = '#d6b88a'
  g.beginPath()
  g.moveTo(x + neck, y + rim); g.lineTo(x, y + rim * 2.6); g.lineTo(x, y + h - rim)
  g.quadraticCurveTo(x, y + h, x + w / 2, y + h); g.quadraticCurveTo(x + w, y + h, x + w, y + h - rim)
  g.lineTo(x + w, y + rim * 2.6); g.lineTo(x + w - neck, y + rim); g.closePath()
  g.fill(); g.stroke()
  g.beginPath(); g.ellipse(x + w / 2, y + rim, w / 2 - neck, rim, 0, 0, Math.PI * 2); g.fillStyle = '#e4cba0'; g.fill(); g.stroke()
  // (its band, and the name's first letter on it)
  g.fillStyle = accent; g.fillRect(x + lw / 2, y + h * 0.36, w - lw, h * 0.3)
  g.fillStyle = '#efe0c4'
  g.font = `900 ${w * 0.5}px ${SIGN_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(mark, x + w / 2, y + h * 0.515)
  // (a highlight down it)
  g.strokeStyle = 'rgba(255,248,232,0.5)'; g.lineWidth = lw * 0.9
  g.beginPath(); g.moveTo(x + w * 0.22, y + rim * 3); g.lineTo(x + w * 0.22, y + h * 0.33); g.stroke()
  g.beginPath(); g.moveTo(x + w * 0.22, y + h * 0.7); g.lineTo(x + w * 0.22, y + h - rim * 1.6); g.stroke()
  g.restore()
}

/** the recycling marks: the corrugated board's (three arrows chasing round a triangle), the cans' aluminium (two round a circle) and the
 * plastic's (プラ, two round a rounded square), each s across, from x along a line at y */
function marks(g: CanvasRenderingContext2D, x: number, y: number, s: number, ink: string) {
  g.save()
  g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = Math.max(1, s * 0.09); g.lineJoin = 'round'; g.lineCap = 'round'
  const head = (px: number, py: number, a: number) => {
    const r = s * 0.16
    g.beginPath(); g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r)
    g.lineTo(px + Math.cos(a + 2.4) * r, py + Math.sin(a + 2.4) * r); g.lineTo(px + Math.cos(a - 2.4) * r, py + Math.sin(a - 2.4) * r); g.closePath(); g.fill()
  }
  // (the board's: a triangle of three arrows)
  {
    const cx = x + s / 2, cy = y + s * 0.52, r = s * 0.46
    const pts = [0, 1, 2].map((i) => [cx + Math.cos(-Math.PI / 2 + i * 2.0944) * r, cy + Math.sin(-Math.PI / 2 + i * 2.0944) * r])
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 3]
      const sx = ax + (bx - ax) * 0.16, sy = ay + (by - ay) * 0.16, ex = ax + (bx - ax) * 0.72, ey = ay + (by - ay) * 0.72
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke()
      head(ex, ey, Math.atan2(by - ay, bx - ax))
    }
    fit(g, '段ボール', cx, y + s * 1.32, s * 1.3, s * 0.3, ink, { align: 'center' })
  }
  // (the cans': two arrows round a circle, アルミ in it)
  {
    const cx = x + s * 2.1, cy = y + s * 0.5, r = s * 0.44
    for (const a0 of [-0.3, Math.PI - 0.3]) {
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + 2.5); g.stroke()
      head(cx + Math.cos(a0 + 2.5) * r, cy + Math.sin(a0 + 2.5) * r, a0 + 2.5 + Math.PI / 2)
    }
    fit(g, 'アルミ', cx, cy + s * 0.11, r * 1.5, s * 0.28, ink, { align: 'center' })
  }
  // (the plastic's: two arrows round a rounded square, プラ in it)
  {
    const cx = x + s * 3.55, cy = y + s * 0.5, r = s * 0.42
    g.beginPath(); g.moveTo(cx - r * 0.2, cy - r); g.lineTo(cx + r * 0.62, cy - r); g.quadraticCurveTo(cx + r, cy - r, cx + r, cy - r * 0.62); g.lineTo(cx + r, cy + r * 0.2); g.stroke()
    head(cx + r, cy + r * 0.25, Math.PI / 2)
    g.beginPath(); g.moveTo(cx + r * 0.2, cy + r); g.lineTo(cx - r * 0.62, cy + r); g.quadraticCurveTo(cx - r, cy + r, cx - r, cy + r * 0.62); g.lineTo(cx - r, cy - r * 0.2); g.stroke()
    head(cx - r, cy - r * 0.25, -Math.PI / 2)
    fit(g, 'プラ', cx, cy + s * 0.12, r * 1.4, s * 0.32, ink, { align: 'center' })
  }
  g.restore()
}

/** a JAN bar code, `m` px a module, its top left (the quiet zone's) at x, y, its bars `h` tall, the digits under them */
function barcode(g: CanvasRenderingContext2D, x: number, y: number, m: number, h: number, twelve: string) {
  const { digits, bits } = ean13(twelve)
  g.save()
  // (on a white patch, as they're printed so a scanner reads them off brown board)
  const w = (95 + 18) * m
  g.fillStyle = '#f3ead8'; g.fillRect(x, y - 3, w, h + 14)
  g.fillStyle = '#141414'
  const x0 = x + 11 * m
  for (let i = 0; i < 95; i++) {
    if (bits[i] !== '1') continue
    // (the guard bars longer, down into the digits' line)
    const guard = i < 3 || (i >= 45 && i < 50) || i >= 92
    g.fillRect(x0 + i * m, y, m, h + (guard ? 5 : 0))
  }
  g.font = `600 ${8.5}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'center'
  g.fillText(digits[0], x + 5 * m, y + h + 1)
  for (let i = 0; i < 6; i++) g.fillText(digits[1 + i], x0 + (3 + i * 7 + 3.5) * m, y + h + 1)
  for (let i = 0; i < 6; i++) g.fillText(digits[7 + i], x0 + (50 + i * 7 + 3.5) * m, y + h + 1)
  g.restore()
}

/** a die-cut handhole: a slot with round ends, w by h, its middle at x, y: dark through it, its cut edge's board showing light along the foot */
function handhole(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const slot = (dx: number, dy: number, ww: number, hh: number) => {
    const r = hh / 2
    g.beginPath(); g.moveTo(x - ww / 2 + r + dx, y - r + dy); g.lineTo(x + ww / 2 - r + dx, y - r + dy)
    g.arc(x + ww / 2 - r + dx, y + dy, r, -Math.PI / 2, Math.PI / 2); g.lineTo(x - ww / 2 + r + dx, y + r + dy)
    g.arc(x - ww / 2 + r + dx, y + dy, r, Math.PI / 2, Math.PI * 1.5); g.closePath()
  }
  g.save()
  // (the cut's edge: the board's layers showing, light)
  g.fillStyle = '#e2c79b'; slot(0, 0.8, w + 2.4, h + 2.4); g.fill()
  // (the hole: dark inside the case, darkest up under its top edge)
  const gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2)
  gr.addColorStop(0, '#0d0906'); gr.addColorStop(1, '#2a1c11')
  g.fillStyle = gr; slot(0, 0, w, h); g.fill()
  // (the push-in flap's crease above it, half cut)
  g.strokeStyle = 'rgba(80,52,26,0.45)'; g.lineWidth = 1
  g.beginPath(); g.moveTo(x - w * 0.42, y - h / 2 - 3); g.quadraticCurveTo(x, y - h / 2 - 9, x + w * 0.42, y - h / 2 - 3); g.stroke()
  g.restore()
}

/** a case's long side, its top left x, y */
function side(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  const m = 9, ink = k.ink
  g.save()
  g.beginPath(); g.rect(x, y, W, H); g.clip()
  // (業務用: a little tag stamped in the ink, the board showing through its letters)
  g.fillStyle = ink; g.fillRect(x + m, y + m, 50, 17)
  fit(g, '業務用', x + m + 25, y + m + 13, 44, 12, '#c9a46e', { align: 'center' })
  fit(g, k.sub, x + m + 58, y + m + 13, W * 0.62 - 66, 9.5, ink, { weight: '600' })
  // (the name, big, in the sign's face, on the left two thirds)
  fit(g, k.name, x + m + 2, y + H * 0.56, W * 0.6, 66, ink, { face: SIGN_FONT, weight: '400', spacing: 3 })
  // (a fine rule, the English letter spaced under it)
  g.fillStyle = ink; g.fillRect(x + m + 2, y + H * 0.62, W * 0.6, 1.6)
  fit(g, k.en, x + m + 2, y + H * 0.71, W * 0.6, 11, ink, { weight: '700', spacing: 2.4 })
  // (what's in it, in a box; and the drinker's warning, or how to keep it, in fine print along the foot)
  g.strokeStyle = ink; g.lineWidth = 1.6
  g.beginPath(); g.roundRect(x + m + 2, y + H * 0.77, W * 0.34, H * 0.13, 4); g.stroke()
  fit(g, '350ml × 24缶', x + m + 2 + W * 0.17, y + H * 0.77 + H * 0.098, W * 0.31, 14, ink, { align: 'center' })
  if (k.alcohol) {
    g.beginPath(); g.arc(x + m + W * 0.4, y + H * 0.835, H * 0.065, 0, Math.PI * 2); g.stroke()
    fit(g, 'お酒', x + m + W * 0.4, y + H * 0.835 + 3.4, H * 0.1, 9, ink, { align: 'center' })
  }
  fit(g, k.alcohol ? 'お酒は20歳になってから。飲酒運転は法律で禁止されています。' : '直射日光・高温多湿を避けて保存してください。',
    x + m + 2, y + H - 5, W * 0.6, 7.2, ink, { weight: '500' })
  // (two cans drawn, the back one a little up and over)
  const cx = x + W * 0.665, cy = y + 14
  can(g, cx + 26, cy - 2, 36, ink, k.accent, k.name[0])
  can(g, cx, cy + 8, 38, ink, k.accent, k.name[0])
  // (this way up, in red, and 天地無用 under it)
  thisWayUp(g, x + W - m - 34, y + m + 2, 34, RED)
  fit(g, '天地無用', x + W - m - 17, y + m + 46, 40, 10.5, RED, { align: 'center' })
  // (the bar code, and the recycling marks under it)
  barcode(g, x + W - m - 113, y + H * 0.56, 1, 30, k.jan)
  marks(g, x + W - m - 104, y + H * 0.8, 21, ink)
  g.restore()
}

/** a case's end, its top left x, y */
function end(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  const m = 9, ink = k.ink
  g.save()
  g.beginPath(); g.rect(x, y, D, H); g.clip()
  handhole(g, x + D / 2, y + H * 0.24, 0.095 * PX, 0.027 * PX)
  fit(g, k.name, x + D / 2, y + H * 0.6, D * 0.78, 42, ink, { face: SIGN_FONT, weight: '400', spacing: 2, align: 'center' })
  fit(g, k.en, x + D / 2, y + H * 0.7, D * 0.8, 8.5, ink, { weight: '700', spacing: 1.6, align: 'center' })
  fit(g, '350ml × 24缶', x + D / 2, y + H * 0.8, D * 0.6, 12, ink, { align: 'center' })
  // (best before and lot, inked on by the filler: a dot printer's grey, a little crooked)
  g.save()
  g.translate(x + m, y + H - 9); g.rotate(-0.012)
  fit(g, `賞味期限 ${k.lot}`, 0, 0, D * 0.6, 9, 'rgba(30,30,34,0.82)', { face: MONO, weight: '600', spacing: 0.6 })
  g.restore()
  thisWayUp(g, x + D - m - 26, y + H - 52, 26, RED)
  fit(g, '天地無用', x + D - m - 13, y + H - 12, 34, 8.5, RED, { align: 'center' })
  g.restore()
}

/** the cases' top (one for all): the outer flaps meeting down its middle, the board between them; an inspection stamp off to one side */
function top(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save()
  g.beginPath(); g.rect(x, y, W, D); g.clip()
  // (the seam: the flaps' edges, a dark gap and a light lip either side)
  g.fillStyle = 'rgba(70,44,20,0.75)'; g.fillRect(x, y + D / 2 - 0.8, W, 1.6)
  g.fillStyle = 'rgba(236,214,176,0.6)'; g.fillRect(x, y + D / 2 - 2.6, W, 1); g.fillRect(x, y + D / 2 + 1.6, W, 1)
  // (検品済: a blue round stamp, a little crooked, its ink uneven)
  g.save()
  g.translate(x + W * 0.2, y + D * 0.26); g.rotate(-0.2)
  g.strokeStyle = 'rgba(40,74,140,0.72)'; g.lineWidth = 2
  g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, 15.5, 0, Math.PI * 2); g.stroke()
  fit(g, '検品済', 0, 4, 26, 10.5, 'rgba(40,74,140,0.78)', { align: 'center' })
  g.restore()
  g.restore()
}

/** the creases a case gets handled: a few faint folds across a face, a dark line with a light one beside it */
function creases(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, n: number) {
  const rnd = random(seed)
  g.save()
  g.beginPath(); g.rect(x, y, w, h); g.clip()
  for (let i = 0; i < n; i++) {
    const x0 = x + rnd() * w, y0 = y + rnd() * h, a = rnd() * Math.PI, l = 18 + rnd() * 40
    const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l
    g.strokeStyle = 'rgba(80,52,26,0.22)'; g.lineWidth = 1.1
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
    g.strokeStyle = 'rgba(240,222,190,0.3)'; g.lineWidth = 0.9
    g.beginPath(); g.moveTo(x0 + 1.2, y0 + 1.2); g.lineTo(x1 + 1.2, y1 + 1.2); g.stroke()
  }
  g.restore()
}

/** the whole print: the board, each drink's row (its side, its end), the top */
function paint(g: CanvasRenderingContext2D) {
  board(g)
  CARTON_DRINKS.forEach((id, r) => {
    const k = KINDS[id], y = ROW0 + r * ROW
    side(g, k, SIDE_X, y)
    creases(g, SIDE_X, y, W, H, 31 + r, 3)
    wear(g, SIDE_X, y, W, H, true, 11 + r)
    end(g, k, END_X, y)
    creases(g, END_X, y, D, H, 47 + r, 2)
    wear(g, END_X, y, D, H, true, 23 + r)
  })
  top(g, TOP_X, TOP_Y)
  creases(g, TOP_X, TOP_Y, W, D, 61, 3)
  wear(g, TOP_X, TOP_Y, W, D, false, 7)
}

/** the board's relief, as a height picture (lighter higher): the flutes under the liner, each face's edges crushed a little lower, the
 * handholes cut through, the top's seam; made into its normal map */
function relief() {
  const c = document.createElement('canvas')
  c.width = TW; c.height = TH
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, TW, TH)
  // (the flutes: a gentle ripple every 7.4 px, up the faces)
  for (let x = 0; x < TW; x++) {
    const v = Math.round(128 + 5 * Math.sin((2 * Math.PI * x) / 7.4))
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, TH)
  }
  // (each face's edges eased down, the board crushed along them)
  const ease = (x: number, y: number, w: number, h: number) => {
    const e = 5
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[x, 0, x + e, 0, x, y, e, h], [x + w, 0, x + w - e, 0, x + w - e, y, e, h],
      [0, y, 0, y + e, x, y, w, e], [0, y + h, 0, y + h - e, x, y + h - e, w, e]] as number[][]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1)
      gr.addColorStop(0, 'rgba(70,70,70,0.7)'); gr.addColorStop(1, 'rgba(70,70,70,0)')
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh)
    }
  }
  CARTON_DRINKS.forEach((_, r) => {
    const y = ROW0 + r * ROW
    ease(SIDE_X, y, W, H)
    ease(END_X, y, D, H)
    // (the handhole: a cut through, its edge falling into it: a few slots, each a little smaller and deeper (no blur filter: one on the canvas
    // costs each shape drawn after it))
    const hx = END_X + D / 2, hy = y + H * 0.24, hw = 0.095 * PX, hh = 0.027 * PX
    for (let i = 3; i >= 0; i--) {
      g.fillStyle = i ? 'rgba(20,20,20,0.3)' : 'rgb(20,20,20)'
      g.beginPath(); g.roundRect(hx - hw / 2 - i, hy - hh / 2 - i, hw + 2 * i, hh + 2 * i, hh / 2 + i); g.fill()
    }
    // (its creases, sunk)
    const crease = (x: number, yy: number, w: number, h: number, seed: number, n: number) => {
      const rnd = random(seed)
      for (let i = 0; i < n; i++) {
        const x0 = x + rnd() * w, y0 = yy + rnd() * h, a = rnd() * Math.PI, l = 18 + rnd() * 40
        g.strokeStyle = 'rgba(80,80,80,0.6)'; g.lineWidth = 1.4
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke()
      }
    }
    crease(SIDE_X, y, W, H, 31 + r, 3)
    crease(END_X, y, D, H, 47 + r, 2)
  })
  ease(TOP_X, TOP_Y, W, D)
  g.fillStyle = 'rgb(70,70,70)'; g.fillRect(TOP_X, TOP_Y + D / 2 - 1.2, W, 2.4)
  return normalFromHeight(c, 2)
}

let mats: { board: THREE.MeshStandardMaterial; tape: THREE.MeshStandardMaterial } | null = null
/**
 * The cases' materials, made once: the board (the print, the relief, a matte kraft: roughness 0.88, no metal (the owner's)) and the tape (a
 * translucent kraft-brown packing tape, a little gloss on it: the owner's, after the clear one)
 */
export function cartonMaterials() {
  if (mats) return mats
  const map = signTexture(TW, TH, (g) => paint(g))
  // (a glTF model's pictures are read top row first)
  if (map) { map.flipY = false; map.anisotropy = 4; map.needsUpdate = true }
  let normalMap: THREE.CanvasTexture | null = null
  if (typeof document !== 'undefined') {
    normalMap = new THREE.CanvasTexture(relief())
    normalMap.flipY = false
    normalMap.anisotropy = 4
  }
  const boardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map, normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.88, metalness: 0 })
  boardMat.name = 'CartonPrint'
  // (its colour across it (its UVs' u): a little deeper along both edges, where it's doubled over the board's grain, so it reads as a strip; an
  // amber deeper than the board, glossy: a tan one as pale as the board was lost on it)
  let edges: THREE.CanvasTexture | null = null
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = 32; c.height = 4
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 32, 0)
    gr.addColorStop(0, 'rgba(120,80,40,1)'); gr.addColorStop(0.06, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)')
    gr.addColorStop(0.94, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(120,80,40,1)')
    g.fillStyle = gr; g.fillRect(0, 0, 32, 4)
    edges = new THREE.CanvasTexture(c)
    edges.colorSpace = THREE.SRGBColorSpace
  }
  // (the studio in it at 0.4: at full, seen from above under the light it shone white, lost on the board again)
  const tape = new THREE.MeshStandardMaterial({ color: '#94602c', map: edges, transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0, depthWrite: false,
    envMapIntensity: 0.4 })
  tape.name = 'CartonTape'
  reflectStudio(tape)
  mats = { board: boardMat, tape }
  return mats
}
