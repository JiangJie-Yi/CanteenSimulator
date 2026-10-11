import * as THREE from 'three'

/*
 * Where the customers sit: one or more counters, each a straight run of stools. A counter is given by its middle
 * (`at`, on the floor), the way it runs (`along`) and the way across it toward the cook (`lay`); its customers sit on
 * the far side, facing the cook. (along × up = lay, so every counter's frame turns the same way.) Behind each row of
 * stools runs an aisle, and the customers walk in along the aisles, never through the stools.
 */
export type Counter = { at: THREE.Vector3; along: THREE.Vector3; lay: THREE.Vector3; length: number; seats: number }
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

export const LAY = new THREE.Vector3(0.59, 0, 0.81)
export const ALONG = new THREE.Vector3(0.81, 0, -0.59)

export function seatsOf(cs: Counter[]): Seat[] {
  return cs.flatMap((c, ci) => Array.from({ length: c.seats }, (_, n) => {
    const plate = c.at.clone().addScaledVector(c.along, (n - (c.seats - 1) / 2) * (c.length / c.seats))
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
  { at: new THREE.Vector3().addScaledVector(LAY, -2.45).addScaledVector(ALONG, 0.45), along: ALONG, lay: LAY, length: 3.6, seats: 4 },
  { at: new THREE.Vector3().addScaledVector(LAY, -0.5).addScaledVector(ALONG, -2.75), along: LAY.clone().negate(), lay: ALONG, length: 3.0, seats: 4 },
]
export const GRILL_SEATS = seatsOf(GRILL_COUNTERS)
