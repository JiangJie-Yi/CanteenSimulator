import { useEffect, useMemo, useRef } from 'react'
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
  // (hand soap's foam: a white dollop, two centimetres across, that sits a moment in the bowl)
  foam: { color: '#f6f3ea', r: 0.02, lie: 0.8 },
  // (washing-up liquid: a drop of the bottle's lemon yellow that soaks into the sponge)
  dishSoap: { color: '#efd062', r: 0.012, lie: 0.45 },
}
const MATS = Object.fromEntries(Object.entries(LOOK).map(([k, l]) => [k, new THREE.MeshToonMaterial({ color: l.color })])) as Record<DripKind, THREE.MeshToonMaterial>
/** a smooth little blob: a once-split icosahedron, its points shared so it shades round (80 faces) */
const GEO = (() => {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('normal').deleteAttribute('uv'))
  g.computeVertexNormals()
  return g
})()
const POOL = 6
/** how long it swells at the nozzle; how much slower than a real fall it's drawn (a real one's over in a tenth of a second, too quick to see) */
const SWELL = 0.18, SLOW = 1.8

export function Drips() {
  // (put straight in the scene: where they go is the world's, whatever the shop's own group is turned and scaled by)
  const scene = useThree((s) => s.scene)
  const meshes = useMemo(() => Array.from({ length: POOL }, () => {
    const m = new THREE.Mesh(GEO, MATS.foam)
    m.visible = false
    m.frustumCulled = false
    m.raycast = () => {}
    return m
  }), [])
  const live = useRef<({ d: Drip; t: number; T: number; landed: boolean } | null)[]>(Array(POOL).fill(null))
  // (dev: the pool and what's in flight, for checking where they go)
  if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __drips: { meshes, live, queue: QUEUE } })
  useEffect(() => { for (const m of Object.values(MATS)) warmLater(new THREE.Mesh(GEO, m)) }, [])
  useEffect(() => {
    for (const m of meshes) scene.add(m)
    return () => { for (const m of meshes) scene.remove(m) }
  }, [scene, meshes])
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05)
    const L = live.current
    while (QUEUE.length) {
      const d = QUEUE.shift()!
      const i = L.findIndex((x) => !x)
      if (i < 0) continue
      // (its fall: as long as a dropped thing takes over the height (the world's units are twice the metre: g 19.6), a little more if it's flung)
      const h = Math.max(0.02, d.from.y - d.to.y + (d.arc ?? 0) * d.from.distanceTo(d.to))
      L[i] = { d, t: -(d.delay ?? 0), T: Math.sqrt((2 * h) / 19.6) * (1 + (d.arc ?? 0)) * SLOW, landed: false }
      meshes[i].material = MATS[d.kind]
    }
    L.forEach((x, i) => {
      const m = meshes[i]
      if (!x) { m.visible = false; return }
      x.t += dt
      const { from, to, kind } = x.d, look = LOOK[kind]
      if (x.t < 0) { m.visible = false; return }
      m.visible = true
      if (x.t < SWELL) {
        // (swelling out of the nozzle, hanging a little as it does)
        const k = x.t / SWELL
        m.position.copy(from).y -= look.r * k
        m.scale.set(look.r * k, look.r * (0.8 + 0.5 * k), look.r * k)
        return
      }
      const s = Math.min(1, (x.t - SWELL) / x.T)
      if (s < 1) {
        // (falling: straight across to where it lands, down by gravity's square, flung up over the way if it was squeezed out)
        m.position.lerpVectors(from, to, s)
        m.position.y = from.y + (to.y - from.y) * s * s + (x.d.arc ?? 0) * from.distanceTo(to) * 4 * s * (1 - s)
        // (drawn out a little along its fall)
        m.scale.set(look.r * 0.9, look.r * (1 + 0.5 * s), look.r * 0.9)
        return
      }
      if (!x.landed) { x.landed = true; x.d.onLand?.() }
      // (landed: spread flat at once, then sinking away)
      const u = (x.t - SWELL - x.T) / look.lie
      if (u >= 1) { L[i] = null; m.visible = false; return }
      const fade = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5
      m.position.copy(to)
      m.position.y += look.r * 0.25 * fade
      m.scale.set(look.r * 1.5 * (0.6 + 0.4 * fade), look.r * 0.35 * fade, look.r * 1.5 * (0.6 + 0.4 * fade))
    })
  })
  return null
}
