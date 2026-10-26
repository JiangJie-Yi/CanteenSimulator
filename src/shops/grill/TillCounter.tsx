import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The till counter, from blender/tillcounter.py, in the till's own frame (built for a top at TILL_TOP; another height stretches the body to
 * it): the dark wooden body with green bamboo up the customers' face and a round lit window with its halo, a polished white marble top, and
 * the low solid hinoki partition along the customers' side and the end by the cats.
 */
const URL = import.meta.env.BASE_URL + 'models/tillcounter.glb'
export const TILL_TOP = 0.86
const UNINKED = /^(TillWindowPaper|TillWindowGlow|TillLattice|TillBambooNode|TillRope)/

function finishOf(src: THREE.MeshStandardMaterial): THREE.Material {
  switch (src.name) {
    case 'TillMarble':
      // (polished marble: the lamps glint in it)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 })
    case 'TillBamboo':
      // (green bamboo's waxy skin: a soft sheen)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3 })
    case 'TillWindowPaper':
      return new THREE.MeshBasicMaterial({ color: '#ffe2a8', toneMapped: false })
    case 'TillWindowGlow':
      // (the window's halo: its black edges add nothing, its warm middle brightens whatever is behind; drawn over the end without a depth test
      // (the end's own faces hid half of it), its front only, so it's seen only from outside the end)
      return new THREE.MeshBasicMaterial({ map: src.map, color: new THREE.Color(2.2, 1.9, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false })
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
      if (src.name === 'TillWindowGlow') { m.renderOrder = 3; m.castShadow = false; m.receiveShadow = false }
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
