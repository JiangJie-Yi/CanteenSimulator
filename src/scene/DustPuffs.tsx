// Overcooked's little puffs of dust at a walker's heels (the owner's): every so often as anyone walks, one round cream puff at the back of
// a foot, left and right in turn, that swells like cotton wool, drifts back and up a little and shrinks away, under half a second. All of
// them one instanced mesh of eighty: one draw, nothing made or thrown away as they come and go.
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAX = 80
type Puff = { on: boolean; x: number; y: number; z: number; vx: number; vz: number; rise: number; t: number; life: number; size: number }
const POOL: Puff[] = Array.from({ length: MAX }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, rise: 0, t: 0, life: 0.4, size: 0 }))
let next = 0
const SEEN = { calls: 0, walking: 0, puffs: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __dust: SEEN })

/** one puff at `at` (the world's), drifting along (vx, vz) a second, `size` across at its biggest */
export function puff(at: THREE.Vector3, vx: number, vz: number, size: number) {
  SEEN.puffs++
  const p = POOL[next]
  next = (next + 1) % MAX
  Object.assign(p, { on: true, x: at.x, y: at.y, z: at.z, vx, vz, rise: size * 1.4, t: 0, life: 0.35 + Math.random() * 0.1, size })
}

/** a walker's own count between footfalls, and which foot */
export type Steps = { t: number; side: number; last: THREE.Vector3 | null }
export const newSteps = (): Steps => ({ t: 0, side: 1, last: null })
const AT = new THREE.Vector3()
/**
 * A walker's footfalls, called each frame with where they are (their feet, the world's), how much they're walking (0..1, their waddle's
 * pace) and how tall they stand (the world's): a puff at a heel every 0.16 s, a little quicker the faster they go, behind them, a foot to
 * either side in turn
 */
export function footDust(s: Steps, feet: THREE.Vector3, walk: number, height: number, dt: number) {
  SEEN.calls++
  if (walk >= 0.5) SEEN.walking++
  const was = s.last
  // (the way they're going, from last frame's place, before it's put by)
  const dx = was ? feet.x - was.x : 0, dz = was ? feet.z - was.z : 0, d = Math.hypot(dx, dz)
  s.last = (s.last ?? new THREE.Vector3()).copy(feet)
  if (!was || walk < 0.5 || dt <= 0) { s.t = 0; return }
  if (d < 1e-5) return
  s.t += dt
  if (s.t < 0.16 - 0.04 * Math.min(1, walk)) return
  s.t = 0
  s.side = -s.side
  const fx = dx / d, fz = dz / d
  // (at the heel: a little behind them, a foot's width to the side, just off the floor)
  AT.set(feet.x - fx * height * 0.06 + -fz * s.side * height * 0.05, feet.y + height * 0.025, feet.z - fz * height * 0.06 + fx * s.side * height * 0.05)
  puff(AT, -fx * height * 0.3, -fz * height * 0.3, height * (0.11 + Math.random() * 0.04))
}

const GEO = new THREE.IcosahedronGeometry(0.5, 1)
const MAT = new THREE.MeshToonMaterial({ color: '#f5f2eb' })
const M = new THREE.Matrix4()
const Q = new THREE.Quaternion()
const S = new THREE.Vector3()
const P = new THREE.Vector3()
/** the puffs, drawn: put once in the scene (App's canvas), from the start (its program made with the rest at loading) */
export function DustPuffs() {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(GEO, MAT, MAX)
    m.name = 'dust-puffs'
    m.frustumCulled = false
    m.castShadow = false
    m.receiveShadow = false
    m.raycast = () => {}
    M.makeScale(0, 0, 0)
    for (let i = 0; i < MAX; i++) m.setMatrixAt(i, M)
    return m
  }, [])
  useEffect(() => () => mesh.dispose(), [mesh])
  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.1)
    let any = false
    POOL.forEach((p, i) => {
      if (!p.on) return
      any = true
      p.t += dt
      const k = p.t / p.life
      if (k >= 1) { p.on = false; M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); return }
      p.x += p.vx * dt
      p.z += p.vz * dt
      // (swelling quickly to its full size by 0.45 of its life, then shrinking away to a dot)
      const s = k < 0.45 ? 0.35 + 0.65 * (1 - (1 - k / 0.45) ** 2) : 1 - 0.9 * ((k - 0.45) / 0.55)
      const r = p.size * s
      P.set(p.x, p.y + p.rise * Math.min(1, k * 1.4), p.z)
      M.compose(P, Q, S.set(r, r * 0.85, r))
      mesh.setMatrixAt(i, M)
    })
    if (any || mesh.userData.was) mesh.instanceMatrix.needsUpdate = true
    mesh.userData.was = any
  })
  return <primitive object={mesh} />
}
