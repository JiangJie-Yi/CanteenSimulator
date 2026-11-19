import { memo, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'

/**
 * The kitchen's serving counter (配膳台, blender/servecounter.py; item 167, the owner's, 2026-11-15): on the kitchen's floor between the cook
 * table and the freezer, where the owner drew the red box; the takeaways' boxes packed and waiting on it (they stood in a plate at the cook
 * table's plating place, its second slot). In the bar's units, its foot's middle at its origin, its front toward +z; toon-shaded and inked as the
 * room's things are; its marks (ServeCounterTop, ServeCounterFront) kept for GuestBar3D to find where its top and its front are.
 */
const URL = import.meta.env.BASE_URL + 'models/servecounter.glb'
useGLTF.preload(URL)
// (item 374: drawn again only when its own props change, not each time what holds it is drawn)
export const ServeCounter = memo(ServeCounterImpl)
function ServeCounterImpl() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = gltf.scene.clone(true)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) { t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null }); t.name = src.name; made.set(src, t) }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    // (the kitchen's counters' line (0.0016 in the room's units), in the bar's, which are twice the size)
    inkModel(r, () => false, { width: 0.0008, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return <primitive object={obj} />
}
