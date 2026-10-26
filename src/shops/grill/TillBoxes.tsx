import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { StaticBatch } from '@/scene/StaticBatch'
import type { Lang } from '@/data/i18n'
import { openRegisterManual } from '@/ui/RegisterManual'
import { tipOver } from './bar'
import { getEdit } from './edit'

/**
 * The till counter's low shelf, from blender/tillboxes.py: two cardboard boxes (paper bags, till rolls) and on the bigger one the register's
 * operating manual, which opens when it's clicked. In the till's own frame.
 */
const URL = import.meta.env.BASE_URL + 'models/tillboxes.glb'
/** the parts too small or too flat for an ink line: the printing, the tape, the cover's band and drawing */
const UNINKED = /(Label|Sub|Up|Seam|Tape|Band|Title|Foot|Pic|Staple)/

export function TillBoxes({ lang }: { lang: Lang }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const { boxes, manual } = useMemo(() => {
    const root = gltf.scene.clone(true)
    const toon = new Map<THREE.Material, THREE.Material>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const src = m.material as THREE.MeshStandardMaterial
      let t = toon.get(src)
      if (!t) {
        t = new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
        toon.set(src, t)
      }
      m.material = t
      m.castShadow = !UNINKED.test(m.name)
      m.receiveShadow = true
    })
    inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0018, weld: true })
    // (the manual comes away from the boxes: it's handled on its own, the boxes are batched)
    const manual = root.getObjectByName('TillManual')!
    manual.removeFromParent()
    return { boxes: root, manual }
  }, [gltf])
  const tip = lang === 'ja' ? tipOver('レジスター取扱説明書', 'クリックで読む') : tipOver('收銀機操作說明書', '點一下翻閱')
  return (
    <>
      <StaticBatch><primitive object={boxes} /></StaticBatch>
      {/* (handlers on a group round it: a primitive's own aren't attached) */}
      <group {...tip} onClick={(e) => { e.stopPropagation(); if (!getEdit().on) openRegisterManual() }}>
        <primitive object={manual} />
      </group>
    </>
  )
}
useGLTF.preload(URL)
