import * as THREE from 'three'

/**
 * Every face in the shop, painted (the owner's, 2026-11-09: Overcooked's simple cartoon way, not the big glossy anime eyes there were):
 * small solid dark bean eyes with one tiny white dot, closed into arcs ^ ^ when happy, a little lidded at work, rounder in a fright; thick
 * rounded brows that carry the mood (pressed in at work, lifted in a fright, drooped when sad); a mouth of a line or two (a short curve,
 * a small O, a little open D when it tastes good); a faint apricot blush; a nose and the owner's moustache left as shapes. Painted in degrees round the head (az across, el up from the eyes' line's
 * middle) so one painter draws them all: the owner's and the staff's face patch (blender/boss.py: a sheet of four by two, the patch's UVs
 * slid from one frame to the next) and the customers' strips of eight (blender/folk.py's order, slid by their material).
 */
export const FACES = ['idle', 'blink', 'happy', 'focused', 'panic', 'proud', 'drink', 'talk'] as const
/** a face the owner and the staff make (setExpression's states) */
export type CrewFace = (typeof FACES)[number]
/** the customers' strip, in its order (blender/folk.py's EXPR) */
const GUEST_FACES = ['idle', 'blink', 'happy', 'mad', 'sad', 'chew', 'talk', 'surprised'] as const
type Face = CrewFace | (typeof GUEST_FACES)[number]
export type FaceKind = 'boss' | 'male' | 'female' | 'elder' | 'kid'

const INK = '#1c1410'
const EYE_AZ = 19.5
const EYE_EL = 3.2
const BROW_EL = 21
/** where each kind's mouth is (degrees down from the eyes' line): the owner's under his moustache */
const MOUTH_EL: Record<FaceKind, number> = { boss: -29, male: -20.6, female: -20.6, elder: -20, kid: -20 }
/** how big each kind's eyes are (the owner's under his glasses a little smaller) */
const BIG: Record<FaceKind, number> = { boss: 0.86, male: 0.95, female: 1, elder: 0.85, kid: 1.1 }

/** a frame on a sheet: where on it, and how degrees round the head land on it */
type Frame = { place: (az: number, el: number) => [number, number]; sx: number; sy: number }

/** one face painted into `f` */
function paintFace(g: CanvasRenderingContext2D, f: Frame, kind: FaceKind, face: Face) {
  const big = BIG[kind]
  // (bean eyes: a little taller than wide, small in the face)
  const rx = 5.4 * big, ry = 6.8 * big
  const lip = kind === 'female' ? '#b8483e' : '#6a2a20'
  const browC = kind === 'elder' ? '#8a8580' : '#2e1c12'
  const browW = { boss: 3.4, male: 2.8, female: 1.9, elder: 2.4, kid: 2.4 }[kind]
  // (drawn about a point (az, el) in degrees, x across and y down, a degree to the unit)
  const at = (az: number, el: number, draw: () => void) => {
    const [x, y] = f.place(az, el)
    g.save()
    g.translate(x, y)
    g.scale(f.sx, f.sy)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    draw()
    g.restore()
  }
  const blush = (colour: string, w: number) => {
    for (const sd of [-1, 1]) at(sd * 30, -12, () => { g.fillStyle = colour; g.beginPath(); g.ellipse(0, 0, w, w * 0.6, 0, 0, Math.PI * 2); g.fill() })
  }
  // (faint, a soft apricot: solid all the same, the figures being hashed on their alpha (a see-through blush came out a scatter of dots), so
  // a pale tint near the skin's own rather than a see-through one)
  blush(face === 'proud' || face === 'happy' ? '#f4ae9a' : '#f6c3b2', kind === 'boss' || kind === 'male' ? 4.6 : 5.4)
  for (const sd of [-1, 1]) {
    const cx = sd * EYE_AZ
    // ---- the eyes
    at(cx, EYE_EL, () => {
      // (one tiny white dot, up toward the outside: no more)
      const dot = (k = 1) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.3 * rx * sd, -0.4 * ry, 0.26 * rx * k, 0, Math.PI * 2); g.fill() }
      const bean = (sx = 1, sy = 1) => { g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, rx * sx, ry * sy, 0, 0, Math.PI * 2); g.fill() }
      const stroke = (w: number, path: () => void, colour = INK) => { g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
      if (face === 'blink') stroke(2.2, () => { g.moveTo(-rx * 1.1, 0.5); g.quadraticCurveTo(0, 0.35 * ry, rx * 1.1, 0.5) })
      // (happy, proud, a mouthful that's good: closed into arcs, ^ ^)
      else if (face === 'happy' || face === 'proud' || face === 'chew') stroke(2.6, () => { g.moveTo(-rx * 1.2, 0.35 * ry); g.quadraticCurveTo(0, -1.0 * ry, rx * 1.2, 0.35 * ry) })
      // (gulping it down: > <)
      else if (face === 'drink') stroke(2.4, () => { g.moveTo(sd * 1.1 * rx, -0.6 * ry); g.lineTo(-sd * 0.8 * rx, 0); g.lineTo(sd * 1.1 * rx, 0.6 * ry) })
      // (a fright: rounder and a touch bigger, the dot as ever)
      else if (face === 'panic' || face === 'surprised') { bean(1.15, 1.0); dot(1.1) }
      // (at work, cross: the top of the bean cut flat by a lid, a little smaller)
      else if (face === 'focused' || face === 'mad') {
        g.save(); g.beginPath(); g.rect(-2 * rx, -0.25 * ry, 4 * rx, 2 * ry); g.clip(); bean(0.95, 0.95); g.restore()
        stroke(1.8, () => { g.moveTo(-1.15 * rx, -0.25 * ry); g.lineTo(1.15 * rx, -0.25 * ry) })
        g.save(); g.beginPath(); g.rect(-2 * rx, -0.25 * ry, 4 * rx, 2 * ry); g.clip(); dot(0.85); g.restore()
      } else if (face === 'sad') { bean(0.9, 0.85); dot(0.9) }
      else { bean(); dot() }
      if (kind === 'elder' && face !== 'happy') stroke(0.8, () => { g.moveTo(sd * 1.15 * rx, 0.55 * ry); g.quadraticCurveTo(sd * 1.35 * rx, 0.7 * ry, sd * 1.3 * rx, 0.95 * ry) }, '#b07a5a')
    })
    // ---- the brows: thick, tilted and lifted by the mood (inner end down when focused or cross, up when worried)
    // (the inner end down when at work or cross, up and the whole brow sagging when sad, lifted high in a fright)
    const tilt = face === 'focused' || face === 'mad' || face === 'drink' ? 3.6 : face === 'sad' ? -4.2 : face === 'panic' ? -2.4 : 0
    const lift = face === 'panic' || face === 'surprised' ? 6 : face === 'happy' || face === 'proud' ? 2 : face === 'mad' ? -1.5 : face === 'sad' ? -1 : 0
    at(cx, BROW_EL - 3 + lift, () => {
      g.strokeStyle = browC; g.lineWidth = browW * 1.25
      g.beginPath()
      g.moveTo(-sd * 4.6, tilt); g.quadraticCurveTo(0, -1.2 - Math.abs(tilt) * 0.15, sd * 4.6, -tilt * 0.3)
      g.stroke()
    })
  }
  // ---- the mouth
  at(0, MOUTH_EL[kind], () => {
    const dark = '#5a1810', tongue = '#e8786a'
    const line = (w: number, path: () => void) => { g.strokeStyle = lip; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
    // (a short gentle curve at rest)
    if (face === 'idle' || face === 'blink') line(1.7, () => { g.moveTo(-3.4, -0.2); g.quadraticCurveTo(0, 2, 3.4, -0.2) })
    else if (face === 'happy' || face === 'proud') {
      // (a little open D: its top flat, a hint of tongue at the bottom)
      const w = face === 'proud' ? 4.8 : 4.2
      g.beginPath(); g.moveTo(-w, -1); g.lineTo(w, -1); g.ellipse(0, -1, w, w * 0.95, 0, 0, Math.PI); g.closePath()
      g.fillStyle = dark; g.fill()
      g.save(); g.clip()
      g.fillStyle = tongue; g.beginPath(); g.ellipse(0, w * 0.75, w * 0.6, w * 0.4, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    } else if (face === 'panic' || face === 'surprised' || face === 'talk') {
      // (a small O: rounder as they gasp, wider and shallower as they talk)
      const [w, h] = face === 'talk' ? [2.8, 2.2] : [2.4, 3.2]
      g.beginPath(); g.ellipse(0, 0.8, w, h, 0, 0, Math.PI * 2)
      g.fillStyle = dark; g.fill()
    } else if (face === 'focused') line(1.7, () => { g.moveTo(-3, 0.4); g.lineTo(3, 0.2) })
    else if (face === 'drink') { g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0.4, 1.6, 1.4, 0, 0, Math.PI * 2); g.fill() }
    else if (face === 'mad') line(1.7, () => { g.moveTo(-3.6, 1.4); g.quadraticCurveTo(0, -1.6, 3.6, 1.4) })
    else if (face === 'sad') line(1.5, () => { g.moveTo(-3.2, 1.2); g.quadraticCurveTo(0, -0.8, 3.2, 1.2) })
    // (munching: a little wobbly line)
    else if (face === 'chew') line(1.6, () => { g.moveTo(-3.4, 0); g.bezierCurveTo(-2, -1.6, -1, 1.6, 0, 0); g.bezierCurveTo(1, -1.6, 2, 1.6, 3.4, 0) })
  })
  // ---- a bead of sweat on the brow (focused at its work; two in a panic)
  if (face === 'focused' || face === 'panic') for (const sd of face === 'panic' ? [-1, 1] : [1]) {
    at(sd * 31, 19, () => {
      g.beginPath(); g.moveTo(0, -3.4); g.quadraticCurveTo(2.8, 0.8, 0, 2.6); g.quadraticCurveTo(-2.8, 0.8, 0, -3.4)
      g.fillStyle = '#9ad8ff'; g.fill()
      g.strokeStyle = '#3a7bb0'; g.lineWidth = 0.7; g.stroke()
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-0.7, 0.6, 0.7, 0, Math.PI * 2); g.fill()
    })
  }
}

/** every pixel of a painted sheet either there or not (its edges' soft alpha, under the figures' hashed alpha, was a scatter of dots) */
function solidify(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  // (and where nothing's drawn, white under the clear: a material that missed the face's own mode multiplies it by the skin and gets the
  // skin, never black (a page hot-swapped mid-play showed a black face))
  for (let i = 3; i < d.length; i += 4) {
    d[i] = d[i] >= 110 ? 255 : 0
    if (!d[i]) d[i - 3] = d[i - 2] = d[i - 1] = 255
  }
  g.putImageData(img, 0, 0)
}

/** a canvas whose see-through parts stay see-through when it's packed into an atlas (scene/atlasMerge) */
export type SeeThrough = HTMLCanvasElement & { seeThrough?: boolean }

// ---- the owner's and the staff's: a sheet of four by two frames, each the front of the head itself (blender/boss.py: the head's faces within
// 45 degrees of its middle are the face, their UVs by bearing and elevation, az -45..45 across a frame, el 45..-45 down it)
const SPAN = 45
const CELL = 243
const crewSheets = new Map<FaceKind, THREE.CanvasTexture>()
/** the sheet of faces for the owner (`boss`) or the staff (`male`, `female`) */
export function crewFaceSheet(kind: FaceKind) {
  let t = crewSheets.get(kind)
  if (t) return t
  const c = document.createElement('canvas') as SeeThrough
  c.width = CELL * 4
  c.height = CELL * 2
  c.seeThrough = true
  const g = c.getContext('2d')!
  const k = CELL / (2 * SPAN)
  FACES.forEach((face, i) => {
    const ox = (i % 4) * CELL, oy = Math.floor(i / 4) * CELL
    paintFace(g, { place: (az, el) => [ox + (az + SPAN) * k, oy + (SPAN - el) * k], sx: k, sy: k }, kind, face)
  })
  solidify(c)
  t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false
  crewSheets.set(kind, t)
  return t
}

// ---- the customers': a strip of eight frames 256 square each, painted in degrees (az −62 to 62 across, el 42 down to −52; blender/folk.py)
const guestStrips = new Map<FaceKind, HTMLCanvasElement>()
/** the customers' strip of faces for their face type, painted as the owner's are */
export function guestFaceStrip(kind: FaceKind) {
  let c = guestStrips.get(kind)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 2048
  c.height = 256
  const g = c.getContext('2d')!
  GUEST_FACES.forEach((face, i) => {
    const ox = i * 256
    paintFace(g, { place: (az, el) => [ox + ((az + 62) / 124) * 256, ((42 - el) / 94) * 256], sx: 256 / 124, sy: 256 / 94 }, kind, face)
  })
  solidify(c)
  guestStrips.set(kind, c)
  return c
}

// ---- a figure's face, made and changed
/** where the face patch is in a figure's one mesh: its vertices (from `start`, `count`), their UVs on the first frame, and a frame's step */
export type FaceRange = { start: number; count: number; base: Float32Array; du: number; dv: number }
/** the face patch's place in the mesh, from the pieces it's built of (the patch's piece at `index`), once the atlas has placed its UVs */
export function faceRange(pieces: { geo: THREE.BufferGeometry }[], index: number): FaceRange | null {
  if (index < 0) return null
  let start = 0
  for (let i = 0; i < index; i++) start += pieces[i].geo.attributes.position.count
  const uv = pieces[index].geo.attributes.uv as THREE.BufferAttribute
  const base = new Float32Array(uv.array as ArrayLike<number>)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
  for (let i = 0; i < uv.count; i++) { u0 = Math.min(u0, uv.getX(i)); u1 = Math.max(u1, uv.getX(i)); v0 = Math.min(v0, uv.getY(i)); v1 = Math.max(v1, uv.getY(i)) }
  return { start, count: uv.count, base, du: u1 - u0, dv: v1 - v0 }
}
const RANGES = new WeakMap<THREE.BufferGeometry, FaceRange>()
/** the figure template's mesh's face (kept by its shape: the copies share it) */
export function markFace(mesh: THREE.Mesh, r: FaceRange | null) {
  if (!r) return
  RANGES.set(mesh.geometry, r)
  // (and on the template itself, for a figure drawn as its template (the owner in the room): its face changed in place)
  mesh.geometry.userData.face = r
}

/**
 * A copy's own shape over its template's: its UVs its own (so its face is its own), and its colours too when `colour` says how (the staff's
 * skin and hair); the rest shared. Undone by the function it gives back: the template's shape put back, only its own attributes let go.
 */
export function ownShape(root: THREE.Object3D, colour?: (m: THREE.Mesh, col: THREE.BufferAttribute) => boolean) {
  const swapped: [THREE.Mesh, THREE.BufferGeometry, THREE.BufferGeometry][] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.geometry
    const face = RANGES.get(src)
    const col = colour && src.attributes.color ? (src.attributes.color as THREE.BufferAttribute).clone() : null
    const coloured = !!col && colour!(m, col)
    if (!face && !coloured) return
    const g = new THREE.BufferGeometry()
    for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a)
    g.setIndex(src.index)
    if (coloured) g.setAttribute('color', col!)
    if (face) { g.setAttribute('uv', (src.attributes.uv as THREE.BufferAttribute).clone()); g.userData.face = face }
    src.computeBoundingSphere()
    g.boundingSphere = src.boundingSphere
    m.geometry = g
    swapped.push([m, src, g])
  })
  return () => {
    for (const [m, src, g] of swapped) {
      m.geometry = src
      for (const k of Object.keys(g.attributes)) if (g.attributes[k] === src.attributes[k]) g.deleteAttribute(k)
      g.setIndex(null)
      g.dispose()
    }
  }
}

/** setExpression: the face a figure (its copy, made its own by ownShape) shows; a no-op if it's showing it */
export function setFace(root: THREE.Object3D, face: CrewFace) {
  const k = FACES.indexOf(face)
  root.traverse((o) => {
    const m = o as THREE.Mesh
    const r = m.isMesh ? (m.geometry.userData.face as FaceRange | undefined) : undefined
    if (!r || m.geometry.userData.faceNow === k) return
    m.geometry.userData.faceNow = k
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute
    const du = (k % 4) * r.du, dv = Math.floor(k / 4) * r.dv
    for (let i = 0; i < r.count; i++) uv.setXY(r.start + i, r.base[i * 2] + du, r.base[i * 2 + 1] + dv)
    uv.clearUpdateRanges()
    uv.addUpdateRange(r.start * 2, r.count * 2)
    uv.needsUpdate = true
  })
}

/**
 * Overcooked's squash and stretch, `t` seconds after it's set off (a word said, something picked up): squashed (1.12, 0.88), sprung up
 * (0.95, 1.08) a tenth and a half of a second on, back to its size; [across, up] scales, 1 once it's over.
 */
export function squash(t: number): [number, number] {
  if (t < 0 || t > 0.42) return [1, 1]
  const ease = (a: number, b: number, u: number) => a + (b - a) * (1 - (1 - u) * (1 - u))
  if (t < 0.08) { const u = t / 0.08; return [ease(1, 1.12, u), ease(1, 0.88, u)] }
  if (t < 0.23) { const u = (t - 0.08) / 0.15; return [ease(1.12, 0.95, u), ease(0.88, 1.08, u)] }
  const u = (t - 0.23) / 0.19
  return [ease(0.95, 1, u), ease(1.08, 1, u)]
}
