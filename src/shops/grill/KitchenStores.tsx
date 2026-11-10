// The kitchen's stores: what's kept in the cook's table's two cupboards (blender/cubbystock.py: the soy sauce and mirin, the pickle jar, the
// cloths and the salt box on the right; the binchotan, the skewers, the foil and the lemons on the left; no plates, those are all on the dish
// racks) and the sacks of raw potatoes and sweet potatoes against the kitchen side of the bar (blender/produce.py).
import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { countedBatch, mergeByMaterial, plainColours } from '@/scene/StaticBatch'
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
/** what's baked (the tubers: blender/produce.py bakes a detailed twin onto each coarse one), its normal map kept, so the room's light shades
 * it as if it were round */
const BAKED = /^ProduceTuber/
/** the produce sacks' cloth: its cross-weave pressed in (a normal map, blender/produce.py's WEAVE_N), kept as the tubers' are */
const WOVEN = /^ProduceSack(Potato|Sweet|Onion)$/
/** how much brighter each sack's burlap is drawn than it's woven */
// (the produce sacks' a little too, to an old sack's light tan (the owner's, 2026-11-11))
const BURLAP_LIFT: Record<string, number> = { CharcoalSackCloth: 1.18, ProduceSackPotato: 1.15, ProduceSackSweet: 1.15, ProduceSackOnion: 1.22 }
/** the produce sacks' cloth dyed another colour: none now (the owner's, 2026-11-11: the white was too white, an old burlap sack's tan as it's
 * woven, grime and all; they'd been dyed a bleached cotton-hemp, 2026-11-09); kept for a sack that wants one */
const BURLAP_DYE: Record<string, string> = {}

/** a burlap picture in another colour: each point that colour by how light it was against the cloth's own mean (the weave's light and dark
 * kept, a little softened); what's woven in another colour (a red or green band: far from the cloth's brown) left as it was */
function dyeBurlap(map: THREE.Texture, hex: string) {
  const img = map.image as CanvasImageSource & { width: number; height: number }
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, c.width, c.height)
  const d = px.data
  const lum = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  let sum = 0
  for (let i = 0; i < d.length; i += 4) sum += lum(i)
  const mean = sum / (d.length / 4)
  const to = new THREE.Color(hex)
  const T = [to.r * 255, to.g * 255, to.b * 255]
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = Math.max(1, d[i + 1])
    // (how much of the band this is: a red far redder than the cloth, or a green above its red)
    const band = Math.min(1, Math.max(0, (r / gr - 1.6) / 0.6) + Math.max(0, (d[i + 1] - r) / 25))
    const k = Math.min(1.12, 0.62 + 0.38 * (lum(i) / mean))
    for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, T[j] * k) * (1 - band) + d[i + j] * band
  }
  g.putImageData(px, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.flipY = map.flipY
  t.colorSpace = map.colorSpace
  t.wrapS = map.wrapS
  t.wrapT = map.wrapT
  t.anisotropy = map.anisotropy
  t.name = map.name
  return t
}
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
        } else {
          const toon = new THREE.MeshToonMaterial({ color: sm.color.clone(), map: sm.map ?? null, side: OPEN.test(sm.name) ? THREE.DoubleSide : THREE.FrontSide })
          // (the sacks' burlap a little brighter than it's woven (the owner's): the potatoes' and sweet potatoes' paler, the charcoal's printed
          // one less so)
          const lift = BURLAP_LIFT[sm.name]
          if (lift) toon.color.multiplyScalar(lift)
          const dye = BURLAP_DYE[sm.name]
          if (dye && sm.map?.image) toon.map = dyeBurlap(sm.map, dye)
          t = toon
          if ((BAKED.test(sm.name) || WOVEN.test(sm.name)) && sm.normalMap) Object.assign(t, { normalMap: sm.normalMap, normalScale: sm.normalScale.clone() })
        }
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
  // (its plain-coloured pieces one material, their colours on their points: merged, one draw where each colour was its own)
  plainColours(r)
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

/**
 * The sacks of potatoes and sweet potatoes, their backs to the bar, along it: what's kept at room temperature, so pointed at they light and
 * say how many there are, and clicked the stock opens on its larder's tab (the owner's).
 */
export function ProduceSacks() {
  const gltf = useGLTF(PRODUCE_URL) as unknown as { scene: THREE.Group }
  const obj = useMemo(() => {
    const r = partOf(gltf.scene, 'ProduceSacks', 0.004)
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    return r
  }, [gltf])
  // (the sacks of potatoes, sweet potatoes and onions, and the crate of carrots and burdock beside them: how many of each)
  const says = () => {
    const n = (id: string) => SUPPLIES.has(id)
    return n('Potato') < 0 ? '點一下看常溫區的庫存'
      : `馬鈴薯 ${n('Potato')}・地瓜 ${n('SweetPotato')}・洋蔥 ${n('Onion')}・紅蘿蔔 ${n('Carrot')}・牛蒡 ${n('Gobo')}｜點一下看常溫區的庫存`
  }
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('根莖蔬菜', says()).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver('根莖蔬菜', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('ambient', 'sack') }}>
      <primitive object={obj} />
    </group>
  )
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
    const list: THREE.Mesh[] = []
    r.traverse((o) => { if (/^CharcoalStick\d+$/.test(o.name) && (o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh) })
    // (the outer ring goes first, the middle ones stand longest: the sticks in the order they're shown, the middle's first; all of them one
    // mesh and one ink line, cut to as many as are left (they were a mesh and a line each: 28 draws))
    list.sort((a, b) => +b.name.slice(13) - +a.name.slice(13))
    return { obj: r, sticks: countedBatch(r, list) }
  }, [gltf])
  const shown = useRef(-1)
  useFrame(() => {
    const left = SUPPLIES.coal()
    const n = left === Infinity ? STICKS_SHOWN : Math.min(STICKS_SHOWN, Math.ceil((left / (2 * SACK_STICKS)) * STICKS_SHOWN))
    if (n === shown.current) return
    shown.current = n
    sticks.show(n)
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
