import * as THREE from 'three'

/*
 * Where the customers sit: one or more counters, each a straight run of stools. A counter is given by its middle
 * (`at`, on the floor), the way it runs (`along`) and the way across it toward the cook (`lay`); its customers sit on
 * the far side, facing the cook. (along × up = lay, so every counter's frame turns the same way.) Behind each row of
 * stools runs an aisle, and the customers walk in along the aisles, never through the stools.
 */
export type Counter = { at: THREE.Vector3; along: THREE.Vector3; lay: THREE.Vector3; length: number; seats: number
  /** its stools moved along it this far from evenly spaced about its middle (clear of a gate at one end) */
  shift?: number
  /** how far behind its middle line its wall stands (FLOOR_FAR unless it's further back, to make room by it) */
  far?: number }
export type Seat = {
  /** on the counter top (y 0: set the top's height yourself): where the plate goes */
  plate: THREE.Vector3
  /** the stool, on the floor */
  stool: THREE.Vector3
  /** the aisle just behind the stool */
  aisle: THREE.Vector3
  /** which way the customer faces sat down */
  yaw: number
  along: THREE.Vector3
  lay: THREE.Vector3
  counter: number
}

/** how far behind the counter's middle line the stools stand, and the aisle behind them */
export const SIT_BACK = 0.5
export const AISLE = 1.15
/** the customers' floor runs from this far toward the cook from a counter's middle line (under the bar, up to its
 * cook's edge's reach) back to the wall behind the aisle; the kitchen's floor starts where it stops */
export const FLOOR_NEAR = 0.42
export const FLOOR_FAR = -(AISLE + 0.5)
/** where a counter's wall stands, behind its middle line */
export const farOf = (c: Counter) => c.far ?? FLOOR_FAR

/**
 * The seats with a customer's plate set down at them just now (GuestBar3D keeps it, every frame): what's grilled for
 * someone is only carried over once their plate's there, so it never lands on the bare bar before it.
 */
export const PLATES_SET = new Set<number>()
/**
 * The stools someone's at in the 3D room just now (GuestBar3D): sat there, on their way to it, away at the toilet, or
 * still getting up and going. Nobody new is given one of these, though the shop's done with whoever had it.
 */
export const SEATS_TAKEN = new Set<number>()

/**
 * Serving through the pass, when there's a server on the floor: what's grilled is put out at the pass (the end of the
 * first counter by the clean plates); a server picks it up there with a plate and carries it to the customer, and
 * sets it down in front of them. Roasting moves the food, GuestBar3D the server and the plates; this is what they tell
 * each other, by the food's key.
 */
export const SERVICE = {
  /** how many servers there are to carry (GuestBar3D says): none, and the cook hands it over the bar himself */
  servers: 0,
  /** what's out at the pass waiting to go, and for which seat (Roasting) */
  waiting: new Map<string, number>(),
  /** what's being carried, and where it is just now, in the shop's frame (GuestBar3D) */
  carried: new Map<string, THREE.Vector3>(),
  /** what's been set down at its seat (GuestBar3D; Roasting lays it on the plate and takes it out of here) */
  delivered: new Set<string>(),
  /** where the staff walking about are just now, in the bar's own frame (the gates in the bar open for them) */
  walkers: [] as THREE.Vector3[],
  /** what a server has gone to fetch from the pass (no longer waiting there for another to take) */
  claimed: new Set<string>(),
}
// (in development, to be watched from the console)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __service?: typeof SERVICE }).__service = SERVICE
/**
 * The staff's way through each counter, at its outer end (GRILL_COUNTERS order): which end, how wide the gap in the
 * base and top is, and how wide the swing door across it (the first counter's reaches on to the till, which stands
 * against its end)
 */
export const BAR_GATES: { end: 1 | -1; w: number; leaf: number }[] = [{ end: 1, w: 0.32, leaf: 0.36 }, { end: -1, w: 0.56, leaf: 0.55 }]
/** a gate's hinge (along its counter, from the middle), and the middle of its doorway, in the bar's frame */
export function gateOf(c: Counter, g: { end: 1 | -1; w: number; leaf: number }) {
  const hinge = g.end * ((c.length + 0.2) / 2 - g.w)
  return { hinge, mid: c.at.clone().addScaledVector(c.along, hinge + g.end * g.leaf / 2).addScaledVector(c.lay, 0.08) }
}
/**
 * The little dish of sauce at a seat (the bar's frame, on its top): to the customer's left of their place, or their
 * right at a seat where the left would be off the top, by a gate. Its offset along the counter, given its seat's.
 */
export function sauceSide(c: Counter, gate: { end: 1 | -1; w: number } | undefined, x: number) {
  const topX0 = -(c.length + 0.3) / 2 + (gate && gate.end < 0 ? gate.w : 0)
  return x - 0.2 - 0.06 < topX0 ? 0.2 : -0.2
}
/** things in the room that can be clicked (the toilets' doors, the altar's incense): how many are under the pointer */
export const POINTER_HINT = { hand: 0 }
/** handlers for one of those: a hand over it */
export const handOver = {
  onPointerOver: (e: { stopPropagation: () => void; nativeEvent: Event }) => {
    e.stopPropagation()
    POINTER_HINT.hand++
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style) el.style.cursor = 'pointer'
  },
  onPointerOut: (e: { nativeEvent: Event }) => {
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand - 1)
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style && !POINTER_HINT.hand) el.style.cursor = ''
  },
}
/** each toilet's door's width */
export const WC_W = 0.82
/**
 * The two toilets, the men's and the women's, side by side in the side counter's wall where it runs into the corner:
 * each one's door along that counter (from its middle), the spot on the floor before it, and one inside. With only the
 * one counter there are none.
 */
export function toiletsOf(cs: Counter[]) {
  if (cs.length < 2) return null
  const c0 = cs[0], c = cs[1]
  const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
  const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(c0.lay)) / c.along.dot(c0.lay)
  const door = (meet + corner) / 2
  const one = (k: number) => {
    const z = door + k * (WC_W / 2 + 0.06)
    const at = (lay: number) => c.at.clone().addScaledVector(c.along, z).addScaledVector(c.lay, lay)
    return { z, front: at(farOf(c) + 0.45), aisle: at(-AISLE), inside: at(farOf(c) - 0.45) }
  }
  return { door, m: one(-1), f: one(1) }
}
/** the drinks fridge against the side counter's wall, just along from the toilets: where it stands (along that
 * counter, and out from its middle line), the way it faces, and the spot before it where a customer helps themselves */
export function fridgeOf(cs: Counter[]) {
  const t = toiletsOf(cs)
  if (!t) return null
  const c = cs[1]
  const z = t.m.z - WC_W / 2 - 0.12 - FRIDGE.W / 2 - 0.05
  const at = (lay: number) => c.at.clone().addScaledVector(c.along, z).addScaledVector(c.lay, lay)
  return { at: at(farOf(c) + FRIDGE.D / 2 + 0.01), yaw: Math.atan2(c.lay.x, c.lay.z), front: at(farOf(c) + FRIDGE.D + 0.32), aisle: at(-AISLE) }
}
/** the fridge's size: across, up, deep */
export const FRIDGE = { W: 0.62, H: 1.55, D: 0.36 }
/** what's in it, and what each costs (NT$) */
export const DRINKS = [
  { id: 'beer', zh: '啤酒', ja: 'ビール', price: 120, color: '#c88a2a', cap: '#d4b04a', glass: false },
  { id: 'sake', zh: '清酒', ja: '日本酒', price: 150, color: '#e8eef0', cap: '#c4302a', glass: true },
  { id: 'oolong', zh: '烏龍茶', ja: 'ウーロン茶', price: 50, color: '#9a5a1a', cap: '#2a6a3a', glass: false },
  { id: 'ramune', zh: '彈珠汽水', ja: 'ラムネ', price: 60, color: '#8ad0e8', cap: '#2a6ab0', glass: true },
] as const
export type DrinkId = (typeof DRINKS)[number]['id']
/** the toilets' doors: how many are going through each just now (GuestBar3D), and whether the player's opened it */
export const TOILETS = { m: { passing: 0, open: false }, f: { passing: 0, open: false } }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __toilets?: typeof TOILETS }).__toilets = TOILETS

/** the till: how far past the first counter's middle it stands (it butts on to the counter's end), and its size */
export const TILL = { along: 0.75, W: 1.2, D: 0.6, rise: 0.1 }

/** the pass, in the bar's own frame (on the first counter's top, at its start, the customers' side of it) */
export const passOf = (cs: Counter[]) => cs[0].at.clone().addScaledVector(cs[0].along, -cs[0].length / 2 + 0.2)
  .addScaledVector(cs[0].lay, -0.16)

/**
 * The whole shop's floor as one rectangle, in the first counter's frame (along it and across it, lay, from its middle):
 * every counter's floor from its far end and wall to where it meets the others, the strip behind the till, and the
 * kitchen inside them, squared off, so there's no corner left open.
 */
export function roomOf(cs: Counter[]) {
  const c0 = cs[0]
  const pts: THREE.Vector3[] = []
  const add = (c: Counter, along: [number, number], lay: [number, number]) => {
    for (const a of along) for (const l of lay) pts.push(c.at.clone().addScaledVector(c.along, a).addScaledVector(c.lay, l))
  }
  // (the first counter's floor runs on past its end to the door, with the till's strip behind it)
  add(c0, [-c0.length / 2 - 0.35, c0.length / 2 + 1.45], [FLOOR_FAR, 1.1])
  for (const c of cs.slice(1)) add(c, [-c.length / 2 - 0.35, c.length / 2], [farOf(c), FLOOR_NEAR])
  const al = pts.map((p) => p.clone().sub(c0.at).dot(c0.along)), ly = pts.map((p) => p.clone().sub(c0.at).dot(c0.lay))
  return { along: [Math.min(...al), Math.max(...al)] as [number, number], lay: [Math.min(...ly), Math.max(...ly)] as [number, number] }
}

export const LAY = new THREE.Vector3(0.59, 0, 0.81)
export const ALONG = new THREE.Vector3(0.81, 0, -0.59)

export function seatsOf(cs: Counter[]): Seat[] {
  return cs.flatMap((c, ci) => Array.from({ length: c.seats }, (_, n) => {
    const plate = c.at.clone().addScaledVector(c.along, (n - (c.seats - 1) / 2) * (c.length / c.seats) + (c.shift ?? 0))
    return {
      plate,
      stool: plate.clone().addScaledVector(c.lay, -SIT_BACK),
      aisle: plate.clone().addScaledVector(c.lay, -AISLE),
      yaw: Math.atan2(c.lay.x, c.lay.z),
      along: c.along,
      lay: c.lay,
      counter: ci,
    }
  }))
}

/**
 * The genkan (玄関) just inside the door: a floor of dark stone a step down from the room's boards, from the wall out
 * past the doorway and from the room's end back to the step up into the room (the first counter's frame: along it,
 * and lay, from its middle). Customers step up out of their shoes there, and into slippers.
 */
export const GENKAN = { depth: 0.05, along: [0.5, 1.45] as [number, number], lay: [FLOOR_FAR, -0.62] as [number, number] }
/** whether a point (the bar's frame) is down in the genkan */
export function inGenkan(cs: Counter[], p: THREE.Vector3) {
  const c0 = cs[0], d = p.clone().sub(c0.at)
  const a = d.dot(c0.along) - c0.length / 2, l = d.dot(c0.lay)
  return a > GENKAN.along[0] && a < GENKAN.along[1] + 0.01 && l > GENKAN.lay[0] - 0.01 && l < GENKAN.lay[1]
}
/** the way in: on the first counter's aisle, just past its far end */
export const doorOf = (cs: Counter[]) => cs[0].at.clone().addScaledVector(cs[0].along, cs[0].length / 2 + 1.0)
  .addScaledVector(cs[0].lay, -AISLE)

/**
 * From the door to a stool: along the first counter's aisle, round the corner into another counter's aisle if
 * that's where the stool is, up behind the stool, and onto it.
 */
export function pathTo(cs: Counter[], s: Seat): THREE.Vector3[] {
  const door = doorOf(cs)
  if (s.counter === 0) return [door, s.aisle, s.stool]
  const c0 = cs[0], c = cs[s.counter]
  const p0 = c0.at.clone().addScaledVector(c0.lay, -AISLE)
  const p1 = c.at.clone().addScaledVector(c.lay, -AISLE)
  const corner = p0.clone().addScaledVector(c0.along, p1.clone().sub(p0).dot(c0.along))
  return [door, corner, s.aisle, s.stool]
}

/** a point that far along a path, and the way it's heading there */
export function alongPath(path: THREE.Vector3[], d: number): { p: THREE.Vector3; dir: THREE.Vector3 } {
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].clone().sub(path[i - 1])
    const len = seg.length()
    if (d <= len || i === path.length - 1) {
      const k = len ? Math.min(1, Math.max(0, d / len)) : 1
      return { p: path[i - 1].clone().addScaledVector(seg, k), dir: len ? seg.divideScalar(len) : new THREE.Vector3(0, 0, 1) }
    }
    d -= len
  }
  return { p: path[path.length - 1].clone(), dir: new THREE.Vector3(0, 0, 1) }
}

export const pathLength = (path: THREE.Vector3[]) => path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0)

/** a single counter of four (the shops that don't lay out their own) */
export const singleCounter = (at: THREE.Vector3, length: number): Counter[] => [{ at, along: ALONG, lay: LAY, length, seats: 4 }]

/**
 * The grill's: the long counter behind the fire, and a second one down the left side of the room, its customers
 * looking in across the fire from the left. The door is past the right end of the first.
 */
export const GRILL_COUNTERS: Counter[] = [
  { at: new THREE.Vector3().addScaledVector(LAY, -2.45).addScaledVector(ALONG, -0.35), along: ALONG, lay: LAY, length: 5.2, seats: 6 },
  { at: new THREE.Vector3().addScaledVector(LAY, -0.42).addScaledVector(ALONG, -2.75), along: LAY.clone().negate(), lay: ALONG, length: 3.14, seats: 4, shift: 0.25,
    // (its wall set further back, for the drinks fridge by the toilets)
    far: FLOOR_FAR - 0.45 },
]
export const GRILL_SEATS = seatsOf(GRILL_COUNTERS)
/**
 * The grill's bar, stools and customers are all drawn this much bigger than their sizes here, to stand beside the
 * fire pit and its big skewers: scaled about the inside corner of the two counters' cook's edges, so those edges stay
 * where they are by the fire and the rest grows away from it. Roasting moves its own uses of them to match.
 */
export const GRILL_SCALE = 2
/** the grill's bar top, in its own sizes */
export const GRILL_BAR_TOP = 0.64
/** the cook's own table (the fire pit and all on it) has its top at the scene's floor, y = 0; the customers' floor is
 * further down, so their bar top comes up just this much higher than it */
export const GRILL_BAR_RISE = 0.12
const GRILL_PIVOT = new THREE.Vector3().addScaledVector(LAY, -2.14).addScaledVector(ALONG, -2.44)
/** where the scaled bar's group goes (with scale GRILL_SCALE) */
export const GRILL_OFFSET = GRILL_PIVOT.clone().multiplyScalar(1 - GRILL_SCALE).setY(GRILL_BAR_RISE - GRILL_BAR_TOP * GRILL_SCALE)
/**
 * Where the customers' plates are kept (the bar's frame, on the cook's table, inside, by the pass): the clean stack
 * and the dirty one beside it, back from the bar where the customers can't reach; and the height of that table's top.
 */
export const PLATE_STACKS = (() => {
  const c0 = { at: new THREE.Vector3().addScaledVector(LAY, -2.45).addScaledVector(ALONG, -0.35) }
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(ALONG, along).addScaledVector(LAY, lay)
  return { clean: at(-1.78, 0.62), dirty: at(-1.4, 0.62) }
})()
/** a point given in the bar's own sizes, where it is in the scene as drawn */
export const toGrillScene = (v: THREE.Vector3) => v.clone().multiplyScalar(GRILL_SCALE).add(GRILL_OFFSET)
/** the cook's table's top (the scene's y = 0), in the bar's own frame */
export const KITCHEN_TOP = -GRILL_OFFSET.y / GRILL_SCALE
