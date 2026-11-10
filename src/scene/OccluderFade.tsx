import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { warmLater } from './Prewarm'

/**
 * Hangings that get in the way fade: a group marked `userData.fade` (the noren, the lanterns at the door, the lamps) that stands
 * between the camera and what it's looking at (the orbit's target, and a little round it) turns see-through, and comes back once it's out of the
 * way. Rays are cast at the group's own meshes (a batch's hidden originals included, since its merged copy can't be hit); what's drawn
 * (the merged copy, the ink lines) is what fades, each mesh on its own copy of its material so nothing else that shares it fades too. The
 * copy follows its original while it's faded (a lamp's shade going dark with the wall switch), and once the hanging's whole again it's back
 * on its original (before, it kept the copy for good, and with it the colour it had then: a lamp once faded stayed lit with the lights off).
 */
const FADED = 0.18
/** the rays: a grid round where what's looked at is on the screen (in the screen's -1..1, about a third of it across) */
const AIM: [number, number][] = [-0.3, -0.15, 0, 0.15, 0.3].flatMap((x) => [-0.3, -0.15, 0, 0.15, 0.3].map((y) => [x, y] as [number, number]))

type Fader = { root: THREE.Object3D; hit: THREE.Mesh[]; drawn: THREE.Mesh[]; ink: THREE.Mesh[]; low: number; k: number; want: number; own: Map<THREE.Material, THREE.Material> }

/** a hanging's own see-through copy of one of its materials, made once: remembering how it was, so the original stays as it is for everything else */
function ownCopy(own: Map<THREE.Material, THREE.Material>, mat: THREE.Material) {
  let c = own.get(mat)
  if (!c) {
    c = mat.clone()
    c.userData.base = { opacity: mat.opacity }
    // (still the solid thing it was, to the edit mode's pointer (scene/pickable), see-through as it's made)
    c.userData.fadeCopy = true
    c.transparent = true
    c.depthWrite = false
    own.set(mat, c)
  }
  return c
}

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
      const hit: THREE.Mesh[] = [], drawn: THREE.Mesh[] = [], ink: THREE.Mesh[] = []
      o.traverse((m) => {
        const mesh = m as THREE.Mesh
        if (!mesh.isMesh || mesh.userData.glow) return
        // (its ink line, drawn on its own back faces: not faded but put away while it's faded (the owner's: a faded lamp went a dark ball,
        // its black hull showing through its see-through shade))
        const mats = ([] as THREE.Material[]).concat(mesh.material)
        if (mesh.name.endsWith('_outline') || mats.every((x) => x.side === THREE.BackSide)) { ink.push(mesh); return }
        drawn.push(mesh)
        hit.push(mesh)
      })
      const was = faders.current.find((f) => f.root === o)
      // (how far it fades: a number on the mark, or FADED; a lit lamp keeps more of itself, or it goes dark against the wall behind)
      const low = typeof o.userData.fade === 'number' ? o.userData.fade : FADED
      const own = was?.own ?? new Map<THREE.Material, THREE.Material>()
      // (its see-through copies made now, and compiled with the rest at load (Prewarm): made the first time it faded, their programs were
      // compiled then, a hitch of 80 to 150 ms on turning to the grill, where a lamp hangs between the camera and the fire)
      for (const mesh of drawn) {
        for (const mat of ([] as THREE.Material[]).concat(mesh.material)) {
          if (own.has(mat) || mesh.userData.fadeOrig) continue
          warmLater(new THREE.Mesh(mesh.geometry, ownCopy(own, mat)))
        }
      }
      list.push({ root: o, hit, drawn, ink, low, k: was?.k ?? 1, want: 1, own })
    })
    faders.current = list
  }

  const setOpacity = (f: Fader, k: number) => {
    const faded = k < 0.999
    for (const m of f.ink) m.visible = !faded
    for (const m of f.drawn) {
      const orig = m.userData.fadeOrig as THREE.Material | THREE.Material[] | undefined
      // (whole again: back on its own material, which everything that changes it (the wall switch) changes for it as well)
      if (!faded) {
        if (orig) {
          m.material = orig
          delete m.userData.fadeOrig
        }
        continue
      }
      if (!orig) m.userData.fadeOrig = m.material
      const src = m.userData.fadeOrig as THREE.Material | THREE.Material[]
      const next = (Array.isArray(src) ? src : [src]).map((mat) => {
        const c = ownCopy(f.own, mat)
        // (as its original is now: a lamp's shade lit or dark, its picture)
        const from = mat as THREE.MeshBasicMaterial & { emissive?: THREE.Color }, to = c as THREE.MeshBasicMaterial & { emissive?: THREE.Color }
        if (from.color && to.color) to.color.copy(from.color)
        if (from.emissive && to.emissive) to.emissive.copy(from.emissive)
        if ('map' in from) to.map = from.map
        c.transparent = true
        c.depthWrite = false
        c.opacity = (c.userData.base as { opacity: number }).opacity * k
        return c
      })
      m.material = Array.isArray(src) ? next : next[0]
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
      for (const f of faders.current) f.want = hits.has(f) ? f.low : 1
    }
    for (const f of faders.current) {
      if (Math.abs(f.k - f.want) >= 0.002) {
        f.k += (f.want - f.k) * Math.min(1, dt * 8)
        if (Math.abs(f.k - f.want) < 0.01) f.k = f.want
      } else if (f.k >= 0.999 && !f.drawn.some((m) => m.userData.fadeOrig)) continue
      // (faded, it's kept in step with its originals every frame: they can change under it)
      setOpacity(f, f.k)
    }
  })
  return null
}
