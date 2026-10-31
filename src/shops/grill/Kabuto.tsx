import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { setTip } from '@/scene/hoverTip'
import { getEdit } from './edit'

const URL = import.meta.env.BASE_URL + 'models/kabuto.glb'

/**
 * A samurai helmet (兜) on its black lacquer stand (blender/kabuto.py), set out as a decoration: its lacquer and gold catch the light, the lacing
 * stays matt. Pointed at, it's named; nothing to click.
 */
export function Kabuto() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    const r = gltf.scene.clone(true)
    // (one finish for each of the model's materials, shared by all its parts, so they can be merged)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        t = src.name === 'KabutoGold'
          ? new THREE.MeshStandardMaterial({ color: '#e0b247', metalness: 1, roughness: 0.28 })
          : src.name === 'KabutoLacquer'
            ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 })
            : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    inkModel(r, (m) => /Rivet|Tehen|Hem|Sun/.test(m.name), { width: 0.0012, weld: true })
    // (nothing on it moves: its parts drawn a few at a time)
    mergeByMaterial(r)
    return r
  }, [gltf])
  return (
    <group onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip({ title: '武士頭盔（兜）', hint: '鍬形與吹返，裝飾用' }) }}
      onPointerOut={() => setTip(null)}>
      <primitive object={root} />
    </group>
  )
}
useGLTF.preload(URL)
