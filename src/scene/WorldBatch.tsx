import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { bakeable, keyOf } from './StaticBatch'
import { HOVER, anyLit } from './hoverGlow'
import { WORLD, giveBack, mergeAway, takeOut, type WorldSpan } from './worldMerge'

/** how often (ms) the room's meshes are looked over for what's kept still (the same place at two looks running) */
const LOOK_MS = 1200
/** made again once this share of what's merged has been taken out of it; or much new kept still, not oftener than every REMAKE_S */
const REMAKE_OUT = 0.25
const REMAKE_S = 30
/** off unless asked for (`?world=1` on the page's address) while what's left of it is worked through (item 367: the close views' triangles
 * (the merge isn't culled by piece), the heap, made again as the walls hide for the camera); `?world=0` off */
const OFF = typeof location === 'undefined' || new URLSearchParams(location.search).get('world') !== '1'

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
  if (m.userData.worldBatch || m.userData.noWorld || m.userData.worldHidden !== undefined) return false
  const g = m.geometry, mat = m.material as THREE.Material & { aoMap?: unknown; lightMap?: unknown }
  if (!g?.attributes.position || g.morphAttributes.position || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false
  if (mat.transparent || mat.userData.noWorld || mat.aoMap || mat.lightMap) return false
  if (m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || mat.onBeforeRender !== THREE.Material.prototype.onBeforeRender) return false
  // (a hand-written shader only the ink lines' kind: drawn from inside out, its look all in its uniforms)
  if ((mat as THREE.ShaderMaterial).isShaderMaterial && mat.side !== THREE.BackSide) return false
  return true
}
/** shown, it and all it's under, and in the room */
function inRoom(o: THREE.Object3D, scene: THREE.Object3D) {
  let q: THREE.Object3D | null = o.parent
  for (; q; q = q.parent) { if (!q.visible) return false; if (q === scene) return true }
  return false
}
const sameAt = (a: THREE.Matrix4, b: THREE.Matrix4) => { for (let i = 0; i < 16; i++) if (Math.abs(a.elements[i] - b.elements[i]) > 1e-6) return false; return true }

/** what's watched of a merged mesh: where it was, its material and look as merged, its shape's version */
type Watch = { m: THREE.Mesh; at: THREE.Matrix4; mat: THREE.Material; colour: number; glow: number; geo: THREE.BufferGeometry; ver: number }
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
  const built = useRef<{ meshes: THREE.Mesh[]; watch: Watch[] } | null>(null)
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
  const build = (list: THREE.Mesh[]) => {
    WORLD.dirty = false
    WORLD.builds++
    WORLD.out = 0
    const groups = new Map<string, { mat: THREE.Material; list: THREE.Mesh[]; cast: boolean; take: boolean; order: number; colours: boolean }>()
    for (const m of list) {
      if ((strikes.current.get(m) ?? 0) >= 2 || !mergeable(m) || !m.visible || !inRoom(m, scene)) continue
      const mat = m.material as THREE.Material
      const key = `${keyOf(mat)}|${lookOf(mat)}|${m.renderOrder}|${m.castShadow}|${m.receiveShadow}`
      const g = groups.get(key) ?? { mat, list: [], cast: m.castShadow, take: m.receiveShadow, order: m.renderOrder, colours: !!(mat as THREE.MeshToonMaterial).vertexColors }
      g.list.push(m)
      groups.set(key, g)
    }
    const made: THREE.Mesh[] = []
    const watch: Watch[] = []
    for (const g of groups.values()) {
      if (g.list.length < 2) continue
      const geos = g.list.map((m) => {
        m.updateWorldMatrix(true, false)
        const x = bakeable(m.geometry, m.matrixWorld)
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
      const mesh = new THREE.Mesh(geo, g.mat)
      mesh.name = 'world-batch'
      mesh.castShadow = g.cast
      mesh.receiveShadow = g.take
      mesh.renderOrder = g.order
      mesh.raycast = () => {}
      mesh.matrixAutoUpdate = false
      mesh.userData.worldBatch = true
      scene.add(mesh)
      made.push(mesh)
      const arr = geo.attributes.position.array as Float32Array
      let from = 0
      g.list.forEach((m, i) => {
        const n = counts[i]
        const span: WorldSpan = { mesh, from, n, kept: arr.slice(from * 3, (from + n) * 3) }
        from += n
        const mat = m.material as THREE.Material
        watch.push({ m, at: m.matrixWorld.clone(), mat, colour: hexOf(mat, 'color'), glow: hexOf(mat, 'emissive'), geo: m.geometry, ver: (m.geometry.attributes.position as THREE.BufferAttribute).version })
        mergeAway(m, span)
      })
    }
    built.current = made.length ? { meshes: made, watch } : null
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
        if (!m.userData.worldHidden || m.userData.lifted) continue
        let gone = m.material !== w.mat || m.geometry !== w.geo || (m.geometry.attributes.position as THREE.BufferAttribute).version !== w.ver
          || !sameAt(m.matrixWorld, w.at)
        // (and, a few at a time, whether it's still in the room and shown, and its colour and glow as they were)
        if (!gone && (i + f) % 6 === 0) gone = !inRoom(m, scene) || hexOf(w.mat, 'color') !== w.colour || hexOf(w.mat, 'emissive') !== w.glow
        if (gone) { takeOut(m); strikes.current.set(m, (strikes.current.get(m) ?? 0) + 1) }
      }
      if (WORLD.out > b.watch.length * REMAKE_OUT) WORLD.dirty = true
    }
    // ---- the room looked over now and then: what's kept still since the last look
    const now = performance.now()
    if (now - lastLook.current < LOOK_MS) return
    lastLook.current = now
    const was = seen.current, next = new Map<THREE.Mesh, THREE.Matrix4>(), keep: THREE.Mesh[] = []
    scene.traverse((o) => {
      if (!mergeable(o) || !o.visible) return
      const at = was.get(o)
      if (at && sameAt(at, o.matrixWorld)) keep.push(o)
      next.set(o, at && sameAt(at, o.matrixWorld) ? at : o.matrixWorld.clone())
    })
    seen.current = next
    // (much come into the room and kept still since it was made (the room still loading as it was first made): made again, not oftener than
    // every REMAKE_S)
    const early = now - mountedAt.current < 90_000
    if (b && !WORLD.dirty && keep.length > Math.max(150, b.watch.length * 0.3) && now - madeAt.current > (early ? 4 : REMAKE_S) * 1000) WORLD.dirty = true
    // ---- to be made again (a quarter taken out, much new, the editor left): given back first, and made again once what's given back has kept
    // still through two looks (looked at while merged, it was hidden, and none of it counted as still)
    if (b && WORLD.dirty) { undo.current(); seen.current = new Map(); return }
    // ---- made once something's kept still and nothing's lit by the pointer just now
    // (the first time not before the room's mostly in: two hundred kept still, or twenty seconds on)
    if (!b && keep.length > 1 && (keep.length >= 200 || now - mountedAt.current > 20_000) && !anyLit()) { build(keep); madeAt.current = now }
  })
  return null
}
