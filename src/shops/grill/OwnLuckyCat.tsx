import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'

/**
 * The shop's own beckoning cat (blender/ownluckycat.py, item 97, the owner's, 2026-11-14: "a lucky cat of your own, and it should move",
 * "on the first step"): 0.30 tall as made, facing +z, its foot's middle at its origin; toon-shaded and inked as the room's things are. Its
 * raised arm beckons by bending (item 163, the owner's, 2026-11-15: "the cat's hand is simply cut off"): the cat one mesh with a morph target
 * that tips the arm forward about its foot, the fur round it stretching with it, eased in and out, a beat of a second and a half with a little
 * rest at the top; its ink line bends with it (inkHull). Everything else of it one batch by material.
 */
const URL = import.meta.env.BASE_URL + 'models/ownluckycat.glb'
useGLTF.preload(URL)
export function OwnLuckyCat() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { obj, body } = useMemo(() => {
    const r = (gltf.scene.getObjectByName('OwnLuckyCat') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    let body: THREE.Mesh | null = null
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the bell and the koban a gold that catches the light; the rest toon)
        t = /Gold/.test(src.name)
          // (both sides: a face of the koban's laddered front came out turned in, a hole in it)
          // (the bell's picture kept: its band and its slit are drawn on it (the owner's, 2026-11-15))
          ? new THREE.MeshToonMaterial({ color: src.color.clone().multiplyScalar(1.15), map: src.map ?? null, emissive: '#3a2a08', side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
      // (the body: the one with the arm's bend in it)
      if (!body && m.morphTargetInfluences?.length) body = m
    })
    inkModel(r, () => false, { width: 0.0016, weld: true })
    // (the body bends: drawn on its own (its line with it), the rest merged)
    mergeByMaterial(r, (o) => o === body)
    return { obj: r, body: body as THREE.Mesh | null }
  }, [gltf])
  const t = useRef(Math.random() * 3)
  useFrame((_, dt) => {
    const w = body?.morphTargetInfluences
    if (!w) return
    t.current += Math.min(dt, 0.1)
    // (down toward the front and back up: an eased swing, held a moment at the top)
    const ph = (t.current % 1.5) / 1.5
    const k = ph < 0.7 ? Math.sin((ph / 0.7) * Math.PI) : 0
    w[0] = k * k * (3 - 2 * k)
  })
  return <primitive object={obj} />
}
