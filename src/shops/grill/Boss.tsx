import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { airbrush, gradientMap } from '@/scene/Person3D'
import { getEdit } from './edit'

/**
 * The owner (blender/boss.py): an Overcooked 2 cook (a big round head on a short plump body rounding off underneath, floating mitten
 * hands) with the face on his picture: glasses, moustache, headband, kappōgi and checked trousers. Drawn in the people's soft paint (the
 * same five-tone light and airbrush).
 *
 * While the shop's shut he keeps busy at his grill, moving as Overcooked's cooks do: a waddle when he walks (bobbing up at each step,
 * rocking side to side, leaning in, his hands swinging), a quick lean-forward scurry when he runs, and both hands out in front when he
 * holds something. His day goes round: turning things at the fire with his tongs, a walk down the aisle, fanning the fire from there
 * with his uchiwa, a run back, a wave, a breather. He blinks every few seconds (now and then twice). In developer mode he stands still
 * at his place.
 */
const URL = import.meta.env.BASE_URL + 'models/boss.glb'
/** the small parts: no ink line round them */
const UNINKED = /(Eye|Shine|Brow|Cheek|Moustache|Mouth|Print|Collar|Knot|Band|Cord|Nose|Thumb|Glass|Hem|Tongs|Fan)/
let made: THREE.Object3D | null = null

/** where his hands hang at rest (as modelled, the node's own frame) */
const REST = { L: new THREE.Vector3(-0.3, 0.2, 0.05), R: new THREE.Vector3(0.3, 0.2, 0.05) }
type Phase = { act: 'tongs' | 'walk' | 'fan' | 'run' | 'wave' | 'idle'; len: number }
/** his round of the day, in seconds */
const ROUND: Phase[] = [
  { act: 'tongs', len: 7 }, { act: 'walk', len: 0 }, { act: 'fan', len: 5 }, { act: 'run', len: 0 }, { act: 'wave', len: 4 }, { act: 'idle', len: 4 },
]
const WALK_SPEED = 0.9
const RUN_SPEED = 2.4

/** `to`: the far end of his walk, in the frame he stands in (x, z), from his place at its origin, facing +z */
export function Boss({ to = [0, 0], children }: { to?: [number, number]; children?: ReactNode }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    if (!made) {
      const r = gltf.scene.clone(true)
      const mats = new Map<THREE.Material, THREE.Material>()
      r.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const src = m.material as THREE.MeshStandardMaterial
        let t = mats.get(src)
        if (!t) {
          t = /White|Dark/.test(src.name)
            ? new THREE.MeshBasicMaterial({ color: src.color.clone() })
            : airbrush(new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, gradientMap }))
          mats.set(src, t)
        }
        m.material = t
        m.castShadow = !UNINKED.test(m.name)
        m.receiveShadow = true
      })
      inkModel(r, (m) => UNINKED.test(m.name), { width: 0.006, weld: true })
      made = r
    }
    return made
  }, [gltf])
  const mover = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const parts = useMemo(() => ({
    handR: root.getObjectByName('BossHandR'),
    handL: root.getObjectByName('BossHandL'),
    tongs: root.getObjectByName('BossTongs'),
    fan: root.getObjectByName('BossFan'),
    eyes: ['BossEye-1', 'BossEye1', 'BossEyeShine-1', 'BossEyeShine1', 'BossEyeShineB-1', 'BossEyeShineB1']
      .map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[],
  }), [root])
  const st = useRef({ last: 0, phase: 0, t: 0, x: 0, z: 0, yaw: 0, stride: 0, blinkAt: 2, blinks: 0 })
  useFrame(({ clock }) => {
    const s = st.current
    const T = clock.elapsedTime
    // (the step from the clock itself, as the frame's delta runs short while the frames are paced)
    const dt = Math.min(Math.max(0, T - s.last), 0.1)
    s.last = T
    if (import.meta.env.DEV) root.userData.st = s
    const m = mover.current, b = body.current
    if (!m || !b) return
    const edit = getEdit().on
    if (edit) { s.phase = 0; s.t = 0; s.x = 0; s.z = 0; s.yaw = 0 }
    const ph = ROUND[s.phase]
    s.t += edit ? 0 : dt
    // (where he's going: the far end on the walk out, home on the run back; what he's doing when he's there)
    let act = ph.act
    let speed = 0
    if (act === 'walk' || act === 'run') {
      const [gx, gz] = act === 'walk' ? to : [0, 0]
      const dx = gx - s.x, dz = gz - s.z
      const d = Math.hypot(dx, dz)
      speed = act === 'walk' ? WALK_SPEED : RUN_SPEED
      if (d < 0.02) {
        s.x = gx; s.z = gz
        s.phase = (s.phase + 1) % ROUND.length; s.t = 0
        speed = 0
      } else {
        const step = Math.min(d, speed * dt)
        s.x += (dx / d) * step; s.z += (dz / d) * step
        s.stride += step
        turnTo(s, Math.atan2(dx, dz), dt * 9)
      }
    } else {
      // (at a stop he turns back to face the fire)
      turnTo(s, 0, dt * 5)
      if (s.t > ph.len) { s.phase = (s.phase + 1) % ROUND.length; s.t = 0 }
    }
    if (edit) act = 'idle'
    m.position.set(s.x, 0, s.z)
    m.rotation.y = s.yaw

    // ---- the body: a waddle (up at each step, rocking, leaning in) when moving, breathing when not
    const step = s.stride * (speed > 1 ? 2.6 : 3.4)
    const moving = speed > 0
    const run = speed > 1
    const bob = moving ? Math.abs(Math.sin(step * Math.PI)) * (run ? 0.055 : 0.035) : 0
    const squash = moving ? 1 - Math.abs(Math.cos(step * Math.PI)) * 0.04 : 1 + Math.sin(T * 1.6) * 0.012
    b.position.y = bob
    b.scale.set(2 - squash, squash, 2 - squash)
    const lean = moving ? (run ? 0.26 : 0.09) : act === 'fan' ? 0.06 : 0
    b.rotation.x += (lean - b.rotation.x) * Math.min(1, dt * 8)
    b.rotation.z = moving ? Math.sin(step * Math.PI) * (run ? 0.13 : 0.09) : Math.sin(T * 0.7) * 0.025
    // (a little hop of joy as he waves)
    if (act === 'wave') b.position.y += Math.max(0, Math.sin(s.t * 5)) * 0.015

    // ---- the hands
    const R = new THREE.Vector3(), L = new THREE.Vector3()
    if (moving) {
      // (swinging, opposite each other, forward and back with each step, a little up as they come forward)
      const sw = Math.sin(step * Math.PI) * (run ? 0.13 : 0.08)
      R.set(0, Math.max(0, sw) * 0.6 + (run ? 0.05 : 0), sw)
      L.set(0, Math.max(0, -sw) * 0.6 + (run ? 0.05 : 0), -sw)
    } else if (act === 'tongs') {
      // (both hands out in front, the tongs in the right; every so often a quick turn of whatever's on the fire)
      const flip = Math.max(0, Math.sin(s.t * 2.2)) ** 6
      R.set(-0.08, 0.12 + flip * 0.06, 0.3 + flip * 0.04)
      L.set(0.1, 0.1, 0.28)
    } else if (act === 'fan') {
      R.set(-0.06, 0.18, 0.3)
      L.set(0.08, 0.06 + Math.sin(T * 1.6) * 0.01, 0.2)
    } else if (act === 'wave') {
      const w = Math.sin(s.t * 9)
      R.set(0.02 + w * 0.04, 0.32, 0.06)
      L.set(0, 0.012 * Math.sin(T * 1.6 + 1), 0)
    } else {
      R.set(0, 0.012 * Math.sin(T * 1.6), 0)
      L.set(0, 0.012 * Math.sin(T * 1.6 + 1), 0)
    }
    if (parts.handR) parts.handR.position.lerp(R, Math.min(1, dt * 12))
    if (parts.handL) parts.handL.position.lerp(L, Math.min(1, dt * 12))
    // ---- what's in his hand: the tongs at the fire, the fan down the aisle; held at the right hand, swinging with it
    const hand = REST.R.clone().add(parts.handR?.position ?? new THREE.Vector3())
    if (parts.tongs) {
      parts.tongs.visible = act === 'tongs'
      parts.tongs.position.copy(hand).add(new THREE.Vector3(-0.02, 0.0, 0.02))
      parts.tongs.rotation.set(0.5 - Math.max(0, Math.sin(s.t * 2.2)) ** 6 * 0.5, -0.25, 0)
    }
    if (parts.fan) {
      parts.fan.visible = act === 'fan'
      parts.fan.position.copy(hand).add(new THREE.Vector3(0, 0.0, 0.02))
      // (fanned to and fro at the fire, quick)
      parts.fan.rotation.set(-0.5 + Math.sin(T * 13) * 0.55, 0, -0.15)
    }

    // ---- a blink every few seconds, now and then twice
    let lid = 1
    const since = T - s.blinkAt
    if (since > 0 && since < 0.14) lid = 0.08 + 0.92 * Math.abs(since / 0.07 - 1)
    else if (since >= 0.14) {
      s.blinkAt = T + (s.blinks % 4 === 3 ? 0.12 : 2.2 + Math.random() * 3)
      s.blinks++
    }
    for (const e of parts.eyes) {
      const sy = (e.userData.sy ??= e.scale.y) as number
      e.scale.y = sy * (/Shine/.test(e.name) ? (lid < 0.5 ? 0 : 1) : lid)
    }
  })
  return (
    <group ref={mover}>
      {children}
      <group ref={body}><primitive object={root} /></group>
    </group>
  )
}

/** turn toward a heading, the short way round, at most `k` of the way this frame */
function turnTo(s: { yaw: number }, to: number, k: number) {
  let d = to - s.yaw
  d = Math.atan2(Math.sin(d), Math.cos(d))
  s.yaw += d * Math.min(1, k)
}
useGLTF.preload(URL)
