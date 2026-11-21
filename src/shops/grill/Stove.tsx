import { memo, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { Steam } from '@/scene/Steam'
import { stepOf } from '@/game/station'
import { ALONG, KITCHEN, LAY, nameOver } from './bar'
import { sizzleSound } from './chewSound'

/**
 * The work counter's gas stove (item 461, the owner's, 2026-11-21: 「這邊要細修，電鍋往左移，右邊加一個瓦斯爐灶，用平底鍋來煎料。」;
 * blender/gasstove.py): a one-burner cassette stove right of the rice cooker (moved left up to the miso pot for it), its frying pan on it,
 * the square tamagoyaki pan hung on the rice-ball shelf's left post beside it. Its flame and its knob the game's (STOVE.on), the blue
 * flames flickering while it's lit; in the scene from the first (its programs made at loading), the flames shrunk to nothing when it's off.
 * While the third cook makes a dish at it (bar.ts's KITCHEN.cooking): the burner lit, the beaten egg poured into the frying pan and spread
 * (the omurice's, the egg-drop soup's), or the square pan taken down onto the burner for a tamagoyaki, rolled up there layer by layer; a
 * sizzle as it goes in and now and then after, a wisp of steam over the pan.
 */
const URL = import.meta.env.BASE_URL + 'models/gasstove.glb'
useGLTF.preload(URL)
/** what the stove and the fryer make, and what's seen in their pans (blender/stovefood.py) */
const FOOD_URL = import.meta.env.BASE_URL + 'models/stovefood.glb'
useGLTF.preload(FOOD_URL)

/** where it stands on the counter (Decor's frame: along the counter (LAY), across it (ALONG)), how big (its model's metres to the bar's
 * units; a little under the cooker's 1.45: the counter's room between the cooker's rice bowl and the rice-ball things is 0.32) */
export const STOVE_AT = { along: 4.435, lay: -0.0835 }
export const STOVE_SCALE = 0.95
/** the counter's top (blender/warmer.py's H, as the cooker stands on it), and the kitchen's floor under it */
const TOP = 0.236
const FLOOR = -1
/** where the tamagoyaki pan hangs: on the rice-ball shelf's left post's face toward the stove (blender/warmer.py's SX[0] at the rice-ball
 * counter's PREP_AT: its face at lay 0.068), its handle's end near the post's top (0.676), its foot 4 cm over the counter; `y` its bottom's
 * middle (the pan 0.18 long, its handle 0.19 more) */
const EGGPAN_AT = { along: 4.715, lay: 0.064, y: 0.37 }
/** the frying pan's handle turned out toward the cook's left front (out to the left it lay over the rice cooker) */
const PAN_TURN = 1.31
/** where the cook stands at a station: this far out in front of the counter's front edge (along 3.816), the aisle */
const STAND_ALONG = 3.55

/** the stove's state, the game's: lit or not (the cook's work sets it) */
export const STOVE = { on: false, flame: 0 }

const SAYS = nameOver('【廚具】卡式瓦斯爐', '煎玉子燒、蛋包飯的蛋皮；平底鍋在爐上，方形的玉子燒鍋掛在旁邊架子上')

/** a model's materials made the shop's toon (those lit from within kept so), each once */
function toToon(r: THREE.Object3D, lit: (name: string) => THREE.Material | null) {
  const made = new Map<THREE.Material, THREE.Material>()
  r.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const src = m.material as THREE.MeshStandardMaterial
    let t = made.get(src)
    if (!t) {
      t = lit(src.name) ?? new THREE.MeshToonMaterial({ color: src.color.clone(), map: src.map ?? null })
      t.name = src.name
      made.set(src, t)
    }
    m.material = t
    m.receiveShadow = true
  })
}
/** a node of the dishes' model, its own copy, at its own origin */
const foodOf = (scene: THREE.Group, name: string) => {
  const o = scene.getObjectByName(name)!.clone(true)
  o.position.set(0, 0, 0)
  o.rotation.set(0, 0, 0)
  return o
}
/** a marker the cooks go by (GuestBar3D's inBar, markOf), named, at a point of its parent's */
const marker = (name: string, x: number, y: number, z: number) => {
  const o = new THREE.Object3D()
  o.name = name
  o.position.set(x, y, z)
  return o
}

export const GasStove = memo(function GasStove() {
  const gltf = useGLTF(URL) as unknown as { scene: THREE.Group }
  const food = useGLTF(FOOD_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const r = (gltf.scene.getObjectByName('GasStoveRoot') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    // (the flames lit from within, seen from either side; the rest the shop's toon)
    toToon(r, (n) => (n === 'StoveFlame' ? new THREE.MeshBasicMaterial({ color: '#6aa8ff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }) : null))
    r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = (m.material as THREE.Material).name !== 'StoveFlame' })
    const flame = r.getObjectByName('StoveFlame0')!, knob = r.getObjectByName('StoveKnob0')!
    const fry = r.getObjectByName('FryPan')!, egg = r.getObjectByName('EggPan')!
    fry.rotation.y = PAN_TURN
    // (the square pan's own copy for the burner, for a tamagoyaki: the hung one down off its hook meanwhile)
    const eggOn = egg.clone(true)
    eggOn.position.copy(fry.position)
    eggOn.rotation.set(0, 0, 0)
    eggOn.visible = false
    r.add(eggOn)
    // (the tamagoyaki pan taken out of the stove's frame and hung on the shelf's post: its bottom against the post, its handle up)
    r.remove(egg)
    // (its own place in the stove's model let go: placed by its hanging alone)
    egg.position.set(0, 0, 0)
    egg.rotation.set(0, 0, 0)
    // (what's in the pans while a dish is made: the beaten egg spread over the frying pan's face, the roll in the square pan)
    const panEgg = foodOf(food.scene, 'PanEgg'), panRoll = foodOf(food.scene, 'PanRoll')
    toToon(panEgg, () => null)
    toToon(panRoll, () => null)
    panEgg.position.copy(fry.position).add(new THREE.Vector3(0, 0.006, 0))
    panRoll.position.copy(eggOn.position).add(new THREE.Vector3(0, 0.006, 0))
    panEgg.visible = panRoll.visible = false
    r.add(panEgg, panRoll)
    // (the marks the third cook goes by: the pan's middle, its handle half way along (the right hand there), where he stands, out in the
    // aisle in front of the counter)
    const dir = new THREE.Vector3(-Math.cos(PAN_TURN), 0, Math.sin(PAN_TURN))
    r.add(marker('stove-top', fry.position.x, fry.position.y + 0.04, fry.position.z),
      marker('stove-grip', fry.position.x + dir.x * 0.2, fry.position.y + 0.071, fry.position.z + dir.z * 0.2),
      marker('stove-front', fry.position.x, (FLOOR - TOP) / STOVE_SCALE, (STOVE_AT.along - STAND_ALONG) / STOVE_SCALE))
    inkModel(r, (m) => (m.material as THREE.Material).name === 'StoveFlame', { width: 0.0012, weld: true })
    inkModel(egg, () => false, { width: 0.0012, weld: true })
    flame.scale.setScalar(0.001)
    return { r, flame, knob, fry, egg, eggOn, panEgg, panRoll, steamAt: fry.position.clone().add(new THREE.Vector3(0, 0.05, 0)) }
  }, [gltf, food])
  // (the pan hung: its handle (+z) up, its inside (+y) toward the stove (-LAY), its width along the counter's depth)
  const hang = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const m = new THREE.Matrix4().makeBasis(ALONG.clone(), LAY.clone().negate(), up)
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    const p = new THREE.Vector3().addScaledVector(ALONG, EGGPAN_AT.along).addScaledVector(LAY, EGGPAN_AT.lay).setY(EGGPAN_AT.y)
    return { q, p }
  }, [])
  const at = useMemo(() => new THREE.Vector3().addScaledVector(ALONG, STOVE_AT.along).addScaledVector(LAY, STOVE_AT.lay), [])
  const steam = useRef(0)
  const heard = useRef({ was: false, at: 0 })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const ck = KITCHEN.cooking?.station === 'stove' ? KITCHEN.cooking : null
    STOVE.on = !!ck
    const step = ck ? stepOf(ck.t, ck.of) : 'done'
    const tama = ck?.id === 'Tamagoyaki'
    // (the square pan down onto the burner for a tamagoyaki, the frying pan by; the egg spread in the frying pan as it's poured, the roll
    // fattening as it's rolled up layer on layer)
    parts.fry.visible = !tama
    parts.eggOn.visible = tama
    parts.egg.visible = !tama
    const spread = ck ? Math.min(1, ck.t / 2.5) : 0
    parts.panEgg.visible = !!ck && !tama && step !== 'done'
    parts.panEgg.scale.set(0.45 + 0.55 * spread, 1, 0.45 + 0.55 * spread)
    parts.panRoll.visible = !!ck && tama && step !== 'done'
    const rolled = ck ? Math.min(1, ck.t / Math.max(1, ck.of * 0.85)) : 0
    parts.panRoll.scale.set(1, 0.5 + 0.5 * rolled, 0.55 + 0.45 * rolled)
    // (lit: the flames up, licking; off: down to nothing; the knob turned with it)
    STOVE.flame += ((STOVE.on ? 1 : 0) - STOVE.flame) * 0.2
    const k = STOVE.flame < 0.01 ? 0.001 : STOVE.flame * (0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 7.3))
    parts.flame.scale.set(STOVE.flame < 0.01 ? 0.001 : 1, k, STOVE.flame < 0.01 ? 0.001 : 1)
    parts.knob.rotation.z = -STOVE.flame * 1.4
    // (the steam off it while it cooks; the sizzle as the egg goes in, and now and then after)
    steam.current += ((ck && step !== 'done' ? 0.7 : 0) - steam.current) * 0.05
    const h = heard.current
    if (ck && !h.was) { sizzleSound(1.3, 1); h.at = t }
    else if (ck && step === 'cook' && t - h.at > 2.6) { sizzleSound(1.0, 0.45); h.at = t }
    h.was = !!ck
  })
  return (
    <group>
      <group position={[at.x, TOP, at.z]} rotation-y={Math.atan2(-ALONG.x, -ALONG.z)} scale={STOVE_SCALE}>
        <primitive object={parts.r} />
        <group position={parts.steamAt}><Steam width={0.18} height={0.3} opacity={0.3} layers={2} level={steam} face /></group>
        <mesh visible={false} position={[0, 0.08, 0]} {...SAYS}><boxGeometry args={[0.36, 0.18, 0.3]} /></mesh>
      </group>
      <group position={hang.p} quaternion={hang.q}><primitive object={parts.egg} /></group>
    </group>
  )
})

/**
 * The frying station (item 469, the owner's, 2026-11-21: 「料理台在增加油炸台，可以炸薯條、天婦羅」; blender/fryer.py): a stainless work
 * table of its own at the work counter's right end (the counter itself full), its top as high as the counter's; on it the tabletop fryer
 * (its oil well, its basket hung on its back rim, its control box with the knob and the lamp) and the draining tray with its rack. While
 * the third cook fries (bar.ts's KITCHEN.cooking): the basket let down into the oil, the oil trembling and bubbling, a sizzle as it goes
 * in and the bubbling heard after; lifted out at the end, what's fried set on the rack to drain.
 */
const FRYER_URL = import.meta.env.BASE_URL + 'models/fryer.glb'
useGLTF.preload(FRYER_URL)
/** where it stands: the fryer's middle (its table's left edge 0.19 left of it), the table 4 cm past the counter's end (lay 2.327), in its line */
export const FRYER_AT = { along: 4.26, lay: 2.327 + 0.04 + 0.19 * 1.1 }
export const FRYER_SCALE = 1.1
/** how far the basket's let down into the oil when it's frying (its model's metres) */
const BASKET_DROP = 0.085
/** the draining rack's middle on the fryer's table (blender/fryer.py: RX, RACK_Y) */
const RACK_AT = new THREE.Vector3(0.29, 0.052, 0)
/** the fryer's state, the game's: frying (the basket down, the oil bubbling) */
export const FRYER = { on: false, down: 0 }

const FRYER_SAYS = nameOver('【廚具】油炸台', '炸薯條、天婦羅；炸好放上旁邊的瀝油架瀝油')

export const Fryer = memo(function Fryer() {
  const gltf = useGLTF(FRYER_URL) as unknown as { scene: THREE.Group }
  const food = useGLTF(FOOD_URL) as unknown as { scene: THREE.Group }
  const parts = useMemo(() => {
    const r = (gltf.scene.getObjectByName('FryerRoot') ?? gltf.scene).clone(true)
    r.position.set(0, 0, 0)
    // (the lamp lit from within; the rest the shop's toon)
    toToon(r, (n) => (n === 'FryerLamp' ? new THREE.MeshBasicMaterial({ color: '#ff6a46' }) : null))
    r.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = !/FryerOil|FryerLamp/.test((m.material as THREE.Material).name) })
    inkModel(r, (m) => /FryerOil|FryerLamp/.test((m.material as THREE.Material).name), { width: 0.0012, weld: true })
    const basket = r.getObjectByName('FryerBasket')!, oil = r.getObjectByName('FryerOil')!
    // (what's been fried, set on the rack to drain at the end: the chips (out of their cone), the tempura)
    const fries = foodOf(food.scene, 'Fries'), tempura = foodOf(food.scene, 'Tempura')
    toToon(fries, () => null)
    toToon(tempura, () => null)
    for (const f of [fries, tempura]) { f.position.copy(RACK_AT); f.visible = false; r.add(f) }
    // (the marks the third cook goes by: the oil's middle, the basket's handle (it moves with the basket), where he stands in the aisle)
    r.add(marker('fryer-top', oil.position.x, oil.position.y, oil.position.z),
      marker('fryer-front', 0, (FLOOR - TOP) / FRYER_SCALE, (FRYER_AT.along - STAND_ALONG) / FRYER_SCALE))
    basket.add(marker('fryer-grip', 0, 0.15, 0.24))
    return { r, basket, oil, basketY: basket.position.y, oilY: oil.position.y, fries, tempura }
  }, [gltf, food])
  const at = useMemo(() => new THREE.Vector3().addScaledVector(ALONG, FRYER_AT.along).addScaledVector(LAY, FRYER_AT.lay), [])
  const heard = useRef({ was: false, at: 0 })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const ck = KITCHEN.cooking?.station === 'fryer' ? KITCHEN.cooking : null
    const step = ck ? stepOf(ck.t, ck.of) : 'done'
    FRYER.on = !!ck && step === 'cook'
    // (the basket eased down into the oil while frying, up out of it after; the oil's face trembling as it bubbles)
    FRYER.down += ((FRYER.on ? 1 : 0) - FRYER.down) * 0.12
    parts.basket.position.y = parts.basketY - BASKET_DROP * FRYER.down
    parts.oil.position.y = parts.oilY + (FRYER.down > 0.05 ? 0.0015 * Math.sin(t * 31) * Math.sin(t * 13.7) * FRYER.down : 0)
    // (lifted out: on the rack to drain)
    parts.fries.visible = !!ck && step === 'plate' && ck.id === 'Fries'
    parts.tempura.visible = !!ck && step === 'plate' && ck.id === 'Tempura'
    const h = heard.current
    if (FRYER.on && !h.was) { sizzleSound(1.6, 1); h.at = t }
    else if (FRYER.on && t - h.at > 1.8) { sizzleSound(1.4, 0.35); h.at = t }
    h.was = FRYER.on
  })
  return (
    <group position={[at.x, TOP, at.z]} rotation-y={Math.atan2(-ALONG.x, -ALONG.z)} scale={FRYER_SCALE}>
      <primitive object={parts.r} />
      <mesh visible={false} position={[0.13, 0.1, 0]} {...FRYER_SAYS}><boxGeometry args={[0.66, 0.3, 0.44]} /></mesh>
    </group>
  )
})

/** each dish's look at the customer's place (items 461, 469): its food (a node of blender/stovefood.py), on a plate or in the soup bowl */
// (`size`: the food drawn smaller than it was made, to lie inside the plate's rim: the rolled omelette and the tempura were as long as the
// plate is across (0.184), the omurice nearly so)
const DISH_LOOK: Record<string, { node: string; bowl: boolean; lift: number; size?: number }> = {
  Tamagoyaki: { node: 'Tamagoyaki', bowl: false, lift: 0.012, size: 0.78 }, Omurice: { node: 'Omurice', bowl: false, lift: 0.012, size: 0.88 },
  HandRoll: { node: 'HandRoll', bowl: false, lift: 0.012 }, Fries: { node: 'Fries', bowl: false, lift: 0.012 },
  Tempura: { node: 'Tempura', bowl: false, lift: 0.012, size: 0.82 }, EggDropSoup: { node: 'EggDropTop', bowl: true, lift: 0.042 },
}
/** how many can be drawn at once (at the places, at the counter, on the trays) */
const SLOTS = 16
/** their size in the bar's units (their model's metres) */
const DISH_SCALE = 0.75

type DishAt = { key: string; id: string; at: THREE.Vector3; yaw: number }
const NO_DISHES: DishAt[] = []
/**
 * The dishes from the stove, the fryer and the board where they are (items 461, 469): at the customers' places (`seat`) and on their way out
 * (`moving`: at the serving counter, on a server's tray, being set down; GuestBar3D lays them out every frame), each on its plate (the
 * egg-drop soup in its bowl): a few slots made once, each the plate, the bowl and every dish's food, shown as one's wanted
 */
export const KitchenDishes = memo(function KitchenDishes({ seat, moving }: { seat: DishAt[]; moving: RefObject<DishAt[]> }) {
  const food = useGLTF(FOOD_URL) as unknown as { scene: THREE.Group }
  const slots = useMemo(() => Array.from({ length: SLOTS }, () => {
    const g = new THREE.Group()
    g.visible = false
    g.scale.setScalar(DISH_SCALE)
    const plate = foodOf(food.scene, 'DishPlate'), bowl = foodOf(food.scene, 'SoupBowl')
    const foods: Record<string, THREE.Object3D> = {}
    for (const [id, look] of Object.entries(DISH_LOOK)) {
      const f = foodOf(food.scene, look.node)
      f.position.y = look.lift
      if (look.size) f.scale.multiplyScalar(look.size)
      f.visible = false
      foods[id] = f
      g.add(f)
    }
    g.add(plate, bowl)
    toToon(g, () => null)
    return { g, plate, bowl, foods }
  }), [food])
  useFrame(() => {
    // (the places' first, then those on their way; no list made each frame)
    const way = moving.current ?? NO_DISHES
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i], d = i < seat.length ? seat[i] : way[i - seat.length]
      s.g.visible = !!d
      if (!d) continue
      s.g.position.copy(d.at)
      s.g.rotation.y = d.yaw
      const bowl = !!DISH_LOOK[d.id]?.bowl
      s.plate.visible = !bowl
      s.bowl.visible = bowl
      for (const id in s.foods) s.foods[id].visible = id === d.id
    }
  })
  return <group>{slots.map((s, i) => <primitive key={i} object={s.g} />)}</group>
})
