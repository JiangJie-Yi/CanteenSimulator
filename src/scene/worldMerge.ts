import * as THREE from 'three'

/**
 * The room's meshes merged across it (item 367, the owner's perf brief: draw calls; scene/WorldBatch makes it): every piece of the room is
 * drawn by its own meshes, one a material, and the room's pieces share most of their materials in look (the plain colours' one toon
 * material, the ink lines', the white picture every untextured material is given): the room drew 1,072 opaque meshes in 382 looks. What's
 * kept still is merged across the room, a mesh a look; anything in it that then moves, hides, changes its look or goes is taken out of it on
 * the spot (its stretch of the merged mesh drawn in to a point, the mesh itself drawn again), never the whole put back for it.
 */
export const WORLD = {
  /** how many times it's been made (a dev's count: once or twice a session), and taken out of since */
  builds: 0,
  out: 0,
  /** made again soon (the editor left, many taken out) */
  dirty: true,
  changedAt: 0,
}
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __world: WORLD })

/** each merged-away mesh's place in the room's merge: the merged mesh, its first vertex there, how many, and the positions as made */
export type WorldSpan = { mesh: THREE.Mesh; from: number; n: number; kept: Float32Array }

/** its stretch of the room's mesh drawn in to one point (covering nothing, casting nothing), or put back */
function collapse(s: WorldSpan, on: boolean) {
  const pos = s.mesh.geometry.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  if (on) for (let i = s.from * 3; i < (s.from + s.n) * 3; i += 3) { arr[i] = s.kept[0]; arr[i + 1] = s.kept[1]; arr[i + 2] = s.kept[2] }
  else arr.set(s.kept, s.from * 3)
  pos.addUpdateRange(s.from * 3, s.n * 3)
  pos.needsUpdate = true
}

/** a merged-away mesh as its code sees it: `visible` what the code last set it to (true as it was merged); really drawn only once out */
type Merged = THREE.Mesh & { userData: { worldSpan?: WorldSpan; worldHidden?: boolean; lifted?: boolean; wantVisible?: boolean } }

/**
 * Taken into the room's merge: hidden, its `visible` its code's to set still (as it reads it back, what it set; set false, it's taken out of
 * the merge for good and hidden as asked: the merge mustn't go on drawing what its code has hidden)
 */
export function mergeAway(m: THREE.Mesh, span: WorldSpan) {
  const x = m as Merged
  x.userData.worldSpan = span
  x.userData.worldHidden = true
  x.userData.wantVisible = true
  Object.defineProperty(x, 'visible', {
    configurable: true,
    get: () => (x.userData.worldHidden && !x.userData.lifted ? false : x.userData.wantVisible !== false),
    set: (v: boolean) => {
      x.userData.wantVisible = v
      if (!v && x.userData.worldHidden) takeOut(x)
    },
  })
}
/** taken out of the room's merge for good: its stretch drawn in, it drawn by itself (as its code wants it) */
export function takeOut(m: THREE.Mesh) {
  const x = m as Merged
  const s = x.userData.worldSpan
  if (!s || !x.userData.worldHidden) return
  if (!x.userData.lifted) collapse(s, true)
  x.userData.worldHidden = false
  x.userData.lifted = false
  WORLD.out++
}
/** given back its own `visible` (the room's merge undone): as its code last set it */
export function giveBack(m: THREE.Mesh) {
  const x = m as Merged
  const want = x.userData.wantVisible !== false
  delete (x as { visible?: boolean }).visible
  x.visible = want
  delete x.userData.worldHidden
  delete x.userData.lifted
  delete x.userData.worldSpan
  delete x.userData.wantVisible
}

/**
 * One of the room's merged-away meshes drawn by itself a while (`on`) or given back to the room's merge: for the pointer's glow
 * (scene/hoverGlow): what it lights is drawn in its glowing copy of its material, not the room's
 */
export function lift(m: THREE.Mesh, on: boolean) {
  const x = m as Merged
  const s = x.userData.worldSpan
  if (!s || !x.userData.worldHidden || !!x.userData.lifted === on) return
  x.userData.lifted = on
  collapse(s, on)
}
