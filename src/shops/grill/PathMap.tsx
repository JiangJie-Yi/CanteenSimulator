// The walking paths' map, drawn on the floor in edit mode when it's asked for (item 168, the owner's, 2026-11-15: "can you draw a map of the
// paths, to see when I press G, and edit and manage them?"): what stands in the way on the kitchen's floor (red: each piece's reach grown by
// the room left to pass, the rectangles the staff's ways go round), the staff's usual ways (blue: from each one's place to the sink, the
// racks, the plating place), the ways being walked just now (yellow), and the customers' (green: from the door to each seat). The ways are
// worked out from where things stand (game/kitchenPath), so a piece moved in edit mode redraws them. In the bar's frame (GuestBar3D's),
// from bar.ts's PATH_MAP, which GuestBar3D fills while it's shown; laid on the floor as flat bands (a line is a pixel wide, lost from up
// high), drawn over whatever's on it, never pointed at.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PATH_MAP } from './bar'
import { useEdit } from './edit'

const KINDS = ['staff', 'live', 'guest'] as const
const COLOR: Record<(typeof KINDS)[number], string> = { staff: '#3d9bff', live: '#ffd23c', guest: '#4fd26e' }
/** how far over the floor it's drawn, and how wide its bands are (the bar's units) */
const LIFT = 0.015
const WIDE = { way: 0.035, edge: 0.025 }

/** a flat band on the floor along a segment, `w` wide: its two triangles' corners into `out` */
function band(out: number[], a: THREE.Vector3, b: THREE.Vector3, w: number, y: number) {
  const dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz)
  if (n < 1e-6) return
  const nx = (-dz / n) * w / 2, nz = (dx / n) * w / 2
  out.push(a.x + nx, y, a.z + nz, a.x - nx, y, a.z - nz, b.x - nx, y, b.z - nz, a.x + nx, y, a.z + nz, b.x - nx, y, b.z - nz, b.x + nx, y, b.z + nz)
}

export function PathMap() {
  const { on, paths } = useEdit()
  const made = useMemo(() => {
    const noRay = () => {}
    const flat = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
    const fill = new THREE.Mesh(new THREE.BufferGeometry(), flat('#ff3b2f', 0.28))
    const edge = new THREE.Mesh(new THREE.BufferGeometry(), flat('#ff5a4c', 0.95))
    const ways = KINDS.map((k) => new THREE.Mesh(new THREE.BufferGeometry(), flat(COLOR[k], k === 'staff' ? 0.7 : 0.95)))
    for (const o of [fill, edge, ...ways]) { o.renderOrder = 1001; o.raycast = noRay; o.frustumCulled = false; o.userData.ignoreRaycast = true }
    return { fill, edge, ways }
  }, [])
  useEffect(() => () => {
    for (const o of [made.fill, made.edge, ...made.ways]) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
  }, [made])
  const seen = useRef(-1)
  useFrame(() => {
    if (!on || !paths || seen.current === PATH_MAP.v) return
    seen.current = PATH_MAP.v
    // (the rectangles: two triangles each, and a band round their four sides)
    const tri: number[] = [], rim: number[] = []
    for (const b of PATH_MAP.blocks) {
      const [a, c, d, e] = b.pts
      for (const v of [a, c, d, a, d, e]) tri.push(v.x, LIFT, v.z)
      for (const [p, q] of [[a, c], [c, d], [d, e], [e, a]]) band(rim, p, q, WIDE.edge, LIFT * 1.5)
    }
    made.fill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
    made.edge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3))
    // (each kind's ways: a band from each point to the next)
    KINDS.forEach((k, i) => {
      const s: number[] = []
      const y = LIFT * (2 + i)
      for (const r of PATH_MAP.routes) {
        if (r.kind !== k) continue
        for (let j = 1; j < r.pts.length; j++) band(s, r.pts[j - 1], r.pts[j], WIDE.way, y)
      }
      made.ways[i].geometry.setAttribute('position', new THREE.Float32BufferAttribute(s, 3))
    })
  })
  if (!on || !paths) return null
  return (
    <group name="path-map">
      <primitive object={made.fill} />
      <primitive object={made.edge} />
      {made.ways.map((l, i) => <primitive key={i} object={l} />)}
    </group>
  )
}
