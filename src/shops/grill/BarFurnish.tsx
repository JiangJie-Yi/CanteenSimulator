import { useMemo } from 'react'
import { reflectStudio } from '@/scene/studio'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'

/**
 * The bar stool (blender/stools.py), the till's two seats (blender/tillstools.py) and the potted bamboo (blender/barfurnish.py): drawn in the room's toon light, with
 * the room's ink line round them; the pot's glaze keeps a little gloss.
 */
const STOOL_URL = import.meta.env.BASE_URL + 'models/stool.glb'
const TILLSTOOL_URL = import.meta.env.BASE_URL + 'models/tillstool.glb'
const BAMBOO_URL = import.meta.env.BASE_URL + 'models/bamboopot.glb'
const TOILET_URL = import.meta.env.BASE_URL + 'models/toilet.glb'
const WASH_URL = import.meta.env.BASE_URL + 'models/washstand.glb'
const GLOSSY = new Set(['StoolBrass', 'PotGlaze', 'WcChina', 'WcIvory', 'WcChrome', 'WcWater', 'WashBrass', 'WashMirror', 'WashBowl', 'WashSoap', 'WashFrame', 'BitWalnut',
  'JetPearl', 'JetSteel', 'JetAcrylic', 'TowelSteel'])
/** a few made as asked (the owner's): the toilet's china a warm ivory, glazed (clear coat, a little rough); its chrome bright metal; the
 * paper holder's walnut with a soft sheen */
const FINISH: Record<string, { color?: string; roughness: number; metalness: number; clearcoat: number }> = {
  WcChina: { color: '#f4f4f0', roughness: 0.15, metalness: 0.05, clearcoat: 0.8 },
  WcChrome: { roughness: 0.2, metalness: 0.9, clearcoat: 0.3 },
  BitWalnut: { roughness: 0.45, metalness: 0, clearcoat: 0.35 },
  // (the hand dryer's pearl white shell, a little metal in it, its acrylic strip glossy black, its grille and the towel box brushed steel
  // (the owner's, 2026-11-10))
  JetPearl: { color: '#f4f3ef', roughness: 0.3, metalness: 0.4, clearcoat: 0.2 },
  JetAcrylic: { color: '#1b1e23', roughness: 0.1, metalness: 0, clearcoat: 0.8 },
  JetSteel: { roughness: 0.35, metalness: 0.85, clearcoat: 0 },
  TowelSteel: { color: '#c9ccd1', roughness: 0.38, metalness: 0.85, clearcoat: 0 },
}
/** parts too thin or small for an ink line */
const UNINKED = /(Piping|Button|WcSeat|Wand|Screen|ArmFace|Leaves|Pebble|Moss|Node|Branch|Rail|Water|Mirror|Spout|Lever|Tap|Handle|Ring|Kumiko|Shoe|FootBrass|Rush|Panel|Slat|Drain|Pump|Pull|Pad\d|Vent|Lamp|Acrylic|Slit|Seam|Window|Slot|Grille)/

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
        // (the washroom's mirror kept a mirror: nearly smooth (the rest a little softened))
        ? new THREE.MeshPhysicalMaterial({ color: src.color.clone(), map: src.map, metalness: src.metalness, roughness: src.name === 'WashMirror' ? 0.04 : Math.max(0.2, src.roughness), clearcoat: 0.5,
          ...(FINISH[src.name] ? { ...FINISH[src.name], color: FINISH[src.name].color ? new THREE.Color(FINISH[src.name].color) : src.color.clone() } : {}) })
        // (the chair back's kumiko: one picture, its gaps cut out by its alpha (tested, not blended), seen from either side)
        : src.name === 'TillKumiko'
          ? new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, alphaTest: 0.5, side: THREE.DoubleSide })
          : new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map, side: /Leaves/.test(m.name) ? THREE.DoubleSide : THREE.FrontSide })
      mats.set(src, t)
    }
    // (chrome real metal, the studio in it: with nothing to reflect it drew black (the cistern's spout, the owner saw))
    // (and the washroom's brass and mirror the same)
    if (/Chrome|^Wash(Brass|Mirror)$|^Jet(Pearl|Steel)$|^TowelSteel$/.test(src.name) && (t as THREE.MeshStandardMaterial).metalness > 0.3) reflectStudio(t as THREE.MeshStandardMaterial)
    m.material = t
    m.castShadow = !UNINKED.test(m.name)
    m.receiveShadow = true
  })
  inkModel(root, (m) => UNINKED.test(m.name), { width: 0.0012, weld: true })
  made.set(url, root)
  return root.clone(true)
}

/** a customer's stool, its cushion blue or (`red`) red (the owner's: the places' cushions in the two, by turns) */
export function StoolModel({ red = false }: { red?: boolean }) {
  const gltf = useGLTF(STOOL_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = toonOf(STOOL_URL, gltf.scene)
    // (the other colour's cushion and button taken off, before the stool's batched)
    const drop: THREE.Object3D[] = []
    r.traverse((o) => { if (/^Stool(Cushion|Button)/.test(o.name) && /Red$/.test(o.name) !== red) drop.push(o) })
    for (const o of drop) o.parent?.remove(o)
    return r
  }, [gltf, red])
  return <primitive object={obj} />
}
/** an unseen box over the bamboo pot, the size of its model (a batch's merged meshes take no pointer): what's said when it's pointed at */
export function BambooHit(props: { onPointerOver: (e: { stopPropagation: () => void }) => void; onPointerOut: () => void }) {
  const gltf = useGLTF(BAMBOO_URL) as unknown as { scene: THREE.Group }
  const box = useMemo(() => new THREE.Box3().setFromObject(gltf.scene), [gltf])
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3())
  return <mesh visible={false} position={mid} {...props}><boxGeometry args={[size.x * 0.8, size.y, size.z * 0.8]} /></mesh>
}
/** one of the till's two seats (blender/tillstools.py): the cashier's walnut chair with its kumiko back (`High`), a helper's stool of the same
 * make (`Low`), each stood at its own origin, facing -z */
export function TillStoolModel({ which }: { which: 'High' | 'Low' }) {
  const gltf = useGLTF(TILLSTOOL_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const one = toonOf(TILLSTOOL_URL, gltf.scene).getObjectByName(`TillStool${which}`)!
    one.position.set(0, 0, 0)
    return one
  }, [gltf, which])
  return <primitive object={obj} />
}
export function BambooModel() {
  const gltf = useGLTF(BAMBOO_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => toonOf(BAMBOO_URL, gltf.scene), [gltf])
  return <primitive object={obj} />
}
/** the toilet and its washlet (blender/wc.py), facing -x */
export { toonOf }
export function ToiletModel() {
  const gltf = useGLTF(TOILET_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => toonOf(TOILET_URL, gltf.scene), [gltf])
  return <primitive object={obj} />
}
/** the hand-wash counter, its back to +x */
export function WashstandModel() {
  const gltf = useGLTF(WASH_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => toonOf(WASH_URL, gltf.scene), [gltf])
  return <primitive object={obj} />
}
useGLTF.preload(TOILET_URL)
useGLTF.preload(WASH_URL)
useGLTF.preload(STOOL_URL)
useGLTF.preload(TILLSTOOL_URL)
useGLTF.preload(BAMBOO_URL)
