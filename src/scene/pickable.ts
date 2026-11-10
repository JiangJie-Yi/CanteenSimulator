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

/** the piece (a Movable, `userData.editId`) a hit object is part of: the nearest one up from it */
export function pieceOf(o: THREE.Object3D) {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) if (typeof q.userData.editId === 'string') return q.userData.editId as string
  return null
}
