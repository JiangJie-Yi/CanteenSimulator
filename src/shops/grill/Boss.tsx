import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { airbrush, gradientMap } from '@/scene/Person3D'

/**
 * The owner (blender/boss.py): round as an Overcooked cook, in his headband, samue and apron, standing at his grill while the shop's shut.
 * Drawn in the people's soft paint (the same five-tone light and airbrush); he breathes, sways a little, waves now and then with his
 * raised hand, and blinks.
 */
const URL = import.meta.env.BASE_URL + 'models/boss.glb'
/** the small parts: no ink line round them */
const UNINKED = /(Eye|Shine|Brow|Cheek|Moustache|Mouth|Tongue|Print|Collar|Knot|BandEnd|Cord|Nose|Thumb)/
let made: THREE.Object3D | null = null

export function Boss() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const root = useMemo(() => {
    if (!made) {
      const r = gltf.scene.clone(true)
      const mats = new Map<THREE.Material, THREE.Material>()
      r.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        const src = m.material as THREE.MeshStandardMaterial
        let t = mats.get(src)
        if (!t) {
          t = /White|Dark/.test(src.name)
            ? new THREE.MeshBasicMaterial({ color: src.color.clone() })
            : airbrush(new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, gradientMap }))
          mats.set(src, t)
        }
        m.material = t
        m.castShadow = !UNINKED.test(m.name)
        m.receiveShadow = true
      })
      inkModel(r, (m) => UNINKED.test(m.name), { width: 0.006, weld: true })
      made = r
    }
    return made
  }, [gltf])
  const body = useRef<THREE.Group>(null)
  const parts = useMemo(() => ({
    handR: root.getObjectByName('BossHandR'),
    handL: root.getObjectByName('BossHandL'),
    eyes: ['BossEye-1', 'BossEye1', 'BossEyeShine-1', 'BossEyeShine1'].map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[],
  }), [root])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const b = body.current
    if (b) {
      // (breathing, and a slow easy sway from foot to foot)
      b.scale.set(1 - Math.sin(t * 1.6) * 0.006, 1 + Math.sin(t * 1.6) * 0.012, 1)
      b.rotation.z = Math.sin(t * 0.7) * 0.03
      b.rotation.y = Math.sin(t * 0.33) * 0.12
    }
    // (every few seconds a wave: the raised hand rocks to and fro; the other bobs at his side)
    const wave = Math.max(0, Math.sin(t * 0.5)) ** 4
    if (parts.handR) { parts.handR.position.x = Math.sin(t * 9) * 0.03 * wave; parts.handR.position.y = 0.01 * Math.sin(t * 1.6) }
    if (parts.handL) parts.handL.position.y = 0.012 * Math.sin(t * 1.6 + 1)
    // (a blink every few seconds)
    const blink = (t % 4.3) < 0.12 ? 0.1 : 1
    for (const e of parts.eyes) { const sy = (e.userData.sy ??= e.scale.y) as number; e.scale.y = sy * blink }
  })
  return <group ref={body}><primitive object={root} /></group>
}
useGLTF.preload(URL)
