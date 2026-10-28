import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The bar stool and the potted bamboo from blender/barfurnish.py: drawn in the room's toon light, with the room's ink line round them;
 * the stool's brass caps and the pot's glaze keep a little gloss.
 */
const STOOL_URL = import.meta.env.BASE_URL + 'models/stool.glb'
const BAMBOO_URL = import.meta.env.BASE_URL + 'models/bamboopot.glb'
const GLOSSY = new Set(['StoolBrass', 'PotGlaze'])
/** parts too thin or small for an ink line */
const UNINKED = /(Piping|Button|Leaves|Pebble|Moss|Node|Branch|Rail)/

const made = new Map<string, THREE.Object3D>()
function toonOf(url: string, scene: THREE.Group) {
  const hit = made.get(url)
  if (hit) return hit.clone(true)
  const root = scene.clone(true)
  const mats = new Map<THREE.Material, THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = mats.get(src)
    if (!t) {
      t = GLOSSY.has(src.name)
        ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, metalness: src.metalness, roughness: Math.max(0.2, src.roughness), clearcoat: 0.5 })
        : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, side: /Leaves/.test(m.name) ? THREE.DoubleSide : THREE.FrontSide })
      mats.set(src, t)
    }
    m.material = t
    m.castShadow = !UNINKED.test(m.name)
    m.receiveShadow = true
  })
  inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
  made.set(url, root)
  return root.clone(true)
}

export function StoolModel() {
  const gltf = useGLTF(STOOL_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => toonOf(STOOL_URL, gltf.scene), [gltf])
  return <primitive object={obj} />
}
export function BambooModel() {
  const gltf = useGLTF(BAMBOO_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => toonOf(BAMBOO_URL, gltf.scene), [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(STOOL_URL)
useGLTF.preload(BAMBOO_URL)
