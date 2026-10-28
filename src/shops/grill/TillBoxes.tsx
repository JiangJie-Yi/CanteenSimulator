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
 * The till counter's low shelf, from blender/tillboxes.py: cardboard boxes of supplies (paper bags, napkins, till rolls, coasters, chopsticks), each
 * its own board and tape, and on the biggest the register's
 * operating manual, which opens when it's clicked. In the till's own frame.
 */
const URL = import.meta.env.BASE_URL + 'models/tillboxes.glb'
/** the parts too small or too flat for an ink line: the printing, the tape, the cover's band and drawing */
const UNINKED = /(Label|Sub|Up|Seam|Tape|Band|Title|Foot|Pic|Staple|Stamp)/

/** the model, cut into its three pieces once: each box (and its tape and printing) and the manual, so each can be moved on its own */
export const BOXES = ['bags', 'napkins', 'rolls', 'coasters', 'chopsticks'] as const
export type TillPart = (typeof BOXES)[number] | 'manual'
let pieces: Record<TillPart, THREE.Object3D> | null = null
function piecesOf(gltf: { scene: THREE.Group }) {
  if (pieces) return pieces
  const { boxes, manual } = (() => {
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
  })()
  const out = { manual } as Record<TillPart, THREE.Object3D>
  for (const k of BOXES) out[k] = new THREE.Group()
  // (each box with everything on it: its name, TillBox<Name>, starts every part of it)
  for (const o of [...boxes.children]) {
    const k = BOXES.find((b) => o.name.startsWith('TillBox' + b[0].toUpperCase() + b.slice(1)))
    if (k) out[k].add(o)
  }
  pieces = out
  return pieces
}

/** one piece of the shelf's things: a box, or the manual (which opens when it's clicked) */
export function TillBoxes({ part, lang }: { part: TillPart; lang: Lang }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => piecesOf(gltf)[part], [gltf, part])
  if (part !== 'manual') return <StaticBatch><primitive object={obj} /></StaticBatch>
  const tip = lang === 'ja' ? tipOver('レジスター取扱説明書', 'クリックで読む') : tipOver('收銀機操作說明書', '點一下翻閱')
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group {...tip} onClick={(e) => { e.stopPropagation(); if (!getEdit().on) openRegisterManual() }}>
      <primitive object={obj} />
    </group>
  )
}
useGLTF.preload(URL)
