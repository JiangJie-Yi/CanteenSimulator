import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStudio } from '@/scene/studio'
import { dressSake, STREAM_GEO, STREAM_MAT } from './Decor'
import { SakeCup } from './DiningRoom'
import { TOKKURI_H } from './Tokkuri'
import { SAKE } from './bar'

/**
 * The sake station at the pass (item 177, the owner's, 2026-11-15: "that sake stand: the way it goes looks odd, and not professional"): the open
 * 1.8-litre bottle kept on the serving counter's right-hand end, where whoever pours stands right at it, with a few clean cups by it. A
 * customer's tokkuri is set out on the counter there, poured into with both hands on the bottle, a cup put beside it, and it waits there for a
 * server to carry out on their tray. (The stand on the cook table stands between the hearth and the bar, out of everyone's reach: its bottles
 * lifted and poured by themselves while the third cook stood two metres off.) GuestBar3D poses the bottle and the hands; this draws the
 * bottle, the cups and the stream, inside the serving counter's own group, so it goes wherever the counter's moved.
 *
 * The station's frame is the counter's own (blender/servecounter.py): x along it, z out of its front, y up from its foot; its top at
 * SERVE_TOP. In the bar's units.
 */
export const SERVE_TOP = 0.496
// (each 0.04 further right since the counter's an old bamboo table 0.1 longer (items 254, 286): as far from its right-hand end as they were,
// all on its woven top inside the split culms round its edge)
export const STATION = {
  /** the open bottle's foot, at the back of the counter's right-hand end */
  bottle: new THREE.Vector3(0.4, SERVE_TOP, -0.075),
  /** where a customer's tokkuri is set out to be poured into, and waits for its server; its cup set down in front of it */
  jug: new THREE.Vector3(0.19, SERVE_TOP, -0.105),
  cup: new THREE.Vector3(0.275, SERVE_TOP, -0.055),
  /** the clean cups, nested three high, at the front corner */
  cups: new THREE.Vector3(0.435, SERVE_TOP, 0.105),
  /** where the one pouring stands, before it, facing in (-z) */
  front: new THREE.Vector3(0.34, 0, 0.47),
}
/** the way the bottle's tipped to pour (from its foot toward its mouth, level): back and to the left across the counter, toward the tokkuri,
 * so it's held across the one pouring, its foot by their right hand */
const POUR_DIR = new THREE.Vector3(-1, 0, -0.95).normalize()
const TIP_AXIS = new THREE.Vector3(POUR_DIR.z, 0, -POUR_DIR.x).normalize()
/** how far it's tipped as it comes over the tokkuri, and as it pours (rad from upright: a full bottle runs at about a right angle) */
const TIP_IN = 0.95
const TIP_POUR = 1.55
/** how far over the tokkuri's lip its mouth is held */
const MOUTH_OVER = 0.035
/** where it's held: one hand at its foot and the other at its neck (fractions of its height); how far out from its middle the hand at its
 * body is, and the one at its neck: on the side toward the one pouring as it stands, and as it's tipped over, under its body (holding it up)
 * and on top of its neck (steadying it), so the hands show from every side (behind it, from across the counter, they were hidden) */
const HOLD_FOOT = 0.12, HOLD_NECK = 0.72, HOLD_BODY = 0.052, HOLD_TOP = 0.03

/** the live station, for GuestBar3D to move: its group (the counter's frame), the bottle (its foot at its origin, `q0` its own turn, `h` how
 * tall it is), its sake, the stream */
export const STATION_OBJ = {
  group: null as THREE.Group | null,
  bottle: null as THREE.Object3D | null,
  liquid: null as THREE.Object3D | null,
  stream: null as THREE.Mesh | null,
  q0: new THREE.Quaternion(),
  h: 0.395,
}

const UP = new THREE.Vector3(0, 1, 0)
const TQ = new THREE.Quaternion()
const ease = (x: number) => x * x * (3 - 2 * x)
/** the bottle posed, tipped `tip` from upright with its mouth at `mouth`, or standing at its foot `foot`; and where its foot and mouth are */
function bottleAt(tip: number, mouth: THREE.Vector3 | null, foot: THREE.Vector3, out: { foot: THREE.Vector3; q: THREE.Quaternion; mouth: THREE.Vector3 }) {
  const h = STATION_OBJ.h
  out.q.copy(TQ.setFromAxisAngle(TIP_AXIS, tip)).multiply(STATION_OBJ.q0)
  const axis = UP.clone().applyAxisAngle(TIP_AXIS, tip)
  if (mouth) { out.mouth.copy(mouth); out.foot.copy(mouth).addScaledVector(axis, -h) }
  else { out.foot.copy(foot); out.mouth.copy(foot).addScaledVector(axis, h) }
  return axis
}
/** the tokkuri's lip, where the bottle's mouth is held over it */
const mouthOver = () => STATION.jug.clone().add(new THREE.Vector3(0, TOKKURI_H + MOUTH_OVER, 0))

export type StationPose = {
  /** the bottle's foot and turn, and its mouth (the station's frame) */
  foot: THREE.Vector3; q: THREE.Quaternion; mouth: THREE.Vector3
  /** where each hand is wanted (the station's frame), or null for a hand that's free */
  left: THREE.Vector3 | null; right: THREE.Vector3 | null
  /** the tokkuri and the cup: where they are (null, not out yet) */
  jug: THREE.Vector3 | null; cup: THREE.Vector3 | null
}
export const newStationPose = (): StationPose => ({ foot: new THREE.Vector3(), q: new THREE.Quaternion(), mouth: new THREE.Vector3(), left: new THREE.Vector3(),
  right: new THREE.Vector3(), jug: new THREE.Vector3(), cup: new THREE.Vector3() })
/** where the hands hold the bottle as it's posed: at its foot and at its neck; standing, on its side toward the one pouring; tipped over, the
 * one under its body and the other on top of its neck */
const DOWN = new THREE.Vector3()
function holds(p: StationPose, axis: THREE.Vector3) {
  const toward = STATION.front.clone().sub(p.foot).setY(0).normalize()
  // (straight down, less what of it runs along the bottle: how far it's tipped over, and which way is its underside)
  DOWN.set(0, -1, 0).addScaledVector(axis, axis.y)
  const over = DOWN.length()
  if (over > 1e-3) DOWN.divideScalar(over)
  p.right!.copy(p.foot).addScaledVector(axis, STATION_OBJ.h * HOLD_FOOT).addScaledVector(toward, HOLD_BODY * (1 - over)).addScaledVector(DOWN, HOLD_BODY * over)
  p.left!.copy(p.foot).addScaledVector(axis, STATION_OBJ.h * HOLD_NECK).addScaledVector(toward, HOLD_TOP * (1 - over)).addScaledVector(DOWN, -HOLD_TOP * over)
}
/**
 * The station at a beat of the pour (game/sakePour's): `beat` and how far through it `k`. jug: a tokkuri brought up from the shelf under the
 * counter's front and set on it, the right hand on the bottle already; grip: the left to its neck; lift: taken up and brought over the
 * tokkuri, tipping; pour: tipped right over, its mouth held over the lip; back: upright again and set down in its place; cup: the right hand
 * to the clean cups, one set down in front of the tokkuri, the left steadying it.
 */
export function stationPose(beat: string, k: number, p: StationPose) {
  const rest = STATION.bottle
  let axis = bottleAt(0, null, rest, p)
  p.jug = p.jug ?? new THREE.Vector3()
  p.jug.copy(STATION.jug)
  p.cup = null
  p.left = p.left ?? new THREE.Vector3()
  p.right = p.right ?? new THREE.Vector3()
  if (beat === 'jug') {
    // (up from the shelf under the front edge, over the edge and onto the counter, in the left hand; the right on the bottle meanwhile)
    const e = ease(k)
    const from = new THREE.Vector3(STATION.jug.x - 0.02, SERVE_TOP - 0.1, 0.22)
    p.jug.lerpVectors(from, STATION.jug, e)
    p.jug.y += Math.sin(Math.PI * Math.min(1, k * 1.2)) * 0.07
    holds(p, axis)
    p.left.copy(p.jug).add(new THREE.Vector3(0, TOKKURI_H * 0.5, 0.03))
    if (k > 0.85) p.left.lerp(p.right.clone().addScaledVector(axis, STATION_OBJ.h * (HOLD_NECK - HOLD_FOOT)), (k - 0.85) / 0.15 * 0.3)
  } else if (beat === 'grip') {
    holds(p, axis)
    const neck = p.left.clone()
    p.left.copy(STATION.jug).add(new THREE.Vector3(0, TOKKURI_H * 0.5, 0.03)).lerp(neck, ease(k))
  } else if (beat === 'lift' || beat === 'pour' || beat === 'back') {
    // (lifted a little and over: from standing in its place to its mouth over the lip, tipping as it comes; held there as it pours, tipped
    // on over as it runs; and back the same way)
    const over = mouthOver()
    if (beat === 'lift' || beat === 'back') {
      const e = ease(beat === 'lift' ? k : 1 - k)
      const start = newStationPose()
      bottleAt(TIP_IN, over, rest, start)
      const tip = TIP_IN * e
      p.q.copy(TQ.setFromAxisAngle(TIP_AXIS, tip)).multiply(STATION_OBJ.q0)
      axis = UP.clone().applyAxisAngle(TIP_AXIS, tip)
      p.foot.lerpVectors(rest, start.foot, e)
      p.foot.y += Math.sin(Math.PI * e) * 0.05
      p.mouth.copy(p.foot).addScaledVector(axis, STATION_OBJ.h)
    } else {
      const tip = TIP_IN + (TIP_POUR - TIP_IN) * ease(Math.min(1, k / 0.3)) - (TIP_POUR - TIP_IN) * 0.6 * ease(Math.max(0, (k - 0.85) / 0.15))
      axis = bottleAt(tip, over, rest, p)
    }
    holds(p, axis)
  } else if (beat === 'cup') {
    // (the right hand from the bottle's foot to the clean cups, one taken and set down in front of the tokkuri; the left on the tokkuri)
    const e = ease(k)
    const fromCups = STATION.cups.clone().add(new THREE.Vector3(0, 0.03, 0))
    p.cup = k < 0.3 ? null : fromCups.clone().lerp(STATION.cup, ease((k - 0.3) / 0.7))
    if (p.cup) p.cup.y += Math.sin(Math.PI * ease((k - 0.3) / 0.7)) * 0.05
    holds(p, axis)
    const foot = p.right.clone()
    p.right.copy(k < 0.3 ? foot.lerp(fromCups, ease(k / 0.3)) : p.cup!.clone().add(new THREE.Vector3(0, 0.03, 0.02)))
    p.left.copy(STATION.jug).add(new THREE.Vector3(0, TOKKURI_H * 0.55, 0.035))
    void e
  }
  return p
}
/** whether the stream runs from the bottle's mouth down into the tokkuri, at this beat */
export const STATION_STREAM_TO = () => STATION.jug.clone().add(new THREE.Vector3(0, TOKKURI_H - 0.02, 0))

const SAKESTAND_URL = import.meta.env.BASE_URL + 'models/sakestand.glb'
/** the open bottle: one of the stand's 1.8-litre bottles (the same make, its label to the front), dressed as the stand's are */
const OPEN_BOTTLE = 'SakeBottle1'
export function SakeStation() {
  useStudio()
  const gltf = useGLTF(SAKESTAND_URL) as unknown as { scene: THREE.Group }
  const bottle = useMemo(() => {
    const src = gltf.scene.getObjectByName(OPEN_BOTTLE)
    if (!src) return null
    const r = src.clone(true)
    r.position.set(0, 0, 0)
    dressSake(r, new Map())
    const q0 = r.quaternion.clone()
    r.quaternion.identity()
    r.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(r)
    STATION_OBJ.h = box.max.y - box.min.y
    STATION_OBJ.q0.copy(q0)
    r.quaternion.copy(q0)
    r.position.copy(STATION.bottle)
    r.name = 'sake-station-bottle'
    r.traverse((o) => { if (/^SakeLiquid/.test(o.name)) o.scale.y = Math.max(0.02, SAKE.open) })
    return r
  }, [gltf])
  return (
    <group name="sake-station" ref={(g) => { STATION_OBJ.group = g }}>
      {bottle && <primitive object={bottle} ref={(o: THREE.Object3D | null) => {
        STATION_OBJ.bottle = o
        let liq: THREE.Object3D | null = null
        o?.traverse((q) => { if (!liq && /^SakeLiquid/.test(q.name)) liq = q })
        STATION_OBJ.liquid = liq
      }} />}
      {/* (the clean cups, nested three high) */}
      <group position={STATION.cups} name="sake-station-cups">
        {[0, 1, 2].map((i) => <group key={i} position-y={i * 0.011}><SakeCup level={0} /></group>)}
      </group>
      <mesh geometry={STREAM_GEO} material={STREAM_MAT} scale={[1, 0.0001, 1]} ref={(m) => { STATION_OBJ.stream = m }} raycast={() => {}} />
      {/* (where the one pouring stands) */}
      <group name="sake-station-front" position={STATION.front} />
    </group>
  )
}
