// Glass broken on the floor (bar.ts's SPILLS, game/spills; the owner's, 2026-11-10): where a bottle let fall from high enough broke. Its
// shards slid out a little from where it hit and lying flat on the boards (6 to 10, each its own size and turn, slivers of the bottle's glass
// catching the light); the drink run out round them in a glossy puddle, to its full size in a moment (milk white and all but opaque, sake or
// ramune water-clear), a few drops thrown further; and a puff of glass dust up off it, gone in a third of a second. Swept up (`left` going to
// nothing), the shards are drawn in together and the puddle shrinks away. Drawn in the scene's own frame, each spill a few meshes made as it
// comes and let go as it's swept; their materials one for each colour, kept (a handful: the drinks' and the glasses' colours).
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { reflectStudio, useStudio } from '@/scene/studio'
import { warmLater } from '@/scene/Prewarm'
import { NO_RAY } from '@/scene/pickable'
import { shardsOf } from '@/game/spills'
import { SPILLS } from './bar'

/** a shard: a piece of the bottle's curved wall (the owner's, 2026-11-11: the flat chips didn't look like broken glass), its edges broken
 * unevenly, lying on its edges with its curve up, a few centimetres across; sized and turned for each */
const SHARD_GEO = (() => {
  const R = 0.032, A = 0.42, H = 0.013
  // (its outline's corners broken in and out: three across, two up)
  const jag = [[0.0, 0.004], [0.006, -0.003], [-0.004, 0.005], [0.003, 0.0], [-0.005, -0.004], [0.004, 0.006]]
  const pos: number[] = [], idx: number[] = []
  for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
    const a = (i / 2 - 0.5) * 2 * A + jag[j * 3 + i][1] * 4, h = (j - 0.5) * 2 * H + jag[j * 3 + i][0]
    // (the arc lying over: across x, its middle up)
    pos.push(Math.sin(a) * R, Math.cos(a) * R - R * Math.cos(A), h)
  }
  for (let i = 0; i < 2; i++) idx.push(i, i + 1, i + 4, i, i + 4, i + 3)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
})()
/** the bottle's neck, snapped off whole, lying on its side; and its base, a ring of wall standing on its floor (no fan into the middle: its
 * floor a narrow ring round a hole too small to see) */
const NECK_GEO = new THREE.CylinderGeometry(0.009, 0.0125, 0.06, 10, 1, true).rotateZ(Math.PI / 2)
const BASE_GEO = new THREE.LatheGeometry([new THREE.Vector2(0.002, 0.0012), new THREE.Vector2(0.03, 0.0012), new THREE.Vector2(0.031, 0.006),
  new THREE.Vector2(0.031, 0.016), new THREE.Vector2(0.03, 0.021)], 14)
/** crumbs of glass round it, too small to pick up by hand */
const CRUMB_GEO = new THREE.OctahedronGeometry(0.0024, 0)
const CRUMB_N = 20
/** a mote of glass dust: a speck */
const DUST_GEO = new THREE.OctahedronGeometry(0.0032, 0)
const DUST_N = 14
const DUST_S = 0.35
/** how long the shards take to slide out from where it hit, and the puddle to run out to its size (seconds) */
const SLIDE_S = 0.28
const RUN_S = 0.5

/** the glass of a broken bottle: its own tint, a little see-through, very smooth, the studio's light in it */
const shardMats = new Map<string, THREE.MeshStandardMaterial>()
function shardMat(tint: string) {
  let m = shardMats.get(tint)
  if (!m) {
    // (seen from both sides: the curved pieces show their inside too)
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.8), roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.6,
      depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide })
    reflectStudio(m)
    shardMats.set(tint, m)
  }
  return m
}
/** a drink spilt on the boards: its colour, glossy (the room's light on its wet top); a clear one darkening the wood under it as it soaks
 * in, more than tinting it (as see-through as the drink is clear); laid just over the floor and pulled toward the camera in depth so it never
 * fights the boards */
const puddleMats = new Map<string, THREE.MeshStandardMaterial>()
function puddleMat(colour: string, clear: number) {
  const key = `${colour}|${clear.toFixed(2)}`
  let m = puddleMats.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(colour).lerp(new THREE.Color('#1c120a'), clear >= 0.5 ? 0.93 : clear * 0.6), roughness: 0.18, metalness: 0,
      transparent: true, opacity: clear >= 0.5 ? 0.4 : 0.55 + (1 - clear) * 0.3, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.3 })
    reflectStudio(m)
    puddleMats.set(key, m)
  }
  return m
}
const DUST_MAT = new THREE.MeshBasicMaterial({ color: '#eef8ff', transparent: true, opacity: 0.85, depthWrite: false })

/** a seeded random run (the same spill the same shapes) */
function seeded(seed: number) {
  let s = Math.floor(Math.abs(seed) * 9301 + 49297) % 233280 || 1
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
}
/** a puddle: a blob a little lopsided, round lobes in its edge where it's run, and a few drops thrown out past it; flat, its top up */
function puddleGeo(seed: number, size: number) {
  const rnd = seeded(seed + 7)
  const N = 22, ph = rnd() * 6.3, ph2 = rnd() * 6.3
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = size * (0.86 + 0.16 * Math.sin(3 * a + ph) + 0.09 * Math.sin(5 * a + ph2) + 0.05 * (rnd() - 0.5))
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r))
  }
  const shapes = [new THREE.Shape(pts)]
  for (let k = 0, n = 3 + Math.floor(rnd() * 3); k < n; k++) {
    const a = rnd() * Math.PI * 2, d = size * (1.15 + rnd() * 0.45), r = 0.006 + rnd() * 0.012
    const c = new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d)
    shapes.push(new THREE.Shape(Array.from({ length: 8 }, (_, j) => c.clone().add(new THREE.Vector2(Math.cos((j / 8) * Math.PI * 2) * r, Math.sin((j / 8) * Math.PI * 2) * r)))))
  }
  const g = new THREE.ShapeGeometry(shapes)
  g.rotateX(-Math.PI / 2)
  return g
}

type Made = {
  group: THREE.Group; shards: THREE.InstancedMesh; puddle: THREE.Mesh; dust: THREE.InstancedMesh | null
  /** the neck and the base, where each came to rest; the crumbs */
  neck: THREE.Mesh; base: THREE.Mesh; big: { x: number; z: number; yaw: number }[]; crumbs: THREE.InstancedMesh; bits: { x: number; z: number; s: number }[]
  /** each shard's resting place (from where it hit), turn, size and lean; each mote's way out */
  rest: { x: number; z: number; yaw: number; sx: number; sz: number; tilt: number }[]; motes: THREE.Vector3[]
}
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3()

/** the spills on the floor: made as they come (SPILLS), moved as they go, let go once swept away */
export function Spills() {
  useStudio()
  const root = useRef<THREE.Group>(null)
  const made = useRef(new Map<number, Made>())
  // (each kind of thing they're drawn with drawn once as the shop loads, unseen: its program made then, not as the first bottle breaks)
  const warmed = useRef(false)
  useFrame(() => {
    const g = root.current
    if (!g) return
    if (!warmed.current) {
      warmed.current = true
      const t = new THREE.Group()
      t.add(new THREE.InstancedMesh(SHARD_GEO, shardMat('#eef4f2'), 1), new THREE.Mesh(BASE_GEO, shardMat('#eef4f2')), new THREE.Mesh(puddleGeo(1, 0.1), puddleMat('#f6f2de', 0.8)), new THREE.InstancedMesh(DUST_GEO, DUST_MAT, 1))
      warmLater(t)
    }
    const now = performance.now()
    const live = new Set<number>()
    for (const s of SPILLS.list) {
      live.add(s.key)
      let m = made.current.get(s.key)
      if (!m) {
        // (made: its shards scattered from where it hit, its puddle's shape, its dust's way out, all from its seed)
        const rnd = seeded(s.seed), n = shardsOf(s.seed)
        const group = new THREE.Group()
        group.position.set(s.at[0], s.at[1], s.at[2])
        // (made in metres: the scene's units to a metre where it fell)
        group.scale.setScalar(s.unit)
        const shards = new THREE.InstancedMesh(SHARD_GEO, shardMat(s.glass), n)
        shards.raycast = NO_RAY
        const rest = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + rnd() * 0.9, d = 0.03 + rnd() * rnd() * 0.24
          return { x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: rnd() * Math.PI * 2, sx: 0.8 + rnd() * 0.8, sz: 0.8 + rnd() * 0.8, tilt: rnd() < 0.5 ? (rnd() - 0.5) * 0.7 : 0 }
        })
        const puddle = new THREE.Mesh(puddleGeo(s.seed, 0.15 + rnd() * 0.07), puddleMat(s.drink, s.clear))
        puddle.position.y = 0.0012
        puddle.raycast = NO_RAY
        // (the puddle first, the shards over it, the dust over all: none of them in the depth, the puddle drawn after hid the shards in it)
        puddle.renderOrder = 1
        shards.renderOrder = 2
        const dust = new THREE.InstancedMesh(DUST_GEO, DUST_MAT, DUST_N)
        dust.raycast = NO_RAY
        dust.renderOrder = 3
        const motes = Array.from({ length: DUST_N }, () => {
          const a = rnd() * Math.PI * 2, v = 0.4 + rnd() * 0.9
          return new THREE.Vector3(Math.cos(a) * v, 0.6 + rnd() * 1.1, Math.sin(a) * v)
        })
        // (the neck and the base, thrown a little further than most, each its own way; the crumbs all round)
        const neck = new THREE.Mesh(NECK_GEO, shards.material as THREE.Material), base = new THREE.Mesh(BASE_GEO, shards.material as THREE.Material)
        const big = [0, 1].map(() => { const a = rnd() * Math.PI * 2, d = 0.08 + rnd() * 0.12; return { x: Math.cos(a) * d, z: Math.sin(a) * d, yaw: rnd() * Math.PI * 2 } })
        const crumbs = new THREE.InstancedMesh(CRUMB_GEO, shards.material as THREE.Material, CRUMB_N)
        const bits = Array.from({ length: CRUMB_N }, () => { const a = rnd() * Math.PI * 2, d = 0.02 + rnd() * 0.26; return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.5 + rnd() } })
        for (const o of [neck, base, crumbs]) { o.raycast = NO_RAY; o.renderOrder = 2; o.castShadow = false }
        crumbs.frustumCulled = false
        for (const o of [shards, dust]) { o.frustumCulled = false; o.castShadow = false; o.receiveShadow = false }
        puddle.receiveShadow = true
        group.add(puddle, shards, dust, neck, base, crumbs)
        g.add(group)
        m = { group, shards, puddle, dust, rest, motes, neck, base, big, crumbs, bits }
        made.current.set(s.key, m)
      }
      const t = (now - s.t0) / 1000
      const left = Math.max(0, Math.min(1, s.left))
      // (the shards: out from where it hit with a little hop; as it's swept, drawn in together and gone)
      const k = Math.min(1, t / SLIDE_S), ease = 1 - (1 - k) ** 3, gather = (1 - left) ** 0.7, shrink = left > 0.18 ? 1 : left / 0.18
      m.rest.forEach((r, i) => {
        P.set(r.x * ease * (1 - gather), 0.0008 + Math.sin(Math.PI * k) * 0.025, r.z * ease * (1 - gather))
        Q.setFromEuler(E.set(r.tilt, r.yaw + (1 - ease) * 2, r.tilt * 0.5))
        S.set(r.sx * shrink, 1, r.sz * shrink)
        m!.shards.setMatrixAt(i, M.compose(P, Q, S))
      })
      m.shards.instanceMatrix.needsUpdate = true
      // (the neck on its side, the base standing; the crumbs: all of them drawn in with the rest as it's swept)
      const [nk, bs] = m.big
      m.neck.position.set(nk.x * ease * (1 - gather), 0.0125, nk.z * ease * (1 - gather))
      m.neck.rotation.set(0, nk.yaw, 0)
      m.neck.scale.setScalar(Math.max(0.001, shrink))
      m.base.position.set(bs.x * ease * (1 - gather), 0, bs.z * ease * (1 - gather))
      m.base.rotation.set(0, bs.yaw, 0)
      m.base.scale.setScalar(Math.max(0.001, shrink))
      m.bits.forEach((b, i) => {
        P.set(b.x * ease * (1 - gather), 0.0015, b.z * ease * (1 - gather))
        S.setScalar(b.s * shrink)
        m!.crumbs.setMatrixAt(i, M.compose(P, Q.identity(), S))
      })
      m.crumbs.instanceMatrix.needsUpdate = true
      // (the puddle, run out to its size, shrinking away as it's wiped up)
      const run = Math.min(1, t / RUN_S)
      m.puddle.scale.setScalar(Math.max(0.001, (0.25 + 0.75 * Math.sqrt(run)) * (left > 0.05 ? 0.35 + 0.65 * left : left / 0.05 * 0.37)))
      // (the dust: up and out, falling back, gone)
      if (m.dust) {
        if (t >= DUST_S) { m.group.remove(m.dust); m.dust.dispose(); m.dust = null }
        else {
          const f = 1 - t / DUST_S
          m.motes.forEach((v, i) => {
            P.set(v.x * t, 0.01 + v.y * t - 4.9 * t * t, v.z * t)
            S.setScalar(f)
            m!.dust!.setMatrixAt(i, M.compose(P, Q.identity(), S))
          })
          m.dust.instanceMatrix.needsUpdate = true
        }
      }
    }
    // (swept away: let go, its puddle's own shape with it; the shards' and the materials' shared)
    for (const [key, m] of made.current) {
      if (live.has(key)) continue
      g.remove(m.group)
      m.shards.dispose()
      m.crumbs.dispose()
      m.dust?.dispose()
      m.puddle.geometry.dispose()
      made.current.delete(key)
    }
  })
  return <group ref={root} name="spills" />
}
