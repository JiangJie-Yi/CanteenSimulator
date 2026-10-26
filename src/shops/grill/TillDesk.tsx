import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The small things on the till's counter, from blender/tilldesk.py: the pen cup, the receipt printer, the card reader, the service bell and
 * the wooden desk mat. Each is its own node, shown wherever its group stands it (its own Movable in GuestBar3D); materials made toon, the bell's
 * dome and the steel bits real metal, an ink line round the bigger parts.
 */
const URL = import.meta.env.BASE_URL + 'models/tilldesk.glb'
export type DeskPiece = 'TillPens' | 'TillPrinter' | 'TillCardReader' | 'TillBell' | 'TillMat'
/** the parts too small or too flat for an ink line: lettering, lights, slots, teeth, keys, cables and holes */
const UNINKED = /(Label|Amount|Prompt|Led|Seam|Slot|Tooth|Vent|Switch|Feed|Lever|Key|Fn|Nfc|Stripe|Screen|Cable|Hole|Clip|Cap|Felt|Band|Floor|Stem|Knob|Slip|Rim|Blades)/
const METAL = new Set(['DeskChrome', 'DeskSteel'])

let pieces: Record<DeskPiece, THREE.Object3D> | null = null
function piecesOf(scene: THREE.Group) {
  if (pieces) return pieces
  const root = scene.clone(true)
  const mats = new Map<THREE.Material, THREE.Material>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = mats.get(src)
    if (!t) {
      t = METAL.has(src.name)
        ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), metalness: 0.9, roughness: src.name === 'DeskChrome' ? 0.12 : 0.3, envMapIntensity: 0.8 })
        : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map })
      mats.set(src, t)
    }
    m.material = t
    m.castShadow = !UNINKED.test(m.name)
    m.receiveShadow = true
  })
  inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
  const get = (n: DeskPiece) => { const o = root.getObjectByName(n)!; o.removeFromParent(); return o }
  pieces = { TillPens: get('TillPens'), TillPrinter: get('TillPrinter'), TillCardReader: get('TillCardReader'), TillBell: get('TillBell'), TillMat: get('TillMat') }
  return pieces
}

export function TillDeskPiece({ name }: { name: DeskPiece }) {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => piecesOf(gltf.scene)[name], [gltf, name])
  return <primitive object={obj} />
}
useGLTF.preload(URL)

/** how thick the desk mat is: what stands on it is raised by this */
export const MAT_T = 0.015
