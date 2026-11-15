import * as THREE from 'three'
import type { WashBeat } from '@/game/handWash'

/**
 * Washing a plate up by hand, posed (item 174, the owner's, 2026-11-15: 「別再讓我看到這麼低水平的動畫」: the plates went from the stack to the
 * basket by themselves while his hands circled inside the counter): from a beat of it (game/handWash's washBeat, its share `k` 0..1) and the
 * points it moves between, where each hand is, the plate (where, how it's turned, drawn as deep as the sink's or as the basket's), how much
 * smear and suds are on it, whether it drips, where the tap's stream meets it, and the sponge in the right hand. One frame for all of it (the
 * caller's), up +y; nothing made new per frame.
 */
export type WashPoints = {
  /** the top dirty plate's middle where it lies (on the stack, or on the basin's floor), and how it's turned about its middle there */
  stack: THREE.Vector3
  stackSpin: number
  /** where it's worked: its middle over the water by the basin's near edge (its lower rim dips in) */
  work: THREE.Vector3
  /** the water's top (the drips fall to it) */
  waterY: number
  /** the tap's mouth while it runs (rinsed under it), else null (swished in the water) */
  spout: THREE.Vector3 | null
  /** the basket's next slot: the plate's middle standing in it, and the way the slots run (its face turned that way) */
  slot: THREE.Vector3
  along: THREE.Vector3
  /** flat and unit: from the work toward him (the plate's face is turned to him), and his left */
  toward: THREE.Vector3
  left: THREE.Vector3
  /** the sponge on its dish */
  spongeHome: THREE.Vector3
  /** his left hand where the last plate left it (in the basket's slot), or where it rests; his hands at rest */
  fromL: THREE.Vector3
  restL: THREE.Vector3
  restR: THREE.Vector3
  /** the plate's radius as it's drawn */
  r: number
}

export type WashPose = {
  left: THREE.Vector3
  right: THREE.Vector3
  /** the plate: shown in his hand, its middle, its turn, how deep it's drawn (1 the sink's, 0 the basket's shallower) */
  held: boolean
  plate: THREE.Vector3
  plateQ: THREE.Quaternion
  deep: number
  /** what's left of its smear (1 as it came .. 0), the suds on it (0..1), and water running off it (0..1) */
  smear: number
  foam: number
  wet: number
  /** where the tap's stream meets its face (the stream stops there), or null */
  stream: THREE.Vector3 | null
  /** the sponge: where, turned how (its flat side to the plate as it scrubs) */
  sponge: THREE.Vector3
  spongeQ: THREE.Quaternion
}

export const newWashPose = (): WashPose => ({
  left: new THREE.Vector3(), right: new THREE.Vector3(), held: false, plate: new THREE.Vector3(), plateQ: new THREE.Quaternion(), deep: 1,
  smear: 1, foam: 0, wet: 0, stream: null, sponge: new THREE.Vector3(), spongeQ: new THREE.Quaternion(),
})

const UP = new THREE.Vector3(0, 1, 0)
const ease = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c) }
/** a share of a beat between two of its points (0 before `a`, 1 after `b`) */
const span = (k: number, a: number, b: number) => (k - a) / (b - a)
// (scratch, kept)
const N = new THREE.Vector3(), U = new THREE.Vector3(), L = new THREE.Vector3(), V = new THREE.Vector3(), W = new THREE.Vector3()
const Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), SPIN = new THREE.Quaternion()
const STREAM_AT = new THREE.Vector3()
/** how far the plate's face is turned up from flat toward him, as it's worked (rad), and rinsed under the tap (steeper: the water runs off) */
const WORK_TILT = 0.95
const RINSE_TILT = 1.15
/** the plate's normal: straight up tilted toward him by `a` */
const tilted = (p: WashPoints, a: number, out: THREE.Vector3) => out.copy(UP).multiplyScalar(Math.cos(a)).addScaledVector(p.toward, Math.sin(a)).normalize()
/** the plate turned so its face looks along `n`, spun about it by `s` */
const turned = (n: THREE.Vector3, s: number, out: THREE.Quaternion) => out.setFromUnitVectors(UP, n).multiply(SPIN.setFromAxisAngle(UP, s))
/** a point on the plate's rim: the way `dir` lies across its face (`dir` put flat on the face), `r` out from its middle */
function rim(at: THREE.Vector3, q: THREE.Quaternion, dir: THREE.Vector3, r: number, out: THREE.Vector3) {
  N.copy(UP).applyQuaternion(q)
  V.copy(dir).addScaledVector(N, -N.dot(dir))
  if (V.lengthSq() < 1e-8) V.set(1, 0, 0).addScaledVector(N, -N.x)
  return out.copy(at).addScaledVector(V.normalize(), r)
}
/** where the right hand waits with the sponge: by the basin's edge on his right, a little in toward him from the work */
function waiting(p: WashPoints, out: THREE.Vector3) {
  return out.copy(p.work).addScaledVector(p.left, -p.r * 1.25).addScaledVector(p.toward, p.r * 0.6).addScaledVector(UP, p.r * 0.35)
}
/** the left hand on the plate: on its left rim, the rim coming round to its top as it's stood up in the basket (`up` 0..1) */
function grip(at: THREE.Vector3, q: THREE.Quaternion, p: WashPoints, up: number, out: THREE.Vector3) {
  rim(at, q, p.left, p.r * 0.92, W)
  if (up <= 0) return out.copy(W)
  rim(at, q, UP, p.r * 0.92, out)
  return out.lerp(W, 1 - up)
}
/** the plate's middle and turn where its rinse leaves it (where the basket's beat starts from) */
function rinsed(p: WashPoints, at: THREE.Vector3, q: THREE.Quaternion) {
  if (p.spout) {
    at.set(p.spout.x, Math.max(p.work.y, p.waterY + p.r * Math.sin(RINSE_TILT) * 0.95), p.spout.z)
    turned(tilted(p, RINSE_TILT, N), p.stackSpin + 2.4, q)
  } else {
    at.copy(p.work)
    turned(tilted(p, WORK_TILT * 0.65, N), p.stackSpin + 2.4, q)
  }
}

/** the sponge taken up off its dish (`back`: put back on it): the right hand reaching out for it and coming back with it */
export function spongePose(k: number, back: boolean, p: WashPoints, out: WashPose) {
  const t = back ? 1 - k : k
  // (his hand goes out most of the way toward the dish; the sponge comes the rest of the way into it)
  const reach = V.copy(p.restR).lerp(p.spongeHome, 0.72)
  const wait = waiting(p, W)
  if (t < 0.5) out.right.copy(p.restR).lerp(reach, ease(span(t, 0, 0.5)))
  else out.right.copy(reach).lerp(wait, ease(span(t, 0.5, 1)))
  out.left.copy(p.restL)
  out.sponge.copy(p.spongeHome).lerp(out.right, ease(span(t, 0.35, 0.62)))
  out.spongeQ.identity()
  out.held = false
  out.foam = 0
  out.wet = 0
  out.stream = null
}

/** a beat of a plate's washing, posed (the sponge in the right hand all along) */
export function washPose(beat: WashBeat, k: number, p: WashPoints, out: WashPose) {
  out.stream = null
  out.deep = 1
  waiting(p, out.right)
  if (beat === 'take') {
    // (the left hand from where it was to the top plate's left rim; the plate still on the stack, not yet in hand)
    turned(UP, p.stackSpin, Q0)
    grip(p.stack, Q0, p, 0, U)
    out.left.copy(p.fromL).lerp(U.addScaledVector(UP, 0.012), ease(span(k, 0, 0.85)))
    // (lifted a little toward the end: it's coming off the stack)
    out.held = false
    out.smear = 1
    out.foam = 0
    out.wet = 0
  } else if (beat === 'bring') {
    // (up off the stack and over to the water, its face coming round to him)
    const e = ease(k)
    out.plate.copy(p.stack).lerp(p.work, e).addScaledVector(UP, p.r * 0.8 * Math.sin(Math.PI * k))
    turned(UP, p.stackSpin, Q0)
    turned(tilted(p, WORK_TILT, N), p.stackSpin, Q1)
    out.plateQ.copy(Q0).slerp(Q1, e)
    out.held = true
    out.smear = 1
    out.foam = 0
    out.wet = 0
    grip(out.plate, out.plateQ, p, 0, out.left)
  } else if (beat === 'scrub') {
    // (held over the water, turned round slowly in the left hand; the sponge going round on its face, two and a half times; the smear going,
    // the suds coming)
    out.plate.copy(p.work).addScaledVector(UP, 0.006 * Math.sin(Math.PI * 4 * k))
    turned(tilted(p, WORK_TILT, N), p.stackSpin + 2.4 * ease(k), out.plateQ)
    out.held = true
    grip(out.plate, out.plateQ, p, 0, out.left)
    N.copy(UP).applyQuaternion(out.plateQ)
    // (two ways across its face: up it, and across it)
    U.copy(UP).addScaledVector(N, -N.y).normalize()
    L.crossVectors(N, U)
    const a = Math.PI * 2 * 2.5 * k, rr = p.r * 0.42
    // (coming in from where it waited, going round, and back out a little at the end)
    V.copy(out.plate).addScaledVector(N, p.r * 0.2).addScaledVector(U, Math.cos(a) * rr).addScaledVector(L, Math.sin(a) * rr)
    out.right.lerp(V, ease(span(k, 0, 0.12)) * (1 - ease(span(k, 0.9, 1))))
    out.smear = 1 - ease(span(k, 0.05, 0.85))
    out.foam = ease(span(k, 0, 0.5))
    out.wet = 0
  } else if (beat === 'rinse') {
    // (under the running tap, its face to the water and rocked as it comes clean, the suds going; with the tap shut, swished in the basin)
    rinsed(p, U, Q1)
    const e = ease(span(k, 0, 0.3))
    turned(tilted(p, WORK_TILT, N), p.stackSpin + 2.4, Q0)
    out.plate.copy(p.work).lerp(U, e)
    out.plateQ.copy(Q0).slerp(Q1, e)
    const rock = Math.sin(Math.PI * 2 * 1.5 * k) * (1 - ease(span(k, 0.85, 1)))
    if (p.spout) out.plateQ.multiply(SPIN.setFromAxisAngle(UP, rock * 0.35))
    else out.plate.addScaledVector(p.left, rock * p.r * 0.45).addScaledVector(UP, -p.r * 0.35 * Math.sin(Math.PI * k))
    out.held = true
    grip(out.plate, out.plateQ, p, 0, out.left)
    out.smear = 0
    out.foam = 1 - ease(span(k, 0.1, 0.8))
    out.wet = ease(span(k, 0.15, 0.35))
    if (p.spout) {
      // (where the stream falling straight down from the tap's mouth meets the plate's face, if it's on it)
      N.copy(UP).applyQuaternion(out.plateQ)
      if (Math.abs(N.y) > 0.05) {
        const y = out.plate.y - (N.x * (p.spout.x - out.plate.x) + N.z * (p.spout.z - out.plate.z)) / N.y
        STREAM_AT.set(p.spout.x, y, p.spout.z)
        if (y < p.spout.y && STREAM_AT.distanceTo(out.plate) < p.r * 0.95) out.stream = STREAM_AT
      }
    }
  } else {
    // (up out of the water and over to the basket's next slot, stood up on its edge with its face along the slots, let go of at the end;
    // drawn as shallow as the basket's are as it goes in)
    rinsed(p, U, Q0)
    const e = ease(k)
    out.plate.copy(U).lerp(p.slot, e).addScaledVector(UP, p.r * 0.9 * Math.sin(Math.PI * k))
    Q1.setFromUnitVectors(UP, p.along)
    out.plateQ.copy(Q0).slerp(Q1, e)
    out.deep = 1 - ease(span(k, 0.6, 1))
    out.held = true
    grip(out.plate, out.plateQ, p, ease(span(k, 0.2, 0.8)), out.left)
    out.smear = 0
    out.foam = 0
    out.wet = 1 - ease(span(k, 0, 0.6))
  }
  // (the sponge in the right hand, a little in front of the palm, its flat side to the plate while it scrubs)
  out.sponge.copy(out.right)
  if (beat === 'scrub' && out.held) {
    N.copy(UP).applyQuaternion(out.plateQ)
    out.sponge.addScaledVector(N, -p.r * 0.1)
    out.spongeQ.setFromUnitVectors(UP, N)
  } else out.spongeQ.identity()
}
