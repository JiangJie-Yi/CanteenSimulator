import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The till counter, from blender/tillcounter.py, in the till's own frame (built for a top at TILL_TOP; another height stretches the body to
 * it): the dark wooden body with loose green bamboo up the customers' face (a warm light behind it showing through) and a round window lit
 * from within like a paper lantern, a polished white marble top, and the walnut shoji partition (washi in a sparse lattice) along the customers' side and down the end.
 */
const URL = import.meta.env.BASE_URL + 'models/tillcounter.glb'
export const TILL_TOP = 0.86
const UNINKED = /^(TillWindowPaper|TillWindowSleeve|TillBambooGlow|TillLattice|TillRope|TillPaper|TillBar|TillShoe)|Node\d/

/** the bamboo's shades, culm to culm: a fresh green, a yellower one, a deeper one… (laid over the one skin) */
const BAMBOO_SHADES = ['#ffffff', '#f2f5c8', '#d6e6b4', '#fff2bf', '#c4d6a8']

function finishOf(src: THREE.MeshStandardMaterial): THREE.Material {
  const shade = /^TillBamboo(\d)$/.exec(src.name)
  if (shade) return new THREE.MeshPhysicalMaterial({ map: src.map, color: BAMBOO_SHADES[+shade[1]], roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3 })
  switch (src.name) {
    case 'TillMarble':
      // (polished marble: the lamps glint in it)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 })
    case 'TillBamboo':
      // (green bamboo's waxy skin: a soft sheen)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3 })
    case 'TillWindowPaper':
      // (the window's paper, lit from within like a lantern: brightest where the lamp is, its fibres showing)
      return new THREE.MeshBasicMaterial({ map: src.map, color: new THREE.Color(1.25, 1.15, 1.05), toneMapped: false })
    case 'TillBambooGlow':
      // (the warm light behind the bamboo, showing between the culms)
      return new THREE.MeshBasicMaterial({ map: src.map, color: new THREE.Color(1.1, 1.05, 1), toneMapped: false })
    case 'TillShieldWalnut':
      // (oiled walnut: a soft sheen)
      return new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 })
    case 'TillShieldShoe':
      return new THREE.MeshPhysicalMaterial({ color: src.color.clone(), metalness: 0.7, roughness: 0.35 })
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
      if (src.name === 'TillWindowPaper' || src.name === 'TillBambooGlow') { m.castShadow = false; m.receiveShadow = false }
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
