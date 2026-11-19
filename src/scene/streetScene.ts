import type { Sky } from './streetView'

/**
 * The street out past the shop's doorway as a place with depth (item 386, the owner's, 2026-11-20: 「外頭的景太平了」 over a shot through the
 * noren: item 360's street was one picture on a card 20 cm past the door, its houses, its machine and its road all flat on it). Its parts'
 * pictures, each drawn as it is (no perspective: the depth is the scene's own now, shops/grill's StreetOutside): the far side's row of old
 * houses and shops as a front elevation (their upper floors' plaster and windows, the ground floors' lattice fronts or a shop's glass doors,
 * its noren and its lantern, a narrow lane's dark gap), the road from above (asphalt, its white edge lines, a drain's cover, patches, by
 * day the power pole's shadow across it), the pavements' concrete flags and kerb, the sky, the drinks machine's front, the eaves' tiles. By
 * the part of the day (the page's data-sky): the windows, the shops, the lantern, the machine and the lamp lit by dusk. Flat fills and
 * gradients only (no filters: drawn on the CPU), each drawn again only as the part of the day turns.
 */
type Pal = { top: string; low: string; wall: string; wood: string; road: string; walk: string; tile: string; lit: number; shade: string; night: boolean }
const PAL: Record<Sky, Pal> = {
  day: { top: '#8fbbe8', low: '#e4eef6', wall: '#ddd3c1', wood: '#5a3d27', road: '#87837d', walk: '#bdb6aa', tile: '#4d5058', lit: 0, shade: 'rgba(40,30,25,0.22)', night: false },
  dawn: { top: '#b3b0d6', low: '#f2d4d2', wall: '#cdbfb6', wood: '#4c3529', road: '#7a727a', walk: '#aea2a2', tile: '#48444e', lit: 0.25, shade: 'rgba(50,30,50,0.26)', night: false },
  dusk: { top: '#475487', low: '#f2a06a', wall: '#ba9174', wood: '#432c1f', road: '#675a54', walk: '#93806f', tile: '#3a3434', lit: 0.65, shade: 'rgba(40,20,10,0.34)', night: false },
  night: { top: '#0b1124', low: '#252e4c', wall: '#2e2e3a', wood: '#1d1612', road: '#24242d', walk: '#33333d', tile: '#16171e', lit: 1, shade: 'rgba(0,0,0,0.4)', night: true },
}
export const palOf = (sky: Sky) => PAL[sky] ?? PAL.day

/** the far side's houses (metres along the street, from its middle; the facade's picture covers FACADE_W of it), each its kind */
export const FACADE_W = 20, FACADE_H = 6.4
// (a shop right across from the doorway, its noren, its glass doors and its lantern framed by it; a lane's mouth beside it, the drinks machine
// in it)
export const HOUSES: { x0: number; x1: number; kind: 'lattice' | 'shop' | 'lane'; roof: number }[] = [
  { x0: -10, x1: -6.4, kind: 'shop', roof: 5.7 },
  { x0: -6.4, x1: -3.9, kind: 'lattice', roof: 6.1 },
  { x0: -3.9, x1: -2.9, kind: 'lane', roof: 0 },
  { x0: -2.9, x1: 1.6, kind: 'shop', roof: 5.8 },
  { x0: 1.6, x1: 4.3, kind: 'lattice', roof: 6.3 },
  { x0: 4.3, x1: 6.8, kind: 'shop', roof: 5.6 },
  { x0: 6.8, x1: 10, kind: 'lattice', roof: 6.0 },
]
/** the ground floors' eaves' height on the wall (metres up from the pavement) */
export const EAVE_Y = 2.75

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const l = g.createRadialGradient(x, y, 0, x, y, r)
  l.addColorStop(0, c); l.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = l
  g.fillRect(x - r, y - r, r * 2, r * 2)
}

/** the far side's row as a front elevation: `w` x `h` the picture for FACADE_W x FACADE_H metres, the pavement at its foot */
export function paintFacade(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky) {
  const s = palOf(sky)
  const X = (m: number) => ((m + FACADE_W / 2) / FACADE_W) * w, Y = (m: number) => h - (m / FACADE_H) * h
  const sk = g.createLinearGradient(0, 0, 0, h)
  sk.addColorStop(0, s.top); sk.addColorStop(1, s.low)
  g.fillStyle = sk; g.fillRect(0, 0, w, h)
  for (const hs of HOUSES) {
    const x0 = X(hs.x0), x1 = X(hs.x1)
    if (hs.kind === 'lane') {
      // (the lane between two: dark and deep, a strip of light at its far end, its walls closing in)
      const ln = g.createLinearGradient(x0, 0, x1, 0)
      const d0 = s.night ? '#0d0f17' : '#4a4643', d1 = s.night ? '#181a24' : '#625d58'
      ln.addColorStop(0, d0); ln.addColorStop(0.5, d1); ln.addColorStop(1, d0)
      g.fillStyle = ln; g.fillRect(x0, Y(5.2), x1 - x0, h - Y(5.2))
      g.fillStyle = s.night ? 'rgba(255,200,140,0.35)' : 'rgba(255,250,235,0.45)'
      g.fillRect(x0 + (x1 - x0) * 0.42, Y(2.2), (x1 - x0) * 0.16, Y(0) - Y(2.2))
      continue
    }
    const top = Y(hs.roof)
    // (the upper floor's plaster, a timber band along the foot of it and at its corners)
    g.fillStyle = s.wall; g.fillRect(x0, top, x1 - x0, Y(EAVE_Y) - top)
    g.fillStyle = s.wood
    g.fillRect(x0, Y(EAVE_Y + 0.25), x1 - x0, Y(EAVE_Y) - Y(EAVE_Y + 0.25))
    g.fillRect(x0, top, Math.max(4, w * 0.004), Y(EAVE_Y) - top); g.fillRect(x1 - Math.max(4, w * 0.004), top, Math.max(4, w * 0.004), Y(EAVE_Y) - top)
    // (the roof's edge against the sky: its tiles' ends)
    g.fillStyle = s.tile; g.fillRect(x0 - 6, top - h * 0.02, x1 - x0 + 12, h * 0.03)
    for (let x = x0; x < x1; x += w * 0.006) { g.fillStyle = s.night ? '#0e0f15' : '#3a3c44'; g.fillRect(x, top - h * 0.02, w * 0.0025, h * 0.028) }
    // (the upper windows: lattice over them, lit by dusk in some)
    const nw = Math.max(1, Math.round((hs.x1 - hs.x0) / 1.6))
    for (let k = 0; k < nw; k++) {
      const span = (x1 - x0) / nw, wx = x0 + span * (k + 0.2), ww = span * 0.6, wy = Y(EAVE_Y + 2.0), wh = Y(EAVE_Y + 0.75) - wy
      const on = s.lit > 0.4 && (k + Math.round(hs.x0)) % 3 !== 0
      g.fillStyle = on ? `rgba(255,${196 - 20 * (k % 2)},120,${0.55 + 0.45 * s.lit})` : sky === 'day' ? '#9fb0bd' : s.night ? '#272d3d' : '#4b5266'
      g.fillRect(wx, wy, ww, wh)
      if (on) glow(g, wx + ww / 2, wy + wh / 2, ww, `rgba(255,190,110,${0.25 * s.lit})`)
      g.fillStyle = s.wood
      for (let b = 1; b < 5; b++) g.fillRect(wx + (ww * b) / 5 - 1.5, wy, 3, wh)
      g.fillRect(wx - 3, wy - 4, ww + 6, 5); g.fillRect(wx - 3, wy + wh, ww + 6, 5)
    }
    // (the ground floor under its eave: the eave's own shadow at the top of it)
    const gy = Y(EAVE_Y), gh = Y(0) - gy
    g.fillStyle = s.wood; g.fillRect(x0, gy, x1 - x0, gh)
    if (hs.kind === 'lattice') {
      // (a house's lattice front (格子戸), the room behind it dark, or warm with its lamps by evening)
      g.fillStyle = s.night ? 'rgba(255,186,108,0.55)' : sky === 'dusk' ? 'rgba(255,170,100,0.3)' : 'rgba(0,0,0,0.3)'
      g.fillRect(x0 + w * 0.006, gy + gh * 0.08, x1 - x0 - w * 0.012, gh * 0.84)
      g.fillStyle = s.wood
      for (let x = x0 + w * 0.006; x < x1 - w * 0.006; x += w * 0.0055) g.fillRect(x, gy + gh * 0.08, w * 0.0022, gh * 0.84)
      g.fillRect(x0 + w * 0.006, gy + gh * 0.5, x1 - x0 - w * 0.012, 4)
    } else {
      // (a shop: its glass doors lit within, a noren over them in indigo with its white mark, a red lantern by its door)
      const dx0 = x0 + (x1 - x0) * 0.16, dx1 = x1 - (x1 - x0) * 0.16
      const gl = g.createLinearGradient(0, gy, 0, Y(0))
      gl.addColorStop(0, s.night ? 'rgba(255,214,150,0.98)' : sky === 'dusk' ? 'rgba(255,200,140,0.8)' : 'rgba(160,182,194,0.9)')
      gl.addColorStop(1, s.night ? 'rgba(220,150,90,0.95)' : 'rgba(110,122,128,0.9)')
      g.fillStyle = gl; g.fillRect(dx0, gy + gh * 0.1, dx1 - dx0, gh * 0.9)
      g.fillStyle = s.wood
      g.fillRect((dx0 + dx1) / 2 - 3, gy + gh * 0.1, 6, gh * 0.9)
      g.fillRect(dx0, gy + gh * 0.55, dx1 - dx0, 4)
      const nh = gh * 0.36
      g.fillStyle = '#26365a'
      for (let k = 0; k < 3; k++) g.fillRect(dx0 + ((dx1 - dx0) * k) / 3 + 2, gy + gh * 0.1, (dx1 - dx0) / 3 - 4, nh)
      g.fillStyle = 'rgba(240,236,224,0.92)'
      g.beginPath(); g.arc((dx0 + dx1) / 2, gy + gh * 0.1 + nh * 0.55, nh * 0.2, 0, Math.PI * 2); g.fill()
      const lx = x1 - (x1 - x0) * 0.07, ly = gy + gh * 0.24
      if (s.lit > 0) glow(g, lx, ly, h * 0.09, `rgba(255,120,60,${0.6 * s.lit})`)
      g.fillStyle = s.lit > 0.4 ? '#ff5a3a' : '#b0281e'
      g.beginPath(); g.ellipse(lx, ly, w * 0.008, h * 0.035, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#1a1210'; g.fillRect(lx - w * 0.006, ly - h * 0.04, w * 0.012, 4); g.fillRect(lx - w * 0.006, ly + h * 0.034, w * 0.012, 4)
    }
    // (the eave's shadow on the ground floor's top, the dark at the foot where the pavement meets it)
    g.fillStyle = s.shade; g.fillRect(x0, gy, x1 - x0, gh * 0.16)
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, Y(0.12), x1 - x0, Y(0) - Y(0.12))
  }
}

/** the road from above: `w` across the street's FACADE_W, `h` across ROAD_D (from the near kerb at its foot to the far kerb at its top) */
export const ROAD_D = 4.4
export function paintRoad(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky, pole?: number) {
  const s = palOf(sky)
  g.fillStyle = s.road; g.fillRect(0, 0, w, h)
  // (its grain: specks lighter and darker, a few patches of newer asphalt)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 2600; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2) }
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(rnd() * w, rnd() * h * 0.8, w * (0.04 + rnd() * 0.06), h * (0.1 + rnd() * 0.12)) }
  // (the white edge lines along both sides, a little in from the kerbs)
  g.fillStyle = s.night ? 'rgba(210,210,220,0.5)' : 'rgba(244,244,238,0.92)'
  g.fillRect(0, h * 0.08, w, h * 0.022); g.fillRect(0, h * 0.9, w, h * 0.022)
  // (a drain's cover near the near kerb)
  g.fillStyle = s.night ? '#1b1b21' : '#5f5c58'
  g.beginPath(); g.arc(w * 0.47, h * 0.86, h * 0.07, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(w * 0.47 - h * 0.05, h * 0.86 + k * h * 0.02); g.lineTo(w * 0.47 + h * 0.05, h * 0.86 + k * h * 0.02); g.stroke() }
  // (by day the power pole's shadow across it, long and soft)
  if (pole !== undefined && sky === 'day') {
    const px = ((pole + FACADE_W / 2) / FACADE_W) * w
    g.fillStyle = 'rgba(0,0,0,0.16)'
    g.beginPath(); g.moveTo(px - 6, h); g.lineTo(px + 6, h); g.lineTo(px + w * 0.09, 0); g.lineTo(px + w * 0.08, 0); g.fill()
  }
  // (darker toward the kerbs: the gutters' grime)
  const gt = g.createLinearGradient(0, 0, 0, h)
  gt.addColorStop(0, 'rgba(0,0,0,0.18)'); gt.addColorStop(0.07, 'rgba(0,0,0,0)'); gt.addColorStop(0.93, 'rgba(0,0,0,0)'); gt.addColorStop(1, 'rgba(0,0,0,0.18)')
  g.fillStyle = gt; g.fillRect(0, 0, w, h)
}

/** a pavement from above: concrete flags a third of a metre, its kerb's stones along the road's edge (`kerbTop`: at the picture's top, else its
 * foot); `w` across FACADE_W, `h` across `depth` metres */
export function paintWalk(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky, depth: number, kerbTop: boolean) {
  const s = palOf(sky)
  g.fillStyle = s.walk; g.fillRect(0, 0, w, h)
  const step = (0.33 / depth) * h, stepX = (0.33 / FACADE_W) * w
  g.fillStyle = 'rgba(0,0,0,0.12)'
  for (let y = 0; y < h; y += step) g.fillRect(0, y, w, 1.5)
  for (let x = 0; x < w; x += stepX) g.fillRect(x, 0, 1.5, h)
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 900; k++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2) }
  // (the kerb: long pale stones, a dark joint between each)
  const kh = (0.16 / depth) * h, ky = kerbTop ? 0 : h - kh
  g.fillStyle = s.night ? '#45454f' : '#cfc9bd'; g.fillRect(0, ky, w, kh)
  g.fillStyle = 'rgba(0,0,0,0.2)'
  for (let x = 0; x < w; x += (0.9 / FACADE_W) * w) g.fillRect(x, ky, 2, kh)
}

/** the sky: its gradient, a few long clouds by day, the stars by night */
export function paintSky(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky) {
  const s = palOf(sky)
  const sk = g.createLinearGradient(0, 0, 0, h)
  sk.addColorStop(0, s.top); sk.addColorStop(0.75, s.low); sk.addColorStop(1, s.low)
  g.fillStyle = sk; g.fillRect(0, 0, w, h)
  if (sky === 'night') {
    g.fillStyle = 'rgba(230,236,255,0.85)'
    for (let k = 0; k < 40; k++) g.fillRect((k * 173) % w, (k * 97) % (h * 0.6), k % 5 ? 1 : 2, k % 5 ? 1 : 2)
  } else {
    g.fillStyle = sky === 'day' ? 'rgba(255,255,255,0.5)' : 'rgba(255,220,200,0.35)'
    for (const [x, y, ww] of [[0.1, 0.3, 0.22], [0.45, 0.22, 0.3], [0.78, 0.36, 0.18]]) {
      g.beginPath(); g.ellipse(w * x, h * y, w * ww * 0.5, h * 0.025, 0, 0, Math.PI * 2); g.fill()
    }
  }
}

/** the drinks machine: its front (the picture's left three quarters: the rows of cans in their window, the buttons, the slot and the tray),
 * and its sides and top (the right quarter, plain); lit by night */
export function paintMachine(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky) {
  const s = palOf(sky)
  const fw = w * 0.75
  g.fillStyle = s.night ? '#c8d3e6' : '#e8ecef'; g.fillRect(0, 0, w, h)
  g.fillStyle = s.night ? '#9aa6bd' : '#c3cad1'; g.fillRect(fw, 0, w - fw, h)
  // (the window of cans: three rows, each can its colour, lit behind)
  const win = s.night ? '#f4f8ff' : '#dfe6ee'
  g.fillStyle = win; g.fillRect(fw * 0.08, h * 0.08, fw * 0.84, h * 0.5)
  const cols = ['#d04a3a', '#3f8f5a', '#e0b23c', '#3a6fb0', '#f2f2f2', '#7a3d2a']
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    g.fillStyle = cols[(r * 2 + c) % cols.length]
    g.fillRect(fw * (0.12 + c * 0.13), h * (0.11 + r * 0.16), fw * 0.08, h * 0.11)
    g.fillStyle = 'rgba(255,60,40,0.85)'; g.fillRect(fw * (0.125 + c * 0.13), h * (0.225 + r * 0.16), fw * 0.07, h * 0.012)
  }
  // (the maker's band over it, the coin slot and the tray at its foot)
  g.fillStyle = '#2f5aa8'; g.fillRect(fw * 0.08, h * 0.61, fw * 0.84, h * 0.06)
  g.fillStyle = '#5b6168'; g.fillRect(fw * 0.7, h * 0.7, fw * 0.12, h * 0.08)
  g.fillStyle = '#2a2d33'; g.fillRect(fw * 0.15, h * 0.84, fw * 0.6, h * 0.1)
  if (s.lit > 0.4) {
    g.fillStyle = 'rgba(200,225,255,0.25)'; g.fillRect(0, 0, fw, h)
  }
}

/** the eaves' picture: their tiles' rows (the top's left half), their underside's boards in shadow (the right half's top), their front's edge
 * tiles (the right half's foot) */
export function paintEave(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky) {
  const s = palOf(sky)
  g.fillStyle = s.tile; g.fillRect(0, 0, w / 2, h)
  g.fillStyle = s.night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)'
  for (let x = 0; x < w / 2; x += w * 0.04) g.fillRect(x, 0, w * 0.012, h)
  g.fillStyle = s.night ? '#120e0b' : '#3b281b'; g.fillRect(w / 2, 0, w / 2, h / 2)
  g.fillStyle = 'rgba(0,0,0,0.25)'
  for (let x = w / 2; x < w; x += w * 0.03) g.fillRect(x, 0, 2, h / 2)
  g.fillStyle = s.night ? '#0c0d12' : '#33353c'; g.fillRect(w / 2, h / 2, w / 2, h / 2)
  g.fillStyle = s.night ? '#1a1b22' : '#4a4c55'
  for (let x = w / 2; x < w; x += w * 0.02) { g.beginPath(); g.arc(x + w * 0.01, h * 0.75, h * 0.18, 0, Math.PI * 2); g.fill() }
}
