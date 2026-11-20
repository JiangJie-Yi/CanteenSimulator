// What the pointer may pick in the edit mode (shops' Movable): what's drawn and solid. The owner, 2026-11-10: clicking the drinks behind a
// pendant lamp chose the lamp every time: its two glow sprites (1.4 m across, and by day, drawn at nothing, 3.6 m) and the 3.6 m pool of light
// on the bar under it took the ray before anything behind them.
import * as THREE from 'three'

/** a raycast that never hits: for what's only light, a glow or an outline, in the game as in the edit mode */
export const NO_RAY = () => {}

/**
 * Whether what a ray hit is something to pick: a mesh drawn solid. Not a sprite, a line or points (a glow, a label); not a mesh drawn only as
 * light, an outline or a trace: additive, an ink hull (back faces), depth only, clear to nothing, or see-through and not in the depth (a decal,
 * steam, the tap's water; a lamp faded out of the camera's way still is: OccluderFade's copies are marked `fadeCopy`); nor one marked
 * `ignoreRaycast`; nor hidden (an unseen hit box, a piece hidden by hand (H)), unless it's hidden only because a merged copy of it is drawn
 * instead, whose own rays don't count (`drawnElsewhere`: a StaticBatch's originals, a homeCopy's parts at home). An edit proxy (a piece's
 * unseen stand-in box, `proxy`) is always its piece.
 */
export function solidHit(o: THREE.Object3D) {
  if (o.userData.proxy) return true
  const m = o as THREE.Mesh
  if (!m.isMesh || o.userData.ignoreRaycast || o.userData.editHandle) return false
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible && !q.userData.drawnElsewhere) return false
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  return mats.some((x) => x.visible && x.opacity > 0.02 && x.colorWrite && x.blending !== THREE.AdditiveBlending && x.side !== THREE.BackSide
    && !(x.transparent && !x.depthWrite && !x.userData.fadeCopy))
}

/**
 * Whether what a ray hit stands in the game's pointing as solid (item 418): solid (solidHit) and drawn opaque as it is now, not a hanging's
 * see-through copy as it's faded out of the camera's way (OccluderFade's `fadeCopy`), nor see-through
 */
export function opaqueHit(o: THREE.Object3D) {
  if (!solidHit(o) || o.userData.proxy) return false
  const m = o as THREE.Mesh
  const mats = Array.isArray(m.material) ? m.material : [m.material]
  return !mats.some((x) => x.userData?.fadeCopy || (x.transparent && x.opacity < 0.9))
}

/**
 * Whether anything from what a ray hit up to the group whose handler has the event now (not that group) has handlers of its own (r3f's), so
 * answers the pointer itself: a click there is a click on it, not on nothing (item 418: a click on a wall or a counter's bare face is one on
 * nothing, as it was when they took no rays, and folds the docked panels away; one on a door in the wall is the door's)
 */
export function answersBelow(e: { object: THREE.Object3D; eventObject: THREE.Object3D }) {
  for (let q: THREE.Object3D | null = e.object; q && q !== e.eventObject; q = q.parent) if ((q as { __r3f?: { eventCount?: number } }).__r3f?.eventCount) return true
  return false
}

/**
 * Whether what a ray hit stands in the edit mode's way though it's no piece: a counter, a wall (a group of it marked `editBlock`). A press or a
 * point that lands on it, solid, goes no further: what's behind it is hidden by it, not to be chosen through it (the owner, 2026-11-15: a press
 * on the bar top beside a pair of chopsticks, or a second press on the pair, chose the charcoal sack on the kitchen floor behind the bar). A
 * piece inside such a group is still its own piece.
 */
export function blocksEdit(o: THREE.Object3D) {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) {
    if (typeof q.userData.editId === 'string') return false
    if (q.userData.editBlock) return true
  }
  return false
}

/**
 * Whether a counter or a wall (blocksEdit), solid, lies on the ray in front of this hit (r3f's event: its own distance, and everything the ray
 * met, nearest first): what's hit is hidden by it. A piece behind one asks this itself, as its press or its pointing may reach it first (the
 * block's own handler stops the ray only where it's the first thing hit of its group).
 */
export function blockedBefore(e: { distance: number; intersections?: { object: THREE.Object3D; distance: number }[] }) {
  for (const h of e.intersections ?? []) {
    if (h.distance >= e.distance - 1e-6) return false
    if (solidHit(h.object) && blocksEdit(h.object)) return true
  }
  return false
}

/** the piece (a Movable, `userData.editId`) a hit object is part of: the nearest one up from it */
export function pieceOf(o: THREE.Object3D) {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (typeof q.userData.editId === 'string') return q.userData.editId as string
  return null
}
