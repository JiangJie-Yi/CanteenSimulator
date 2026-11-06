import * as THREE from 'three'

/**
 * Every face in the shop, painted (the owner's: Overcooked's way, bold enough to read from above): big dark oval eyes with a large and a
 * small glint, thick brows that tilt and lift, a mouth for every mood (a smile, a toothy D, a round O, a pout, a pressed line with the
 * tongue out), a nose and the owner's moustache left as shapes. Painted in degrees round the head (az across, el up from the eyes' line's
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
  const rx = 8.8 * big, ry = 12 * big
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
  const blush = (colour: string, a: number) => {
    for (const sd of [-1, 1]) at(sd * 31, -15, () => { g.globalAlpha = a; g.fillStyle = colour; g.beginPath(); g.ellipse(0, 0, 6.2, 3.6, 0, 0, Math.PI * 2); g.fill() })
  }
  // (solid: the figures are hashed on their alpha, and a see-through blush came out a scatter of dots)
  if (kind !== 'boss' && kind !== 'male') blush('#f7ab9c', 1)
  if (face === 'proud') blush('#ff7f78', 1)
  for (const sd of [-1, 1]) {
    const cx = sd * EYE_AZ
    // ---- the eyes
    at(cx, EYE_EL, () => {
      const glints = (k = 1) => {
        g.fillStyle = '#ffffff'
        g.beginPath(); g.arc(0.32 * rx, -0.38 * ry, 0.34 * rx * k, 0, Math.PI * 2); g.fill()
        g.beginPath(); g.arc(-0.3 * rx, 0.42 * ry, 0.16 * rx * k, 0, Math.PI * 2); g.fill()
      }
      const oval = (sx = 1, sy = 1) => { g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, rx * sx, ry * sy, 0, 0, Math.PI * 2); g.fill() }
      const stroke = (w: number, path: () => void, colour = INK) => { g.strokeStyle = colour; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
      if (face === 'blink') stroke(2.2, () => { g.moveTo(-rx, 0); g.quadraticCurveTo(0, 0.5 * ry, rx, 0) })
      else if (face === 'happy') stroke(2.4, () => { g.moveTo(-rx * 0.9, 0.25 * ry); g.quadraticCurveTo(0, -0.85 * ry, rx * 0.9, 0.25 * ry) })
      else if (face === 'drink' || face === 'chew') stroke(2.4, () => { g.moveTo(sd * 0.8 * rx, -0.55 * ry); g.lineTo(-sd * 0.7 * rx, 0); g.lineTo(sd * 0.8 * rx, 0.55 * ry) })
      else if (face === 'panic' || face === 'surprised') {
        // (the whites showing, a dark ring round them, the pupil shrunk to a dot)
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 0, rx * 1.05, ry * 1.1, 0, 0, Math.PI * 2); g.fill()
        g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke()
        g.fillStyle = INK; g.beginPath(); g.arc(0, 0.5, 0.26 * rx, 0, Math.PI * 2); g.fill()
      } else if (face === 'proud') {
        // (a shining star)
        g.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.42 * ry : 0.98 * ry
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        g.closePath()
        g.fillStyle = '#ffd23a'; g.fill()
        g.strokeStyle = INK; g.lineWidth = 1.3; g.stroke()
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0.18 * rx, -0.3 * ry, 0.16 * rx, 0, Math.PI * 2); g.fill()
      } else {
        // (open: the lid cut across for a look (focused and cross: low at the inside; sad: low at the outside))
        const lid = face === 'focused' || face === 'mad' ? [-0.15, -0.95] : face === 'sad' ? [-0.95, -0.2] : null
        g.save()
        if (lid) {
          g.beginPath()
          g.moveTo(-sd * 1.6 * rx, lid[0] * ry); g.lineTo(sd * 1.6 * rx, lid[1] * ry); g.lineTo(sd * 1.6 * rx, 2 * ry); g.lineTo(-sd * 1.6 * rx, 2 * ry)
          g.closePath(); g.clip()
        }
        oval()
        glints()
        g.restore()
        if (lid) stroke(1.8, () => { g.moveTo(-sd * 1.05 * rx, (lid[0] + (lid[1] - lid[0]) * 0.17) * ry); g.lineTo(sd * 1.05 * rx, (lid[1] - (lid[1] - lid[0]) * 0.17) * ry) })
        if (kind === 'female') for (const k of [0, 1, 2]) stroke(1.1, () => { const a = -0.5 - k * 0.32; g.moveTo(sd * Math.cos(a) * rx * 0.95, Math.sin(a) * ry * 0.95); g.lineTo(sd * Math.cos(a) * rx * 1.35, Math.sin(a) * ry * 1.3) })
      }
      if (kind === 'elder' && face !== 'happy') stroke(0.8, () => { g.moveTo(sd * 1.15 * rx, 0.55 * ry); g.quadraticCurveTo(sd * 1.35 * rx, 0.7 * ry, sd * 1.3 * rx, 0.95 * ry) }, '#b07a5a')
    })
    // ---- the brows: thick, tilted and lifted by the mood (inner end down when focused or cross, up when worried)
    const tilt = face === 'focused' || face === 'mad' || face === 'drink' ? 4.5 : face === 'sad' || face === 'panic' ? -3.6 : 0
    const lift = face === 'panic' || face === 'surprised' ? 5 : face === 'happy' || face === 'proud' ? 1.8 : face === 'mad' ? -1 : 0
    at(cx, BROW_EL + lift, () => {
      g.strokeStyle = browC; g.lineWidth = browW
      g.beginPath()
      g.moveTo(-sd * 5.6, tilt); g.quadraticCurveTo(0, -1.4 - Math.abs(tilt) * 0.2, sd * 5.6, -tilt * 0.4)
      g.stroke()
    })
  }
  // ---- the mouth
  at(0, MOUTH_EL[kind], () => {
    const dark = '#5a1810', tongue = '#e8786a'
    const line = (w: number, path: () => void) => { g.strokeStyle = lip; g.lineWidth = w; g.beginPath(); path(); g.stroke() }
    if (face === 'idle' || face === 'blink') line(1.7, () => { g.moveTo(-5, -0.6); g.quadraticCurveTo(0, 2.6, 5, -0.6) })
    else if (face === 'happy' || face === 'proud') {
      // (a big toothy D: its top flat, teeth along it, the tongue at the bottom)
      const w = face === 'proud' ? 7 : 6.2
      g.beginPath(); g.moveTo(-w, -1.5); g.lineTo(w, -1.5); g.ellipse(0, -1.5, w, 7, 0, 0, Math.PI); g.closePath()
      g.fillStyle = dark; g.fill()
      g.save(); g.clip()
      g.fillStyle = '#fffaf0'; g.fillRect(-w, -1.6, 2 * w, 2.2)
      g.fillStyle = tongue; g.beginPath(); g.ellipse(0, 4.6, 3.6, 2.4, 0, 0, Math.PI * 2); g.fill()
      g.restore()
      g.strokeStyle = lip; g.lineWidth = 1; g.beginPath(); g.moveTo(-w, -1.5); g.lineTo(w, -1.5); g.ellipse(0, -1.5, w, 7, 0, 0, Math.PI); g.closePath(); g.stroke()
    } else if (face === 'panic' || face === 'surprised' || face === 'talk') {
      // (wide open: an O as they gasp, rounder and lower; as they talk, wider and shallower)
      const [w, h, y] = face === 'talk' ? [4.6, 3.4, 0.8] : [3.8, 4.8, 1.2]
      g.beginPath(); g.ellipse(0, y, w, h, 0, 0, Math.PI * 2)
      g.fillStyle = dark; g.fill()
      g.save(); g.clip()
      g.fillStyle = tongue; g.beginPath(); g.ellipse(0, y + h * 0.75, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); g.fill()
      g.restore()
      g.strokeStyle = lip; g.lineWidth = 1; g.beginPath(); g.ellipse(0, y, w, h, 0, 0, Math.PI * 2); g.stroke()
    } else if (face === 'focused') {
      // (pressed tight, the tongue poking out at a corner)
      g.fillStyle = tongue; g.beginPath(); g.arc(2.6, 0.6, 1.6, 0, Math.PI); g.fill()
      g.strokeStyle = lip; g.lineWidth = 0.7; g.stroke()
      line(1.7, () => { g.moveTo(-4.4, 0.6); g.lineTo(4.4, 0) })
    } else if (face === 'drink') {
      // (a pout, pushed out at the bottle)
      g.fillStyle = dark; g.beginPath(); g.ellipse(0, 0.4, 1.4, 1.1, 0, 0, Math.PI * 2); g.fill()
      line(1.5, () => g.ellipse(0, 0.4, 2.6, 2.1, 0, 0, Math.PI * 2))
    } else if (face === 'mad') line(1.7, () => { g.moveTo(-4.6, 1.6); g.quadraticCurveTo(0, -2, 4.6, 1.6) })
    else if (face === 'sad') line(1.5, () => { g.moveTo(-4, 1.4); g.quadraticCurveTo(0, -1.2, 4, 1.4) })
    else if (face === 'chew') line(1.6, () => { g.moveTo(-4.2, 0); g.bezierCurveTo(-2.4, -2, -1.2, 2, 0, 0); g.bezierCurveTo(1.2, -2, 2.4, 2, 4.2, 0) })
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
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0
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
