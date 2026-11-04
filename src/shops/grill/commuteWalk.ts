// One of the staff on their way home (or upstairs) as the shop shuts, or in as it opens (game/commute's rules): finishing up where they
// stand first, then their way at their own pace, giving way to whoever's just ahead; going out, a pause at the door turned back to the
// room with a nod, and through it fading; coming in, through the door fading in, and on to their place. Each walker (Roasting's crew,
// GuestBar3D's servers and stock keeper) steps its own along in its own frame; where they all are in the world is kept here, to keep apart.
import * as THREE from 'three'
import { FADE_S, NOD_S, yieldTo } from '@/game/commute'

/** where everyone on their way is just now (the world), and which way they're going, by id */
export const COMMUTERS = new Map<string, { p: THREE.Vector3; go: THREE.Vector3 }>()

export type Trip = {
  id: string
  dir: 'out' | 'in'
  /** the way, in the walker's own frame: out, from where they stand to the door and a step through it; in, from a step outside the door in */
  way: THREE.Vector3[]
  len: number
  /** how far along, and seconds since it began */
  d: number
  t: number
  /** seconds before they set off; their pace */
  wait: number
  pace: number
  /** seconds into the nod at the door */
  nod: number
  done: boolean
  /** where they were in the world last step (which way they're going, for giving way) */
  last: THREE.Vector3 | null
}

const lengthOf = (w: THREE.Vector3[]) => w.reduce((s, p, i) => (i ? s + p.distanceTo(w[i - 1]) : 0), 0)
export function makeTrip(id: string, dir: 'out' | 'in', way: THREE.Vector3[], wait: number, pace: number): Trip {
  return { id, dir, way, len: lengthOf(way), d: 0, t: 0, wait, pace, nod: 0, done: false, last: null }
}
/** a point and the way's direction so far along it */
function along(w: THREE.Vector3[], d: number) {
  let left = d
  for (let i = 1; i < w.length; i++) {
    const seg = w[i].distanceTo(w[i - 1])
    if (left <= seg || i === w.length - 1) {
      const k = seg > 1e-6 ? Math.min(1, left / seg) : 1
      return { p: w[i - 1].clone().lerp(w[i], k), dir: w[i].clone().sub(w[i - 1]) }
    }
    left -= seg
  }
  return { p: w[w.length - 1].clone(), dir: new THREE.Vector3(0, 0, 1) }
}

export type TripPose = {
  /** where to stand (the walker's frame), facing (a yaw, or null to keep it), how much of them shows (0..1), drawn at all */
  p: THREE.Vector3; yaw: number | null; vis: number; shown: boolean
  /** how far into their nod (0..1..0); stretching while they finish up */
  nod: number; stretch: boolean; walking: boolean
}
/**
 * A step along a trip: `dt` seconds, `speed` everyone's walking pace in the walker's frame, `world` the walker's frame to the world (for
 * giving way). Out: finishing up, then the way to the door, the nod, the step through it fading; in: unseen till their moment, through
 * the door fading in, on to their place.
 */
export function tripStep(tr: Trip, dt: number, speed: number, world: (v: THREE.Vector3) => THREE.Vector3): TripPose {
  tr.t += dt
  const n = tr.way.length
  // (the last stretch going out, the first coming in: through the doorway)
  const doorLen = n > 1 ? tr.way[n - 1].distanceTo(tr.way[n - 2]) : 0, inLen = n > 1 ? tr.way[1].distanceTo(tr.way[0]) : 0
  if (tr.t < tr.wait) {
    const p = tr.way[0].clone()
    return { p, yaw: null, vis: tr.dir === 'out' ? 1 : 0, shown: tr.dir === 'out', nod: 0, stretch: tr.dir === 'out' && tr.t > tr.wait * 0.35, walking: false }
  }
  if (tr.done) return { p: tr.way[n - 1].clone(), yaw: null, vis: tr.dir === 'out' ? 0 : 1, shown: tr.dir === 'in', nod: 0, stretch: false, walking: false }
  const atDoor = tr.dir === 'out' && tr.d >= tr.len - doorLen - 1e-4
  if (atDoor && tr.nod < NOD_S) {
    // (turned back to the room, a nod: then through the door)
    tr.nod += dt
    const p = tr.way[n - 2].clone(), back = tr.way[Math.max(0, n - 3)].clone().sub(p)
    const k = Math.min(1, tr.nod / NOD_S)
    return { p, yaw: Math.atan2(back.x, back.z), vis: 1, shown: true, nod: Math.sin(Math.PI * k), stretch: false, walking: false }
  }
  // (giving way to whoever's just ahead on their own way)
  // (face to face, only the one of the two whose name comes later gives way: both did, and the two crept past each other)
  let slow = 1
  const me = world(along(tr.way, tr.d).p)
  const go = tr.last ? me.clone().sub(tr.last).setY(0) : new THREE.Vector3()
  if (go.lengthSq() > 1e-10) {
    go.normalize()
    for (const [id, o] of COMMUTERS) {
      if (id === tr.id) continue
      const to = o.p.clone().sub(me).setY(0), gap = to.length()
      if (gap < 1e-4) continue
      const headOn = o.go.dot(go) < -0.3
      if (headOn && id > tr.id) continue
      slow = Math.min(slow, yieldTo(gap, go.dot(to.divideScalar(gap))))
    }
  }
  tr.last = me
  COMMUTERS.set(tr.id, { p: me, go })
  // (through the doorway at an easy pace, slower than across the room)
  const inDoor = tr.dir === 'out' ? atDoor : tr.d < inLen
  tr.d = Math.min(tr.len, tr.d + dt * speed * tr.pace * slow * (inDoor ? 0.7 : 1))
  const { p, dir } = along(tr.way, tr.d)
  let vis = 1
  if (tr.dir === 'out' && atDoor) vis = Math.max(0, 1 - (tr.d - (tr.len - doorLen)) / Math.max(1e-4, doorLen))
  if (tr.dir === 'in' && tr.d < inLen) vis = Math.min(1, tr.d / Math.max(1e-4, inLen))
  // (a fade no quicker than FADE_S, however short the doorway)
  if (tr.d >= tr.len) {
    tr.done = true
    COMMUTERS.delete(tr.id)
  }
  return { p, yaw: dir.x || dir.z ? Math.atan2(dir.x, dir.z) : null, vis: tr.done ? (tr.dir === 'out' ? 0 : 1) : vis, shown: !(tr.done && tr.dir === 'out'), nod: 0, stretch: false, walking: true }
}
/** a step through a door: the point that far on past `door` from `from` (out through it), for the way's last stretch */
export const through = (from: THREE.Vector3, door: THREE.Vector3, by: number) => door.clone().add(door.clone().sub(from).setY(0).normalize().multiplyScalar(by))
export { FADE_S }
