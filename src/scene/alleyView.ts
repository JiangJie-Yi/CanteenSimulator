import * as THREE from 'three'

/**
 * What's out of the upstairs window (item 452, the owner's, 2026-11-21: 「2樓窗外景色?」 over a shot of the window, a pale grey-white
 * nothing past its open shoji: it was the shop's doorway's street, its upper half, a standing person's view from the road): the view from
 * a first-floor window over the back of a Japanese town, in three layers each at its own depth behind the window and looked through it in
 * perspective (the round window's way, DiningRoom's ROUND_VIEW: as the camera turns, the near slides across the far):
 *  - near (1.2 behind it): the neighbour's tiled roof just below the window across the lane, its ridge and its end tile, a television
 *    aerial on it, and the power lines strung across in front;
 *  - far (5): the town's roofs on and on, a few blocks of flats and a bathhouse's tall chimney among them, a utility pole;
 *  - sky (20): by the part of the day, a few clouds by day, by night stars and the moon.
 * By the part of the day (the page's data-sky): day, dawn rose, dusk amber with the first windows lit, night dark blue with them all lit.
 * Each layer's picture spans `H` either way of the window's middle in the window's own units (metres), wrapping along it so it fills the
 * view turned; flat fills and gradients only (drawn on the CPU, once each time the part of the day turns).
 */
export type AlleySky = 'dawn' | 'day' | 'dusk' | 'night'

const LOOK: Record<AlleySky, { top: string; low: string; glow: string; roof: string; roofLit: string; ridge: string; wall: string; dark: string; lit: number }> = {
  day: { top: '#6fa7de', low: '#dbe9f4', glow: '#f4f1e4', roof: '#5a606a', roofLit: '#7c838e', ridge: '#30343b', wall: '#d7ccb8', dark: '#3b3330', lit: 0 },
  dawn: { top: '#7e7cb6', low: '#f3c7b6', glow: '#ffe2c4', roof: '#56535e', roofLit: '#7a7380', ridge: '#2d2a33', wall: '#c4b1a6', dark: '#34282b', lit: 0.25 },
  dusk: { top: '#34417a', low: '#f29a5a', glow: '#ffc27a', roof: '#3d363d', roofLit: '#6b5a5a', ridge: '#221d22', wall: '#a8846c', dark: '#2a1e1c', lit: 0.8 },
  night: { top: '#080d20', low: '#232c56', glow: '#3a4478', roof: '#1d2029', roofLit: '#2e3240', ridge: '#0e1015', wall: '#2b2b37', dark: '#101015', lit: 1 },
}
/** each layer's depth behind the window and its picture's half-size (the window's units) */
export const ALLEY_LAYERS = { near: { d: 1.2, H: 1.3 }, far: { d: 5, H: 3.6 }, sky: { d: 20, H: 12 } }
type Layer = keyof typeof ALLEY_LAYERS
const px = (k: Layer, n: number) => {
  const H = ALLEY_LAYERS[k].H
  return { X: (x: number) => (x / H * 0.5 + 0.5) * n, Y: (y: number) => (0.5 - y / H * 0.5) * n, S: (l: number) => (l / H * 0.5) * n }
}
/** a little seeded noise, so the town's the same each time it's drawn */
const rnd = (k: number) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

function drawSky(g: CanvasRenderingContext2D, n: number, sky: AlleySky) {
  const s = LOOK[sky], P = px('sky', n)
  g.clearRect(0, 0, n, n)
  const gr = g.createLinearGradient(0, 0, 0, n)
  gr.addColorStop(0, s.top); gr.addColorStop(0.62, s.low); gr.addColorStop(0.8, s.glow); gr.addColorStop(1, s.glow)
  g.fillStyle = gr; g.fillRect(0, 0, n, n)
  if (sky === 'day' || sky === 'dawn') {
    // (a few soft clouds, flat-bottomed)
    g.fillStyle = sky === 'day' ? 'rgba(255,255,255,0.75)' : 'rgba(255,226,214,0.7)'
    for (let k = 0; k < 5; k++) {
      const x = P.X(-10 + k * 4.6 + rnd(k) * 2), y = P.Y(2 + rnd(k + 9) * 4), w = P.S(2.2 + rnd(k + 3) * 2)
      for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(x + (j - 1.5) * w * 0.35, y - (j % 2) * w * 0.12, w * 0.32, w * 0.16, 0, 0, Math.PI * 2); g.fill() }
      g.fillRect(x - w * 0.62, y, w * 1.24, w * 0.1)
    }
  }
  if (sky === 'night' || sky === 'dusk') {
    g.fillStyle = sky === 'night' ? 'rgba(236,240,255,0.85)' : 'rgba(255,240,220,0.5)'
    for (let k = 0; k < 60; k++) { const r = rnd(k + 40) > 0.85 ? 2 : 1; g.fillRect(rnd(k) * n, rnd(k + 100) * n * 0.55, r, r) }
  }
  if (sky === 'night') {
    // (the moon, a soft glow round it)
    const mx = P.X(3.5), my = P.Y(5.5), mr = P.S(0.5)
    const gl = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4)
    gl.addColorStop(0, 'rgba(255,248,220,0.35)'); gl.addColorStop(1, 'rgba(255,248,220,0)')
    g.fillStyle = gl; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8)
    g.fillStyle = '#fbf3d8'; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill()
  }
}

function drawFar(g: CanvasRenderingContext2D, n: number, sky: AlleySky) {
  const s = LOOK[sky], P = px('far', n)
  g.clearRect(0, 0, n, n)
  const win = (x: number, y: number, w: number, h: number, k: number) => {
    const on = s.lit > 0 && rnd(k) < 0.25 + 0.55 * s.lit
    g.fillStyle = on ? (rnd(k + 7) > 0.3 ? '#ffd58a' : '#ffefc4') : sky === 'night' ? '#15192a' : 'rgba(40,46,60,0.45)'
    g.fillRect(x, y, w, h)
  }
  // (blocks of flats and an office or two, rising behind the roofs, their windows in rows)
  for (let k = 0; k < 7; k++) {
    const x0 = -3.6 + k * 1.05 + rnd(k) * 0.4, w = 0.5 + rnd(k + 20) * 0.5, top = -0.55 + rnd(k + 40) * 0.95
    g.fillStyle = k % 3 ? s.wall : '#b9bcc0'
    if (sky === 'night') g.fillStyle = '#23242f'
    g.fillRect(P.X(x0), P.Y(top), P.S(w * 2), P.Y(-3.6) - P.Y(top))
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const wx = x0 + 0.06 + c * (w - 0.08) / 4, wy = top - 0.1 - r * 0.16
      if (wy < -2.2) continue
      win(P.X(wx), P.Y(wy), P.S(0.07 * 2), P.S(0.05 * 2), k * 40 + r * 5 + c)
    }
  }
  // (the bathhouse's chimney, tall and thin, a band near its top)
  const cx = 1.5
  g.fillStyle = sky === 'night' ? '#2a2422' : '#8c6d5c'
  g.beginPath(); g.moveTo(P.X(cx - 0.09), P.Y(-2)); g.lineTo(P.X(cx - 0.06), P.Y(1.1)); g.lineTo(P.X(cx + 0.06), P.Y(1.1)); g.lineTo(P.X(cx + 0.09), P.Y(-2)); g.fill()
  g.fillStyle = sky === 'night' ? '#4a1d1d' : '#a5403a'; g.fillRect(P.X(cx - 0.065), P.Y(1.0), P.S(0.13 * 2), P.S(0.05 * 2))
  // (the town's roofs, on and on: tiled, dark, ridge over ridge, lower ones nearer)
  for (let row = 0; row < 3; row++) {
    const base = -0.95 - row * 0.45
    for (let k = 0; k < 9; k++) {
      const x0 = -3.8 + k * 0.92 + (row % 2) * 0.4 + rnd(k + row * 30) * 0.2, w = 0.8 + rnd(k + row * 30 + 5) * 0.3, h = 0.22 + rnd(k + row * 30 + 9) * 0.12
      g.fillStyle = row === 0 ? s.roof : s.roofLit
      if (row === 1) g.fillStyle = s.roof
      g.beginPath()
      g.moveTo(P.X(x0), P.Y(base)); g.lineTo(P.X(x0 + w * 0.22), P.Y(base + h)); g.lineTo(P.X(x0 + w * 0.78), P.Y(base + h)); g.lineTo(P.X(x0 + w), P.Y(base))
      g.lineTo(P.X(x0 + w), P.Y(-3.6)); g.lineTo(P.X(x0), P.Y(-3.6)); g.closePath(); g.fill()
      g.fillStyle = s.ridge; g.fillRect(P.X(x0 + w * 0.2), P.Y(base + h) - 2, P.S(w * 0.6 * 2), 3)
      // (a lit window under the eaves now and then)
      win(P.X(x0 + w * 0.4), P.Y(base - 0.12), P.S(0.1 * 2), P.S(0.06 * 2), k * 13 + row * 7 + 900)
    }
  }
  // (a utility pole and its crossarms against the sky)
  g.fillStyle = s.dark
  g.fillRect(P.X(-1.8) - 3, P.Y(0.9), 6, P.Y(-2.5) - P.Y(0.9))
  for (const y of [0.78, 0.62]) g.fillRect(P.X(-2.05), P.Y(y), P.S(0.5 * 2), 4)
}

function drawNear(g: CanvasRenderingContext2D, n: number, sky: AlleySky) {
  const s = LOOK[sky], P = px('near', n)
  g.clearRect(0, 0, n, n)
  // (the neighbour's roof below the window, sloping down toward us: rows of grey tiles, each row a wave of round-backed tiles, a little
  // lighter on their crowns; its ridge along the top, an end tile at its end)
  const ridge = -0.36
  g.fillStyle = s.roof
  g.fillRect(0, P.Y(ridge), n, n - P.Y(ridge))
  const rowH = 0.075
  for (let r = 0; ; r++) {
    const y = ridge - 0.05 - r * rowH
    if (y < -1.3) break
    const yy = P.Y(y), step = P.S(0.11 * 2)
    g.fillStyle = s.roofLit
    for (let x = -((r % 2) * step) / 2; x < n + step; x += step) { g.beginPath(); g.ellipse(x + step / 2, yy - P.S(0.012 * 2), step * 0.4, P.S(0.022 * 2), 0, Math.PI, 0); g.fill() }
    g.fillStyle = s.ridge; g.fillRect(0, yy, n, Math.max(2, P.S(0.006 * 2)))
  }
  g.fillStyle = s.ridge; g.fillRect(0, P.Y(ridge + 0.04), n, P.S(0.06 * 2))
  g.fillStyle = s.roofLit; g.fillRect(0, P.Y(ridge + 0.04), n, Math.max(2, P.S(0.008 * 2)))
  // (its end tile (onigawara), a rounded block at the ridge's end)
  g.fillStyle = s.ridge
  g.beginPath(); g.ellipse(P.X(-0.95), P.Y(ridge + 0.03), P.S(0.08 * 2), P.S(0.07 * 2), 0, Math.PI, 0); g.fill()
  // (a television aerial on its ridge: a mast and its crossed bars)
  g.fillStyle = s.dark
  const ax = 0.55
  g.fillRect(P.X(ax) - 2, P.Y(0.42), 4, P.Y(ridge + 0.02) - P.Y(0.42))
  for (const [y, w] of [[0.38, 0.3], [0.3, 0.24], [0.22, 0.18]] as const) g.fillRect(P.X(ax - w / 2), P.Y(y), P.S(w * 2), 3)
  for (let k = 0; k < 6; k++) g.fillRect(P.X(ax - 0.14 + k * 0.056) - 1, P.Y(0.39), 2, P.S(0.03 * 2))
  // (the power lines strung across in front, sagging, the same height at either edge (the picture wraps))
  g.strokeStyle = sky === 'night' ? 'rgba(10,10,14,0.85)' : 'rgba(30,28,30,0.8)'
  g.lineWidth = 2
  for (const [y0, sag] of [[0.36, 0.1], [0.28, 0.09], [0.12, 0.12]] as const) {
    g.beginPath(); g.moveTo(0, P.Y(y0)); g.quadraticCurveTo(n / 2, P.Y(y0 - sag * 2), n, P.Y(y0)); g.stroke()
  }
}

/** the window's view: its material (a plane at the window's glass, its x along the window, y up, z toward the room; `uCam` the camera
 * in that plane's frame, set each frame) and its painting by the part of the day */
export function makeAlleyView() {
  if (typeof document === 'undefined') return null
  const make = (size: number, draw: (g: CanvasRenderingContext2D, n: number, sky: AlleySky) => void, wrapS: THREE.Wrapping) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.wrapS = wrapS
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { t, paint: (sky: AlleySky) => { draw(g, size, sky); t.needsUpdate = true } }
  }
  const layers = { sky: make(512, drawSky, THREE.MirroredRepeatWrapping), far: make(1024, drawFar, THREE.MirroredRepeatWrapping), near: make(1024, drawNear, THREE.RepeatWrapping) }
  let painted: AlleySky | null = null
  const paint = (sky: AlleySky) => { if (sky === painted) return; painted = sky; for (const l of Object.values(layers)) l.paint(sky) }
  paint('day')
  const L = ALLEY_LAYERS
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSky: { value: layers.sky.t }, uFar: { value: layers.far.t }, uNear: { value: layers.near.t }, uCam: { value: new THREE.Vector3(0, 0, 3) } },
    vertexShader: `varying vec3 vLocal;
void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uSky, uFar, uNear;
uniform vec3 uCam;
varying vec3 vLocal;
vec4 layerOn(sampler2D t, vec2 xy, float H) { vec2 uv = xy / (2.0 * H) + 0.5; return texture2D(t, vec2(uv.x, clamp(uv.y, 0.002, 0.998))); }
void main() {
  // (the way the eye looks through this point of the window, out over the town: where it meets each layer; the far roofs hazed into the
  // sky by the air between)
  vec3 dir = normalize(vLocal - uCam);
  vec2 slope = dir.xy / max(-dir.z, 0.15);
  vec3 c = layerOn(uSky, vLocal.xy + slope * ${L.sky.d.toFixed(1)}, ${L.sky.H.toFixed(2)}).rgb;
  vec3 air = c;
  vec4 f = layerOn(uFar, vLocal.xy + slope * ${L.far.d.toFixed(1)}, ${L.far.H.toFixed(2)}); c = mix(c, mix(f.rgb, air, 0.32), f.a);
  vec4 m = layerOn(uNear, vLocal.xy + slope * ${L.near.d.toFixed(1)}, ${L.near.H.toFixed(2)}); c = mix(c, mix(m.rgb, air, 0.05), m.a);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  })
  return { mat, paint }
}
