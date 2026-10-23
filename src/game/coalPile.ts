// How sticks of charcoal lie on the fire bed: each rests on the salt (and the heap in the middle), or across whatever sticks lie
// beneath it, tipped to rest on the two sides it touches, laid across them rather than along them, as a pile is built. Pure
// numbers (in the pit's own frame, plan x / z and height y) so the pile can be worked out and tested apart from the drawing.

/** a stick lying in the pile: its middle in plan, the way it points (plan angle), its middle's height, and how steeply it rises along its length */
export type Lay = { x: number; z: number; yaw: number; y: number; slope: number }
/** half a stick's length, and its radius */
export const STICK_HALF = 0.27
export const STICK_R = 0.024
/** the salt's mound (its height in the middle and how far it reaches) and the heap's hump on it */
const SALT_TOP = 0.126, SALT_REACH = 1.12, HEAP_TOP = 0.12, HEAP_REACH = 0.5

/** the height of the bed's surface at a place in plan */
export function surfaceY(x: number, z: number, lift = 0) {
  const r = Math.hypot(x, z)
  return lift + SALT_TOP * Math.max(0, 1 - (r / SALT_REACH) ** 2) ** 1.5 + HEAP_TOP * Math.max(0, 1 - (r / HEAP_REACH) ** 2)
}

/** how far a point is from a stick's axis in plan, and how far along the axis (from its middle) the nearest part is */
function near(px: number, pz: number, o: Lay) {
  const dx = Math.cos(o.yaw), dz = Math.sin(o.yaw)
  const u = Math.max(-STICK_HALF, Math.min(STICK_HALF, (px - o.x) * dx + (pz - o.z) * dz))
  return { d: Math.hypot(px - (o.x + dx * u), pz - (o.z + dz * u)), u }
}

/** where a stick laid at (x, z) pointing `yaw` comes to rest on the bed and the sticks `below` it: its middle's height, and its slope */
export function restOf(x: number, z: number, yaw: number, below: Lay[], lift = 0) {
  const S = [-0.22, 0, 0.22]
  const dx = Math.cos(yaw), dz = Math.sin(yaw)
  const h = S.map((s) => {
    const px = x + dx * s, pz = z + dz * s
    let y = surfaceY(px, pz, lift) + STICK_R
    for (const o of below) {
      const { d, u } = near(px, pz, o)
      // (lying across it: resting on it at the height its surface has there)
      if (d < 2 * STICK_R) y = Math.max(y, o.y + o.slope * u + Math.sqrt(Math.max(0, (2 * STICK_R) ** 2 - d * d)))
    }
    return y
  })
  const slope = Math.max(-0.6, Math.min(0.6, (h[2] - h[0]) / 0.44))
  return { y: Math.max(h[0] + slope * 0.22, h[1], h[2] - slope * 0.22), slope }
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
export function placeStick(below: Lay[], rnd: () => number = Math.random, reach = 0.34, tries = 28, lift = 0) {
  for (let i = 0; i < tries; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * reach
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    const yaw = crossYaw(x, z, below, rnd) ?? rnd() * Math.PI
    const rest = restOf(x, z, yaw, below, lift)
    // (judged at its highest end, not only its middle: a stick leaning on a pile must not reach past the depth either)
    const hi = rest.y + Math.abs(rest.slope) * STICK_HALF
    if (withinPile(x, z, rest.y, lift) && hi - surfaceY(x, z, lift) <= STICK_R + (MAX_LAYERS - 1) * 2 * STICK_R + 0.05) return { x, z, yaw, rest }
  }
  return null
}
