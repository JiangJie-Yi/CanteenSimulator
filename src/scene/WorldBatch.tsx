import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bakeable, keyOf } from './StaticBatch'
import { HOVER, anyLit } from './hoverGlow'
import { WORLD, giveBack, mergeAway, mergeState, takeOut, type WorldSpan } from './worldMerge'

/** how often (ms) the room's meshes are looked over for what's kept still (the same place at two looks running) */
const LOOK_MS = 1200
/** what's come in and kept still since it was made, ADD_MIN or more of it, merged on its own and added to it, ADD_MS apart (never made again
 * whole by itself: what's taken out is drawn by itself, as before the merge; made again whole only as the editor's shut) */
const ADD_MIN = 24
const ADD_MS = 3000
/** off unless asked for (`?world=1` on the page's address) while what's left of it is worked through (item 367: the close views' triangles
 * (the merge isn't culled by piece), the heap, made again as the walls hide for the camera); `?world=0` off */
const OFF = typeof location === 'undefined' || new URLSearchParams(location.search).get('world') !== '1'
/** the room's merge split by stretches of the room this many units across (x and z), a look's mesh a stretch (`?wcell=<units>`, item 374:
 * tried against a look's one mesh for all the room); 0: not split */
const CELL = typeof location === 'undefined' ? 0 : Number(new URLSearchParams(location.search).get('wcell')) || 0
const CENTRE = new THREE.Vector3()

/** what of a material's look keyOf doesn't say, that two merged must share */
function lookOf(m: THREE.Material) {
  const x = m as THREE.MeshToonMaterial & { alphaHash?: boolean }
  let k = `${m.depthTest}|${m.polygonOffset}|${m.polygonOffsetFactor}|${m.polygonOffsetUnits}|${m.alphaTest}|${x.alphaHash ?? ''}`
  if (x.emissive) k += `|${x.emissive.getHexString()}:${x.emissiveIntensity}`
  // (a reworked shader's own variant; one with its own uniforms (the ink lines'), their values)
  k += `|${m.customProgramCacheKey()}`
  const sh = m as THREE.ShaderMaterial
  if (sh.isShaderMaterial) {
    k += `|${sh.vertexShader.length}:${sh.fragmentShader.length}`
    for (const [n, u] of Object.entries(sh.uniforms ?? {})) {
      const v = u.value as unknown
      k += `|${n}=${typeof v === 'number' ? v.toFixed(5) : v instanceof THREE.Color ? v.getHexString() : (v as { toArray?: () => number[] })?.toArray ? (v as { toArray: () => number[] }).toArray().join(',') : (v as { uuid?: string })?.uuid ?? String(v)}`
    }
  }
  return k
}
/** a mesh the room's merge can take: one material, opaque, drawn whole, nothing of its own done as it's drawn */
function mergeable(o: THREE.Object3D): o is THREE.Mesh {
  const m = o as THREE.Mesh
  if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return false
  if (m.userData.worldBatch || m.userData.noWorld || mergeState(m)) return false
  const g = m.geometry, mat = m.material as THREE.Material & { aoMap?: unknown; lightMap?: unknown }
  if (!g?.attributes.position || g.morphAttributes.position || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false
  if (mat.transparent || mat.userData.noWorld || mat.aoMap || mat.lightMap || mat.visible === false) return false
  // (only what the eye's camera draws: on layer 0 (with the mirror's or not); a view's camera marker is on layer 5 but in the editor)
  if (!m.layers.isEnabled(0)) return false
  if (m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || mat.onBeforeRender !== THREE.Material.prototype.onBeforeRender) return false
  // (a hand-written shader only the ink lines' kind: drawn from inside out, its look all in its uniforms)
  if ((mat as THREE.ShaderMaterial).isShaderMaterial && mat.side !== THREE.BackSide) return false
  // (nor what fades as it comes between the camera and what's looked at (scene/OccluderFade: a lamp, the noren): its material's swapped for a
  // see-through copy then, and it was taken out of the merge each time, twice and left out; now never put in)
  for (let q = m.parent; q; q = q.parent) if (q.userData.fadeOccluder) return false
  return true
}
/** the group it's merged within: the nearest above it that's hidden as a whole now and then (userData.hideRoot: a wall hidden while the
 * camera's round behind it), its merge put under it and hidden with it; else the room */
function rootOf(o: THREE.Object3D, scene: THREE.Object3D) {
  for (let q = o.parent; q && q !== scene; q = q.parent) if (q.userData.hideRoot) return q
  return scene
}
/** shown, it and all it's under up to its root (the root's own hiding hides its merge with it), and in the room */
function inRoom(o: THREE.Object3D, scene: THREE.Object3D) {
  let q: THREE.Object3D | null = o.parent
  for (; q; q = q.parent) {
    if (q === scene) return true
    if (q.userData.hideRoot) { for (let r = q.parent; r; r = r.parent) if (r === scene) return true; return false }
    if (!q.visible) return false
  }
  return false
}
const sameAt = (a: THREE.Matrix4, b: THREE.Matrix4) => { for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > 1e-6) return false; return true }

/** an ink line's hull (scene/inkHull's: a shader drawn from inside out, each vertex pushed out along its normal by its width (uWidth) in the
 * piece's own units, before the piece's matrix) */
const isHull = (m: THREE.Material) => (m as THREE.ShaderMaterial).isShaderMaterial && m.side === THREE.BackSide && !!(m as THREE.ShaderMaterial).uniforms?.uWidth
/** how far a mesh's material pushes it out (a hull's width; 0 for anything else) */
const pushOf = (m: THREE.Material) => (isHull(m) ? ((m as THREE.ShaderMaterial).uniforms.uWidth.value as number) : 0)
/** a hull's shape pushed out as its shader pushes it (`w` along each vertex's normal, in its own units), to be merged so: its line in the
 * room's frame then exactly as wide as round the piece itself, however the piece is scaled */
function pushedOut(g: THREE.BufferGeometry, w: number) {
  const x = new THREE.BufferGeometry()
  for (const [k, a] of Object.entries(g.attributes)) x.setAttribute(k, a)
  if (g.index) x.setIndex(g.index)
  const pos = (g.attributes.position as THREE.BufferAttribute).clone(), nrm = g.attributes.normal as THREE.BufferAttribute | undefined
  if (nrm) for (let i = 0; i < pos.count; i++) {
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i), l = Math.hypot(nx, ny, nz) || 1
    pos.setXYZ(i, pos.getX(i) + (nx / l) * w, pos.getY(i) + (ny / l) * w, pos.getZ(i) + (nz / l) * w)
  }
  x.setAttribute('position', pos)
  return x
}
/** a hull's material with no width of its own (its shape's pushed out already, pushedOut): a copy of it (the same shader, so the same
 * program; its colour the same uniform), made once for each */
const FLAT_INK = new Map<THREE.Material, THREE.Material>()
function flatInk(mat: THREE.Material) {
  let c = FLAT_INK.get(mat)
  if (!c) {
    const sh = mat as THREE.ShaderMaterial
    const x = sh.clone()
    x.uniforms.uWidth = { value: 0 }
    if (sh.uniforms.uColor) x.uniforms.uColor = sh.uniforms.uColor
    FLAT_INK.set(mat, (c = x))
  }
  return c
}

/** what's watched of a merged mesh: where it was, its material and look as merged, its shape's version */
type Watch = { m: THREE.Mesh; at: THREE.Matrix4; mat: THREE.Material; colour: number; glow: number; geo: THREE.BufferGeometry; ver: number; layers: number }
const hexOf = (m: THREE.Material, k: 'color' | 'emissive') => ((m as THREE.MeshToonMaterial)[k] as THREE.Color | undefined)?.getHex() ?? -1

/**
 * The room's meshes merged across it (item 367; scene/worldMerge): every LOOK_MS the room's meshes are looked over, and those in the same
 * place as at the last look (kept still), opaque and drawn whole, are merged, a mesh for each look they share (StaticBatch's keyOf, and what
 * keyOf doesn't say: the glow, the depth test, the polygon offset, the shader's uniforms, the shadows cast and taken, the draw order); theirs
 * hidden (worldMerge's mergeAway). Watched every frame after: one that moves, goes from the room, is hidden (by itself or what it's under), is
 * given another material or its colour or glow changes, or has its shape changed, is taken out of it on the spot (worldMerge's takeOut,
 * twice so and it's left out after); a quarter taken out, or the editor left, and it's made again. The editor on, it's all given back.
 * Nothing new to draw with (their own materials), nothing to point at (the originals are what the pointer finds), the same shadows.
 */
export function WorldBatch() {
  const scene = useThree((s) => s.scene)
  /** what's merged: its meshes (`base` of them as it was made, the rest added since) and what's watched */
  const built = useRef<{ meshes: THREE.Mesh[]; watch: Watch[]; base: number } | null>(null)
  const seen = useRef(new Map<THREE.Mesh, THREE.Matrix4>())
  const lastLook = useRef(0)
  const madeAt = useRef(0)
  const mountedAt = useRef(performance.now())
  const strikes = useRef(new WeakMap<THREE.Mesh, number>())
  const frame = useRef(0)
  const undo = useRef(() => {})
  undo.current = () => {
    const b = built.current
    if (!b) return
    built.current = null
    for (const m of b.meshes) { m.removeFromParent(); m.geometry.dispose() }
    for (const w of b.watch) giveBack(w.m)
    WORLD.dirty = true
    WORLD.changedAt = performance.now()
  }
  useEffect(() => () => undo.current(), [])
  /** `list` merged, a mesh for each look they share; `more`: added to what's merged (what's come in and kept still since), not made anew */
  const build = (list: THREE.Mesh[], more = false) => {
    if (more) WORLD.adds++
    else {
      WORLD.dirty = false
      WORLD.builds++
      WORLD.out = 0
    }
    const groups = new Map<string, { mat: THREE.Material; list: THREE.Mesh[]; cast: boolean; take: boolean; order: number; colours: boolean; root: THREE.Object3D; layers: number }>()
    for (const m of list) {
      if ((strikes.current.get(m) ?? 0) >= 2 || !mergeable(m) || !m.visible || !inRoom(m, scene)) continue
      const mat = m.material as THREE.Material
      const root = rootOf(m, scene)
      // (and, the room's own (not a wall's), by the stretch of the room it's in (CELL across, x and z), so a close view leaves the rest out)
      let cell = ''
      if (CELL && root === scene) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
        const c = CENTRE.copy(m.geometry.boundingSphere!.center).applyMatrix4(m.matrixWorld)
        cell = `${Math.floor(c.x / CELL)},${Math.floor(c.z / CELL)}`
      }
      const key = `${keyOf(mat)}|${lookOf(mat)}|${m.renderOrder}|${m.castShadow}|${m.receiveShadow}|${root.uuid}|${cell}|L${m.layers.mask}`
      const g = groups.get(key) ?? { mat, list: [], cast: m.castShadow, take: m.receiveShadow, order: m.renderOrder, colours: !!(mat as THREE.MeshToonMaterial).vertexColors, root, layers: m.layers.mask }
      g.list.push(m)
      groups.set(key, g)
    }
    // (merged away only with every mesh under it merged too (or merged already): the renderer draws nothing under what it's hidden, and a
    // hull left out (alone in its look) went with its piece, its line gone; a look left with one, not merged at all, and so on round)
    const going = new Set<THREE.Mesh>()
    for (let pass = 0; pass < 4; pass++) {
      going.clear()
      for (const g of groups.values()) if (g.list.length >= 2) for (const m of g.list) going.add(m)
      let held = 0
      for (const g of groups.values()) {
        if (g.list.length < 2) continue
        const keep = g.list.filter((m) => {
          let ok = true
          m.traverse((d) => { if (ok && d !== m && (d as THREE.Mesh).isMesh && !going.has(d as THREE.Mesh) && !mergeState(d)?.hidden) ok = false })
          return ok
        })
        held += g.list.length - keep.length
        g.list = keep
      }
      if (!held) break
    }
    const made: THREE.Mesh[] = []
    const watch: Watch[] = []
    for (const g of groups.values()) {
      if (g.list.length < 2) continue
      // (in its root's frame: under the wall it's on, it goes where the wall goes)
      g.root.updateWorldMatrix(true, false)
      const toRoot = g.root === scene ? null : new THREE.Matrix4().copy(g.root.matrixWorld).invert()
      // (an ink hull pushed out as its shader would, in its own units, and drawn with no width of its own)
      const push = pushOf(g.mat)
      const geos = g.list.map((m) => {
        m.updateWorldMatrix(true, false)
        const own = push ? pushedOut(m.geometry, push) : m.geometry
        const x = bakeable(own, toRoot ? new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld) : m.matrixWorld)
        // (colours on the points only where the material reads them (white where it does and they've none): mismatched, they won't merge)
        if (!g.colours && x.attributes.color) x.deleteAttribute('color')
        if (g.colours && !x.attributes.color) x.setAttribute('color', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 3).fill(1), 3))
        return x
      })
      const counts = geos.map((x) => x.attributes.position.count)
      const geo = mergeGeometries(geos)
      for (const x of geos) x.dispose()
      if (!geo) continue
      // (its normals, UVs and colours let go of once they're on the graphics card: only its positions are written again (a part drawn in))
      for (const k of ['normal', 'uv', 'color']) (geo.attributes[k] as THREE.BufferAttribute | undefined)?.onUpload(function (this: THREE.BufferAttribute) { (this as unknown as { array: unknown }).array = null })
      const mesh = new THREE.Mesh(geo, push ? flatInk(g.mat) : g.mat)
      mesh.name = 'world-batch'
      mesh.castShadow = g.cast
      mesh.receiveShadow = g.take
      mesh.renderOrder = g.order
      mesh.raycast = () => {}
      mesh.matrixAutoUpdate = false
      mesh.userData.worldBatch = true
      mesh.layers.mask = g.layers
      g.root.add(mesh)
      mesh.updateMatrixWorld(true)
      made.push(mesh)
      let from = 0
      g.list.forEach((m, i) => {
        const n = counts[i]
        const span: WorldSpan = { mesh, from, n, src: m, toRoot, push }
        from += n
        const mat = m.material as THREE.Material
        watch.push({ m, at: m.matrixWorld.clone(), mat, colour: hexOf(mat, 'color'), glow: hexOf(mat, 'emissive'), geo: m.geometry, ver: (m.geometry.attributes.position as THREE.BufferAttribute).version, layers: m.layers.mask })
        mergeAway(m, span)
      })
    }
    const b = built.current
    if (more && b) { b.meshes.push(...made); b.watch.push(...watch) }
    else built.current = made.length ? { meshes: made, watch, base: made.length } : null
  }
  useFrame(() => {
    if (OFF) return
    frame.current++
    // (the editor on: everything as it is, to be picked and moved)
    if (HOVER.paused) { if (built.current) undo.current(); return }
    const b = built.current
    if (b) {
      // ---- what's merged, watched: anything changed taken out on the spot
      const f = frame.current
      for (let i = 0; i < b.watch.length; i++) {
        const w = b.watch[i], m = w.m
        const st = mergeState(m)
        if (!st?.hidden || st.lifted) continue
        const gone = m.material !== w.mat ? 'material' : m.geometry !== w.geo || (m.geometry.attributes.position as THREE.BufferAttribute).version !== w.ver ? 'shape'
          : !sameAt(m.matrixWorld, w.at) ? 'moved' : m.layers.mask !== w.layers ? 'layers'
            // (and, a few at a time, whether it's still in the room and shown, and its colour and glow as they were)
            : (i + f) % 6 !== 0 ? '' : !inRoom(m, scene) || w.mat.visible === false ? 'hidden' : hexOf(w.mat, 'color') !== w.colour ? 'colour' : hexOf(w.mat, 'emissive') !== w.glow ? 'glow' : ''
        if (gone) { takeOut(m, gone); strikes.current.set(m, (strikes.current.get(m) ?? 0) + 1) }
      }
    }
    // ---- the room looked over now and then: what's kept still since the last look
    const now = performance.now()
    if (now - lastLook.current < LOOK_MS) return
    lastLook.current = now
    const was = seen.current, next = new Map<THREE.Mesh, THREE.Matrix4>(), keep: THREE.Mesh[] = []
    scene.traverseVisible((o) => {
      if (!mergeable(o)) return
      const at = was.get(o)
      if (at && sameAt(at, o.matrixWorld)) keep.push(o)
      next.set(o, at && sameAt(at, o.matrixWorld) ? at : o.matrixWorld.clone())
    })
    seen.current = next
    // (come into the room and kept still since it was made (the room still loading, a piece put down): merged on their own and added to it, what's
    // merged left as it is (made again whole each time, it was made thirteen times in its first two minutes as the room loaded, each a hitch:
    // every piece in the room baked again); made again whole only once what's added has come to half as many meshes as it was made with)
    if (b && !WORLD.dirty && keep.length >= ADD_MIN && now - madeAt.current > ADD_MS && !anyLit()) { build(keep, true); madeAt.current = now; return }
    // ---- to be made again (a quarter taken out, much new, the editor left): given back first, and made again once what's given back has kept
    // still through two looks (looked at while merged, it was hidden, and none of it counted as still)
    if (b && WORLD.dirty) { undo.current(); seen.current = new Map(); return }
    // ---- made once something's kept still and nothing's lit by the pointer just now
    // (the first time not before the room's mostly in: two hundred kept still, or twenty seconds on)
    if (!b && keep.length > 1 && (keep.length >= 200 || now - mountedAt.current > 20_000) && !anyLit()) { build(keep); madeAt.current = now }
  })
  return null
}
