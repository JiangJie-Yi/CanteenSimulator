import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The till's order tablet on its stand, from blender/ipad.py, in the frame the till had it (the stand's middle at the origin, the screen
 * toward +z): the model's materials made toon, its screen showing `screen` unlit, an ink line round the body and the stand.
 */
const IPAD_URL = import.meta.env.BASE_URL + 'models/ipad.glb'
/** the parts too small or too flat for an ink line */
const UNINKED = /^Ipad(Screen|Glass|FrontCam|Grille|Port|Connector|BackLens|Flash|TopButton|Volume|StandFoot|StandLedgePad)/

export function IpadModel({ screen }: { screen: THREE.Texture | null }) {
  const gltf = useGLTF(IPAD_URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    const r = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (m.name === 'IpadScreen') {
        // (the order screen, as bright as it is: glTF's UVs run top to bottom, the canvas's bottom to top)
        const g = m.geometry.clone()
        const uv = g.attributes.uv
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
        m.geometry = g
        m.material = new THREE.MeshBasicMaterial({ map: screen, toneMapped: false })
        return
      }
      const src = m.material as THREE.MeshStandardMaterial
      let t = toon.get(src)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
        toon.set(src, t)
      }
      m.material = t
      m.castShadow = !UNINKED.test(m.name)
    })
    inkModel(r, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
    return r
  }, [gltf, screen])
  return <primitive object={root} />
}
useGLTF.preload(IPAD_URL)
