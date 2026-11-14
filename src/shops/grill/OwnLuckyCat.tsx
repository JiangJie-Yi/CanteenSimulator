import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'

/**
 * The shop's own beckoning cat (blender/ownluckycat.py, item 97, the owner's, 2026-11-14: "a lucky cat of your own, and it should move",
 * "on the first step"): 0.30 tall as made, facing +z, its foot's middle at its origin; toon-shaded and inked as the room's things are. All of
 * it one batch by material but its raised paw, which beckons: swung about its shoulder, forward toward whoever's in front of it and back up,
 * a beat of a second and a half with a little rest at the top.
 */
const URL = import.meta.env.BASE_URL + 'models/ownluckycat.glb'
useGLTF.preload(URL)
const X = new THREE.Vector3(1, 0, 0)
export function OwnLuckyCat() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { obj, paw } = useMemo(() => {
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
          ? new THREE.MeshToonMaterial({ color: src.color.clone().multiplyScalar(1.15), emissive: '#3a2a08', side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    // (not round the beckoning hand: its outline and the body's met in a dark line where it's cut from the arm (item 128))
    inkModel(r, (m) => m.name === 'OwnCatPaw', { width: 0.0016, weld: true })
    const paw = r.getObjectByName('OwnCatPaw') ?? null
    // (a touch bigger than the cut it came from, so the arm's cut face is under it)
    paw?.scale.setScalar(1.04)
    mergeByMaterial(r, (o) => o.name === 'OwnCatPaw')
    return { obj: r, paw }
  }, [gltf])
  const t = useRef(Math.random() * 3)
  useFrame((_, dt) => {
    if (!paw) return
    t.current += Math.min(dt, 0.1)
    // (down toward the front and back up: an eased swing, held a moment at the top)
    const ph = (t.current % 1.5) / 1.5
    const k = ph < 0.7 ? Math.sin((ph / 0.7) * Math.PI) : 0
    // (a small beckon (item 128): swung far, the cut where the hand meets the arm opened)
    paw.quaternion.setFromAxisAngle(X, 0.4 * k * k * (3 - 2 * k))
  })
  return <primitive object={obj} />
}
