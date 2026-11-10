// The drinks' cardboard cases' print (blender/drinkcartons.py lays each case's faces out on it): kraft board printed in one or two inks, as
// the cases at the back of a Japanese bar are. Every face drawn at one scale (930 px to the metre), right reading from outside it: each
// drink's row its long side (front and back) and its end beside it; the top one for all. No two kinds alike (the owner's, 2026-11-10: every
// case was the same name, two cans and a big bar code, as if copied): a draft beer's silver band with its name big in brush strokes and its
// strength and malt under it; a green tea's dark green straight on the board, its name upright beside 京都宇治, a pale teapot and a round
// tea seal in a plain double frame; a cola's red rounded panel with its name knocked out in round heavy letters, kept-cool and handle-with-
// care on either side; a sour's modern look, a strip of its colour, flat blocks for its flavour and a mark of its own (a whisky barrel, a
// lemon). No cans drawn. The JAN code at its real size (some 3.5 by 1.6 cm), in a different corner, or on the end, case by case; this way
// up (天地無用), the recycling marks; on each end a die-cut handhole, the name, the best-before and lot inked on; the top its flaps' seam and
// an inspection stamp. The board's flutes, its crushed edges, its creases and the handholes in a normal map.
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
  /** the name, big */
  name: string
  en: string
  /** a line of what it is, small */
  sub: string
  /** its two inks: the print's, and the second for its accents */
  ink: string
  accent: string
  alcohol: boolean
  /** its JAN code's first twelve digits (the thirteenth worked out) */
  jan: string
  /** best before and lot, inked on its end */
  lot: string
  /** its case's look (the owner's: no two alike) */
  look: 'beer' | 'tea' | 'cola' | 'sour'
  /** where its bar code's printed, small: on its side or its end, and which corner (or the right edge's middle) */
  code: { on: 'side' | 'end'; at: 'tl' | 'tr' | 'bl' | 'br' | 'rm' }
  /** a sour's mark: a whisky barrel, or a lemon slice; and its two flavour blocks */
  mark?: 'barrel' | 'lemon'
  blocks?: [string, string]
}
/** what each case holds, in the order of the model's rows (blender/drinkcartons.py's PRINT_OF): the canned drinks come by the case */
export const CARTON_DRINKS: DrinkId[] = ['beerCan', 'greenTea', 'cola', 'highball', 'chuhai']
const KINDS: Record<string, Kind> = {
  beerCan: { name: '生ビール', en: 'DRAFT BEER', sub: 'アルコール分5%・麦芽100%', ink: '#151515', accent: '#b4291f', alcohol: true, jan: '458221430001',
    lot: '2027.05 L3B', look: 'beer', code: { on: 'side', at: 'br' } },
  greenTea: { name: '緑茶', en: 'JAPANESE GREEN TEA', sub: '国産茶葉100%  無香料', ink: '#25603a', accent: '#b4291f', alcohol: false, jan: '458221430102',
    lot: '2027.08 T1K', look: 'tea', code: { on: 'end', at: 'br' } },
  cola: { name: 'コーラ', en: 'COLA', sub: '炭酸飲料', ink: '#b3261e', accent: '#1d1a18', alcohol: false, jan: '458221430209', lot: '2027.03 C2R',
    look: 'cola', code: { on: 'side', at: 'bl' } },
  highball: { name: 'ハイボール', en: 'WHISKY & SODA', sub: 'アルコール分7%  ウイスキー・ソーダ', ink: '#1a2846', accent: '#a8701c', alcohol: true,
    jan: '458221430306', lot: '2027.04 H5A', look: 'sour', mark: 'barrel', blocks: ['7%', 'DRY'], code: { on: 'side', at: 'tr' } },
  chuhai: { name: 'チューハイ', en: 'CHU-HI  LEMON', sub: 'レモン果汁3%  アルコール分5%', ink: '#1f4a2a', accent: '#d2a91a', alcohol: true,
    jan: '458221430403', lot: '2027.02 S4L', look: 'sour', mark: 'lemon', blocks: ['レモン', '果汁3%'], code: { on: 'end', at: 'rm' } },
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

/** a JAN bar code at its real size on a case (the owner's, 2026-11-10: it was three times that, filling a corner): CODE_M px a module (some
 * 3.5 cm across, 1.6 cm tall with its digits), its top left (the quiet zone's) at x, y, the digits under its bars */
const CODE_M = 0.31, CODE_H = 9.5
const CODE_W = (95 + 18) * CODE_M, CODE_TALL = CODE_H + 14 * CODE_M
function barcode(g: CanvasRenderingContext2D, x: number, y: number, twelve: string) {
  const { digits, bits } = ean13(twelve), m = CODE_M
  g.save()
  // (on a pale patch, as they're printed so a scanner reads them off brown board)
  g.fillStyle = '#f3ead8'; g.fillRect(x, y - 1, CODE_W, CODE_TALL + 1)
  g.fillStyle = '#141414'
  const x0 = x + 11 * m
  for (let i = 0; i < 95; i++) {
    if (bits[i] !== '1') continue
    // (the guard bars longer, down into the digits' line)
    const guard = i < 3 || (i >= 45 && i < 50) || i >= 92
    g.fillRect(x0 + i * m, y, m, CODE_H + (guard ? 5 * m : 0))
  }
  g.font = `600 ${8.5 * m}px ${MONO}`; g.textBaseline = 'top'; g.textAlign = 'center'
  g.fillText(digits[0], x + 5 * m, y + CODE_H + m)
  for (let i = 0; i < 6; i++) g.fillText(digits[1 + i], x0 + (3 + i * 7 + 3.5) * m, y + CODE_H + m)
  for (let i = 0; i < 6; i++) g.fillText(digits[7 + i], x0 + (50 + i * 7 + 3.5) * m, y + CODE_H + m)
  g.restore()
}
/** where a kind's bar code goes on a face (x, y, w, h), if it goes on this one */
function codeOn(g: CanvasRenderingContext2D, k: Kind, face: 'side' | 'end', x: number, y: number, w: number, h: number) {
  if (k.code.on !== face) return
  const e = 10
  const [bx, by] = k.code.at === 'tl' ? [x + e, y + e] : k.code.at === 'tr' ? [x + w - e - CODE_W, y + e] : k.code.at === 'bl' ? [x + e, y + h - e - CODE_TALL]
    : k.code.at === 'br' ? [x + w - e - CODE_W, y + h - e - CODE_TALL] : [x + w - e - CODE_W, y + h * 0.44]
  barcode(g, bx, by, k.jan)
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

const MINCHO = '"Yu Mincho", "YuMincho", "Hiragino Mincho ProN", "Noto Serif JP", serif'
/** the board's own colour, for letters knocked out of a printed panel */
const KRAFT = '#d3a96f'

/** a word set upright, one letter under the next, centred on cx from top; how tall it came out */
function upright(g: CanvasRenderingContext2D, text: string, cx: number, top: number, size: number, ink: string, face = SANS, weight = '700') {
  g.save()
  g.font = `${weight} ${size}px ${face}`; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'top'
  let y = top
  for (const ch of text) { g.fillText(ch, cx, y); y += size * 1.04 }
  g.restore()
  return y - top
}

/** a box drawn round a line of words, w by h, its top left x, y, the words centred in it */
function boxed(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, size: number, ink: string, r = 3) {
  g.save()
  g.strokeStyle = ink; g.lineWidth = 1.4
  g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke()
  g.restore()
  fit(g, text, x + w / 2, y + h / 2 + size * 0.36, w - 8, size, ink, { align: 'center' })
}

/** a pale teapot (急須, its handle out to one side) and two tea leaves, in the tea's ink washed thin, s across, its middle at cx, cy */
function teapot(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, ink: string) {
  g.save()
  g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 1.4; g.lineJoin = 'round'; g.lineCap = 'round'
  const body = () => { g.beginPath(); g.ellipse(cx, cy, s * 0.3, s * 0.22, 0, 0, Math.PI * 2) }
  const spout = () => {
    g.beginPath(); g.moveTo(cx + s * 0.25, cy - s * 0.02); g.quadraticCurveTo(cx + s * 0.4, cy - s * 0.06, cx + s * 0.47, cy - s * 0.2)
    g.lineTo(cx + s * 0.5, cy - s * 0.17); g.quadraticCurveTo(cx + s * 0.44, cy + s * 0.04, cx + s * 0.26, cy + s * 0.08); g.closePath()
  }
  const handle = () => {
    g.beginPath(); g.moveTo(cx - s * 0.26, cy - s * 0.08); g.lineTo(cx - s * 0.54, cy - s * 0.2); g.lineTo(cx - s * 0.56, cy - s * 0.13)
    g.lineTo(cx - s * 0.27, cy + s * 0.01); g.closePath()
  }
  const lid = () => { g.beginPath(); g.ellipse(cx, cy - s * 0.21, s * 0.15, s * 0.04, 0, 0, Math.PI * 2); g.moveTo(cx + s * 0.035, cy - s * 0.27); g.arc(cx, cy - s * 0.27, s * 0.035, 0, Math.PI * 2) }
  for (const shape of [body, spout, handle, lid]) { g.globalAlpha = 0.16; shape(); g.fill(); g.globalAlpha = 0.5; shape(); g.stroke() }
  // (two leaves at its foot, their midribs)
  for (const [lx, ly, a] of [[cx + s * 0.36, cy + s * 0.26, -0.5], [cx + s * 0.5, cy + s * 0.22, 0.35]] as [number, number, number][]) {
    g.save(); g.translate(lx, ly); g.rotate(a)
    g.globalAlpha = 0.22; g.beginPath(); g.ellipse(0, 0, s * 0.1, s * 0.04, 0, 0, Math.PI * 2); g.fill()
    g.globalAlpha = 0.5; g.stroke(); g.beginPath(); g.moveTo(-s * 0.09, 0); g.lineTo(s * 0.09, 0); g.stroke()
    g.restore()
  }
  g.restore()
}

/** a round seal stamped a little crooked, a word in it in the sign's face, r round, its middle at cx, cy */
function seal(g: CanvasRenderingContext2D, word: string, cx: number, cy: number, r: number, ink: string) {
  g.save()
  g.translate(cx, cy); g.rotate(-0.16)
  g.strokeStyle = ink; g.globalAlpha = 0.85
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke()
  g.lineWidth = 0.8; g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.stroke()
  g.restore()
  fit(g, word, cx, cy + r * 0.42, r * 1.3, r * 1.2, ink, { face: SIGN_FONT, weight: '400', align: 'center' })
}

/** a whisky barrel in line, its hoops in the second ink, w by h, its middle at cx, cy */
function barrel(g: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, ink: string, hoop: string) {
  g.save()
  g.lineJoin = 'round'; g.lineCap = 'round'
  const t = cy - h / 2, b = cy + h / 2, hw = (w / 2) * 0.84, bulge = (w / 2) * 1.04, cap = h * 0.08
  // (its staves' outline, bulging at its waist, and the head's ellipse on top)
  g.strokeStyle = ink; g.lineWidth = 2
  g.beginPath(); g.moveTo(cx - hw, t); g.quadraticCurveTo(cx - bulge * 1.07, cy, cx - hw, b); g.stroke()
  g.beginPath(); g.moveTo(cx + hw, t); g.quadraticCurveTo(cx + bulge * 1.07, cy, cx + hw, b); g.stroke()
  g.beginPath(); g.ellipse(cx, t, hw, cap, 0, 0, Math.PI * 2); g.stroke()
  g.beginPath(); g.ellipse(cx, b, hw, cap, 0, 0, Math.PI); g.stroke()
  // (a few staves down it)
  g.lineWidth = 0.9
  for (const f of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(cx + f * hw, t + cap * 0.9); g.quadraticCurveTo(cx + f * bulge * 1.07, cy, cx + f * hw, b + cap * 0.9); g.stroke() }
  // (its two hoops)
  g.strokeStyle = hoop; g.lineWidth = 3.2
  for (const f of [0.2, 0.8]) {
    const yy = t + h * f, ww = hw + (bulge * 1.07 - hw) * Math.sin(Math.PI * f) * 0.95
    g.beginPath(); g.ellipse(cx, yy, ww, cap, 0, 0, Math.PI); g.stroke()
  }
  g.restore()
}

/** a lemon slice in line (its rind, its pith, eight segments), filled in the second ink, r round, its middle at cx, cy; a leaf by it */
function lemon(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: string, fill: string) {
  g.save()
  g.fillStyle = fill; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill()
  g.strokeStyle = ink; g.lineWidth = 2; g.stroke()
  g.lineWidth = 1.1; g.beginPath(); g.arc(cx, cy, r * 0.82, 0, Math.PI * 2); g.stroke()
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1); g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.stroke()
  }
  g.translate(cx + r * 0.78, cy - r * 0.86); g.rotate(-0.6)
  g.fillStyle = ink; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(0, 0, r * 0.42, r * 0.17, 0, 0, Math.PI * 2); g.fill()
  g.restore()
}

/** the fine print along a face's foot: the drinker's warning, or how to keep it */
function footnote(g: CanvasRenderingContext2D, k: Kind, x: number, y: number, w: number, ink: string) {
  fit(g, k.alcohol ? 'お酒は20歳になってから。飲酒運転は法律で禁止されています。' : '直射日光・高温多湿を避けて保存してください。', x, y, w, 7, ink, { weight: '500' })
}

/** a draft beer's side: a silver band across its middle between two red lines, the name big on it in brush strokes, its strength and malt
 * under it, 業務用 and its English over it */
function beerSide(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  const t = y + H * 0.3, b = y + H * 0.66
  const gr = g.createLinearGradient(0, t, 0, b)
  gr.addColorStop(0, '#d5d8da'); gr.addColorStop(0.55, '#aeb2b5'); gr.addColorStop(1, '#c5c8ca')
  g.fillStyle = gr; g.fillRect(x, t, W, b - t)
  g.fillStyle = k.accent; g.fillRect(x, t - 6, W, 2.4); g.fillRect(x, b + 3.6, W, 2.4)
  fit(g, k.name, x + W / 2, b - (b - t) * 0.17, W * 0.76, 60, k.ink, { face: SIGN_FONT, weight: '400', spacing: 6, align: 'center' })
  g.fillStyle = k.ink; g.fillRect(x + 12, y + 12, 46, 15)
  fit(g, '業務用', x + 35, y + 24, 40, 11, KRAFT, { align: 'center' })
  fit(g, k.en, x + W / 2, y + H * 0.21, W * 0.4, 12, k.accent, { weight: '800', spacing: 4, align: 'center' })
  fit(g, k.sub, x + W / 2, y + H * 0.79, W * 0.6, 13, k.ink, { weight: '800', align: 'center' })
  boxed(g, '350ml × 24缶', x + 12, y + H * 0.83, W * 0.26, 17, 10, k.ink)
  thisWayUp(g, x + W - 34, y + 9, 22, RED)
  fit(g, '天地無用', x + W - 23, y + 40, 32, 8, RED, { align: 'center' })
  marks(g, x + W * 0.36, y + H * 0.84, 12, k.ink)
  footnote(g, k, x + 12, y + H - 4, W * 0.55, k.ink)
}

/** a green tea's side: dark green straight on the board in a plain double frame, its name upright and big by 京都宇治, a pale teapot and
 * leaves, a round tea seal */
function teaSide(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  g.save()
  g.strokeStyle = k.ink
  g.lineWidth = 1.6; g.strokeRect(x + 10, y + 10, W - 20, H - 20)
  g.lineWidth = 0.8; g.strokeRect(x + 14.5, y + 14.5, W - 29, H - 29)
  g.restore()
  upright(g, k.name, x + W * 0.8, y + H * 0.13, 64, k.ink, SIGN_FONT, '400')
  upright(g, '京都宇治', x + W * 0.65, y + H * 0.16, 15, k.ink, MINCHO, '600')
  teapot(g, x + W * 0.29, y + H * 0.46, 132, k.ink)
  seal(g, '茶', x + W * 0.5, y + H * 0.26, 15, k.accent)
  fit(g, k.sub, x + 24, y + H * 0.8, W * 0.36, 9.5, k.ink, { weight: '700' })
  boxed(g, '350ml × 24缶', x + 24, y + H * 0.83, W * 0.24, 16, 9.5, k.ink, 1)
  thisWayUp(g, x + 22, y + 20, 18, RED)
  fit(g, '天地無用', x + 31, y + 45, 26, 6.5, RED, { align: 'center' })
  marks(g, x + W * 0.33, y + H * 0.82, 11, k.ink)
  footnote(g, k, x + W * 0.57, y + H - 19, W * 0.38, k.ink)
}

/** a cola's side: a red rounded panel, its name knocked out of it in round heavy letters with what it is under them; kept cool on its
 * left, handle with care on its right */
function colaSide(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  const px = x + W * 0.13, py = y + H * 0.15, pw = W * 0.6, ph = H * 0.56
  g.save()
  g.fillStyle = k.ink; g.beginPath(); g.roundRect(px, py, pw, ph, 16); g.fill()
  g.strokeStyle = KRAFT; g.lineWidth = 1.3; g.beginPath(); g.roundRect(px + 5, py + 5, pw - 10, ph - 10, 12); g.stroke()
  // (the name: filled and stroked with round joins in the board's colour, round and heavy)
  g.font = `900 52px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'
  const fw = g.measureText(k.name).width, sc = Math.min(1, (pw - 34) / fw)
  g.translate(px + pw / 2, py + ph * 0.6); g.scale(sc, 1)
  g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = KRAFT; g.fillStyle = KRAFT
  g.strokeText(k.name, 0, 0); g.fillText(k.name, 0, 0)
  g.restore()
  fit(g, k.sub, px + pw / 2, py + ph * 0.86, pw * 0.5, 14, KRAFT, { weight: '800', spacing: 7, align: 'center' })
  // (kept cool, upright on the left in a slim box; handle with care, boxed on the right)
  g.save(); g.strokeStyle = k.ink; g.lineWidth = 1.2; g.strokeRect(x + 14, y + H * 0.17, 20, H * 0.5); g.restore()
  upright(g, '冷暗所保管', x + 24, y + H * 0.19, 10.5, k.ink)
  boxed(g, 'ガラス瓶・アルミ缶', x + W * 0.76, y + H * 0.3, W * 0.21, 18, 8, k.ink, 2)
  fit(g, '取扱注意', x + W * 0.865, y + H * 0.56, W * 0.2, 15, k.ink, { weight: '900', align: 'center' })
  fit(g, '350ml × 24缶', px + pw / 2, y + H * 0.82, pw * 0.5, 12, k.ink, { align: 'center' })
  thisWayUp(g, x + W - 34, y + 9, 22, RED)
  fit(g, '天地無用', x + W - 23, y + 40, 32, 8, RED, { align: 'center' })
  marks(g, x + W * 0.72, y + H * 0.79, 12, k.ink)
  footnote(g, k, x + W * 0.17, y + H - 4, W * 0.55, k.ink)
}

/** a sour's side, modern and fresh: a strip of its colour down the left, its name in heavy plain letters, two flat blocks for its flavour,
 * its mark (a barrel, a lemon) to the right */
function sourSide(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  g.fillStyle = k.accent; g.fillRect(x, y, 13, H)
  g.save(); g.strokeStyle = k.ink; g.lineWidth = 1.2; g.strokeRect(x + 26, y + 13, 44, 15); g.restore()
  fit(g, '業務用', x + 48, y + 25, 38, 10, k.ink, { align: 'center' })
  fit(g, k.name, x + 26, y + H * 0.48, W * 0.56, 46, k.ink, { weight: '900', spacing: 1 })
  fit(g, k.en, x + 27, y + H * 0.58, W * 0.5, 10, k.ink, { weight: '700', spacing: 3.4 })
  const [b1, b2] = k.blocks ?? ['', '']
  g.fillStyle = k.accent; g.fillRect(x + 27, y + H * 0.64, 54, 21)
  fit(g, b1, x + 54, y + H * 0.64 + 15, 48, 12, '#fff6e2', { weight: '800', align: 'center' })
  g.fillStyle = k.ink; g.fillRect(x + 85, y + H * 0.64, 54, 21)
  fit(g, b2, x + 112, y + H * 0.64 + 15, 48, 12, '#fff6e2', { weight: '800', align: 'center' })
  fit(g, k.sub, x + 27, y + H * 0.84, W * 0.42, 9, k.ink, { weight: '600' })
  boxed(g, '350ml × 24缶', x + W * 0.52, y + H * 0.76, W * 0.2, 16, 9, k.ink)
  if (k.mark === 'barrel') barrel(g, x + W * 0.8, y + H * 0.5, 78, 96, k.ink, k.accent)
  else lemon(g, x + W * 0.79, y + H * 0.5, 38, k.ink, k.accent)
  thisWayUp(g, x + W - 32, y + H - 44, 20, RED)
  fit(g, '天地無用', x + W - 22, y + H - 14, 30, 7.5, RED, { align: 'center' })
  marks(g, x + W * 0.5, y + H * 0.88, 10, k.ink)
  footnote(g, k, x + 27, y + H - 4, W * 0.42, k.ink)
}

/** a case's long side, its top left x, y: its kind's own look, its bar code if it's printed here */
function side(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  g.save()
  g.beginPath(); g.rect(x, y, W, H); g.clip()
  if (k.look === 'beer') beerSide(g, k, x, y)
  else if (k.look === 'tea') teaSide(g, k, x, y)
  else if (k.look === 'cola') colaSide(g, k, x, y)
  else sourSide(g, k, x, y)
  codeOn(g, k, 'side', x, y, W, H)
  g.restore()
}

/** a case's end, its top left x, y: a die-cut handhole, the name in its kind's look under it, what's in it, the best-before and lot inked
 * on, this way up; its bar code if it's printed here */
function end(g: CanvasRenderingContext2D, k: Kind, x: number, y: number) {
  const m = 9, cx = x + D / 2
  g.save()
  g.beginPath(); g.rect(x, y, D, H); g.clip()
  if (k.look === 'beer') {
    // (its band at the side's height, the two meeting round the corner (the owner's: it sat lower, the corner a step))
    const t = y + H * 0.3, b = y + H * 0.66, gr = g.createLinearGradient(0, t, 0, b)
    gr.addColorStop(0, '#d5d8da'); gr.addColorStop(0.55, '#aeb2b5'); gr.addColorStop(1, '#c5c8ca')
    g.fillStyle = gr; g.fillRect(x, t, D, b - t)
    g.fillStyle = k.accent; g.fillRect(x, t - 6, D, 2.4); g.fillRect(x, b + 3.6, D, 2.4)
    fit(g, k.name, cx, b - (b - t) * 0.18, D * 0.74, 40, k.ink, { face: SIGN_FONT, weight: '400', spacing: 3, align: 'center' })
  } else if (k.look === 'tea') {
    fit(g, k.name, cx, y + H * 0.62, D * 0.5, 44, k.ink, { face: SIGN_FONT, weight: '400', spacing: 6, align: 'center' })
    fit(g, '京都宇治', cx, y + H * 0.72, D * 0.4, 11, k.ink, { face: MINCHO, weight: '600', spacing: 3, align: 'center' })
  } else if (k.look === 'cola') {
    const pw = D * 0.6, ph = H * 0.27, px = cx - pw / 2, py = y + H * 0.41
    g.save()
    g.fillStyle = k.ink; g.beginPath(); g.roundRect(px, py, pw, ph, 11); g.fill()
    g.font = `900 34px ${SANS}`; g.textAlign = 'center'
    const sc = Math.min(1, (pw - 20) / g.measureText(k.name).width)
    g.translate(cx, py + ph * 0.72); g.scale(sc, 1)
    g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = KRAFT; g.fillStyle = KRAFT
    g.strokeText(k.name, 0, 0); g.fillText(k.name, 0, 0)
    g.restore()
  } else {
    g.fillStyle = k.accent; g.fillRect(x, y, 9, H)
    fit(g, k.name, cx + D * 0.07, y + H * 0.6, D * 0.55, 28, k.ink, { weight: '900', align: 'center' })
    fit(g, k.en, cx + D * 0.07, y + H * 0.68, D * 0.5, 7.5, k.ink, { weight: '700', spacing: 2, align: 'center' })
    if (k.mark === 'barrel') barrel(g, x + D * 0.13, y + H * 0.56, 30, 38, k.ink, k.accent)
    else lemon(g, x + D * 0.13, y + H * 0.57, 15, k.ink, k.accent)
  }
  // (the handhole cut through whatever's printed there)
  handhole(g, cx, y + H * 0.24, 0.095 * PX, 0.027 * PX)
  fit(g, '350ml × 24缶', cx, y + H * 0.82, D * 0.5, 11, k.ink, { align: 'center' })
  // (best before and lot, inked on by the filler: a dot printer's grey, a little crooked)
  g.save()
  g.translate(x + m + 6, y + H - 9); g.rotate(-0.012)
  fit(g, `賞味期限 ${k.lot}`, 0, 0, D * 0.5, 8.5, 'rgba(30,30,34,0.82)', { face: MONO, weight: '600', spacing: 0.6 })
  g.restore()
  // (this way up: on the right, or the left where the bar code's taken the right)
  const left = k.code.on === 'end'
  thisWayUp(g, left ? x + m + 6 : x + D - m - 24, y + 12, 20, RED)
  fit(g, '天地無用', left ? x + m + 16 : x + D - m - 14, y + 42, 30, 7.5, RED, { align: 'center' })
  codeOn(g, k, 'end', x, y, D, H)
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
