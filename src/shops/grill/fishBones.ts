// A grilled fish's bones, as left after it's eaten (the owner's): on a customer's plate (GuestBar3D) and in the tasting bowl after the owner's
// had a whole fish (Roasting)
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A grilled fish's bones as they're left on the plate (the owner's): the spine, a comb of ribs either side of it, the tail fin; and the
 * head, browned. One geometry each (shared by every plate), lying along x, about 15 cm.
 */
export const BONES_GEO = (() => {
  const parts: THREE.BufferGeometry[] = []
  const spine = new THREE.CylinderGeometry(0.0028, 0.0022, 0.12, 5)
  spine.rotateZ(Math.PI / 2)
  parts.push(spine)
  for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) {
    const len = 0.03 - Math.abs(i - 2.5) * 0.003
    const rib = new THREE.CylinderGeometry(0.0011, 0.0007, len, 4)
    rib.translate(0, len / 2, 0)
    rib.rotateZ(sd * 0.5)
    rib.rotateX(sd * Math.PI / 2)
    rib.translate(-0.045 + i * 0.014, 0, 0)
    parts.push(rib)
  }
  const tail = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.028, 0.016), new THREE.Vector2(0.022, 0), new THREE.Vector2(0.028, -0.016)]))
  tail.rotateX(-Math.PI / 2)
  tail.translate(0.058, 0.001, 0)
  parts.push(tail)
  const g = mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p).map((p) => { p.deleteAttribute('uv'); return p }))
  for (const p of parts) p.dispose()
  return g
})()
export const HEAD_GEO = (() => {
  const g = new THREE.IcosahedronGeometry(0.016, 1)
  g.scale(1.3, 0.55, 0.8)
  g.translate(-0.074, 0.004, 0)
  return g
})()
/** their colours: the bones bleached, the head browned */
export const BONE_MAT = new THREE.MeshToonMaterial({ color: '#efe6cf' })
export const BONE_HEAD_MAT = new THREE.MeshToonMaterial({ color: '#8a5a30' })
