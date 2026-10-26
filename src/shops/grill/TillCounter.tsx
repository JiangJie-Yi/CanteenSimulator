import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The till counter, from blender/tillcounter.py, in the till's own frame (built for a top at TILL_TOP; another height stretches the body to
 * it): the dark wooden body with its battens and round lit window, a polished white marble top, and the clear acrylic partition in its hinoki
 * frame along the customers' side and the end by the cats.
 */
const URL = import.meta.env.BASE_URL + 'models/tillcounter.glb'
export const TILL_TOP = 0.86
const UNINKED = /^(TillPane|TillWindowPaper|TillLattice|TillFoot)/

function finishOf(src: THREE.MeshStandardMaterial): THREE.Material {
  switch (src.name) {
    case 'TillMarble':
      // (polished marble: the lamps glint in it)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 })
    case 'TillAcrylic':
      // (clear acrylic: barely there but for its sheen)
      return new THREE.MeshPhysicalMaterial({ color: '#f4fbff', transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })
    case 'TillWindowPaper':
      return new THREE.MeshBasicMaterial({ color: '#f2dcb0', toneMapped: false })
    default:
      return new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
  }
}

let model: THREE.Group | null = null
export function TillCounter({ top }: { top: number }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    if (model) return model
    const r = gltf.scene.clone(true)
    const mats = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = mats.get(src)
      if (!t) { t = finishOf(src); mats.set(src, t) }
      m.material = t
      m.castShadow = !UNINKED.test(m.name)
      m.receiveShadow = true
      if (src.name === 'TillAcrylic') m.renderOrder = 3
    })
    inkModel(r, (m) => UNINKED.test(m.name), { width: 0.003, weld: true })
    model = r
    return r
  }, [gltf])
  // (another height: the body stretched to it, the top and the partition set on it)
  const k = top / TILL_TOP
  return <group scale={[1, k, 1]}><primitive object={root} /></group>
}
useGLTF.preload(URL)
