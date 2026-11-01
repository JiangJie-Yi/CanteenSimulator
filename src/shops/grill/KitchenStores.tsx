// The kitchen's stores: what's kept in the cook's table's two cupboards (blender/cubbystock.py: the soy sauce and mirin, the pickle jar, the
// cloths and the salt box on the right; the binchotan, the skewers, the foil and the lemons on the left; no plates, those are all on the dish
// racks) and the sacks of raw potatoes and sweet potatoes against the kitchen side of the bar (blender/produce.py).
import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { mergeByMaterial } from '@/scene/StaticBatch'
import { reflectStudio, useStudio } from '@/scene/studio'
import { SACK_STICKS } from '@/game/supplies'
import { askPantry, SUPPLIES, tipOver } from './bar'
import { getEdit } from './edit'

const STOCK_URL = import.meta.env.BASE_URL + 'models/cubbystock.glb'
const PRODUCE_URL = import.meta.env.BASE_URL + 'models/produce.glb'
/** what's metal: real metal, reflecting the studio */
const METAL = /^Stock(Cap|Iron|Steel|FoilEnd|OilTin)$/
/** what's seen from inside as well as out: the sacks, open at the mouth */
const OPEN = /^(ProduceSack|CharcoalSack)/
/** too small or too fine for an ink line (the skewers, their ties, the labels and the marks on things) */
const UNINKED = /Skewer|Label|Mark|Spice\d|SpiceCap|FoilRoll|Lemon\d/

/** a loaded model's part (its node by name), in the room's toon light, inked once and folded together by material (it never moves; but what
 * `keep` names, left as it is to be shown or hidden) */
function partOf(scene: THREE.Group, node: string, width: number, keep?: (o: THREE.Object3D) => boolean) {
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
  mergeByMaterial(r, keep)
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
/** how many sticks the sack shows full (two sacks' worth and over: all of them) */
const STICKS_SHOWN = 14
/**
 * The sack of binchotan on the floor by the cook table (blender/produce.py's CharcoalSack): the crate on the table is filled from it. As many
 * sticks stand up out of it as it has left (none, when it's empty); pointed at, it lights and says how many; clicked, the stock opens on its
 * supplies' tab.
 */
export function CharcoalSack() {
  const gltf = useGLTF(PRODUCE_URL) as unknown as { scene: THREE.Group }
  const { obj, sticks } = useMemo(() => {
    const r = partOf(gltf.scene, 'CharcoalSack', 0.004, (o) => /^CharcoalStick/.test(o.name))
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    const sticks: THREE.Object3D[] = []
    r.traverse((o) => { if (/^CharcoalStick\d+$/.test(o.name)) sticks.push(o) })
    sticks.sort((a, b) => +a.name.slice(13) - +b.name.slice(13))
    return { obj: r, sticks }
  }, [gltf])
  const shown = useRef(-1)
  useFrame(() => {
    const left = SUPPLIES.coal()
    const n = left === Infinity ? STICKS_SHOWN : Math.min(STICKS_SHOWN, Math.ceil((left / (2 * SACK_STICKS)) * STICKS_SHOWN))
    if (n === shown.current) return
    shown.current = n
    // (the outer ring goes first: the middle ones stand longest)
    sticks.forEach((o, i) => { o.visible = STICKS_SHOWN - 1 - i < n })
  })
  const says = () => {
    const left = SUPPLIES.coal()
    return left <= 0 ? '麻袋空了・點一下到庫存訂木炭' : `還有 ${left === Infinity ? '' : left} 根・桌上的炭箱用完會從這裡補・點一下看庫存`
  }
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('備長炭（麻袋）', says()).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver('備長炭（麻袋）', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('supplies', 'sack') }}>
      <primitive object={obj} />
    </group>
  )
}
useGLTF.preload(STOCK_URL)
useGLTF.preload(PRODUCE_URL)
