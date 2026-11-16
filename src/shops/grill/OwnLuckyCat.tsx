import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'

/**
 * The shop's own beckoning cat (blender/ownluckycat.py, item 97, the owner's, 2026-11-14: "a lucky cat of your own"): 0.30 tall as made,
 * facing +z, its foot's middle at its origin; toon-shaded and inked as the room's things are, all of it one batch by material. Its raised paw
 * stays still (item 223, the owner's, 2026-11-16: 「你手別動好了，會不會比較好看」: it beckoned by a morph target before, items 97 and 163).
 */
const URL = import.meta.env.BASE_URL + 'models/ownluckycat.glb'
useGLTF.preload(URL)
export function OwnLuckyCat() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = (gltf.scene.getObjectByName('OwnLuckyCat') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
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
    })
    inkModel(r, () => false, { width: 0.0016, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return <primitive object={obj} />
}
