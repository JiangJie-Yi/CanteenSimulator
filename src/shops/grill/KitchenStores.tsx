// The kitchen's stores: what's kept in the cook's table's two cupboards (blender/cubbystock.py: the soy sauce and mirin, the pickle jar, the
// cloths and the salt box on the right; the binchotan, the skewers, the foil and the lemons on the left; no plates, those are all on the dish
// racks) and the sacks of raw potatoes and sweet potatoes against the kitchen side of the bar (blender/produce.py).
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { reflectStudio, useStudio } from '@/scene/studio'

const STOCK_URL = import.meta.env.BASE_URL + 'models/cubbystock.glb'
const PRODUCE_URL = import.meta.env.BASE_URL + 'models/produce.glb'
/** what's metal: real metal, reflecting the studio */
const METAL = /^Stock(Cap|Iron|Steel|FoilEnd|OilTin)$/
/** what's seen from inside as well as out: the sacks, open at the mouth */
const OPEN = /^ProduceSack/
/** too small or too fine for an ink line (the skewers, their ties, the labels and the marks on things) */
const UNINKED = /Skewer|Label|Mark|Spice\d|SpiceCap|FoilRoll|Lemon\d/

/** a loaded model's part (its node by name), in the room's toon light, inked once and folded together by material (it never moves) */
function partOf(scene: THREE.Group, node: string, width: number) {
  const src = scene.getObjectByName(node)
  if (!src) return new THREE.Group()
  const r = src.clone(true)
  r.position.set(0, 0, 0)
  const mats = new Map<THREE.Material, THREE.Material>()
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const fix = (s: THREE.Material) => {
      let t = mats.get(s)
      if (!t) {
        const sm = s as THREE.MeshStandardMaterial
        if (METAL.test(sm.name)) {
          const g = new THREE.MeshStandardMaterial({ color: sm.color.clone(), metalness: 0.8, roughness: Math.max(0.25, sm.roughness), envMapIntensity: 0.8 })
          reflectStudio(g)
          t = g
        } else t = new THREE.MeshToonMaterial({ color: sm.color.clone(), map: sm.map ?? null, side: OPEN.test(sm.name) ? THREE.DoubleSide : THREE.FrontSide })
        t.name = sm.name
        mats.set(s, t)
      }
      return t
    }
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material)
    m.castShadow = false
    m.receiveShadow = true
  })
  inkModel(r, (m) => UNINKED.test(m.name), { width, weld: true })
  mergeByMaterial(r)
  return r
}

/** what's in one of the cook's table's cupboards ('right' or 'left'), standing on its floor, x along the table, +z toward its doors */
export function CubbyStock({ which }: { which: 'right' | 'left' }) {
  useStudio()
  const gltf = useGLTF(STOCK_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => partOf(gltf.scene, which === 'right' ? 'StockRight' : 'StockLeft', 0.0025), [gltf, which])
  return <primitive object={obj} />
}

/** the sacks of potatoes and sweet potatoes, their backs to the bar, along it */
export function ProduceSacks() {
  const gltf = useGLTF(PRODUCE_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = partOf(gltf.scene, 'ProduceSacks', 0.004)
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    return r
  }, [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(STOCK_URL)
useGLTF.preload(PRODUCE_URL)
