import * as THREE from 'three'

/**
 * The room's meshes merged across it (item 367, the owner's perf brief: draw calls; scene/WorldBatch makes it): every piece of the room is
 * drawn by its own meshes, one a material, and the room's pieces share most of their materials in look (the plain colours' one toon
 * material, the ink lines', the white picture every untextured material is given): the room drew 1,072 opaque meshes in 382 looks. What's
 * kept still is merged across the room, a mesh a look; anything in it that then moves, hides, changes its look or goes is taken out of it on
 * the spot (its stretch of the merged mesh drawn in to a point, the mesh itself drawn again), never the whole put back for it.
 */
export const WORLD = {
  /** how many times it's been made (a dev's count: once or twice a session), and taken out of since; how many times what's come in and kept
   * still since has been merged on its own and added to it (item 374) */
  builds: 0,
  out: 0,
  adds: 0,
  /** (dev) the last pieces taken out and why: what a piece's own code does to it that the merge can't keep (item 374) */
  outs: [] as string[],
  /** made again soon (the editor left, many taken out) */
  dirty: true,
  changedAt: 0,
}
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __world: WORLD })

/** each merged-away mesh's place in the room's merge: the merged mesh, its first vertex there, how many; and its own mesh and the frame it
 * was merged in (its root's: null, the room's own; a wall's), its positions written again from them as it's put back (none kept aside: a copy
 * of every merged piece's positions was the most of the heap the merge took, item 374) */
export type WorldSpan = { mesh: THREE.Mesh; from: number; n: number; src: THREE.Mesh; toRoot: THREE.Matrix4 | null
  /** an ink hull's: how far it was pushed out along its normals as it was merged (WorldBatch's pushedOut), 0 for anything else */
  push: number }

const M = new THREE.Matrix4()
const V = new THREE.Vector3()
const N = new THREE.Vector3()
/** its stretch's positions as they were merged (StaticBatch's bakeable: its triangles one by one in their order, a mirrored one wound back),
 * from its own mesh where it is (it hasn't moved: moved, it's taken out) */
function bakeInto(s: WorldSpan, arr: Float32Array) {
  const g = s.src.geometry, pos = g.attributes.position as THREE.BufferAttribute, idx = g.index
  const nrm = s.push ? (g.attributes.normal as THREE.BufferAttribute | undefined) : undefined
  M.copy(s.src.matrixWorld)
  if (s.toRoot) M.premultiply(s.toRoot)
  const flip = M.determinant() < 0
  for (let k = 0; k < s.n; k++) {
    const j = k % 3
    const at = flip && j ? k + (j === 1 ? 1 : -1) : k
    const i = idx ? idx.getX(at) : at
    V.fromBufferAttribute(pos, i)
    // (an ink hull's pushed out along its normal as it was merged)
    if (nrm) { N.fromBufferAttribute(nrm, i); const l = N.length() || 1; V.addScaledVector(N, s.push / l) }
    V.applyMatrix4(M)
    const o = (s.from + k) * 3
    arr[o] = V.x
    arr[o + 1] = V.y
    arr[o + 2] = V.z
  }
}
/** its stretch of the room's mesh drawn in to one point, its first (covering nothing, casting nothing), or put back */
function collapse(s: WorldSpan, on: boolean) {
  const pos = s.mesh.geometry.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  if (on) {
    const o = s.from * 3, x = arr[o], y = arr[o + 1], z = arr[o + 2]
    for (let i = o; i < (s.from + s.n) * 3; i += 3) { arr[i] = x; arr[i + 1] = y; arr[i + 2] = z }
  } else bakeInto(s, arr)
  pos.addUpdateRange(s.from * 3, s.n * 3)
  pos.needsUpdate = true
}

/** a merged-away mesh's part in the merge (beside it, not in its userData, which a clone copies as JSON): its span; whether it's drawn by
 * the merge just now (`hidden`: its own drawing hidden), or by itself a moment for the pointer's glow (`lifted`); the `visible` its code set */
export type MergeState = { span: WorldSpan; hidden: boolean; lifted: boolean; want: boolean }
const STATE = new WeakMap<THREE.Object3D, MergeState>()
/** its part in the merge, if it's been taken into it (merged away, or taken out since): none once it's given back */
export const mergeState = (m: THREE.Object3D) => STATE.get(m)
/** whether it's drawn by the room's merge just now */
export const mergedAway = (m: THREE.Object3D) => !!STATE.get(m)?.hidden
/** a merged-away mesh being cloned just now (its `visible` read for the copy as its code set it) */
let cloning = 0

/**
 * Taken into the room's merge: hidden, its `visible` its code's to set still (as it reads it back, what it set; set false, it's taken out of
 * the merge for good and hidden as asked: the merge mustn't go on drawing what its code has hidden); cloned, the copy as its code sees it
 */
export function mergeAway(m: THREE.Mesh, span: WorldSpan) {
  const st: MergeState = { span, hidden: true, lifted: false, want: true }
  STATE.set(m, st)
  Object.defineProperty(m, 'visible', {
    configurable: true,
    get: () => (st.hidden && !st.lifted && !cloning ? false : st.want),
    set: (v: boolean) => {
      st.want = v
      if (!v && st.hidden) takeOut(m)
    },
  })
  // (its copy (Object3D.copy reads `visible` off it) shown as its code set it, not hidden as the merge has it)
  const own = m.clone
  m.clone = function (this: THREE.Mesh, recursive?: boolean) {
    cloning++
    try { return own.call(this, recursive) } finally { cloning-- }
  } as typeof m.clone
}
/** taken out of the room's merge for good: its stretch drawn in, it drawn by itself (as its code wants it); `why` for the dev's list */
export function takeOut(m: THREE.Mesh, why = 'hidden') {
  const st = STATE.get(m)
  if (!st || !st.hidden) return
  const s = st.span
  if (import.meta.env?.DEV) {
    // (named by the nearest piece it's part of (its edit id) and the first hidden group above it)
    let piece = '', hid = ''
    for (let q: THREE.Object3D | null = m; q; q = q.parent) {
      if (!piece && q.userData.editId) piece = String(q.userData.editId)
      if (!hid && q !== m && !q.visible) hid = q.name || q.type
    }
    WORLD.outs.push(`${why}: ${piece || '?'} (${m.name || '?'}) under ${hid || '-'}`)
    if (WORLD.outs.length > 200) WORLD.outs.shift()
  }
  if (!st.lifted) collapse(s, true)
  st.hidden = false
  st.lifted = false
  WORLD.out++
}
/** given back its own `visible` and `clone` (the room's merge undone): as its code last set it */
export function giveBack(m: THREE.Mesh) {
  const st = STATE.get(m)
  if (!st) return
  delete (m as { visible?: boolean }).visible
  delete (m as { clone?: unknown }).clone
  m.visible = st.want
  STATE.delete(m)
}

/**
 * One of the room's merged-away meshes drawn by itself a while (`on`) or given back to the room's merge: for the pointer's glow
 * (scene/hoverGlow): what it lights is drawn in its glowing copy of its material, not the room's
 */
export function lift(m: THREE.Mesh, on: boolean) {
  const st = STATE.get(m)
  if (!st || !st.hidden || st.lifted === on) return
  st.lifted = on
  collapse(st.span, on)
}
