import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { warmLater } from './Prewarm'

/**
 * What a press or a squeeze gives out, seen (item 289, the owner's, 2026-11-17: 「按一下要有東西出來捏!」, the washroom's hand soap and the sink's
 * washing-up liquid): a blob of it swelling at the nozzle as it's pressed out, falling (or flung a little way, out of a squeezed bottle) to
 * where it lands, and there settling, spread flat, and gone (into the water, into the sponge, down the basin). One small pool of them for
 * the shop, each kind its colour; drawn in the toon light everything is (its program made at load: nothing new compiled as they're used).
 */
export type DripKind = 'foam' | 'dishSoap'
export type Drip = {
  /** where it comes out and where it lands (the world's) */
  from: THREE.Vector3
  to: THREE.Vector3
  kind: DripKind
  /** after how long (s): a pump's head pressed down first */
  delay?: number
  /** how high it's flung over the straight way (a squeezed bottle's jet), as a share of how far it goes */
  arc?: number
  /** heard as it lands */
  onLand?: () => void
}
const QUEUE: Drip[] = []
/** a press's or a squeeze's blob given out */
export function drip(d: Drip) {
  QUEUE.push({ ...d, from: d.from.clone(), to: d.to.clone() })
}
/** each kind's look: its colour, its size (radius, the world's units), how long it lies where it lands */
const LOOK: Record<DripKind, { color: string; r: number; lie: number }> = {
  // (hand soap's foam: a white dollop of bubbles, four centimetres across, that sits a moment in the bowl)
  foam: { color: '#f6f3ea', r: 0.02, lie: 0.9 },
  // (washing-up liquid: the bottle's lemon yellow, a thick string of it that pools on the sponge and soaks in)
  dishSoap: { color: '#efc94a', r: 0.011, lie: 0.8 },
}
const MATS = Object.fromEntries(Object.entries(LOOK).map(([k, l]) => [k, new THREE.MeshToonMaterial({ color: l.color })])) as Record<DripKind, THREE.MeshToonMaterial>
/** a smooth little blob: a once-split icosahedron, its points shared so it shades round (80 faces) */
const GEO = (() => {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('normal').deleteAttribute('uv'))
  g.computeVertexNormals()
  return g
})()
const POOL = 6
/**
 * (item 459, the owner's 「擠出來的樣子也很怪，要優話」: it was one hard ball thrown in an arc (up over the bottle's top first, a ball jumping),
 * landing as a flat disc at once; from the sink's view a dot). Now each press gives out a few pieces of it (BEADS): the washing-up liquid
 * a string of beads off the spout, the first the biggest, one after another down a falling curve (it leaves the spout going a little out
 * toward where it lands and falls, never up), each drawn out along its fall, each going into a pool where it lands that grows as they come
 * and then soaks in; the hand soap's foam a dollop of bubbles swelling out of the nozzle as the pump's pressed, dropping straight, squashing
 * as it lands, sitting a moment and going. The fall drawn slower than a real one (SLOW: a real one's over in a tenth of a second).
 */
const BEADS = 5
const SLOW = 1.8
/** the liquid's beads one after another (s), each smaller than the one before by this much */
const BEAD_GAP = 0.022, BEAD_LESS = 0.1
/** the foam's dollop: its bubbles about its middle (x, y, z in its size) and each one's size */
const FOAM_BITS: [number, number, number, number][] = [[0, 0, 0, 1], [0.62, 0.2, 0.1, 0.72], [-0.55, 0.15, -0.25, 0.78], [0.1, 0.55, -0.45, 0.66], [-0.2, 0.62, 0.42, 0.6]]
/** how long the foam swells out of the nozzle */
const FOAM_SWELL = 0.26

type Live = { d: Drip; t: number; T: number; landed: number }
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const Drips = memo(DripsImpl)
function DripsImpl() {
  // (put straight in the scene: where they go is the world's, whatever the shop's own group is turned and scaled by)
  const scene = useThree((s) => s.scene)
  // (each press's pieces, and its pool where it lands)
  const meshes = useMemo(() => Array.from({ length: POOL }, () => Array.from({ length: BEADS + 1 }, () => {
    const m = new THREE.Mesh(GEO, MATS.foam)
    m.visible = false
    m.frustumCulled = false
    m.raycast = () => {}
    return m
  })), [])
  const live = useRef<(Live | null)[]>(Array(POOL).fill(null))
  // (dev: the pool and what's in flight, for checking where they go)
  if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __drips: { meshes, live, queue: QUEUE } })
  useEffect(() => { for (const m of Object.values(MATS)) warmLater(new THREE.Mesh(GEO, m)) }, [])
  useEffect(() => {
    for (const set of meshes) for (const m of set) scene.add(m)
    return () => { for (const set of meshes) for (const m of set) scene.remove(m) }
  }, [scene, meshes])
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05)
    const L = live.current
    while (QUEUE.length) {
      const d = QUEUE.shift()!
      const i = L.findIndex((x) => !x)
      if (i < 0) continue
      // (its fall: as long as a dropped thing takes over the height (the world's units are twice the metre: g 19.6))
      const h = Math.max(0.02, d.from.y - d.to.y)
      L[i] = { d, t: -(d.delay ?? 0), T: Math.sqrt((2 * h) / 19.6) * SLOW, landed: 0 }
      for (const m of meshes[i]) m.material = MATS[d.kind]
    }
    L.forEach((x, i) => {
      const set = meshes[i]
      if (!x) { for (const m of set) m.visible = false; return }
      x.t += dt
      if (x.t < 0) { for (const m of set) m.visible = false; return }
      if (x.d.kind === 'foam') { if (foamTick(x, set)) L[i] = null }
      else if (liquidTick(x, set)) L[i] = null
    })
  })
  return null
}
/** where a piece is `s` (0..1) down its fall from `from` to `to`: across at an even pace (as a thing let go of goes on across), down by
 * gravity's square (never up) */
function fallAt(out: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, s: number) {
  out.set(from.x + (to.x - from.x) * s, from.y + (to.y - from.y) * s * s, from.z + (to.z - from.z) * s)
  return out
}
const AT = new THREE.Vector3(), NEXT = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion()
/** the washing-up liquid's string of beads and its pool; whether it's all over */
function liquidTick(x: Live, set: THREE.Mesh[]) {
  const { from, to } = x.d, r = LOOK.dishSoap.r
  let inPool = 0
  for (let k = 0; k < BEADS; k++) {
    const m = set[k], s = (x.t - k * BEAD_GAP) / x.T, rk = r * (1 - BEAD_LESS * k)
    if (s <= 0) {
      // (not out yet: the first only, swelling at the spout's lip as the pump's pressed)
      m.visible = k === 0
      if (m.visible) { const g = Math.min(1, 1 + s * 4); m.position.copy(from); m.scale.setScalar(rk * Math.max(0.2, g)) }
      continue
    }
    if (s >= 1) { m.visible = false; inPool += (1 - BEAD_LESS * k) ** 3; if (k === 0 && !x.landed) { x.landed = x.t; x.d.onLand?.() } continue }
    // (falling: drawn out along its way, the more the faster it's going)
    m.visible = true
    fallAt(m.position, from, to, s)
    fallAt(NEXT, from, to, Math.min(1, s + 0.04))
    const dir = NEXT.sub(m.position)
    if (dir.lengthSq() > 1e-10) m.quaternion.copy(Q.setFromUnitVectors(UP, dir.normalize()))
    // (drawn out along its fall into a string, each bead into the next: one pour, not beads)
    const stretch = 1.4 + 2.2 * s
    m.scale.set(rk / Math.sqrt(stretch), rk * stretch, rk / Math.sqrt(stretch))
  }
  // (the pool where it lands: as big as what's come into it, then soaking in, flatter and smaller till it's gone)
  const pool = set[BEADS]
  if (!x.landed) { pool.visible = false; return false }
  const all = Array.from({ length: BEADS }, (_, k) => (1 - BEAD_LESS * k) ** 3).reduce((a, b) => a + b, 0)
  const lastIn = x.landed + (BEADS - 1) * BEAD_GAP
  const u = Math.max(0, (x.t - lastIn) / LOOK.dishSoap.lie)
  if (u >= 1) { pool.visible = false; return true }
  const size = r * 2.8 * Math.cbrt(inPool / all) * (1 - 0.35 * u)
  pool.visible = size > 1e-4
  pool.position.copy(to)
  pool.quaternion.identity()
  pool.scale.set(size, size * 0.32 * (1 - u), size)
  pool.position.y += size * 0.32 * (1 - u) * 0.5
  return false
}
/** the hand soap's dollop of foam; whether it's over */
function foamTick(x: Live, set: THREE.Mesh[]) {
  const { from, to } = x.d, r = LOOK.foam.r
  set[BEADS].visible = false
  let k = 1, squash = 1
  if (x.t < FOAM_SWELL) {
    // (swelling out of the nozzle, hanging under it)
    k = x.t / FOAM_SWELL
    AT.copy(from).y -= r * 0.9 * k
  } else {
    const s = Math.min(1, (x.t - FOAM_SWELL) / x.T)
    if (s < 1) fallAt(AT, from, to, s).y -= r * 0.9
    else {
      if (!x.landed) { x.landed = x.t; x.d.onLand?.() }
      // (landed: squashed and springing back a little, sitting, then going)
      const t = x.t - x.landed, u = t / LOOK.foam.lie
      if (u >= 1) { for (const m of set) m.visible = false; return true }
      squash = 1 - 0.3 * Math.exp(-t * 9) * Math.cos(t * 26)
      k = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4
      AT.copy(to).y += r * 0.55 * squash * k
    }
  }
  FOAM_BITS.forEach(([bx, by, bz, bs], i) => {
    const m = set[i]
    m.visible = k > 0.02
    m.quaternion.identity()
    m.position.set(AT.x + bx * r * k / Math.sqrt(squash), AT.y + by * r * k * squash, AT.z + bz * r * k / Math.sqrt(squash))
    m.scale.set(bs * r * k / Math.sqrt(squash), bs * r * k * squash, bs * r * k / Math.sqrt(squash))
  })
  return false
}
