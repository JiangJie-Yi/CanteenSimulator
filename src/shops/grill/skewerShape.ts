// An iron skewer's shape (金串, the owner's: a plain rod didn't read as one): a flat steel bar with a sharp point at one end and a loop of the
// bar at the other for a handle. Made in its own frame: along +y from its point (y 0) to its loop's top; the bar `w` wide (x, half of it) and
// `t` thick (z, half), its point `point` long, its loop `ring` across (to the tube's middle), the loop lying in the bar's flat (x, y). The
// cooks' rods (Roasting), the holders' (SkewerStore) and the one in hand while researching (Decor) are all of it, at their own sizes.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** the faces turned out if they were made in: `probe` a point on it, `out` the way out from there */
function outward(g: THREE.BufferGeometry, probe: number, out: THREE.Vector3) {
  g.computeVertexNormals()
  const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal as THREE.BufferAttribute, probe)
  if (n.dot(out) >= 0) return g
  const ix = g.index!.array as Uint16Array | Uint32Array
  for (let i = 0; i < ix.length; i += 3) { const k = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = k }
  g.computeVertexNormals()
  return g
}

export function ironSkewer(len: number, w: number, t: number, point: number, ring: number) {
  // (the bar: six round its flattened section, from its point up to where the loop begins)
  const SIDES = 6
  const pos: number[] = [], idx: number[] = []
  const section = (y: number, k: number) => {
    const base = pos.length / 3
    for (let j = 0; j < SIDES; j++) { const a = (j / SIDES) * Math.PI * 2; pos.push(Math.cos(a) * w * k, y, Math.sin(a) * t * k) }
    return base
  }
  const join = (a: number, b: number) => { for (let j = 0; j < SIDES; j++) { const j2 = (j + 1) % SIDES; idx.push(a + j, b + j, b + j2, a + j, b + j2, a + j2) } }
  pos.push(0, 0, 0)
  const s0 = section(point * 0.45, 0.5)
  for (let j = 0; j < SIDES; j++) idx.push(0, s0 + j, s0 + ((j + 1) % SIDES))
  const s1 = section(point, 1)
  join(s0, s1)
  const s2 = section(len, 1)
  join(s1, s2)
  const bar = new THREE.BufferGeometry()
  bar.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  bar.setIndex(idx)
  outward(bar, s1, new THREE.Vector3(1, 0, 0))
  // (the loop: a round tube of the bar's thickness, from the bar's end round and back to it)
  const SEG = 12, TUBE = 4
  const rp: number[] = [], ri: number[] = []
  const cy = len + ring
  for (let i = 0; i <= SEG; i++) {
    const th = -Math.PI / 2 + (i / SEG) * Math.PI * 2
    const nx = Math.cos(th), ny = Math.sin(th)
    for (let j = 0; j < TUBE; j++) {
      const a = (j / TUBE) * Math.PI * 2
      rp.push(nx * (ring + Math.cos(a) * t), cy + ny * (ring + Math.cos(a) * t), Math.sin(a) * t)
    }
    if (i) for (let j = 0; j < TUBE; j++) {
      const p = (i - 1) * TUBE, q = i * TUBE, j2 = (j + 1) % TUBE
      ri.push(p + j, q + j, q + j2, p + j, q + j2, p + j2)
    }
  }
  const loop = new THREE.BufferGeometry()
  loop.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3))
  loop.setIndex(ri)
  // (its outermost point, at its side, faces out from the loop's middle)
  outward(loop, (SEG / 4) * TUBE, new THREE.Vector3(1, 0, 0))
  const both = [bar, loop].map((g) => {
    const n = g.attributes.position.count
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 2).fill(0.5), 2))
    return g
  })
  const out = mergeGeometries(both)!
  for (const g of both) g.dispose()
  return out
}
