import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Hangings that get in the way fade: a group marked `userData.fade` (the noren, the red lantern, the banners and flags, the lamps) that stands
 * between the camera and what it's looking at (the orbit's target, and a little round it) turns see-through, and comes back once it's out of the
 * way. Rays are cast at the group's own meshes (a batch's hidden originals included, since its merged copy can't be hit); what's drawn
 * (the merged copy, the ink lines) is what fades, each mesh on its own copy of its material so nothing else that shares it fades too.
 */
const FADED = 0.18
/** the rays: a grid round where what's looked at is on the screen (in the screen's -1..1, about a third of it across) */
const AIM: [number, number][] = [-0.3, -0.15, 0, 0.15, 0.3].flatMap((x) => [-0.3, -0.15, 0, 0.15, 0.3].map((y) => [x, y] as [number, number]))

type Fader = { root: THREE.Object3D; hit: THREE.Mesh[]; drawn: THREE.Mesh[]; k: number; want: number; own: Map<THREE.Material, THREE.Material> }

export function OccluderFade({ target }: { target: () => THREE.Vector3 | undefined }) {
  const { scene, camera } = useThree()
  const faders = useRef<Fader[]>([])
  const seen = useRef(0)
  const tick = useRef(0)
  const ray = useRef(new THREE.Raycaster())

  // (the marked groups, looked for again now and then: pieces load and batches merge after mount)
  const gather = () => {
    const list: Fader[] = []
    scene.traverse((o) => {
      if (!o.userData.fade) return
      const hit: THREE.Mesh[] = [], drawn: THREE.Mesh[] = []
      o.traverse((m) => {
        const mesh = m as THREE.Mesh
        if (!mesh.isMesh || mesh.userData.glow) return
        drawn.push(mesh)
        if (!mesh.name.endsWith('_outline')) hit.push(mesh)
      })
      const was = faders.current.find((f) => f.root === o)
      list.push({ root: o, hit, drawn, k: was?.k ?? 1, want: 1, own: was?.own ?? new Map() })
    })
    faders.current = list
  }

  const setOpacity = (f: Fader, k: number) => {
    for (const m of f.drawn) {
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      const next = mats.map((mat) => {
        let c = f.own.get(mat)
        if (!c) {
          // (its own copy, remembering how it was, so the original stays as it is for everything else)
          c = mat.clone()
          c.userData.base = { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite }
          f.own.set(mat, c)
          f.own.set(c, c)
        }
        const base = c.userData.base as { opacity: number; transparent: boolean; depthWrite: boolean }
        const faded = k < 0.999
        c.transparent = faded || base.transparent
        c.depthWrite = faded ? false : base.depthWrite
        c.opacity = base.opacity * k
        return c
      })
      m.material = Array.isArray(m.material) ? next : next[0]
    }
  }

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime
    if (now - seen.current > 1.5) { seen.current = now; gather() }
    const aim = target()
    if (!aim) return
    // (the rays every few frames; the fading every frame)
    if (++tick.current % 3 === 0) {
      const far = camera.position.distanceTo(aim) * 0.97
      const hits = new Set<Fader>()
      // (round where the target is on the screen, which needn't be its middle: the view is shifted to frame the stage)
      const c = aim.clone().project(camera)
      for (const [x, y] of AIM) {
        ray.current.setFromCamera(new THREE.Vector2(c.x + x, c.y + y), camera)
        ray.current.far = far
        for (const f of faders.current) {
          if (hits.has(f)) continue
          if (ray.current.intersectObjects(f.hit, false).length) hits.add(f)
        }
      }
      for (const f of faders.current) f.want = hits.has(f) ? FADED : 1
    }
    for (const f of faders.current) {
      if (Math.abs(f.k - f.want) < 0.002) continue
      f.k += (f.want - f.k) * Math.min(1, dt * 8)
      if (Math.abs(f.k - f.want) < 0.01) f.k = f.want
      setOpacity(f, f.k)
    }
  })
  return null
}
