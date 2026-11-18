/**
 * The street seen out through the shop's doorway (item 360, the owner's, 2026-11-19: 「這個角度要看的到外面」 over a shot of the noren with
 * only white past it): painted on the card just outside the doorway, facing in (GuestBar3D's DOOR_OUT), in its own perspective as from
 * inside the room, the eye a standing person's: the far side of the street, a row of old two-storey houses and shops (dark timber, lattice
 * fronts, a noren, a hanging lantern, the upper floors' windows, their tiled eaves against the sky), a narrow lane between two of them with
 * a drinks machine in it, a power pole and its wires; the road's asphalt coming toward the sill, its white edge line and a drain's cover.
 * By the part of the day (the page's data-sky): day bright and pale-skied, dawn rose, dusk amber with the first lights coming on, night dark
 * blue, the windows, the lanterns and the machine lit. Drawn on a canvas once each time the part of the day turns; flat fills and gradients
 * only (no filters: drawn on the CPU).
 */
export type Sky = 'dawn' | 'day' | 'dusk' | 'night'

const SKIES: Record<Sky, { top: string; low: string; wall: string; wood: string; road: string; lit: number; shade: string }> = {
  day: { top: '#9cc3ea', low: '#e6f0f7', wall: '#d9cfbd', wood: '#5a3d27', road: '#8e8a84', lit: 0, shade: 'rgba(40,30,25,0.18)' },
  dawn: { top: '#b9b6d8', low: '#f2d6d6', wall: '#cbbcb4', wood: '#4c3529', road: '#7e7680', lit: 0.25, shade: 'rgba(50,30,50,0.22)' },
  dusk: { top: '#4e5b8a', low: '#f4a46e', wall: '#b98f72', wood: '#432c1f', road: '#6e5f58', lit: 0.65, shade: 'rgba(40,20,10,0.3)' },
  night: { top: '#0d1326', low: '#27304f', wall: '#2c2c38', wood: '#1d1612', road: '#262630', lit: 1, shade: 'rgba(0,0,0,0.35)' },
}

/** `w` x `h`: the card's picture; the horizon (the eye's height) at `horizon` of the way down */
export function drawStreetView(g: CanvasRenderingContext2D, w: number, h: number, sky: Sky) {
  const s = SKIES[sky] ?? SKIES.day
  const hz = Math.round(h * 0.4)
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = 1
  // (the sky)
  const sk = g.createLinearGradient(0, 0, 0, hz)
  sk.addColorStop(0, s.top); sk.addColorStop(1, s.low)
  g.fillStyle = sk; g.fillRect(0, 0, w, hz + 2)
  if (sky === 'night') {
    g.fillStyle = 'rgba(230,236,255,0.8)'
    for (let k = 0; k < 18; k++) g.fillRect((k * 173) % w, (k * 97) % (hz * 0.55), k % 4 ? 1 : 2, k % 4 ? 1 : 2)
  }
  // (the far side's houses: their eaves' line against the sky, their fronts down to the road's far kerb; each its own width)
  const kerb = Math.round(hz + h * 0.2)
  const houses = [
    { x0: -0.05, x1: 0.34, roof: 0.2, kind: 'lattice' as const },
    { x0: 0.34, x1: 0.47, roof: 0.3, kind: 'lane' as const },
    { x0: 0.47, x1: 0.83, roof: 0.16, kind: 'shop' as const },
    { x0: 0.83, x1: 1.06, roof: 0.24, kind: 'lattice' as const },
  ]
  for (const hs of houses) {
    const x0 = Math.round(hs.x0 * w), x1 = Math.round(hs.x1 * w), top = Math.round(h * hs.roof)
    if (hs.kind === 'lane') {
      // (the lane between: darker, deeper, its far end a strip of light; the drinks machine against its wall)
      const ln = g.createLinearGradient(0, top, 0, kerb)
      ln.addColorStop(0, sky === 'night' ? '#121521' : '#6f6a66'); ln.addColorStop(1, sky === 'night' ? '#1a1c26' : '#5e5853')
      g.fillStyle = ln; g.fillRect(x0, Math.round(h * 0.18), x1 - x0, kerb - Math.round(h * 0.18))
      const mx = x0 + Math.round((x1 - x0) * 0.18), mw = Math.round((x1 - x0) * 0.62), my = kerb - Math.round(h * 0.12)
      g.fillStyle = sky === 'night' ? '#dfe9ff' : '#c9d6e6'
      g.fillRect(mx, my, mw, Math.round(h * 0.12))
      g.fillStyle = sky === 'night' ? '#7fb2ff' : '#4d79b8'
      g.fillRect(mx + 2, my + 3, mw - 4, Math.round(h * 0.025))
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        g.fillStyle = ['#d04a3a', '#3f8f5a', '#e0b23c'][(r + c) % 3]
        g.fillRect(mx + 4 + c * Math.round((mw - 8) / 3), my + Math.round(h * 0.035) + r * Math.round(h * 0.022), Math.round((mw - 14) / 3), Math.round(h * 0.014))
      }
      if (s.lit > 0) glow(g, mx + mw / 2, my + h * 0.05, h * 0.16, `rgba(170,200,255,${0.35 * s.lit})`)
      continue
    }
    // (the upper floor: plaster or board, a window or two, the tiled eave over the ground floor)
    g.fillStyle = s.wall
    g.fillRect(x0, top, x1 - x0, kerb - top)
    // (the roof's edge against the sky, a dark line of tiles with its eave's shadow under)
    g.fillStyle = sky === 'night' ? '#0b0d14' : '#3d3f46'
    g.fillRect(x0 - 4, top - Math.round(h * 0.018), x1 - x0 + 8, Math.round(h * 0.022))
    for (let x = x0; x < x1; x += 7) { g.fillStyle = sky === 'night' ? '#14161f' : '#555861'; g.fillRect(x, top - Math.round(h * 0.018), 3, Math.round(h * 0.016)) }
    const wy = top + Math.round(h * 0.035), wh = Math.round(h * 0.07)
    const nw = hs.kind === 'shop' ? 3 : 2
    for (let k = 0; k < nw; k++) {
      const wx = x0 + Math.round((x1 - x0) * (0.12 + k * (0.76 / nw))), ww = Math.round((x1 - x0) * (0.6 / nw))
      g.fillStyle = s.lit > 0.4 && (k + hs.x0 * 10) % 3 < 2 ? `rgba(255,${200 - 30 * k},120,${0.5 + 0.5 * s.lit})` : sky === 'day' ? '#a9b8c4' : '#3a4152'
      g.fillRect(wx, wy, ww, wh)
      g.fillStyle = s.wood
      for (let b = 1; b < 4; b++) g.fillRect(wx + Math.round((ww * b) / 4), wy, 2, wh)
      g.fillRect(wx - 2, wy - 2, ww + 4, 3); g.fillRect(wx - 2, wy + wh, ww + 4, 3)
    }
    // (the ground floor's own little eave)
    const ey = Math.round(hz - h * 0.02)
    g.fillStyle = sky === 'night' ? '#101219' : '#4a4c53'
    g.fillRect(x0 - 3, ey, x1 - x0 + 6, Math.round(h * 0.014))
    g.fillStyle = s.shade
    g.fillRect(x0, ey + Math.round(h * 0.014), x1 - x0, Math.round(h * 0.03))
    // (the ground floor: a lattice front, or a shop's glass doors with a noren and a lantern)
    const gy = ey + Math.round(h * 0.014), gh = kerb - gy
    g.fillStyle = s.wood
    g.fillRect(x0, gy, x1 - x0, gh)
    if (hs.kind === 'lattice') {
      g.fillStyle = sky === 'night' ? 'rgba(255,190,110,0.5)' : 'rgba(0,0,0,0.25)'
      g.fillRect(x0 + 6, gy + 6, x1 - x0 - 12, gh - 12)
      g.fillStyle = s.wood
      for (let x = x0 + 6; x < x1 - 6; x += 5) g.fillRect(x, gy + 6, 3, gh - 12)
      g.fillRect(x0 + 6, gy + Math.round(gh * 0.45), x1 - x0 - 12, 3)
    } else {
      const dx0 = x0 + Math.round((x1 - x0) * 0.18), dx1 = x1 - Math.round((x1 - x0) * 0.18)
      const gl = g.createLinearGradient(0, gy, 0, kerb)
      gl.addColorStop(0, sky === 'night' ? 'rgba(255,214,150,0.95)' : sky === 'dusk' ? 'rgba(255,200,140,0.7)' : 'rgba(170,190,200,0.85)')
      gl.addColorStop(1, sky === 'night' ? 'rgba(220,150,90,0.9)' : 'rgba(120,130,135,0.85)')
      g.fillStyle = gl; g.fillRect(dx0, gy + 4, dx1 - dx0, gh - 4)
      g.fillStyle = s.wood
      g.fillRect(Math.round((dx0 + dx1) / 2) - 2, gy + 4, 4, gh - 4)
      // (its noren, indigo, three panels, the white of its mark)
      const nh = Math.round(gh * 0.38)
      g.fillStyle = '#26365a'
      for (let k = 0; k < 3; k++) g.fillRect(dx0 + Math.round(((dx1 - dx0) * k) / 3) + 1, gy + 4, Math.round((dx1 - dx0) / 3) - 2, nh)
      g.fillStyle = 'rgba(240,236,224,0.9)'
      g.beginPath(); g.arc((dx0 + dx1) / 2, gy + 4 + nh * 0.55, nh * 0.2, 0, Math.PI * 2); g.fill()
      // (a lantern hung by its door, red; lit by evening)
      const lx = x1 - Math.round((x1 - x0) * 0.09), lyy = gy + Math.round(gh * 0.12)
      if (s.lit > 0) glow(g, lx, lyy + 12, h * 0.07, `rgba(255,120,60,${0.55 * s.lit})`)
      g.fillStyle = s.lit > 0.4 ? '#ff5a3a' : '#b0281e'
      g.beginPath(); g.ellipse(lx, lyy + 12, 8, 13, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#1a1210'; g.fillRect(lx - 6, lyy - 2, 12, 3); g.fillRect(lx - 6, lyy + 24, 12, 3)
    }
  }
  // (the far kerb, and the road coming toward the sill: its asphalt, darker toward us, the white edge line along its far side, a drain's
  // cover near the middle)
  g.fillStyle = sky === 'night' ? '#3a3a44' : '#a9a49b'
  g.fillRect(0, kerb, w, Math.round(h * 0.02))
  const rd = g.createLinearGradient(0, kerb, 0, h)
  rd.addColorStop(0, s.road); rd.addColorStop(1, shadeOf(s.road, 0.72))
  g.fillStyle = rd; g.fillRect(0, kerb + Math.round(h * 0.02), w, h - kerb)
  g.fillStyle = sky === 'night' ? 'rgba(220,220,230,0.55)' : 'rgba(245,245,240,0.9)'
  g.fillRect(0, kerb + Math.round(h * 0.045), w, Math.round(h * 0.006))
  g.fillStyle = 'rgba(0,0,0,0.06)'
  for (let k = 0; k < 140; k++) g.fillRect((k * 211) % w, kerb + Math.round(h * 0.03) + ((k * 89) % Math.round(h - kerb - h * 0.03)), 2, 2)
  g.fillStyle = sky === 'night' ? '#202027' : '#6d6a66'
  g.beginPath(); g.ellipse(w * 0.62, kerb + h * 0.14, w * 0.09, h * 0.018, 0, 0, Math.PI * 2); g.fill()
  // (the power pole by the right-hand house, its wires over the street, its lamp lit by night)
  const px = Math.round(w * 0.9)
  g.fillStyle = sky === 'night' ? '#16161c' : '#6b6863'
  g.fillRect(px - 5, Math.round(h * 0.02), 10, kerb + Math.round(h * 0.02) - Math.round(h * 0.02))
  g.fillRect(px - 26, Math.round(h * 0.08), 52, 5)
  g.strokeStyle = sky === 'night' ? 'rgba(20,20,26,0.9)' : 'rgba(50,50,55,0.85)'
  g.lineWidth = 1.5
  for (const [y0, y1] of [[0.085, 0.13], [0.09, 0.16], [0.1, 0.19]]) {
    g.beginPath(); g.moveTo(-10, h * y1); g.quadraticCurveTo(w * 0.45, h * (y1 + 0.05), px, h * y0); g.stroke()
  }
  const lampY = Math.round(h * 0.17)
  g.fillStyle = sky === 'night' ? '#fff3d6' : '#d8d4c8'
  g.fillRect(px - 22, lampY, 18, 6)
  if (s.lit > 0.4) glow(g, px - 13, lampY + 6, h * 0.12, `rgba(255,240,200,${0.4 * s.lit})`)
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const l = g.createRadialGradient(x, y, 0, x, y, r)
  l.addColorStop(0, c); l.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = l
  g.fillRect(x - r, y - r, r * 2, r * 2)
}

function shadeOf(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * k), gg = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k)
  return `rgb(${r},${gg},${b})`
}
