// The pictures hung on the shop's walls that are the shop's own (items 295, 296): its people as they are drawn (data/crewLook, the figures'
// and the office's pictures' own list), put into photographs; painted once into a canvas each, frame and mat and all, for a thin board to
// carry. Everyone and every name in them made up.
import { featuresOf, TENUGUI, variantOf, WEAR, type Wear } from '@/data/crewLook'
import type { Look, Role } from '@/data/staff'

/** someone not of the shop (a guest in the photographs): their own clothes over the figure's, and sunglasses */
type Dress = { coat: string; collar: string; neck: string; shades?: boolean }
type Who = { id: string; role: Role | 'owner'; look: Look; peace?: boolean; sign?: string; dress?: Dress }
const INK = '#2e2018'

/** a soft colour a little lighter (k > 0) or darker (k < 0) */
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

/**
 * One of the shop's people as its figures are (a big round head over a small body), standing, smiling for the camera: `x` the middle of
 * their feet, `foot` the ground's height, `s` the head's radius. What they wear their job's (WEAR), their skin, hair and glasses their own
 * (featuresOf); the owner in his kappōgi with its red line and his twisted hachimaki. A peace sign, or a sign held up, if they're given one.
 */
export function drawFolk(g: CanvasRenderingContext2D, x: number, foot: number, s: number, w: Who) {
  const own = featuresOf(w.id, w.look)
  const owner = w.role === 'owner' && !w.dress
  const wear: Wear | null = w.dress ? { coat: w.dress.coat, collar: w.dress.collar, neck: w.dress.neck, head: 'band' } : owner ? null
    : WEAR[variantOf(w.role as Role, w.look.female)]
  const coat = wear ? wear.coat : '#f7f3ea'
  const bodyH = s * 1.35, bodyW = s * 1.45
  const headY = foot - bodyH - s * 0.82
  g.save()
  g.lineJoin = 'round'
  g.lineWidth = Math.max(1, s * 0.07)
  g.strokeStyle = INK
  // (its shadow at its feet)
  g.fillStyle = 'rgba(30,24,16,0.22)'
  g.beginPath(); g.ellipse(x, foot, bodyW * 0.62, s * 0.16, 0, 0, Math.PI * 2); g.fill()
  // (its legs, in the trousers' cloth, and its feet)
  const legs = wear ? wear.neck : '#2b2b30'
  g.fillStyle = legs
  for (const d of [-1, 1]) {
    g.beginPath(); g.roundRect(x + d * bodyW * 0.18 - s * 0.17, foot - s * 0.5, s * 0.34, s * 0.48, s * 0.08); g.fill(); g.stroke()
  }
  // (its body: the coat, a kimono's longer; the collar's bands crossed on its chest)
  const top = foot - bodyH - s * 0.2
  g.fillStyle = coat
  g.beginPath()
  g.moveTo(x - bodyW * 0.42, top + s * 0.15)
  g.quadraticCurveTo(x - bodyW * 0.55, foot - s * 0.45, x - bodyW * 0.48, foot - s * 0.42)
  g.lineTo(x + bodyW * 0.48, foot - s * 0.42)
  g.quadraticCurveTo(x + bodyW * 0.55, foot - s * 0.45, x + bodyW * 0.42, top + s * 0.15)
  g.quadraticCurveTo(x, top - s * 0.12, x - bodyW * 0.42, top + s * 0.15)
  g.fill(); g.stroke()
  // (what's on its cloth: the samue's pale grid, the kimono's little flowers)
  if (wear?.grid) {
    g.save(); g.clip()
    g.strokeStyle = 'rgba(220,226,240,0.35)'; g.lineWidth = Math.max(0.6, s * 0.03)
    for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * s * 0.22, top); g.lineTo(x + k * s * 0.22, foot); g.stroke() }
    for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(x - bodyW, top + k * s * 0.22); g.lineTo(x + bodyW, top + k * s * 0.22); g.stroke() }
    g.restore()
  }
  if (wear?.flowers) {
    g.fillStyle = 'rgba(244,196,210,0.85)'
    for (let k = 0; k < 9; k++) {
      const fx = x + Math.sin(k * 2.1) * bodyW * 0.36, fy = top + s * 0.3 + ((k * 0.37) % 1) * (bodyH - s * 0.4)
      g.beginPath(); g.arc(fx, fy, s * 0.06, 0, Math.PI * 2); g.fill()
    }
  }
  if (wear?.obi) {
    g.fillStyle = wear.obi
    g.fillRect(x - bodyW * 0.45, top + bodyH * 0.45, bodyW * 0.9, s * 0.26)
    g.strokeRect(x - bodyW * 0.45, top + bodyH * 0.45, bodyW * 0.9, s * 0.26)
  }
  // (the collar: its two bands crossed, left over right)
  g.strokeStyle = wear ? wear.collar : '#d8cfbd'
  g.lineWidth = s * 0.14
  g.beginPath(); g.moveTo(x - s * 0.34, top + s * 0.05); g.lineTo(x + s * 0.06, top + s * 0.62); g.stroke()
  g.beginPath(); g.moveTo(x + s * 0.34, top + s * 0.05); g.lineTo(x - s * 0.02, top + s * 0.5); g.stroke()
  if (owner) {
    // (the owner's kappōgi: its red line down its edge)
    g.strokeStyle = '#b8322a'; g.lineWidth = s * 0.06
    g.beginPath(); g.moveTo(x - s * 0.3, top + s * 0.1); g.lineTo(x + s * 0.08, top + s * 0.68); g.stroke()
  }
  g.strokeStyle = INK
  g.lineWidth = Math.max(1, s * 0.07)
  // (its arms: down at its sides; a hand up making a peace sign, or both up holding a sign)
  g.fillStyle = coat
  const hand = (hx: number, hy: number) => { g.fillStyle = own.skin; g.beginPath(); g.arc(hx, hy, s * 0.13, 0, Math.PI * 2); g.fill(); g.stroke() }
  if (w.sign) {
    for (const d of [-1, 1]) {
      g.fillStyle = coat
      g.beginPath(); g.moveTo(x + d * bodyW * 0.4, top + s * 0.25); g.lineTo(x + d * bodyW * 0.36, top + s * 0.75); g.lineWidth = s * 0.26; g.strokeStyle = coat; g.stroke()
      g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = INK
    }
    // (the sign: a board of pale wood held across in front, its words brushed on it)
    const sw = s * 3.1, sh = s * 0.9, sy = top + s * 0.55
    g.fillStyle = '#e7d3a8'
    g.beginPath(); g.roundRect(x - sw / 2, sy, sw, sh, s * 0.06); g.fill(); g.stroke()
    g.fillStyle = INK
    g.font = `700 ${Math.round(sh * 0.55)}px "LXGW WenKai TC", serif`
    g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(w.sign, x, sy + sh / 2)
    hand(x - sw / 2 + s * 0.1, sy + sh * 0.45)
    hand(x + sw / 2 - s * 0.1, sy + sh * 0.45)
  } else {
    for (const d of [-1, 1]) {
      const up = w.peace && d === 1
      g.strokeStyle = coat; g.lineWidth = s * 0.26
      g.beginPath(); g.moveTo(x + d * bodyW * 0.42, top + s * 0.25)
      if (up) g.lineTo(x + d * bodyW * 0.75, top - s * 0.25); else g.lineTo(x + d * bodyW * 0.5, top + s * 0.95)
      g.stroke()
      g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = INK
      if (up) {
        // (two fingers up)
        const hx = x + d * bodyW * 0.78, hy = top - s * 0.32
        g.strokeStyle = own.skin; g.lineWidth = s * 0.09
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - s * 0.1, hy - s * 0.32); g.moveTo(hx, hy); g.lineTo(hx + s * 0.08, hy - s * 0.32); g.stroke()
        g.lineWidth = Math.max(1, s * 0.07); g.strokeStyle = INK
        hand(hx, hy)
      } else hand(x + d * bodyW * 0.52, top + s * 1.0)
    }
  }
  // (its head: round, its skin; its hair under what's on its head)
  g.fillStyle = own.skin
  g.beginPath(); g.arc(x, headY, s, 0, Math.PI * 2); g.fill(); g.stroke()
  g.fillStyle = own.hair
  g.beginPath(); g.arc(x, headY, s, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill()
  const head = w.dress ? 'none' : owner ? 'hachimaki' : wear!.head
  if (head === 'cap') {
    g.fillStyle = TENUGUI
    g.beginPath(); g.arc(x, headY - s * 0.15, s * 0.96, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill(); g.stroke()
  } else if (head === 'band' || head === 'hachimaki') {
    // (a band round the brow: the white tenugui, the owner's twisted with red)
    g.fillStyle = TENUGUI
    g.beginPath(); g.roundRect(x - s * 0.98, headY - s * 0.62, s * 1.96, s * 0.26, s * 0.1); g.fill(); g.stroke()
    if (head === 'hachimaki') {
      g.strokeStyle = '#c0392b'; g.lineWidth = s * 0.06
      for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(x + k * s * 0.22, headY - s * 0.62); g.lineTo(x + k * s * 0.22 + s * 0.1, headY - s * 0.36); g.stroke() }
      g.strokeStyle = INK; g.lineWidth = Math.max(1, s * 0.07)
    }
  } else if (head === 'bun') {
    g.fillStyle = own.hair
    g.beginPath(); g.arc(x, headY - s * 1.05, s * 0.38, 0, Math.PI * 2); g.fill(); g.stroke()
    g.fillStyle = '#e8c45a'
    g.fillRect(x - s * 0.55, headY - s * 1.08, s * 1.1, s * 0.06)
  }
  // (its face: smiling, the eyes shut in two arcs, a cheek's blush, an open smile; glasses if it wears them)
  g.strokeStyle = INK
  g.lineWidth = Math.max(1, s * 0.08)
  for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * s * 0.36, headY + s * 0.08, s * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke() }
  g.fillStyle = 'rgba(232,120,110,0.35)'
  for (const d of [-1, 1]) { g.beginPath(); g.ellipse(x + d * s * 0.56, headY + s * 0.32, s * 0.16, s * 0.09, 0, 0, Math.PI * 2); g.fill() }
  g.fillStyle = '#8a2d24'
  g.beginPath(); g.moveTo(x - s * 0.2, headY + s * 0.4); g.quadraticCurveTo(x, headY + s * 0.72, x + s * 0.2, headY + s * 0.4); g.closePath(); g.fill(); g.stroke()
  if (w.dress?.shades) {
    // (dark glasses over the smiling eyes)
    g.fillStyle = '#16161a'
    for (const d of [-1, 1]) { g.beginPath(); g.ellipse(x + d * s * 0.36, headY + s * 0.06, s * 0.27, s * 0.19, 0, 0, Math.PI * 2); g.fill() }
    g.fillRect(x - s * 0.12, headY + s * 0.02, s * 0.24, s * 0.05)
  } else if (own.glasses) {
    g.lineWidth = Math.max(1, s * 0.06)
    for (const d of [-1, 1]) { g.beginPath(); g.arc(x + d * s * 0.36, headY + s * 0.08, s * 0.24, 0, Math.PI * 2); g.stroke() }
    g.beginPath(); g.moveTo(x - s * 0.12, headY + s * 0.06); g.lineTo(x + s * 0.12, headY + s * 0.06); g.stroke()
  }
  g.restore()
}

/** a photograph's frame and mat round it, and its print's own look: a warm film's tone, its corners a little darker */
export function frameAndMat(g: CanvasRenderingContext2D, W: number, H: number, frame: number, mat: number, wood = '#3a2416') {
  g.fillStyle = wood
  g.fillRect(0, 0, W, H)
  // (the frame's mouldings: a lighter bead inside, a darker edge outside)
  g.strokeStyle = shade(wood, 0.25); g.lineWidth = 3
  g.strokeRect(frame - 4, frame - 4, W - 2 * frame + 8, H - 2 * frame + 8)
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 4
  g.strokeRect(2, 2, W - 4, H - 4)
  g.fillStyle = '#f1ead9'
  g.fillRect(frame, frame, W - 2 * frame, H - 2 * frame)
  return { x: frame + mat, y: frame + mat, w: W - 2 * (frame + mat), h: H - 2 * (frame + mat) }
}
export function filmLook(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, date: string) {
  const v = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, r.h * 0.35, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.72)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.32)')
  g.fillStyle = v
  g.fillRect(r.x, r.y, r.w, r.h)
  g.fillStyle = 'rgba(255,214,150,0.08)'
  g.fillRect(r.x, r.y, r.w, r.h)
  // (the camera's own date in its corner, orange)
  g.font = `700 ${Math.round(r.h * 0.055)}px "Courier New", monospace`
  g.textAlign = 'right'; g.textBaseline = 'alphabetic'
  g.fillStyle = 'rgba(255,140,40,0.92)'
  g.fillText(date, r.x + r.w - r.h * 0.04, r.y + r.h - r.h * 0.04)
}

/**
 * The owner and the staff out together (item 296, the owner's, 2026-11-17: 「員工專用與美人圖這邊加一張老闆與員工出遊的合照」): a snapshot by
 * a lake under the mountain, a clear autumn day: the sky, Fuji with its snow, the lake and the far shore's woods in their reds and golds,
 * the shop's people lined up on the near bank smiling, the owner in the middle holding up the trip's sign, one of the young ones making a
 * peace sign; the camera's date in the corner. `zh`: the sign in Chinese (員工旅遊), or Japanese (社員旅行)
 */
export function paintOuting(g: CanvasRenderingContext2D, W: number, H: number, zh: boolean) {
  const r = frameAndMat(g, W, H, 26, 16)
  g.save()
  g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip()
  // (the sky)
  const sky = g.createLinearGradient(0, r.y, 0, r.y + r.h * 0.55)
  sky.addColorStop(0, '#6fa3d8'); sky.addColorStop(1, '#cfe2f2')
  g.fillStyle = sky; g.fillRect(r.x, r.y, r.w, r.h * 0.6)
  g.fillStyle = 'rgba(255,255,255,0.75)'
  for (const [cx, cy, s] of [[0.2, 0.12, 1], [0.72, 0.09, 1.3], [0.9, 0.2, 0.8]]) {
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(r.x + r.w * cx + k * 16 * s, r.y + r.h * cy + (k % 2) * 4, 22 * s, 9 * s, 0, 0, Math.PI * 2); g.fill() }
  }
  // (the mountain: its blue slopes, its snow cap ragged at its foot)
  const mx = r.x + r.w * 0.5, base = r.y + r.h * 0.5, peak = r.y + r.h * 0.13
  g.fillStyle = '#5d7da6'
  g.beginPath(); g.moveTo(r.x + r.w * 0.06, base); g.lineTo(mx - r.w * 0.07, peak); g.lineTo(mx + r.w * 0.07, peak); g.lineTo(r.x + r.w * 0.94, base); g.closePath(); g.fill()
  g.fillStyle = '#f4f6fa'
  g.beginPath(); g.moveTo(mx - r.w * 0.07, peak); g.lineTo(mx + r.w * 0.07, peak)
  for (let k = 0; k <= 8; k++) { const t = k / 8; g.lineTo(mx + r.w * (0.16 - 0.32 * t), peak + r.h * (0.09 + (k % 2) * 0.035)) }
  g.closePath(); g.fill()
  // (the far shore's woods in autumn, and the lake under them, the mountain's image in it)
  for (let k = 0; k < 40; k++) {
    const tx = r.x + (k / 40) * r.w, ty = base + Math.sin(k * 1.7) * 3
    g.fillStyle = ['#c0442a', '#d9822b', '#e0b13a', '#8a6a2a', '#4f6b32'][k % 5]
    g.beginPath(); g.arc(tx, ty, 9 + (k % 3) * 3, Math.PI, 0); g.fill()
  }
  const lake = g.createLinearGradient(0, base, 0, r.y + r.h * 0.7)
  lake.addColorStop(0, '#4f7fae'); lake.addColorStop(1, '#7fa9cf')
  g.fillStyle = lake; g.fillRect(r.x, base, r.w, r.h * 0.2)
  g.fillStyle = 'rgba(244,246,250,0.35)'
  g.beginPath(); g.moveTo(mx - r.w * 0.06, base + r.h * 0.17); g.lineTo(mx + r.w * 0.06, base + r.h * 0.17); g.lineTo(mx, base + r.h * 0.04); g.closePath(); g.fill()
  // (the near bank: grass and a gravel path where they stand)
  const bank = r.y + r.h * 0.7
  g.fillStyle = '#7d9a4a'; g.fillRect(r.x, bank, r.w, r.h * 0.3)
  g.fillStyle = '#b9a98a'; g.fillRect(r.x, bank + r.h * 0.12, r.w, r.h * 0.2)
  // (the people: the owner in the middle with the sign, the rest either side, the back row a little higher)
  const foot = r.y + r.h * 0.96, s = r.h * 0.085
  const cast: Who[] = [
    { id: 'outing-stock', role: 'stock', look: { age: 'old', female: false } as Look },
    { id: 'outing-chefF', role: 'chef', look: { age: 'young', female: true } as Look },
    { id: 'outing-owner', role: 'owner', look: { age: 'middle', female: false } as Look, sign: zh ? '員工旅遊' : '社員旅行' },
    { id: 'outing-serverF', role: 'server', look: { age: 'young', female: true } as Look },
    { id: 'outing-server', role: 'server', look: { age: 'young', female: false } as Look, peace: true },
  ]
  const back: Who[] = [
    { id: 'outing-chef', role: 'sous', look: { age: 'middle', female: false } as Look },
    { id: 'outing-cashier', role: 'cashier', look: { age: 'middle', female: true } as Look },
  ]
  back.forEach((w, k) => drawFolk(g, r.x + r.w * (0.36 + k * 0.28), foot - s * 1.0, s * 0.92, w))
  cast.forEach((w, k) => drawFolk(g, r.x + r.w * (0.13 + k * 0.185), foot, s, w))
  filmLook(g, r, "'26 10 12")
  g.restore()
}

/**
 * The corner by the way in where the shop's visitors have left their mark (item 295, the owner's, 2026-11-17: 「靠近玄關的門處牆壁會有些美食家
 * 的簽名及留言板+照片」), all made up: six signature cards in a grid (item 400: SIGN_CARDS, signCard; they were three signed boards, 色紙 with a
 * line brushed down them), a cork board pinned with the customers' notes and a postcard, and two photographs: the owner with a famous guest before the
 * noren, signed across in pen, and the shop on its first day in sepia. All one canvas (WALL_SIGNS' places on it), for the boards that carry
 * them.
 */
/** the wall signs' canvas over WALL_SIGNS.size (its pixels per place) */
export const SIGNS_PX = 2
export const WALL_SIGNS = {
  /** each piece's place on the canvas (x, y, w, h, its pixels) */
  /** the six signature cards (item 400), in a row along the canvas's foot */
  cards: [0, 1, 2, 3, 4, 5].map((k) => [k * 171, 352, 165, 140]) as [number, number, number, number][],
  board: [508, 0, 420, 300] as [number, number, number, number],
  photos: [[0, 192, 200, 150], [212, 192, 200, 150]] as [number, number, number, number][],
  /** a swatch of the frames' dark wood, and of the cards' white edge */
  wood: [940, 0, 20, 20] as [number, number, number, number],
  card: [970, 0, 20, 20] as [number, number, number, number],
  size: [1024, 512] as [number, number],
}
const BRUSH = '"LXGW WenKai TC", "Noto Serif TC", serif'
/** a little photograph's own frame and print, `draw` drawing what's in it into its print */
function snapshot(g: CanvasRenderingContext2D, [x, y, w, h]: number[], draw: (fr: { x: number; y: number; w: number; h: number }) => void) {
  g.save()
  g.translate(x, y)
  const fr = { x: 10, y: 10, w: w - 20, h: h - 20 }
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h)
  g.fillStyle = '#f1ead9'; g.fillRect(6, 6, w - 12, h - 12)
  g.beginPath(); g.rect(fr.x, fr.y, fr.w, fr.h); g.clip()
  draw(fr)
  g.restore()
}
export function paintWallSigns(g: CanvasRenderingContext2D, zh: boolean) {
  const [W, H] = WALL_SIGNS.size
  // (painted at twice its places' pixels (item 356: close to, it blurred): the canvas is WALL_SIGNS.size times SIGNS_PX)
  g.setTransform(SIGNS_PX, 0, 0, SIGNS_PX, 0, 0)
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#3a2416'; g.fillRect(...WALL_SIGNS.wood)
  g.fillStyle = '#e4e2dc'; g.fillRect(...WALL_SIGNS.card)
  // (the signature cards: their visitors' autographs, words and names, made up (item 400))
  SIGN_CARDS.forEach((c, k) => signCard(g, WALL_SIGNS.cards[k], c))
  // (the cork board (item 356, the owner's 「不OK」 over it: flat coloured squares each with a line and a squiggle, dots for pins, a lighthouse
  // postcard that had nothing to do with the shop): its frame's wood eased at the edge, the cork's grains of every size and shade, and pinned
  // on it what a shop's regulars leave: sticky notes with a corner curling up, a page torn off a lined pad, a till slip, a kraft card with a
  // little cake drawn on, a print of the grilled fish and one of the shop at night; each casting its shadow on the cork, held by a pin with a
  // shine on its head and its own shadow)
  {
    const [x, y, w, h] = WALL_SIGNS.board
    let r = 5
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
    // (the frame: dark wood, a lighter bevel inside, its grain)
    g.fillStyle = '#3e2615'; g.fillRect(x, y, w, h)
    g.strokeStyle = 'rgba(160,110,70,0.35)'; g.lineWidth = 1
    for (let k = 0; k < 24; k++) { const yy = y + 2 + k * 12.3; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + w * 0.3, yy - 2, x + w * 0.6, yy + 3, x + w, yy); g.stroke() }
    g.fillStyle = '#7a5232'; g.fillRect(x + 9, y + 9, w - 18, h - 18)
    g.fillStyle = '#2a180c'; g.fillRect(x + 11, y + 11, w - 22, h - 22)
    // (the cork: a warm ground, darker toward the frame, its grains, a few darker crumbs and pale chips)
    const cx0 = x + 12, cy0 = y + 12, cw = w - 24, ch = h - 24
    const cg = g.createRadialGradient(cx0 + cw / 2, cy0 + ch / 2, 20, cx0 + cw / 2, cy0 + ch / 2, cw * 0.7)
    cg.addColorStop(0, '#c99c66'); cg.addColorStop(1, '#a97c4a')
    g.fillStyle = cg; g.fillRect(cx0, cy0, cw, ch)
    const cols = ['138,90,48', '216,176,124', '168,116,66', '232,200,148', '110,70,38']
    for (let k = 0; k < 5200; k++) {
      const sz = rnd() < 0.82 ? 1 : rnd() < 0.8 ? 2 : 3
      g.fillStyle = `rgba(${cols[Math.floor(rnd() * cols.length)]},${0.35 + rnd() * 0.45})`
      g.fillRect(cx0 + rnd() * cw, cy0 + rnd() * ch, sz, sz * (0.7 + rnd() * 0.6))
    }
    // (a pushpin at (px, py): its shadow, its body, its head with a shine)
    const pin = (px: number, py: number, col: string) => {
      g.fillStyle = 'rgba(30,18,8,0.35)'; g.beginPath(); g.ellipse(px + 4, py + 5, 6, 4, 0.4, 0, Math.PI * 2); g.fill()
      const hg = g.createRadialGradient(px - 2, py - 2, 0.5, px, py, 6)
      hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.25, col); hg.addColorStop(1, shade(col, -0.45))
      g.fillStyle = hg; g.beginPath(); g.arc(px, py, 5.6, 0, Math.PI * 2); g.fill()
      g.strokeStyle = shade(col, -0.6); g.lineWidth = 0.8; g.stroke()
    }
    // (a paper's shadow on the cork, offset down and to the right, soft)
    const shadow = (nw: number, nh: number) => {
      g.fillStyle = 'rgba(40,24,10,0.14)'; g.fillRect(-nw / 2 + 2, -nh / 2 + 3, nw + 3, nh + 3)
      g.fillStyle = 'rgba(40,24,10,0.18)'; g.fillRect(-nw / 2 + 3, -nh / 2 + 4, nw, nh)
    }
    // (handwriting: a line of it, as big as fits, a touch uneven)
    const hand = (text: string, cx: number, cy: number, size: number, maxW: number, col = '#23284a') => {
      g.fillStyle = col
      g.font = `700 ${size}px ${BRUSH}`
      const fit = Math.min(1, maxW / Math.max(1, g.measureText(text).width))
      g.font = `700 ${Math.floor(size * fit)}px ${BRUSH}`
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(text, cx, cy)
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'
    // 1 (a yellow sticky note, its lower right corner curling up off the cork; a little fish drawn under the words)
    g.save(); g.translate(x + 74, y + 66); g.rotate(-0.06)
    shadow(96, 82)
    const yg = g.createLinearGradient(0, -41, 0, 41); yg.addColorStop(0, '#fff6a6'); yg.addColorStop(1, '#f6e47c')
    g.fillStyle = yg; g.beginPath(); g.moveTo(-48, -41); g.lineTo(48, -41); g.lineTo(48, 25); g.lineTo(32, 41); g.lineTo(-48, 41); g.closePath(); g.fill()
    g.fillStyle = '#e8d266'; g.beginPath(); g.moveTo(48, 25); g.lineTo(32, 41); g.lineTo(36, 27); g.closePath(); g.fill()
    g.fillStyle = 'rgba(40,24,10,0.2)'; g.beginPath(); g.moveTo(48, 25); g.lineTo(52, 30); g.lineTo(34, 44); g.lineTo(32, 41); g.closePath(); g.fill()
    hand(zh ? '謝謝招待！' : 'ごちそうさま！', 0, -12, 20, 84)
    g.strokeStyle = '#23284a'; g.lineWidth = 1.6
    g.beginPath(); g.ellipse(-6, 16, 14, 6, 0, 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.moveTo(8, 16); g.lineTo(18, 10); g.lineTo(18, 22); g.closePath(); g.stroke()
    g.fillStyle = '#23284a'; g.beginPath(); g.arc(-14, 15, 1.4, 0, Math.PI * 2); g.fill()
    g.restore()
    pin(x + 74, y + 30, '#d23a2a')
    // 2 (a pink sticky note)
    g.save(); g.translate(x + 172, y + 62); g.rotate(0.05)
    shadow(86, 74)
    const pg = g.createLinearGradient(0, -37, 0, 37); pg.addColorStop(0, '#ffd9e4'); pg.addColorStop(1, '#f9c2d2')
    g.fillStyle = pg; g.fillRect(-43, -37, 86, 74)
    hand(zh ? '下次再來～' : 'また来ます～', 0, -6, 19, 76)
    hand(zh ? '小美' : 'みき', 22, 22, 12, 40, '#7a3a50')
    g.restore()
    pin(x + 172, y + 28, '#2a5ad2')
    // 3 (a print of the grilled fish on its plate, a white border, words written under it)
    g.save(); g.translate(x + 266, y + 78); g.rotate(-0.04)
    shadow(92, 108)
    g.fillStyle = '#fbfaf6'; g.fillRect(-46, -54, 92, 108)
    g.fillStyle = '#3a2a22'; g.fillRect(-40, -48, 80, 70)
    const pl = g.createRadialGradient(0, -12, 4, 0, -12, 36); pl.addColorStop(0, '#f4f0e8'); pl.addColorStop(1, '#cfc7b8')
    g.fillStyle = pl; g.beginPath(); g.ellipse(0, -13, 34, 22, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#b7712f'; g.beginPath(); g.ellipse(-3, -14, 22, 8, -0.08, 0, Math.PI * 2); g.fill()
    g.beginPath(); g.moveTo(17, -15); g.lineTo(28, -22); g.lineTo(28, -7); g.closePath(); g.fill()
    g.strokeStyle = '#5a3216'; g.lineWidth = 1.6
    for (const k of [-12, -4, 4]) { g.beginPath(); g.moveTo(-3 + k - 3, -20); g.lineTo(-3 + k + 3, -8); g.stroke() }
    g.fillStyle = '#e8e2c8'; g.beginPath(); g.ellipse(14, 0, 6, 3, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#f2d23a'; g.beginPath(); g.ellipse(-24, -2, 5, 3, 0.3, 0, Math.PI * 2); g.fill()
    hand(zh ? '烤魚超讚' : '焼き魚最高', 0, 38, 17, 80)
    g.restore()
    pin(x + 266, y + 28, '#2aa04a')
    // 4 (a page torn off a lined pad: its blue lines, its torn top edge)
    g.save(); g.translate(x + 86, y + 166); g.rotate(0.04)
    shadow(100, 80)
    g.fillStyle = '#fdfdf8'
    g.beginPath(); g.moveTo(-50, -34)
    for (let i = 0; i <= 20; i++) g.lineTo(-50 + i * 5, -40 + (i % 2 ? 3 : 0) + (rnd() - 0.5) * 2)
    g.lineTo(50, 40); g.lineTo(-50, 40); g.closePath(); g.fill()
    g.strokeStyle = 'rgba(80,120,200,0.45)'; g.lineWidth = 1
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-46, -18 + k * 16); g.lineTo(46, -18 + k * 16); g.stroke() }
    g.strokeStyle = 'rgba(210,70,70,0.4)'; g.beginPath(); g.moveTo(-34, -36); g.lineTo(-34, 40); g.stroke()
    hand(zh ? '老闆好帥' : '大将かっこいい', 6, -4, 21, 80)
    hand(zh ? '— 隔壁桌' : '— となりの席', 18, 22, 11, 60, '#4a4a60')
    g.restore()
    pin(x + 86, y + 130, '#e0a020')
    // 5 (a kraft card with a little cake drawn on it)
    g.save(); g.translate(x + 192, y + 168); g.rotate(-0.05)
    shadow(90, 78)
    g.fillStyle = '#d6b88a'; g.fillRect(-45, -39, 90, 78)
    g.strokeStyle = 'rgba(120,80,40,0.25)'; g.lineWidth = 1
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-45, -30 + k * 13); g.lineTo(45, -28 + k * 13); g.stroke() }
    hand(zh ? '生日快樂' : 'お誕生日', 0, -16, 19, 80, '#5a2a18')
    g.fillStyle = '#f6e6d0'; g.fillRect(-14, 6, 28, 14)
    g.fillStyle = '#e05a6a'; g.fillRect(-14, 6, 28, 4)
    g.fillStyle = '#f0f0f0'; g.fillRect(-1.5, -4, 3, 10)
    g.fillStyle = '#ffb030'; g.beginPath(); g.ellipse(0, -6, 2.4, 4, 0, 0, Math.PI * 2); g.fill()
    hand('2026.10', 0, 30, 10, 60, '#5a2a18')
    g.restore()
    pin(x + 192, y + 133, '#d23a2a')
    // 6 (a till slip, its torn foot zigzag, a dish written on it and circled)
    g.save(); g.translate(x + 52, y + 248); g.rotate(0.07)
    shadow(64, 64)
    g.fillStyle = '#fbf9f2'
    g.beginPath(); g.moveTo(-32, -32); g.lineTo(32, -32); g.lineTo(32, 28)
    for (let i = 0; i <= 8; i++) g.lineTo(32 - i * 8, 28 + (i % 2 ? 4 : 0))
    g.closePath(); g.fill()
    g.strokeStyle = 'rgba(60,60,60,0.35)'; g.setLineDash([3, 3]); g.lineWidth = 1
    g.beginPath(); g.moveTo(-26, -18); g.lineTo(26, -18); g.stroke(); g.setLineDash([])
    hand(zh ? '鹽烤鯖魚' : '鯖の塩焼き', 0, -2, 14, 56, '#2a2a2a')
    hand(zh ? '必點！' : '必食！', 0, 16, 13, 50, '#c0281c')
    g.strokeStyle = '#c0281c'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 6, 30, 20, 0.05, 0, Math.PI * 2); g.stroke()
    g.restore()
    pin(x + 52, y + 218, '#2a5ad2')
    // 7 (a print of the shop at night: its front, the red lantern lit, the noren; pinned at both top corners)
    g.save(); g.translate(x + 316, y + 214); g.rotate(0.035)
    shadow(128, 92)
    g.fillStyle = '#fbfaf6'; g.fillRect(-64, -46, 128, 92)
    const ng = g.createLinearGradient(0, -40, 0, 40); ng.addColorStop(0, '#141a30'); ng.addColorStop(1, '#2a2430')
    g.fillStyle = ng; g.fillRect(-58, -40, 116, 80)
    g.fillStyle = '#2a1a12'; g.fillRect(-50, -22, 100, 8)
    g.fillStyle = '#3a2a20'; g.fillRect(-42, -14, 84, 52)
    g.fillStyle = 'rgba(255,190,110,0.85)'; g.fillRect(-20, -6, 40, 44)
    g.fillStyle = '#26345a'; for (const k of [0, 1, 2]) g.fillRect(-20 + k * 13.6, -6, 12.6, 16)
    const lg = g.createRadialGradient(-30, 4, 1, -30, 4, 18); lg.addColorStop(0, 'rgba(255,120,60,0.9)'); lg.addColorStop(1, 'rgba(255,120,60,0)')
    g.fillStyle = lg; g.fillRect(-48, -14, 36, 36)
    g.fillStyle = '#e8402a'; g.beginPath(); g.ellipse(-30, 4, 7, 11, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgba(255,240,220,0.9)'; g.font = `700 8px ${BRUSH}`; g.fillText('聞', -30, 4)
    hand(zh ? '聞野・夜' : '聞野・夜', 34, -32, 10, 40, '#f2ead8')
    g.restore()
    pin(x + 316 - 58, y + 214 - 44, '#2aa04a'); pin(x + 316 + 58, y + 214 - 40, '#d23a2a')
  }
  // (the owner with a famous guest before the noren, signed across in silver pen)
  snapshot(g, WALL_SIGNS.photos[0], (fr) => {
    g.fillStyle = '#e9dcc0'; g.fillRect(fr.x, fr.y, fr.w, fr.h)
    // (the noren: three panels of indigo, split from a little under its top, the shop's crest (聞 in a ring) on the middle one)
    const nx = fr.x + fr.w * 0.06, nw = fr.w * 0.88, nh = fr.h * 0.56
    g.fillStyle = '#26345a'; g.fillRect(nx, fr.y, nw, nh)
    g.fillStyle = '#e9dcc0'
    for (const k of [1, 2]) g.fillRect(nx + (nw * k) / 3 - 1, fr.y + fr.h * 0.12, 2, nh - fr.h * 0.12)
    const cx = fr.x + fr.w * 0.5, cy = fr.y + fr.h * 0.24, cr = fr.h * 0.12
    g.strokeStyle = '#f2ead8'; g.lineWidth = 2
    g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.stroke()
    g.fillStyle = '#f2ead8'; g.font = `700 ${Math.round(cr * 1.3)}px ${BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText('聞', cx, cy + 1)
    g.fillStyle = '#6a4a2a'; g.fillRect(fr.x, fr.y + fr.h * 0.8, fr.w, fr.h * 0.2)
    drawFolk(g, fr.x + fr.w * 0.34, fr.y + fr.h * 0.97, fr.h * 0.16, { id: 'photo-owner', role: 'owner', look: { age: 'middle', female: false } as Look })
    drawFolk(g, fr.x + fr.w * 0.66, fr.y + fr.h * 0.97, fr.h * 0.16, { id: 'photo-guest', role: 'server', look: { age: 'middle', female: false } as Look, peace: true,
      dress: { coat: '#2a2a30', collar: '#e8e8ec', neck: '#1c1c22', shades: true } })
    // (the guest's autograph in silver pen over the noren's left panel: a run of loops rising, a swash under it)
    g.strokeStyle = 'rgba(236,238,246,0.95)'; g.lineWidth = 1.6; g.lineCap = 'round'
    g.beginPath()
    const sx = fr.x + fr.w * 0.1, sy = fr.y + fr.h * 0.46, L = fr.w * 0.26
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = t * Math.PI * 2 * 3.5
      const px = sx + L * t + 4.5 * Math.sin(a), py = sy - fr.h * 0.16 * t - 5.5 * (1 - Math.cos(a)) * (1 - t * 0.4)
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py)
    }
    g.stroke()
    g.beginPath(); g.moveTo(sx - 2, sy + 5); g.quadraticCurveTo(sx + L * 0.6, sy + 1, sx + L * 1.05, sy - fr.h * 0.12); g.stroke()
    filmLook(g, fr, "'25 12 03")
  })
  // (the shop on its first day: its front, eave, lantern and noren, the owner before it, in sepia)
  snapshot(g, WALL_SIGNS.photos[1], (fr) => {
    g.fillStyle = '#d8c6a0'; g.fillRect(fr.x, fr.y, fr.w, fr.h)
    g.fillStyle = '#5a4630'; g.fillRect(fr.x, fr.y + fr.h * 0.18, fr.w, fr.h * 0.1)
    g.fillStyle = '#7a6448'; g.fillRect(fr.x + fr.w * 0.12, fr.y + fr.h * 0.28, fr.w * 0.76, fr.h * 0.6)
    g.fillStyle = '#4a3a28'; g.fillRect(fr.x + fr.w * 0.36, fr.y + fr.h * 0.28, fr.w * 0.3, fr.h * 0.34)
    g.fillStyle = '#2a2018'
    for (const k of [0, 1, 2]) g.fillRect(fr.x + fr.w * (0.365 + k * 0.098), fr.y + fr.h * 0.28, fr.w * 0.09, fr.h * 0.16)
    g.fillStyle = '#8a5a3a'; g.beginPath(); g.ellipse(fr.x + fr.w * 0.24, fr.y + fr.h * 0.46, 9, 14, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#4a3a28'; g.fillRect(fr.x + fr.w * 0.24 - 6, fr.y + fr.h * 0.46 - 15, 12, 3); g.fillRect(fr.x + fr.w * 0.24 - 6, fr.y + fr.h * 0.46 + 12, 12, 3)
    // (a stand of congratulation flowers by the door: a ring of blooms on its legs)
    const fx = fr.x + fr.w * 0.82, fy = fr.y + fr.h * 0.5
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5
    g.beginPath(); g.moveTo(fx - 8, fr.y + fr.h * 0.88); g.lineTo(fx, fy); g.lineTo(fx + 8, fr.y + fr.h * 0.88); g.stroke()
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      g.fillStyle = k % 2 ? '#e8d8c0' : '#b89070'
      g.beginPath(); g.arc(fx + Math.cos(a) * 11, fy - 6 + Math.sin(a) * 11, 4.5, 0, Math.PI * 2); g.fill()
    }
    g.fillStyle = '#f0e6d0'; g.fillRect(fx - 3, fy - 2, 6, 22)
    g.fillStyle = '#3a2a1a'; g.fillRect(fr.x, fr.y + fr.h * 0.86, fr.w, fr.h * 0.14)
    drawFolk(g, fr.x + fr.w * 0.62, fr.y + fr.h * 0.97, fr.h * 0.13, { id: 'photo-owner', role: 'owner', look: { age: 'middle', female: false } as Look })
    g.globalCompositeOperation = 'color'
    g.fillStyle = 'rgb(150,110,60)'; g.fillRect(fr.x, fr.y, fr.w, fr.h)
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = 'rgba(255,240,210,0.18)'; g.fillRect(fr.x, fr.y, fr.w, fr.h)
    g.fillStyle = '#3a2a1a'
    g.font = `700 13px ${BRUSH}`
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'
    g.fillText(zh ? '開店紀念 2024' : '開店記念 2024', fr.x + 6, fr.y + 16)
  })
}

/**
 * The visitors' signature cards (item 400, the owner's, 2026-11-20: a photograph of a wall of them, 「先給你看一下，簽名的樣子」; after items
 * 384 and 390, the signatures in marker on the plaster: their names were set in a handwriting typeface (Caveat, the WenKai), neat letters
 * that read as typing, not as anyone's signature, and they were dotted about the wall): six white cards in a grid, each signed as an
 * autograph is, in one run of the pen: a big capital, the rest of the name run together fast into humps and loops, smaller as it goes, a
 * flourish swung back under it or up off its end, the line thinner where the pen ran fast; who it's to small over it, a line or two and
 * the day by it, the name printed small in its corner. The autographs drawn stroke by stroke (no typeface), each from its own name's
 * letters and its own seed; all made up. Only one to the shop by its name (item 399: not 聞野 on everything).
 */
const HAND = '"LXGW WenKai TC", "Segoe Print", "Comic Sans MS", cursive'
const PENS = { black: '#1c1c22', blue: '#1f3c9e', red: '#c3282d' }
type Pen = keyof typeof PENS
type Flourish = 'under' | 'rise' | 'loop'
/** one card: who it's to, the name it's signed with (its letters shape the autograph), the name printed under it, its line or two, the
 * day, the pen, the autograph's seed, its capital (0: a loop on a tall stem, 1: a big oval, 2: a stroke up, a loop and a leg) and its
 * flourish, and a little drawing after the line */
type SignCard = { to: string; sign: string; name: string; lines: string[]; date: string; pen: Pen; seed: number; cap: 0 | 1 | 2; end: Flourish
  doodle?: 'fish' | 'smile' | 'heart' | 'star' }
export const SIGN_CARDS: SignCard[] = [
  { to: 'To 老闆', sign: 'Sakura', name: 'さくら', lines: ['炭火の香り、', '最高でした！'], date: '2026.10.5', pen: 'black', seed: 11, cap: 1, end: 'under', doodle: 'fish' },
  { to: 'To 聞野', sign: 'Xiaoyu', name: '美食家 林小雨', lines: ['好吃到想哭！'], date: '2026.6.12', pen: 'black', seed: 23, cap: 2, end: 'rise' },
  { to: 'To Chef', sign: 'Kenyui', name: 'Ken & Yui', lines: ['結婚一週年', 'ありがとう！'], date: '2026.11.8', pen: 'red', seed: 37, cap: 2, end: 'loop', doodle: 'heart' },
  { to: '給老闆', sign: 'Ahsiang', name: '阿翔', lines: ['老闆加油！'], date: '2026.11.15', pen: 'black', seed: 41, cap: 0, end: 'under', doodle: 'star' },
  { to: '店長さんへ', sign: 'Misaki', name: '大阪より 美咲', lines: ['また来ます！'], date: '2026.10.21', pen: 'blue', seed: 53, cap: 1, end: 'rise', doodle: 'smile' },
  { to: 'To 大家', sign: 'Kurokawa', name: '料理評論 黒川', lines: ['魚が主役の店'], date: '2025.12.3', pen: 'black', seed: 67, cap: 0, end: 'loop' },
]
/** every character the cards' words are written in, for the hand's letters to be asked for */
export const CARD_CHARS = [...new Set(SIGN_CARDS.flatMap((c) => [c.to, c.name, ...c.lines, c.date]).join(''))].join('')
/** a point of an autograph in its own frame: x along it, y up it, its capital about a unit tall */
type P2 = [number, number]
/** a cubic's points on from the stroke's last one, n of them */
function curve(s: P2[], c1: P2, c2: P2, e: P2, n = 12) {
  const [ax, ay] = s[s.length - 1]
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    s.push([u * u * u * ax + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
      u * u * u * ay + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1]])
  }
}
/** the letters that rise in a loop, that drop in one, and the little round ones */
const ASC = 'bdfhklt', DESC = 'gjpqy', ROUND = 'aceos'
/** the autograph of `name`: its strokes, the run of the pen first, then what's put in after it (an i's dot, a t's bar) */
function autograph(name: string, seed: number, cap: 0 | 1 | 2, end: Flourish): P2[][] {
  let r = seed * 9301 + 49297
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647)
  const run: P2[] = [], marks: P2[][] = []
  const W = 0.4 + rnd() * 0.14
  if (cap === 0) {
    // (a loop at the head of a tall stem dropped through the line and curled back up: an L's, a J's)
    run.push([0.06, 0.55])
    curve(run, [0.0, 0.88], [0.16, 1.1], [0.3, 1.04])
    curve(run, [0.44, 0.98], [0.26, 0.22], [0.18, -0.24])
    curve(run, [0.1, -0.5], [W * 0.85, -0.18], [W, 0.3])
  } else if (cap === 1) {
    // (a big oval, round the other way and in at its top, its tail run on into the rest: an S's, an O's)
    run.push([W * 0.9, 0.82])
    curve(run, [W * 0.62, 1.16], [0.0, 1.02], [0.0, 0.5])
    curve(run, [0.0, -0.05], [W * 0.42, -0.14], [W * 0.72, 0.02])
    curve(run, [W * 1.06, 0.16], [W * 1.02, 0.42], [W * 0.92, 0.56])
    curve(run, [W * 0.84, 0.36], [W * 0.92, 0.04], [W * 1.12, 0.02])
  } else {
    // (a stroke straight up, back down it, out in a loop to a leg kicked off to the right: a K's, an R's)
    run.push([0.0, 0.02])
    curve(run, [0.02, 0.45], [0.06, 0.95], [0.16, 1.05])
    curve(run, [0.22, 0.92], [0.15, 0.3], [0.12, -0.04])
    curve(run, [0.1, 0.38], [W * 0.62, 0.98], [W * 0.82, 0.74])
    curve(run, [W * 0.55, 0.46], [W * 0.78, 0.1], [W * 1.05, 0.0])
  }
  // (the rest of the name run together, fast: each letter a hump, a loop up or down, or a little round one, smaller as it goes)
  const xh = 0.34 + rnd() * 0.08
  const rest = name.slice(1).toLowerCase().replace(/[^a-z]/g, '')
  rest.split('').forEach((ch, i) => {
    const [x0] = run[run.length - 1]
    const k = Math.max(0.62, 1 - i * 0.07), w = (0.15 + rnd() * 0.07) * (0.85 + k * 0.15), h = xh * k * (0.88 + rnd() * 0.24)
    if (ASC.includes(ch)) {
      const top = (0.72 + rnd() * 0.25) * (0.8 + k * 0.2)
      curve(run, [x0 + w * 0.45, 0.28], [x0 + w * 0.95, top], [x0 + w * 0.6, top])
      curve(run, [x0 + w * 0.25, top * 0.98], [x0 + w * 0.3, 0.15], [x0 + w * 0.5, 0.0])
      curve(run, [x0 + w * 0.65, -0.04], [x0 + w * 0.85, 0.0], [x0 + w, 0.04], 6)
      if (ch === 't') marks.push([[x0 + w * 0.1, top * 0.66], [x0 + w * 1.25, top * 0.74]])
    } else if (DESC.includes(ch)) {
      curve(run, [x0 + w * 0.2, h * 0.7], [x0 + w * 0.45, h], [x0 + w * 0.55, h * 0.9])
      curve(run, [x0 + w * 0.68, h * 0.3], [x0 + w * 0.6, -0.42], [x0 + w * 0.42, -0.5])
      curve(run, [x0 + w * 0.15, -0.52], [x0 + w * 0.5, -0.08], [x0 + w, 0.08])
    } else if (ROUND.includes(ch)) {
      curve(run, [x0 + w * 0.15, h * 0.55], [x0 + w * 0.45, h * 1.02], [x0 + w * 0.7, h * 0.95], 8)
      curve(run, [x0 + w * 0.42, h * 1.2], [x0 - w * 0.02, h * 0.8], [x0 + w * 0.12, h * 0.38], 8)
      curve(run, [x0 + w * 0.2, h * 0.02], [x0 + w * 0.62, h * 0.08], [x0 + w * 0.7, h * 0.7], 8)
      curve(run, [x0 + w * 0.72, h * 0.32], [x0 + w * 0.82, 0.02], [x0 + w, 0.02], 8)
    } else {
      curve(run, [x0 + w * 0.08, h * 0.62], [x0 + w * 0.2, h * 1.12], [x0 + w * 0.48, h], 8)
      curve(run, [x0 + w * 0.72, h * 0.92], [x0 + w * 0.82, h * 0.25], [x0 + w, 0.0], 8)
      if (ch === 'i' || ch === 'j') marks.push([[x0 + w * 0.42, h * 1.55], [x0 + w * 0.56, h * 1.62]])
    }
  })
  // (and its flourish)
  const [xe, ye] = run[run.length - 1]
  if (end === 'under') {
    // (down off its end and swept back under the whole of it, hooked up at its start)
    curve(run, [xe + 0.1, ye - 0.04], [xe + 0.2, -0.08], [xe + 0.16, -0.16], 8)
    curve(run, [xe * 0.75, -0.4], [xe * 0.25, -0.44], [-0.06, -0.3], 24)
    curve(run, [-0.14, -0.26], [-0.18, -0.18], [-0.14, -0.1], 6)
  } else if (end === 'rise') {
    // (on off its end and up, long, in one fast stroke)
    curve(run, [xe + 0.12, ye - 0.14], [xe + 0.34, 0.12], [xe + 0.58, 0.78], 18)
  } else {
    // (up off its end and back over it in a wide loop, down through it and out under)
    curve(run, [xe + 0.32, 0.5], [xe + 0.12, 1.22], [xe * 0.55, 1.16], 18)
    curve(run, [xe * 0.25, 1.1], [xe * 0.24, 0.3], [xe * 0.34, -0.3], 18)
    curve(run, [xe * 0.42, -0.62], [xe + 0.1, -0.34], [xe + 0.36, -0.1], 18)
  }
  return [run, ...marks]
}
/** the autograph's strokes laid into a box on the card (x, y, w, h), climbing at `rise` (rad), as big as they'll go; drawn in the pen's
 * line, thinner where it ran fast (its points further apart) and lifted off at its ends; a dot or a bar in one stroke */
function signInto(g: CanvasRenderingContext2D, strokes: P2[][], [x, y, w, h]: number[], rise: number, width: number) {
  const c = Math.cos(rise), s = Math.sin(rise)
  const turned = strokes.map((st) => st.map(([u, v]) => [u * c - v * s, u * s + v * c] as P2))
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const st of turned) for (const [u, v] of st) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v) }
  const k = Math.min(w / (x1 - x0), h / (y1 - y0))
  const ox = x + (w - (x1 - x0) * k) / 2 - x0 * k, oy = y + (h - (y1 - y0) * k) / 2 + y1 * k
  for (const st of turned) {
    const pts = st.map(([u, v]) => [ox + u * k, oy - v * k] as P2)
    if (pts.length === 2) {
      g.lineWidth = width * 0.85
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[1][0], pts[1][1]); g.stroke()
      continue
    }
    let mean = 0
    for (let i = 1; i < pts.length; i++) mean += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    mean /= pts.length - 1
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1), seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
      const fast = Math.min(1.15, Math.max(0.62, 1.3 - 0.4 * (seg / (mean || 1))))
      const ends = Math.max(0, Math.min(1, t / 0.04, (1 - t) / 0.08))
      g.lineWidth = Math.max(0.5, width * fast * (0.35 + 0.65 * ends))
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke()
    }
  }
}
/** a little drawing in the pen's line, `s` across, centred on (x, y) */
function doodle(g: CanvasRenderingContext2D, kind: NonNullable<SignCard['doodle']>, x: number, y: number, s: number) {
  g.lineWidth = Math.max(0.7, s * 0.08)
  g.beginPath()
  if (kind === 'fish') {
    // (a fish grilled on its skewer: its body, tail, eye, the grill's two marks across it, the skewer out of its mouth)
    const r = s * 0.36
    g.ellipse(x - s * 0.05, y, r, r * 0.46, 0, 0, Math.PI * 2)
    g.moveTo(x + r * 0.9, y); g.lineTo(x + r * 1.45, y - r * 0.42); g.lineTo(x + r * 1.45, y + r * 0.42); g.closePath()
    g.moveTo(x - r * 0.25, y - r * 0.3); g.lineTo(x - r * 0.05, y + r * 0.3)
    g.moveTo(x + r * 0.1, y - r * 0.3); g.lineTo(x + r * 0.3, y + r * 0.3)
    g.moveTo(x - r * 1.5, y); g.lineTo(x - r * 1.05, y)
    g.stroke()
    g.beginPath(); g.arc(x - r * 0.62, y - r * 0.08, s * 0.035, 0, Math.PI * 2); g.fill()
  } else if (kind === 'smile') {
    const r = s * 0.42
    g.arc(x, y, r, 0, Math.PI * 2)
    // (its eyes shut with smiling, its mouth wide)
    g.moveTo(x - r * 0.55, y - r * 0.12); g.quadraticCurveTo(x - r * 0.35, y - r * 0.42, x - r * 0.15, y - r * 0.12)
    g.moveTo(x + r * 0.15, y - r * 0.12); g.quadraticCurveTo(x + r * 0.35, y - r * 0.42, x + r * 0.55, y - r * 0.12)
    g.moveTo(x - r * 0.5, y + r * 0.2); g.quadraticCurveTo(x, y + r * 0.75, x + r * 0.5, y + r * 0.2)
    g.stroke()
  } else if (kind === 'heart') {
    const r = s * 0.42
    g.moveTo(x, y + r * 0.95)
    g.bezierCurveTo(x - r * 1.35, y + r * 0.05, x - r * 0.75, y - r * 1.0, x, y - r * 0.38)
    g.bezierCurveTo(x + r * 0.75, y - r * 1.0, x + r * 1.35, y + r * 0.05, x, y + r * 0.95)
    g.stroke()
  } else {
    const r = s * 0.46
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? 0.42 : 1
      if (i) g.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k)
      else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    }
    g.stroke()
  }
}
/** words written small in the card's pen (gone over once at their edge, a marker's stroke fuller than a pen's), or printed (`print`) */
function words(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign, print = false) {
  g.font = `${print ? 400 : 700} ${size}px ${HAND}`
  g.textAlign = align; g.textBaseline = 'alphabetic'
  g.fillText(text, x, y)
  if (!print) { g.lineWidth = size * 0.04; g.strokeText(text, x, y) }
  return g.measureText(text).width
}
/** one signature card: white with a faint sheen, its edge a shade darker; signed */
function signCard(g: CanvasRenderingContext2D, [x, y, w, h]: number[], c: SignCard) {
  g.save()
  g.fillStyle = '#f7f6f1'; g.fillRect(x, y, w, h)
  const sh = g.createLinearGradient(x, y, x + w, y + h)
  sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.36, 'rgba(255,255,255,0)')
  sh.addColorStop(0.44, 'rgba(255,255,255,0.65)'); sh.addColorStop(0.52, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = sh; g.fillRect(x, y, w, h)
  g.strokeStyle = 'rgba(120,118,110,0.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  const col = PENS[c.pen]
  g.fillStyle = col; g.strokeStyle = col
  g.lineCap = 'round'; g.lineJoin = 'round'
  // (a marker on gloss: barely any bleed)
  g.shadowColor = col; g.shadowBlur = 0.6
  // (who it's to, small, at the top left, a little aslant)
  g.save(); g.translate(x + w * 0.07, y + h * 0.15); g.rotate(-0.05); words(g, c.to, 0, 0, h * 0.085, 'left'); g.restore()
  // (the autograph, big, climbing across the middle)
  signInto(g, autograph(c.sign, c.seed, c.cap, c.end), [x + w * 0.07, y + h * 0.19, w * 0.86, h * 0.54], 0.1 + (c.seed % 7) * 0.025, h * 0.026)
  // (its line or two at the left under it, the drawing after the last)
  c.lines.forEach((l, i) => {
    const ly = y + h * (c.lines.length > 1 ? 0.8 + i * 0.095 : 0.85)
    const lw = words(g, l, x + w * 0.07, ly, h * 0.07, 'left')
    if (c.doodle && i === c.lines.length - 1) doodle(g, c.doodle, x + w * 0.07 + lw + h * 0.075, ly - h * 0.025, h * 0.1)
  })
  // (the day, and the name printed small, at the right foot)
  words(g, c.date, x + w * 0.93, y + h * 0.8, h * 0.058, 'right')
  words(g, c.name, x + w * 0.93, y + h * 0.915, h * 0.062, 'right', true)
  g.restore()
}
