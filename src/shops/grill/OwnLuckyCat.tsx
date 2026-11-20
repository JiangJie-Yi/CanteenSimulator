import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { inkModel } from '@/scene/inkHull'
import { BAKE_COATS, coatPicture, SUZU_MAT, suzuAt, thicken } from './catCoat'

/**
 * The shop's own beckoning cat (blender/ownluckycat.py, item 97, the owner's, 2026-11-14: "a lucky cat of your own"): 0.30 tall as made,
 * facing +z, its foot's middle at its origin; toon-shaded and inked as the room's things are, all of it one batch by material. Its raised paw
 * stays still (item 223, the owner's, 2026-11-16: 「你手別動好了，會不會比較好看」: it beckoned by a morph target before, items 97 and 163).
 */
const URL = import.meta.env.BASE_URL + 'models/ownluckycat.glb'
useGLTF.preload(URL)
export function OwnLuckyCat() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
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
          // (the bell's picture kept: its band and its slit are drawn on it (the owner's, 2026-11-15))
          ? new THREE.MeshToonMaterial({ color: src.color.clone().multiplyScalar(1.15), map: src.map ?? null, emissive: '#3a2a08', side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
        t.name = src.name
        made.set(src, t)
      }
      m.material = t
      m.castShadow = true
      m.receiveShadow = true
    })
    // (items 429, 432, the owner's 「鈴鐺須做好，增加一些米克斯斑紋，硬幣加厚」「這招財貓的金幣背後有點怪」: its bell (a ball, its band and slit only
    // drawn) put away for the made one, a little bigger round where it was; its koban half as thick again, both its sides drawn (a face of its
    // back came out turned in, and seen from the side the dark through it); its coat a grey tabby's over its back and crown)
    r.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(r.matrixWorld).invert()
    const local = (m: THREE.Mesh) => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    const bell = r.getObjectByName('OwnCatBell') as THREE.Mesh | undefined
    if (bell?.isMesh) {
      const g = local(bell)
      g.computeBoundingBox()
      const bb = g.boundingBox!, sz = bb.getSize(new THREE.Vector3())
      g.dispose()
      bell.removeFromParent()
      const made = new THREE.Mesh(suzuAt(bb.getCenter(new THREE.Vector3()), (Math.max(sz.x, sz.y, sz.z) / 2) * 1.12), SUZU_MAT)
      made.name = 'OwnCatSuzu'
      made.castShadow = true
      r.add(made)
    }
    const koban = r.getObjectByName('OwnCatKoban') as THREE.Mesh | undefined
    if (koban?.isMesh) {
      koban.geometry = thicken(koban.geometry.clone(), 1.5)
      const km = (koban.material as THREE.MeshToonMaterial).clone()
      km.side = THREE.DoubleSide
      koban.material = km
    }
    const body = r.getObjectByName('OwnCatBody') as THREE.Mesh | undefined
    const bm = body?.material as THREE.MeshToonMaterial | undefined
    // (its coat in its model's picture (scripts/bake-cat-coats.mjs); worked out here only for that script)
    if (BAKE_COATS && body?.isMesh && bm?.map) {
      const g = local(body)
      g.computeBoundingBox()
      bm.map = coatPicture(bm.map, [g], g.boundingBox!, 'grey')
      g.dispose()
    }
    inkModel(r, () => false, { width: 0.0016, weld: true })
    mergeByMaterial(r)
    return r
  }, [gltf])
  return <primitive object={obj} />
}
