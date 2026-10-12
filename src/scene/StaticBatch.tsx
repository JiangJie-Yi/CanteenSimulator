import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/*
 * Things that never move, drawn as a handful of meshes instead of hundreds. Its children are built as usual (each a
 * mesh with its own little material, as is easiest to write), then, once they're there, every mesh among them is
 * baked into place and those that look alike (the same kind of material, colour, texture, side and blending) are
 * merged into one, and the originals are hidden. A beckoning cat of forty parts, inked, is two draws, not eighty.
 *
 * Only for what's static: the children are read once, when it mounts (a change to them later isn't picked up), and
 * nothing in it can move on its own or be pointed at.
 */

const ATTRS = ['position', 'normal', 'uv'] as const

/** what decides whether two meshes can be drawn as one */
function keyOf(m: THREE.Material) {
  const x = m as THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; toneMapped?: boolean }
  return [m.type, x.color?.getHexString(), x.map?.uuid, m.side, m.transparent, m.opacity, m.blending, m.depthWrite, x.toneMapped].join('|')
}

/** the geometry, its own copy, with just what every merged mesh has (and unindexed, so any can go with any) */
function bakeable(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  const src = g.index ? g.toNonIndexed() : g
  const out = new THREE.BufferGeometry()
  const n = src.attributes.position.count
  for (const a of ATTRS) {
    const at = src.attributes[a]
    out.setAttribute(a, at ? at.clone() : new THREE.BufferAttribute(new Float32Array(n * (a === 'uv' ? 2 : 3)), a === 'uv' ? 2 : 3))
  }
  out.applyMatrix4(m)
  // (a mirroring transform turns the faces inside out: wind them back)
  if (m.determinant() < 0) {
    for (const a of ATTRS) {
      const arr = out.attributes[a].array as Float32Array
      const w = out.attributes[a].itemSize
      for (let i = 0; i < n; i += 3) for (let k = 0; k < w; k++) [arr[(i + 1) * w + k], arr[(i + 2) * w + k]] = [arr[(i + 2) * w + k], arr[(i + 1) * w + k]]
    }
  }
  if (src !== g) src.dispose()
  return out
}

export function StaticBatch({ children }: { children: ReactNode }) {
  const holder = useRef<THREE.Group>(null)
  const merged = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const h = holder.current, o = merged.current
    if (!h || !o) return
    h.updateWorldMatrix(true, true)
    const inv = new THREE.Matrix4().copy(h.matrixWorld).invert()
    const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; order: number }>()
    h.traverse((m) => {
      if (!(m instanceof THREE.Mesh) || m instanceof THREE.SkinnedMesh || m instanceof THREE.InstancedMesh || Array.isArray(m.material)) return
      if (!m.visible) return
      const key = `${keyOf(m.material)}|${m.renderOrder}`
      const g = groups.get(key) ?? { mat: m.material as THREE.Material, geos: [] as THREE.BufferGeometry[], shadow: false, order: m.renderOrder }
      g.geos.push(bakeable(m.geometry, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)))
      g.shadow ||= m.castShadow
      groups.set(key, g)
    })
    const made: THREE.Mesh[] = []
    for (const { mat, geos, shadow, order } of groups.values()) {
      const geo = mergeGeometries(geos)
      for (const x of geos) x.dispose()
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = shadow
      mesh.receiveShadow = true
      mesh.raycast = () => {}
      mesh.renderOrder = order
      made.push(mesh)
      o.add(mesh)
    }
    h.visible = false
    return () => {
      for (const m of made) {
        m.removeFromParent()
        m.geometry.dispose()
      }
      h.visible = true
    }
  }, [])
  return (
    <>
      <group ref={holder}>{children}</group>
      <group ref={merged} />
    </>
  )
}
