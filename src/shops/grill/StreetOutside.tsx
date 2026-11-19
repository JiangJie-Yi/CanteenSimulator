import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { NO_RAY } from '@/scene/pickable'
import { EAVE_Y, FACADE_H, FACADE_W, HOUSES, ROAD_D, paintEave, paintFacade, paintMachine, paintRoad, paintSky, paintWalk, palOf } from '@/scene/streetScene'
import type { Sky } from '@/scene/streetView'

/**
 * The street out past the doorway, with depth (item 386, the owner's, 2026-11-20: 「外頭的景太平了」: item 360's street was one picture on a
 * card 20 cm past the door). Now a place out there in the doorway's own frame (x along the doorway, y up from the genkan's floor, z out from
 * the wall), its parts low and their detail in their pictures (scene/streetScene): the pavement out of the door, a step down from the sill,
 * to its kerb; the road a kerb's drop lower, across to the far kerb and its pavement; the far side's row of houses and shops as their fronts,
 * their ground floors' eaves standing out over the pavement and their roofs' edges, a drinks machine against them; a power pole on the near
 * pavement by the door, its crossarm and its street lamp out over the road; the sky far behind. Seen through the doorway from the room, each
 * at its own distance, so they move against each other as the camera does. Unlit pictures, painted again only as the part of the day turns
 * (the lamp, the windows, the shops and the machine lit by dusk); no light added, a few draws. Shown only while the camera's in the room (out
 * over the shop, the overview's, the street would stand out round the shop's model)
 */
const WALL_Z = 0.2
const NEAR_Z = 1.75
const FAR_Z = NEAR_Z + ROAD_D
const HOUSE_Z = FAR_Z + 1.0
const SKY_Z = HOUSE_Z + 9
const WALK_Y = -0.04, ROAD_Y = -0.16
// (on the near pavement just past the doorway's right-hand jamb: from the room's left it stands in the doorway, near, the rest moving past it)
const POLE = { x: 0.6, z: 1.45, r: 0.12, h: 8.6 }
// (in the lane's mouth, its back to the lane, facing the street)
const MACHINE = { x0: -3.82, x1: -2.98, z0: HOUSE_Z - 0.72, z1: HOUSE_Z - 0.02, h: 1.83 }
const HW = FACADE_W / 2

type Quad = [THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple]
/** a geometry of four-cornered faces, each its corners (counter-clockwise seen from the side it faces) and their places on the picture */
function quads(faces: { p: Quad; uv: [number, number][] }[]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (const f of faces) {
    const b = pos.length / 3
    for (let k = 0; k < 4; k++) { pos.push(...f.p[k]); uv.push(...f.uv[k]) }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
/** a flat piece of ground facing up, from z0 to z1 (its picture's foot at z0) */
const ground = (y: number, z0: number, z1: number): { p: Quad; uv: [number, number][] } =>
  ({ p: [[-HW, y, z0], [-HW, y, z1], [HW, y, z1], [HW, y, z0]], uv: [[0, 0], [0, 1], [1, 1], [1, 0]] })
/** an upright face toward the shop (facing -z) at z, from x0 to x1 and y0 to y1, its picture's part u0..u1, v0..v1 */
const front = (z: number, x0: number, x1: number, y0: number, y1: number, u: [number, number], v: [number, number]): { p: Quad; uv: [number, number][] } =>
  ({ p: [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], uv: [[u[1], v[0]], [u[0], v[0]], [u[0], v[1]], [u[1], v[1]]] })

/** a box's six faces (its picture's parts: its front toward the shop `f`, the rest `o`), its top sloping from yt at its back (z1) to yf at
 * its front (z0) */
function slab(x0: number, x1: number, z0: number, z1: number, yb0: number, yb1: number, yt0: number, yt1: number,
  f: [number, number, number, number], top: [number, number, number, number], under: [number, number, number, number]) {
  const r = (u: [number, number, number, number]): [number, number][] => [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]]
  return [
    // (its top: from the front edge (z0, yt0) back to the wall (z1, yt1))
    { p: [[x0, yt0, z0], [x0, yt1, z1], [x1, yt1, z1], [x1, yt0, z0]] as Quad, uv: r(top) },
    // (its underside)
    { p: [[x0, yb1, z1], [x0, yb0, z0], [x1, yb0, z0], [x1, yb1, z1]] as Quad, uv: r(under) },
    // (its front, toward the shop)
    { p: [[x1, yb0, z0], [x0, yb0, z0], [x0, yt0, z0], [x1, yt0, z0]] as Quad, uv: r(f) },
    // (its two ends)
    { p: [[x0, yb0, z0], [x0, yb1, z1], [x0, yt1, z1], [x0, yt0, z0]] as Quad, uv: r(f) },
    { p: [[x1, yb1, z1], [x1, yb0, z0], [x1, yt0, z0], [x1, yt1, z1]] as Quad, uv: r(f) },
  ]
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return { c, g: c.getContext('2d')!, t }
}

/**
 * Seen only through the doorway: a sheet in the wall's plane just outside it (5 mm), round the doorway (its hole), that writes the depth
 * and no colour, drawn after everything but the street (so nothing else is touched), the street after it: wherever the room's not open to
 * the street but through its doorway (where a wall's been taken away for the camera, the void beyond as it was) the street's behind it and
 * isn't drawn. (No stencil: the canvas hasn't one)
 */
const MASK_ORDER = 100
function maskGeo(hole: { x0: number; x1: number; y0: number; y1: number }) {
  const z = WALL_Z + 0.005, X = 14, Y0 = -2, Y1 = 9
  const f = (x0: number, x1: number, y0: number, y1: number) => front(z, x0, x1, y0, y1, [0, 1], [0, 1])
  return quads([f(-X, hole.x0, Y0, Y1), f(hole.x1, X, Y0, Y1), f(hole.x0, hole.x1, hole.y1, Y1), f(hole.x0, hole.x1, Y0, hole.y0)])
}
const MASK = new THREE.MeshBasicMaterial({ colorWrite: false })

type Street = {
  pics: { tex: THREE.CanvasTexture; paint: (sky: Sky) => void }[]
  mats: THREE.Material[]
  geos: THREE.BufferGeometry[]
  meshes: { geo: THREE.BufferGeometry; mat: THREE.Material }[]
  pole: THREE.MeshBasicMaterial
  lamp: THREE.MeshBasicMaterial
}
let street: Street | null = null
/** made once for the shop (the pictures, their materials, the geometry), painted again as the part of the day turns */
function streetOf(): Street | null {
  if (street || typeof document === 'undefined') return street
  const facade = canvas(2048, 656), road = canvas(2048, 448), near = canvas(2048, 160), far = canvas(2048, 112)
  const sky = canvas(256, 512), machine = canvas(256, 256), eave = canvas(256, 128)
  const pics = [
    { tex: facade.t, paint: (s: Sky) => paintFacade(facade.g, 2048, 656, s) },
    { tex: road.t, paint: (s: Sky) => paintRoad(road.g, 2048, 448, s, POLE.x) },
    { tex: near.t, paint: (s: Sky) => paintWalk(near.g, 2048, 160, s, NEAR_Z - WALL_Z, true) },
    { tex: far.t, paint: (s: Sky) => paintWalk(far.g, 2048, 112, s, HOUSE_Z - FAR_Z, false) },
    { tex: sky.t, paint: (s: Sky) => paintSky(sky.g, 256, 512, s) },
    { tex: machine.t, paint: (s: Sky) => paintMachine(machine.g, 256, 256, s) },
    { tex: eave.t, paint: (s: Sky) => paintEave(eave.g, 256, 128, s) },
  ]
  const mat = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
  const [mFacade, mRoad, mNear, mFar, mSky, mMachine, mEave] = pics.map((p) => mat(p.tex))
  const geoFacade = quads([front(HOUSE_Z, -HW, HW, WALK_Y, WALK_Y + FACADE_H, [0, 1], [0, 1])])
  const geoRoad = quads([ground(ROAD_Y, NEAR_Z, FAR_Z)])
  const geoNear = quads([ground(WALK_Y, WALL_Z, NEAR_Z)])
  // (the far pavement and the face of its kerb toward the shop, the kerb's stones (the picture's foot))
  const geoFar = quads([ground(WALK_Y, FAR_Z, HOUSE_Z), front(FAR_Z, -HW, HW, ROAD_Y, WALK_Y, [0, 1], [0.02, 0.12])])
  const geoSky = quads([front(SKY_Z, -32, 32, ROAD_Y - 3, 34, [0, 1], [0, 1])])
  // (each house's ground-floor eave standing out over the pavement, sloping down from the wall; and its roof's edge over its upper floor)
  const eaves: { p: Quad; uv: [number, number][] }[] = []
  const TOP: [number, number, number, number] = [0.02, 0.02, 0.48, 0.98], UNDER: [number, number, number, number] = [0.52, 0.02, 0.98, 0.48]
  const EDGE: [number, number, number, number] = [0.52, 0.52, 0.98, 0.98]
  for (const hs of HOUSES) {
    if (hs.kind === 'lane') continue
    const x0 = hs.x0 + 0.04, x1 = hs.x1 - 0.04
    const y = WALK_Y + EAVE_Y
    eaves.push(...slab(x0, x1, HOUSE_Z - 0.75, HOUSE_Z, y - 0.12, y + 0.08, y - 0.04, y + 0.16, EDGE, TOP, UNDER))
    const yr = WALK_Y + hs.roof
    eaves.push(...slab(x0 - 0.05, x1 + 0.05, HOUSE_Z - 0.5, HOUSE_Z, yr - 0.1, yr + 0.05, yr - 0.02, yr + 0.2, EDGE, TOP, UNDER))
  }
  const geoEave = quads(eaves)
  // (the drinks machine: its front the picture's left three quarters, its sides and top the rest)
  const SIDE: [number, number, number, number] = [0.78, 0.02, 0.98, 0.98]
  const mz = MACHINE
  const geoMachine = quads([
    front(mz.z0, mz.x0, mz.x1, WALK_Y, WALK_Y + mz.h, [0, 0.75], [0, 1]),
    ...slab(mz.x0, mz.x1, mz.z0, mz.z1, WALK_Y, WALK_Y, WALK_Y + mz.h, WALK_Y + mz.h, SIDE, SIDE, SIDE).filter((_, i) => i !== 2),
  ])
  // (the pole: eight-sided, its crossarm, its lamp's arm out over the road; the lamp's head its own, lit by night)
  const pieces = [
    new THREE.CylinderGeometry(POLE.r * 0.85, POLE.r, POLE.h, 8, 1).translate(POLE.x, WALK_Y + POLE.h / 2, POLE.z),
    new THREE.BoxGeometry(1.7, 0.1, 0.1).translate(POLE.x, WALK_Y + POLE.h - 0.9, POLE.z),
    new THREE.BoxGeometry(0.06, 0.06, 1.0).translate(POLE.x, WALK_Y + 4.7, POLE.z + 0.55),
  ].map((g) => g.toNonIndexed())
  const geoPole = mergeGeometries(pieces)!
  const geoLamp = new THREE.BoxGeometry(0.34, 0.08, 0.16).translate(POLE.x, WALK_Y + 4.64, POLE.z + 1.0)
  // (round, as unlit as the rest: its shading drawn round it, dark on one side going light on the other, the colour by the part of the day)
  const round = canvas(64, 4)
  const gr = round.g.createLinearGradient(0, 0, 64, 0)
  gr.addColorStop(0, '#5a5a5a'); gr.addColorStop(0.3, '#ffffff'); gr.addColorStop(0.55, '#c8c8c8'); gr.addColorStop(0.8, '#4a4a4a'); gr.addColorStop(1, '#5a5a5a')
  round.g.fillStyle = gr; round.g.fillRect(0, 0, 64, 4)
  round.t.wrapS = THREE.RepeatWrapping
  const pole = new THREE.MeshBasicMaterial({ color: '#6b6863', map: round.t, toneMapped: false })
  const lamp = new THREE.MeshBasicMaterial({ color: '#d8d4c8', toneMapped: false })
  const meshes = [
    { geo: geoSky, mat: mSky }, { geo: geoFacade, mat: mFacade }, { geo: geoEave, mat: mEave }, { geo: geoFar, mat: mFar },
    { geo: geoRoad, mat: mRoad }, { geo: geoNear, mat: mNear }, { geo: geoMachine, mat: mMachine }, { geo: geoPole, mat: pole }, { geo: geoLamp, mat: lamp },
  ]
  street = { pics, mats: [mFacade, mRoad, mNear, mFar, mSky, mMachine, mEave, pole, lamp], geos: meshes.map((m) => m.geo), meshes, pole, lamp }
  return street
}

let streetSky = ''
/** the street painted for the part of the day (the page's data-sky), once each time it turns */
function paintFor(st: Street) {
  const s = (typeof document === 'undefined' ? 'day' : document.documentElement.dataset.sky ?? 'day') as Sky
  if (s === streetSky) return
  streetSky = s
  const sky = (['dawn', 'day', 'dusk', 'night'].includes(s) ? s : 'day') as Sky
  for (const p of st.pics) { p.paint(sky); p.tex.needsUpdate = true }
  const pal = palOf(sky)
  st.pole.color.set(pal.night ? '#16161c' : '#6b6863')
  st.lamp.color.set(pal.lit > 0.4 ? '#fff3d6' : '#d8d4c8')
}

const CAM = new THREE.Vector3()
/** `floor`: the genkan's floor (the doorway's sill); `hole`: the doorway's opening in the wall, in its frame (x across, y up) */
function StreetOutsideImpl({ floor, hole }: { floor: number; hole: { x0: number; x1: number; y0: number; y1: number } }) {
  const st = useMemo(() => streetOf(), [])
  const mask = useMemo(() => maskGeo({ x0: hole.x0, x1: hole.x1, y0: hole.y0 - floor, y1: hole.y1 - floor }), [hole.x0, hole.x1, hole.y0, hole.y1, floor])
  useEffect(() => () => mask.dispose(), [mask])
  const root = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    const g = root.current
    if (!g || !st || !g.parent) return
    paintFor(st)
    // (shown only from inside the room: the camera behind the wall's line and under the ceiling's height)
    g.parent.worldToLocal(camera.getWorldPosition(CAM))
    const inside = CAM.z < WALL_Z && CAM.y < floor + 4.6
    if (g.visible !== inside) g.visible = inside
  })
  if (!st) return null
  return (
    <group ref={root} position-y={floor}>
      <mesh geometry={mask} material={MASK} raycast={NO_RAY} renderOrder={MASK_ORDER} />
      {st.meshes.map((m, i) => <mesh key={i} geometry={m.geo} material={m.mat} raycast={NO_RAY} renderOrder={MASK_ORDER + 1} />)}
    </group>
  )
}
export const StreetOutside = memo(StreetOutsideImpl)
