// The walking paths' map, drawn on the floor in edit mode when it's asked for (item 168, the owner's, 2026-11-15: "can you draw a map of the
// paths, to see when I press G, and edit and manage them?"): what stands in the way on the kitchen's floor (red: each piece's reach grown by
// the room left to pass, the rectangles the staff's ways go round), the staff's usual ways (from each one's place to the sink, the racks,
// the plating place), the ways being walked just now (brighter, wider), and the customers' (from the door to each seat). The ways are worked
// out from where things stand (game/kitchenPath), so a piece moved in edit mode redraws them. In the bar's frame (GuestBar3D's), from bar.ts's
// PATH_MAP, which GuestBar3D fills while it's shown; laid on the floor as flat bands (a line is a pixel wide, lost from up high), drawn over
// whatever's on it, never pointed at.
// Item 189 (the owner's, 2026-11-16: "mark clearly whose each way is, and let them be edited by hand"): each person's ways in their own colour,
// the places and the people named on the floor; the way or the person the editor's list points at (PATH_MAP.hot) bright, the rest faint.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { PATH_MAP, type PathRoute } from './bar'
import { editWords, useEditSel } from './edit'

/** each person's colour on the map (item 189): the servers blue, violet, teal; the owner amber; the plater pink; the customers green */
const WHO_COLOR: Record<string, string> = { 'server-0': '#3d9bff', 'server-1': '#a970ff', 'server-2': '#2ec4c4', 'server-3': '#7fb2ff', owner: '#ff9f1c',
  plater: '#ff5fa2', guest: '#4fd26e' }
export const whoColor = (who: string) => WHO_COLOR[who] ?? '#ffd23c'
/** a person's name on the map, in the edit panel's language */
export function whoName(who: string) {
  const T = editWords()
  return who.startsWith('server-') ? T.pathServer(Number(who.slice(7)) + 1) : T.pathWho[who] ?? who
}
/** a place's name on the map (a person's own place is named for them) */
export function placeName(key: string) {
  const T = editWords()
  if (key.startsWith('server-') || key === 'owner') return whoName(key)
  return key.startsWith('seat-') ? T.pathSeat(Number(key.slice(5)) + 1) : T.pathPlace[key] ?? key
}
/** how far over the floor it's drawn, and how wide its bands are and how strong (the bar's units) */
const LIFT = 0.015
const WIDE = { staff: 0.035, live: 0.055, guest: 0.028, edge: 0.025 }
const ALPHA = { staff: 0.6, live: 0.95, guest: 0.55 }
const RISE = { staff: 2, live: 3, guest: 2.5 }

/** a flat band on the floor along a segment, `w` wide: its two triangles' corners into `out`, their colour into `col` */
function band(out: number[], col: number[], a: THREE.Vector3, b: THREE.Vector3, w: number, y: number, rgba: number[]) {
  const dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz)
  if (n < 1e-6) return
  const nx = (-dz / n) * w / 2, nz = (dx / n) * w / 2
  out.push(a.x + nx, y, a.z + nz, a.x - nx, y, a.z - nz, b.x - nx, y, b.z - nz, a.x + nx, y, a.z + nz, b.x - nx, y, b.z - nz, b.x + nx, y, b.z + nz)
  for (let k = 0; k < 6; k++) col.push(rgba[0], rgba[1], rgba[2], rgba[3])
}

type Place = { key: string; at: [number, number, number] }

export function PathMap() {
  const on = useEditSel((s) => s.on), paths = useEditSel((s) => s.paths)
  const made = useMemo(() => {
    const noRay = () => {}
    const flat = (color: string, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
    const fill = new THREE.Mesh(new THREE.BufferGeometry(), flat('#ff3b2f', 0.28))
    const edge = new THREE.Mesh(new THREE.BufferGeometry(), flat('#ff5a4c', 0.95))
    // (every way in one: each person's colour and each way's strength by its corners)
    const ways = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }))
    for (const o of [fill, edge, ways]) { o.renderOrder = 1001; o.raycast = noRay; o.frustumCulled = false; o.userData.ignoreRaycast = true }
    return { fill, edge, ways }
  }, [])
  useEffect(() => () => {
    for (const o of [made.fill, made.edge, made.ways]) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
  }, [made])
  // (the list's pointing let go as the map's put away)
  useEffect(() => { if (!on || !paths) PATH_MAP.hot = null }, [on, paths])
  const seen = useRef('')
  const [places, setPlaces] = useState<Place[]>([])
  const placesSig = useRef('')
  useFrame(() => {
    if (!on || !paths) return
    const key = `${PATH_MAP.v}|${PATH_MAP.hot}`
    if (seen.current === key) return
    seen.current = key
    // (the rectangles: two triangles each, and a band round their four sides)
    const tri: number[] = [], rim: number[] = [], none: number[] = []
    for (const b of PATH_MAP.blocks) {
      const [a, c, d, e] = b.pts
      for (const v of [a, c, d, a, d, e]) tri.push(v.x, LIFT, v.z)
      for (const [p, q] of [[a, c], [c, d], [d, e], [e, a]]) band(rim, none, p, q, WIDE.edge, LIFT * 1.5, [0, 0, 0, 0])
    }
    made.fill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
    made.edge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3))
    // (each way a band from each point to the next, in its person's colour: the one pointed at bright and wide over the rest, the rest faint)
    const hot = PATH_MAP.hot
    const isHot = (r: PathRoute) => !!hot && (r.who === hot || r.key === hot)
    const pos: number[] = [], col: number[] = []
    const c = new THREE.Color()
    for (const r of [...PATH_MAP.routes].sort((p, q) => Number(isHot(p)) - Number(isHot(q)))) {
      c.set(whoColor(r.who))
      const h = isHot(r)
      const alpha = h ? 1 : hot ? 0.12 : ALPHA[r.kind]
      for (let j = 1; j < r.pts.length; j++) band(pos, col, r.pts[j - 1], r.pts[j], WIDE[r.kind] * (h ? 1.7 : 1), LIFT * (h ? 6 : RISE[r.kind]), [c.r, c.g, c.b, alpha])
    }
    made.ways.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    made.ways.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
    // (the places named on the floor: told again only when they've changed)
    const ps = PATH_MAP.places.map((p): Place => ({ key: p.key, at: [p.at.x, 0.02, p.at.z] }))
    const sig = ps.map((p) => `${p.key}:${p.at[0].toFixed(2)},${p.at[2].toFixed(2)}`).join('|')
    if (sig !== placesSig.current) { placesSig.current = sig; setPlaces(ps) }
  })
  if (!on || !paths) return null
  return (
    <group name="path-map">
      <primitive object={made.fill} />
      <primitive object={made.edge} />
      <primitive object={made.ways} />
      {places.map((p) => {
        const person = p.key.startsWith('server-') || p.key === 'owner'
        const seat = p.key.startsWith('seat-')
        return (
          <Html key={p.key} position={p.at} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <span className={`pm-tag${person ? ' is-person' : seat ? ' is-seat' : ''}`} style={person ? { background: whoColor(p.key) } : undefined}>{placeName(p.key)}</span>
          </Html>
        )
      })}
    </group>
  )
}
