// How sticks of charcoal lie on the fire bed: each rests on the salt, or across whatever sticks lie
// beneath it, tipped to rest on the two sides it touches, laid across them rather than along them, as a pile is built. Pure
// numbers (in the pit's own frame, plan x / z and height y) so the pile can be worked out and tested apart from the drawing.

/** a stick lying in the pile: its middle in plan, the way it points (plan angle), its middle's height, and how steeply it rises along its length */
export type Lay = { x: number; z: number; yaw: number; y: number; slope: number }
/** half a stick's length, and its radius: as the sticks are drawn (about 0.3 long, 0.065 across), measured in the scene */
export const STICK_HALF = 0.15
export const STICK_R = 0.032
/** the salt's mound, fitted to the fire pit's mesh as it is (its height in the middle, how far it reaches, how full its shoulder): there's
 * no heap on it any more, so nothing is raised over the middle and nothing lies in the air there */
const SALT_TOP = 0.212, SALT_REACH = 1.15, SALT_FULL = 0.85

/** the height of the bed's surface at a place in plan */
export function surfaceY(x: number, z: number, lift = 0) {
  const r = Math.hypot(x, z)
  return lift + SALT_TOP * Math.max(0, 1 - (r / SALT_REACH) ** 2) ** SALT_FULL
}

/** how far a point is from a stick's axis in plan, and how far along the axis (from its middle) the nearest part is */
function near(px: number, pz: number, o: Lay) {
  const dx = Math.cos(o.yaw), dz = Math.sin(o.yaw)
  const u = Math.max(-STICK_HALF, Math.min(STICK_HALF, (px - o.x) * dx + (pz - o.z) * dz))
  return { d: Math.hypot(px - (o.x + dx * u), pz - (o.z + dz * u)), u }
}

/** how far along its length a stick is sampled for what holds it up, and the most it may tilt (steeper is clamped: it'd be sliding by then) */
const SAMPLES = 21, MAX_SLOPE = 1.5

/**
 * Where a stick laid at (x, z) pointing `yaw` comes to rest on the bed and the sticks `below` it: its middle's height, and its slope.
 * It's held up wherever the bed or a stick beneath rises highest along its length, and rests on the two highest supports on either side of its
 * middle (the upper hull of the heights along it, read at its middle), so it touches what holds it up and never hangs in the air or sinks in.
 */
export function restOf(x: number, z: number, yaw: number, below: Lay[], lift = 0) {
  const dx = Math.cos(yaw), dz = Math.sin(yaw)
  const pts: [number, number][] = []
  for (let i = 0; i < SAMPLES; i++) {
    const t = -STICK_HALF + (2 * STICK_HALF * i) / (SAMPLES - 1)
    const px = x + dx * t, pz = z + dz * t
    let y = surfaceY(px, pz, lift) + STICK_R
    for (const o of below) {
      const { d, u } = near(px, pz, o)
      // (lying across it: resting on it at the height its surface has there)
      if (d < 2 * STICK_R) y = Math.max(y, o.y + o.slope * u + Math.sqrt(Math.max(0, (2 * STICK_R) ** 2 - d * d)))
    }
    pts.push([t, y])
  }
  // (the upper hull of those, left to right)
  const hull: [number, number][] = []
  for (const q of pts) {
    while (hull.length >= 2) {
      const [a, b] = [hull[hull.length - 2], hull[hull.length - 1]]
      if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) >= 0) hull.pop()
      else break
    }
    hull.push(q)
  }
  // (the hull's edge over its middle: the stick lies along it)
  let best = { y: pts[Math.floor(SAMPLES / 2)][1], slope: 0 }
  let flat = Infinity
  for (let i = 0; i + 1 < hull.length; i++) {
    const [a, b] = [hull[i], hull[i + 1]]
    if (a[0] <= 1e-9 && b[0] >= -1e-9) {
      const m = (b[1] - a[1]) / (b[0] - a[0])
      if (Math.abs(m) < flat) { flat = Math.abs(m); best = { y: a[1] + m * (0 - a[0]), slope: m } }
    }
  }
  return { y: best.y, slope: Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, best.slope)) }
}

/**
 * A stick let go at (x, z) comes to rest, then slides if it can: where the ground under it falls away (a steep heap, a tilted stick
 * beneath) it rolls and slips downhill, a couple of centimetres at a time (a hand's breadth at most), until it's flat enough, or low enough, to stay put.
 * Returns where it ends up, and the way it lies there.
 */
export function settle(x: number, z: number, yaw: number, below: Lay[], lift = 0) {
  let cx = x, cz = z
  let rest = restOf(cx, cz, yaw, below, lift)
  const STEP = 0.02, TRAVEL = 0.1
  for (let i = 0; i < 40; i++) {
    // (only a stick lying on others slips: one on the bed itself stays where it fell, the bed being nearly level; and none goes far, so the
    // heap stays a heap)
    if (rest.y - surfaceY(cx, cz, lift) < STICK_R + 0.01) break
    let low = { x: cx, z: cz, rest, y: rest.y }
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, nx = cx + Math.cos(a) * STEP, nz = cz + Math.sin(a) * STEP
      if (Math.hypot(nx - x, nz - z) > TRAVEL) continue
      const r = restOf(nx, nz, yaw, below, lift)
      if (r.y < low.y - 1e-6) low = { x: nx, z: nz, rest: r, y: r.y }
    }
    if (low.x === cx && low.z === cz) break
    if (rest.y - low.y < 0.004 && Math.abs(rest.slope) < 0.3) break
    cx = low.x; cz = low.z; rest = low.rest
  }
  return { x: cx, z: cz, rest }
}

/** a stick landing close to one already lying is laid across it: the way it should point (a right angle off, a little unsquare), or null if none is near */
export function crossYaw(x: number, z: number, below: Lay[], rnd: () => number = Math.random) {
  let best: Lay | null = null, bd = 0.14
  for (const o of below) {
    const { d } = near(x, z, o)
    if (d < bd) { bd = d; best = o }
  }
  return best ? best.yaw + (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rnd() - 0.5) * 0.6) : null
}

/** a pile of sticks is only so many layers deep (each laid across the last): past that they'd roll off, so none rests higher */
export const MAX_LAYERS = 3

/** whether a stick resting with its middle at height y over (x, z) stays within the pile's depth */
export function withinPile(x: number, z: number, y: number, lift = 0) {
  return y - surfaceY(x, z, lift) <= STICK_R + (MAX_LAYERS - 1) * 2 * STICK_R + 0.012
}

/**
 * Where the next stick lands: a few places tried over the heap (within `reach` of the middle), the first that stays within the pile's depth
 * taken, and null if the heap is already as deep as it will go anywhere it was tried (the caller lets the oldest burn out first).
 */
export function placeStick(below: Lay[], rnd: () => number = Math.random, reach = 0.2, tries = 40, lift = 0) {
  for (let i = 0; i < tries; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * reach
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    const yaw = crossYaw(x, z, below, rnd) ?? rnd() * Math.PI
    const end = settle(x, z, yaw, below, lift)
    const { rest } = end
    // (judged at its highest end, not only its middle: a stick leaning on a pile must not reach past the depth either)
    const hi = rest.y + Math.abs(rest.slope) * STICK_HALF
    if (withinPile(end.x, end.z, rest.y, lift) && hi - surfaceY(end.x, end.z, lift) <= STICK_R + (MAX_LAYERS - 1) * 2 * STICK_R + 0.05) return { x: end.x, z: end.z, from: { x, z }, yaw, rest }
  }
  return null
}

/** whether the bed can take more sticks: under the most it holds, or some already burnt to ash that can be cleared (a burning stick is never pushed out) */
export const roomFor = (alive: number, ashed: number, max: number) => alive < max || ashed > 0

/** the most sticks the bed holds at once, and how many one load of charcoal puts on (6 or 7: a fire is laid close, the sticks touching, or it
 * won't catch): six loads (what it takes to bring the fire to 100%) fit */
export const COAL_MAX = 42
export const COAL_PER_ADD = { min: 6, max: 7 }

/** a broken-off piece of a stick that has burnt through: about this round (it's thinner than the stick it came from) */
export const CHUNK_R = STICK_R * 0.75

/** a piece of a burnt-through stick, where it comes to rest: plan x / z, height of its middle, the way it points, and its length */
export type Chunk = { x: number; z: number; y: number; yaw: number; len: number }

/** the height a piece of radius r comes to rest at over (x, z): on the bed, or on the highest stick under it there */
function supportAt(x: number, z: number, r: number, below: Lay[], lift: number) {
  let y = surfaceY(x, z, lift) + r
  for (const o of below) {
    const { d, u } = near(x, z, o)
    if (d < STICK_R + r) y = Math.max(y, o.y + o.slope * u + Math.sqrt(Math.max(0, (STICK_R + r) ** 2 - d * d)))
  }
  return y
}

/**
 * A stick burnt through gives way: it breaks into three to five pieces along its length (uneven ones), each falling straight down from where
 * it was onto what's under it there (the bed, or a stick beneath), a little askew. None rises above where it broke from, none floats.
 */
export function crumble(l: Lay, below: Lay[], rnd: () => number = Math.random, lift = 0): Chunk[] {
  const n = 3 + Math.floor(rnd() * 3)
  // (where it breaks: n uneven lengths along it)
  const cuts = Array.from({ length: n }, () => 0.6 + rnd() * 0.8)
  const total = cuts.reduce((a, b) => a + b, 0)
  const dx = Math.cos(l.yaw), dz = Math.sin(l.yaw)
  const out: Chunk[] = []
  let t = -STICK_HALF
  for (const c of cuts) {
    const len = (2 * STICK_HALF * c) / total
    const u = t + len / 2
    t += len
    // (each piece drops where it was, nudged a little sideways as it goes)
    const side = (rnd() - 0.5) * 0.03
    const x = l.x + dx * u - dz * side, z = l.z + dz * u + dx * side
    const from = l.y + l.slope * u
    const y = Math.min(from, supportAt(x, z, CHUNK_R, below, lift))
    out.push({ x, z, y, yaw: l.yaw + (rnd() - 0.5) * 0.9, len: len * 0.92 })
  }
  return out
}

/**
 * How hard a stick dragged from the crate is thrown when it's let go: 0 (laid down) .. 1 (flung), from how fast it was moving (scene units a
 * second) and how long ago it last moved (ms): a swing stopped before letting go is no throw.
 */
export function throwForce(speed: number, stillFor: number) {
  if (stillFor > 120 || !(speed > 0)) return 0
  return Math.min(1, speed / 3.5)
}

/** the standing bundle's slots: a square of 7 × 7 places this far apart, the feet set in them */
export const STAND_STEP = 0.085
const STAND_N = 7
/**
 * The next stick stood up in the bundle, the way charcoal's built round a robatayaki's fish: upright, its foot on the bed in the square of
 * slots, the free one nearest the middle taken (so the bundle grows outward), leaning in toward the middle a little, the outer ones more, so
 * the whole leans together. Returns its middle (as a Lay's: the way it leans as yaw, how steeply it rises along it as slope), or null when
 * every slot's taken.
 */
export function standStick(stood: Lay[], rnd: () => number = Math.random, lift = 0) {
  const feet = stood.map((l) => {
    const k = 1 / Math.hypot(1, l.slope)
    return { x: l.x - Math.cos(l.yaw) * STICK_HALF * k, z: l.z - Math.sin(l.yaw) * STICK_HALF * k }
  })
  const free: { x: number; z: number; d: number }[] = []
  for (let i = 0; i < STAND_N; i++) for (let j = 0; j < STAND_N; j++) {
    const x = (i - (STAND_N - 1) / 2) * STAND_STEP, z = (j - (STAND_N - 1) / 2) * STAND_STEP
    if (feet.some((f) => Math.hypot(f.x - x, f.z - z) < STAND_STEP * 0.6)) continue
    free.push({ x, z, d: Math.max(Math.abs(x), Math.abs(z)) + Math.hypot(x, z) * 0.1 + rnd() * 0.02 })
  }
  if (!free.length) return null
  free.sort((a, b) => a.d - b.d)
  const s = free[0]
  const fx = s.x + (rnd() - 0.5) * 0.008, fz = s.z + (rnd() - 0.5) * 0.008
  const r = Math.hypot(fx, fz)
  // (the middle ones nearly upright, leaning in more toward the bundle's edge, up to ten degrees or so; neighbours near alike, so they lean
  // together onto the middle and don't cross)
  const lean = ((1.5 + 9 * Math.min(1, r / 0.32) + (rnd() - 0.5) * 1.5) * Math.PI) / 180
  const yaw = r > 0.02 ? Math.atan2(-fz, -fx) + (rnd() - 0.5) * 0.15 : rnd() * Math.PI * 2
  const c = Math.sin(lean), up = Math.cos(lean)
  const x = fx + Math.cos(yaw) * STICK_HALF * c, z = fz + Math.sin(yaw) * STICK_HALF * c
  const y = surfaceY(fx, fz, lift) + STICK_HALF * up
  return { x, z, from: { x, z }, yaw, rest: { y, slope: up / c } }
}
