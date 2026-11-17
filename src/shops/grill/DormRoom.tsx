import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { setTip } from '@/scene/hoverTip'
import { getEdit } from './edit'

/**
 * The staff room upstairs (二樓員工休息室兼宿舍, blender/dorm.py; item 325, the owner's, 2026-11-18: 「然後捏個2F小房間，會切換場景，可以上樓
 * 去」): six mats over the shop, up the stair behind the staff door: a low table with tea and mandarins, cushions, the futons folded in the
 * corner, a paper lamp, a tansu, the store room's fusuma, a shoji window. A scene of its own, set well off from the shop (out of every view of
 * it, so it costs nothing while they're looked at), in the dining room's scale (its metres twice the world's units); the view 二樓 looks at
 * it. Its things in the room's toon light and line; its lamp a warm glow of its own; drawn by material, a few draws. The stair coming up
 * through its floor, clicked, goes back down (a request the app's views take, `jgs-view`).
 */
const DORM_URL = import.meta.env.BASE_URL + 'models/dorm.glb'
useGLTF.preload(DORM_URL)
/** where it stands in the world: off to the side of the shop, on its floor's level (the dining room's floor, the staff door's foot) */
export const DORM_AT = new THREE.Vector3(60, -1.16, -1.69)
const DORM_SCALE = 2
/** the stair's well in the room's frame (blender/dorm.py: the front right, 0.9 by 1.23), to be clicked */
const STAIR = { x: 1.8 - 0.5, z: 1.35 - 0.635, w: 0.9, d: 1.23 }

/** asks the app's views for one (the stair up behind the staff door, the stair down here) */
export const askView = (id: string) => window.dispatchEvent(new CustomEvent('jgs-view', { detail: id }))

export function DormRoom() {
  const gltf = useGLTF(DORM_URL) as unknown as { scene: THREE.Group }
  const { root, look } = useMemo(() => {
    const r = (gltf.scene.getObjectByName('DormRoot') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    const made = new Map<THREE.Material, THREE.Material>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = made.get(src)
      if (!t) {
        // (the lamp's shade a warm glow of its own; the rest the room's toon, a little of the lamp's warmth on it (it's off the shop's lamps
        // and its shadows: by night it went near black))
        t = src.name === 'DormLampShade' ? new THREE.MeshBasicMaterial({ color: '#ffe6b8' })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null, emissive: new THREE.Color('#2a1f14'), emissiveIntensity: 1 })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = src.name !== 'DormLampShade'
      m.receiveShadow = true
    })
    // (the room's line, in its own metres: the dining room's 0.0016 a metre)
    inkModel(r, (m) => (m.material as THREE.Material).name === 'DormLampShade', { width: 0.0016, weld: true })
    mergeByMaterial(r)
    const lk = r.getObjectByName('DormLook')
    return { root: r, look: lk ? lk.position.clone() : new THREE.Vector3(0.15, 0.6, 0.1) }
  }, [gltf])
  return (
    <group position={DORM_AT} scale={DORM_SCALE}>
      <primitive object={root} />
      {/* (what the view 二樓 looks at: over the table; its +z the room's open front, which the view faces) */}
      <group name="look-dorm" position={look} />
      {/* (the stair's well: pointed at, it says where it goes; clicked, down to the shop) */}
      <mesh position={[STAIR.x, 0.08, STAIR.z]} visible={false}
        onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; setTip(null); askView('back') }}
        onPointerOver={(e) => { e.stopPropagation(); if (getEdit().on) return; document.body.style.cursor = 'pointer'; setTip({ title: '樓梯', hint: '點一下下樓，回到店裡' }) }}
        onPointerOut={() => { document.body.style.cursor = ''; setTip(null) }}>
        <boxGeometry args={[STAIR.w, 0.16, STAIR.d]} />
      </mesh>
    </group>
  )
}
