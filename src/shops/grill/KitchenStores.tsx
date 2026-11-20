// The kitchen's stores: what's kept in the cook's table's two cupboards (blender/cubbystock.py: the soy sauce and mirin, the pickle jar, the
// cloths and the salt box on the right; the binchotan, the skewers, the foil and the lemons on the left; no plates, those are all on the dish
// racks) and the sacks of raw potatoes and sweet potatoes against the kitchen side of the bar (blender/produce.py).
import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { inkModel } from '@/scene/inkHull'
import { countedBatch, homeCopy, mergeByMaterial, plainColours } from '@/scene/StaticBatch'
import { parOf, unitsShown } from '@/game/pantry'
import { reflectStudio, useStudio } from '@/scene/studio'
import { SACK_STICKS, SEASON_GOODS } from '@/game/supplies'
import { PAR } from '@/game/economy'
import { askPantry, SUPPLIES, tipOver } from './bar'
import { DISHES } from '@/data/menu'
import { storageOf } from '@/data/storage'
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
const BURLAP_LIFT: Record<string, number> = { CharcoalSackCloth: 1.18, ProduceSackPotato: 1.15, ProduceSackSweet: 1.15, ProduceSackOnion: 1.22, ProduceSackLiner: 1.15 }
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
/** what's printed on each produce sack's front, as a farm's sacks are (the owner's, 2026-11-11: to read as sacks at a glance): where round it
 * (`u`: blender/produce.py's sacks face front at a / π round their picture, twice round), and the words: the produce, where it's from, its
 * weight, a red mark */
const SACK_PRINT: Record<string, { u: number; name: string; from: string; kg: string; mark: string }> = {
  ProduceSackPotato: { u: 0.389, name: 'じゃがいも', from: '北海道産', kg: '20kg', mark: '特' },
  ProduceSackSweet: { u: 0.5, name: 'さつまいも', from: '鹿児島産', kg: '10kg', mark: '甘' },
  ProduceSackOnion: { u: 0.611, name: '玉ねぎ', from: '淡路島産', kg: '20kg', mark: '秀' },
}
/** a sack's picture with its print on it: stencilled ink soaked into the weave (lighter where the threads stand, broken here and there),
 * mirrored (u runs round the sack the other way to how it's read from outside) */
function printSack(map: THREE.Texture, p: (typeof SACK_PRINT)[string]) {
  const img = map.image as CanvasImageSource & { width: number; height: number }
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')!
  g.drawImage(img, 0, 0)
  const W = c.width, H = c.height
  // (the ink on its own first, then laid over the cloth multiplied, so the weave shows through it)
  const ink = document.createElement('canvas')
  ink.width = W
  ink.height = H
  const k = ink.getContext('2d')!
  // (once: the picture goes round the sack twice, so it's on its back as well)
  for (const u of [p.u]) {
    const cx = (u % 1) * W
    k.save()
    k.translate(cx, 0)
    k.scale(-1, 1)
    k.textAlign = 'center'
    k.textBaseline = 'middle'
    // (v up the sack's body is 0.9 at its mouth: the print between 0.25 and 0.58 of its height; the picture's top its foot's other end)
    const y = (v: number) => (1 - v) * H
    k.fillStyle = '#b3261e'
    k.beginPath(); k.arc(0, y(0.53), W * 0.032, 0, Math.PI * 2); k.fill()
    k.fillStyle = '#f2e6cc'
    k.font = `900 ${Math.round(W * 0.036)}px "Noto Serif JP", "Yu Mincho", serif`
    k.fillText(p.mark, 0, y(0.53))
    k.fillStyle = '#1c1712'
    k.font = `900 ${Math.round(W * 0.052)}px "Noto Sans JP", "Yu Gothic", sans-serif`
    k.fillText(p.name, 0, y(0.43))
    k.font = `700 ${Math.round(W * 0.034)}px "Noto Sans JP", "Yu Gothic", sans-serif`
    k.fillText(p.from, 0, y(0.355))
    k.fillStyle = '#b3261e'
    k.fillText(p.kg, 0, y(0.3))
    k.restore()
  }
  // (worn: knocked back where the threads stand proud, broken in a few blotches)
  k.globalCompositeOperation = 'destination-out'
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 900; i++) {
    k.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.35})`
    k.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 5, 2 + rnd() * 3)
  }
  g.globalAlpha = 0.82
  g.globalCompositeOperation = 'multiply'
  g.drawImage(ink, 0, 0)
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
const UNINKED = /Skewer|Label|Mark|Spice\d|SpiceCap|FoilRoll|Lemon\d|ProduceSack\dInside/

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
          const print = SACK_PRINT[sm.name]
          if (print && toon.map?.image) toon.map = printSack(toon.map, print)
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

/**
 * What each thing in the two fridges is in the stock (item 275, the owner's, 2026-11-17: 「這個遊戲是模擬真實世界，不是亂塞些模型的」; with 274's
 * 「調料...跟庫存的對不上」): each shown by its own stock, where they all went at once by whether there was any of anything (items 182, 199). Its
 * stock (or either of two: the box both mushrooms are in), and where there are several of one (bottles, tins, lemons, cobs, skewers, rice
 * balls...) which of them it is, its name's number: as many shown as there's stock for (game/pantry's unitsShown), what holds them there
 * while any of them is.
 */
const CUBBY_PARTS: { re: RegExp; ids: string[]; counted?: true }[] = [
  { re: /^StockBottle(?:Label)?(\d)$/, ids: ['season:soy'], counted: true },
  { re: /^StockPickle/, ids: ['season:soy'] },
  { re: /^StockMiso/, ids: ['season:miso'] },
  { re: /^StockMilkTin(\d)$/, ids: ['season:milk'], counted: true },
  { re: /^StockWasabi/, ids: ['season:wasabi'] },
  { re: /^StockYuzu/, ids: ['season:yuzu'] },
  { re: /^StockLemon(\d)$/, ids: ['season:lemon'], counted: true },
  { re: /^StockLemonDish$/, ids: ['season:lemon'] },
  { re: /^StockCorn(?:Husk)?(\d)$/, ids: ['GrilledCorn'], counted: true },
  { re: /^StockCornCrate$/, ids: ['GrilledCorn'] },
  { re: /^StockShiitake(?:Stem)?(\d)$/, ids: ['GrilledShiitake'], counted: true },
  { re: /^StockEringi(\d)$/, ids: ['KingOyster'], counted: true },
  { re: /^StockMushroomBox$/, ids: ['GrilledShiitake', 'KingOyster'] },
  { re: /^StockAsparagus(\d)$/, ids: ['Asparagus'], counted: true },
  { re: /^StockAsparaTie$/, ids: ['Asparagus'] },
  { re: /^StockShishito(\d)$/, ids: ['Shishito'], counted: true },
  { re: /^StockShishitoBasket$/, ids: ['Shishito'] },
  { re: /^StockLeek(\d)$/, ids: ['Negi'], counted: true },
  { re: /^StockLeekTie$/, ids: ['Negi'] },
  { re: /^StockDaikon/, ids: ['Daikon'] },
  // (the skewer trays: each tray its own meat, each of its four skewers one of them (its name's second number))
  { re: /^Stock(?:TraySkewer|Meat|Fat|Sausage)0(\d)/, ids: ['Yakitori'], counted: true },
  { re: /^StockSkewerTray0$/, ids: ['Yakitori'] },
  { re: /^Stock(?:TraySkewer|Meat|Fat|Sausage)1(\d)/, ids: ['PorkBelly'], counted: true },
  { re: /^StockSkewerTray1$/, ids: ['PorkBelly'] },
  { re: /^Stock(?:TraySkewer|Meat|Fat|Sausage)2(\d)/, ids: ['Sausage'], counted: true },
  { re: /^StockSkewerTray2$/, ids: ['Sausage'] },
  // (the rice balls made ready for the grill, from the rice, each in its sheet of nori)
  { re: /^Stock(?:Onigiri|Nori)(\d)$/, ids: ['Onigiri'], counted: true },
  { re: /^StockOnigiriPlate$/, ids: ['Onigiri'] },
]
/** what's in one of the cook's table's cupboards ('right' or 'left'), standing on its floor, x along the table, +z toward its doors */
export function CubbyStock({ which }: { which: 'right' | 'left' }) {
  useStudio()
  const gltf = useGLTF(STOCK_URL) as unknown as { scene: THREE.Group }
  const view = useMemo(() => {
    // (nothing folded together at first: each part shown or hidden by its stock, then what's shown drawn as one copy by material (homeCopy),
    // made again only when what's shown changes)
    const r = partOf(gltf.scene, which === 'right' ? 'StockRight' : 'StockLeft', 0.0025, () => true)
    // (anything the table doesn't name: by whether there's any of the cupboard's foods, as it all went before)
    const rest = which === 'right' ? CHILLED_SAUCES : CHILLED_FOODS
    const parts = [...r.children].map((top) => {
      const at = CUBBY_PARTS.findIndex((e) => e.re.test(top.name))
      const e = at >= 0 ? CUBBY_PARTS[at] : null
      const m = e?.counted ? e.re.exec(top.name) : null
      const meshes: THREE.Mesh[] = []
      top.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
      return { top, meshes, ids: e?.ids ?? rest, entry: at, unit: m ? +m[1] : null }
    })
    // (how many of each counted one there are)
    const all = new Map<number, number>()
    for (const p of parts) if (p.unit !== null) all.set(p.entry, Math.max(all.get(p.entry) ?? 0, p.unit + 1))
    return { r, parts, all, key: '', copy: null as THREE.Object3D | null, at: -1 }
  }, [gltf, which])
  useEffect(() => () => { view.copy?.traverse((o) => (o as THREE.Mesh).geometry?.dispose()) }, [view])
  useFrame(() => {
    const now = performance.now()
    if (now - view.at < 500) return
    view.at = now
    const has = (id: string) => SUPPLIES.has(id)
    const counts = new Map<number, number>()
    const shows = view.parts.map((p) => {
      if (p.unit === null) return p.ids.some((id) => has(id) !== 0)
      let n = counts.get(p.entry)
      if (n === undefined) { n = unitsShown(has(p.ids[0]), view.all.get(p.entry) ?? 1, parOf(p.ids[0])); counts.set(p.entry, n) }
      return p.unit < n
    })
    const key = shows.map((s) => (s ? 1 : 0)).join('')
    if (key === view.key) return
    view.key = key
    // (the copy as it was let go; each part's meshes shown or not; what's shown folded together by material again, the parts themselves
    // hidden under it (still pointed at))
    if (view.copy) {
      view.copy.removeFromParent()
      view.copy.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
      view.copy = null
    }
    view.parts.forEach((p, i) => { for (const m of p.meshes) m.visible = shows[i] })
    const before = new Set(view.r.children)
    homeCopy(view.r, view.parts.map((p) => p.top)).home(true)
    view.copy = view.r.children.find((c) => !before.has(c)) ?? null
  })
  return <primitive object={view.r} />
}
/** the foods the cook table's cupboards hold (data/storage's chilled ones on the menu) */
const CHILLED_FOODS = DISHES.flatMap((d) => d.items.map((x) => x.id)).filter((id) => storageOf(id) === 'chilled')
/** the sauces kept chilled (the seasonings not kept dry: data/storage), the right-hand cupboard's */
const CHILLED_SAUCES = SEASON_GOODS.map((g) => g.id).filter((id) => storageOf(id) === 'chilled')

/**
 * The sacks of potatoes and sweet potatoes, their backs to the bar, along it: what's kept at room temperature, so pointed at they light and
 * say how many there are, and clicked the stock opens on its larder's tab (the owner's).
 */
/** how far (in the model's own units, its 1.4 times in the room) the sacks stand to the right of where they were modelled */
const SACKS_RIGHT = 0.2
const SACK_PARTS = /^Produce(Sack|Potato|Sweet|Onion|Loose)/
/** what's in each sack, as there's stock of it (item 199, the owner's: 「庫存的東西沒對上」: the sacks drawn full at 0): the potatoes (and the
 * loose one by them), the sweet potatoes, the onions (and their roots, the loose one too) */
// (each name with or without the glTF's _0, _1 a piece of more than one material is split into (item 355: the onions' heap, two materials,
// came as ProduceOnionHeap_0 and _1, never counted out: empty, the sack slumped and its heap stayed up in the air over it, against the wall))
const PILES = [
  { id: 'Potato', re: /^Produce(Potato(Edge|Top)?\d+|Loose0|PotatoHeap)(_\d+)?$/ },
  { id: 'SweetPotato', re: /^ProduceSweet((Edge)?\d+|Heap)(_\d+)?$/ },
  { id: 'Onion', re: /^Produce(Onion(Edge|Top)?\d+|LooseOnion|OnionHeap)(_\d+)?$/ },
] as const
/** the order the pieces in a sack go, deepest last: the loose one on the floor first, then the top, the rim, the body, and last of all the heap
 * that fills its mouth (blender/produce.py's ProducePotatoHeap and the rest, item 261: the mouth was a flat brown disc) */
const pileRank = (name: string) => (/Heap(_\d+)?$/.test(name) ? 4 : /Loose/.test(name) ? 0 : /Top/.test(name) ? 1 : /Edge/.test(name) ? 2 : 3)
/** how many of a sack's pieces are shown for so much in stock: all of them at the usual stock (PAR) and over, none at none, at least one
 * while there's any; all of them with no shop running */
const pileShown = (have: number, all: number) => (have < 0 ? all : have <= 0 ? 0 : Math.max(1, Math.min(all, Math.round((all * have) / PAR))))
/** an empty sack slumped down on its foot (item 222, the owner's 「這也超怪」: emptied, each stood as full as ever, its mouth a black hole, the
 * dark floor set just inside it under what's heaped there): how tall it's left, how much wider it slumps, and how quickly it goes (per s).
 * Its mouth shows its lining then (blender/produce.py's ProduceSack*Inside, item 401: the cloth's inside going down into it, its folds) */
const SLUMP_H = 0.3, SLUMP_W = 1.08, SLUMP_RATE = 3
export function ProduceSacks() {
  const gltf = useGLTF(PRODUCE_URL) as unknown as { scene: THREE.Group }
  const { obj, piles, sacks } = useMemo(() => {
    // (the owner's, 2026-11-12: the sacks over to the right (the stepped stand of baskets they were moved toward is gone, the owner's, 11-15): each part of the model
    // moved as it stands in a copy of it BEFORE partOf draws its ink line (one welded line round all of them: moved after, it stayed where the parts
    // were, black scraps all about the sacks), the sacks (and what's in them) along the row)
    const moved = gltf.scene.getObjectByName('ProduceSacks')?.clone(true)
    if (moved) for (const c of moved.children) {
      if (SACK_PARTS.test(c.name)) c.position.x += SACKS_RIGHT
    }
    const holder = new THREE.Group()
    if (moved) holder.add(moved)
    const piled = (o: THREE.Object3D) => PILES.some((k) => k.re.test(o.name))
    // (each open sack's own pieces (its cloth, the dark floor inside it, its twine) kept out of the shop's merging, to be gathered and slumped
    // as one when it's empty (item 222))
    const ownSack = (o: THREE.Object3D) => /^ProduceSack\d/.test(o.name)
    // (a finer ink line (item 314): at 4 mm every tuber in the heaps had a thick black ring round it, a cartoon's blobs, the sweet potatoes red
    // leaves, as the basket's vegetables were before item 153)
    const r = partOf(holder, 'ProduceSacks', 0.0022, (o) => piled(o) || ownSack(o))
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    // (each sack's pieces one mesh and one ink line cut to as many as there's stock for, the topmost going first (countedBatch, as the
    // charcoal sack's sticks); the onions' roots taken off them and done the same, in the same order)
    const piles = PILES.map(({ id, re }) => {
      const pieces: THREE.Mesh[] = []
      r.traverse((o) => { if (re.test(o.name) && (o as THREE.Mesh).isMesh) pieces.push(o as THREE.Mesh) })
      pieces.sort((a, b) => pileRank(b.name) - pileRank(a.name) || a.name.localeCompare(b.name))
      const roots = pieces.map((q) => q.children.find((c) => (c as THREE.Mesh).isMesh && /Root$/.test(c.name)) as THREE.Mesh | undefined)
      const kept = roots.filter((x): x is THREE.Mesh => !!x)
      for (const x of kept) r.attach(x)
      // (the roots of the first so many pieces shown: the heap has none, so not one for every piece any more)
      const rooted = roots.map((x) => !!x)
      const rootsOf = (n: number) => rooted.slice(0, n).filter(Boolean).length
      return { id, all: pieces.length, body: countedBatch(r, pieces), roots: kept.length ? countedBatch(r, kept) : null, rootsOf, shown: -1 }
    })
    // (each open sack gathered into a group of its own, its origin at the middle of its foot, merged by material (its cloth, its floor, its
    // twine); the piles' order is the sacks': potatoes, sweet potatoes, onions)
    r.updateMatrixWorld(true)
    const sacks = PILES.map((_, i) => {
      const own: THREE.Object3D[] = []
      r.traverse((o) => { if ((o as THREE.Mesh).isMesh && new RegExp(`^ProduceSack${i}(?!\\d)`).test(o.name) && !o.name.endsWith('_outline')) own.push(o) })
      if (!own.length) return null
      const box = new THREE.Box3()
      for (const o of own) box.expandByObject(o)
      const g = new THREE.Group()
      g.name = `produce-sack-${i}`
      const foot = box.getCenter(new THREE.Vector3()).setY(box.min.y)
      g.position.copy(r.worldToLocal(foot.clone()))
      r.add(g)
      g.updateMatrixWorld(true)
      for (const o of own) g.attach(o)
      mergeByMaterial(g)
      return { g, k: 0 }
    })
    return { obj: r, piles, sacks }
  }, [gltf])
  useFrame((_, dt) => {
    piles.forEach((p, i) => {
      const n = pileShown(SUPPLIES.has(p.id), p.all)
      if (n !== p.shown) {
        p.shown = n
        p.body.show(n)
        p.roots?.show(p.rootsOf(n))
      }
      // (empty: the sack slumps down on its foot, a little wider; filled again, it stands up as it was)
      const sk = sacks[i]
      if (!sk) return
      const want = n === 0 ? 1 : 0
      if (sk.k === want) return
      sk.k = want > sk.k ? Math.min(want, sk.k + dt * SLUMP_RATE) : Math.max(want, sk.k - dt * SLUMP_RATE)
      const e = sk.k * sk.k * (3 - 2 * sk.k)
      sk.g.scale.set(1 + (SLUMP_W - 1) * e, 1 - (1 - SLUMP_H) * e, 1 + (SLUMP_W - 1) * e)
    })
  })
  // (the sacks of potatoes, sweet potatoes and onions, and the baskets of the summer vegetables and the burdock beside them: how many of each
  // (the carrots chilled now, the owner's))
  const says = () => {
    const n = (id: string) => SUPPLIES.has(id)
    return n('Potato') < 0 ? '點一下看常溫區的庫存'
      : `馬鈴薯 ${n('Potato')}・地瓜 ${n('SweetPotato')}・洋蔥 ${n('Onion')}・牛蒡 ${n('Gobo')}・番茄 ${n('Tomato')}・小黃瓜 ${n('Cucumber')}・茄子 ${n('Eggplant')}・青椒 ${n('Piman')}・甜椒 ${n('Paprika')}｜點一下看常溫區的庫存`
  }
  return (
    // (handlers on a group round it: a primitive's own aren't attached)
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver('常溫蔬菜', says()).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver('常溫蔬菜', '').onPointerOut(e) }}
      onClick={(e) => { e.stopPropagation(); if (getEdit().on) return; askPantry('ambient', 'sack') }}>
      <primitive object={obj} />
    </group>
  )
}
/** what's in each of the baskets of vegetables in front of the sacks (item 133; item 262: two crates and the basket, each its own vegetables) */
const VEG_SAYS: Record<VegNode, [string, string]> = {
  VegCrate: ['蔬菜木箱', '番茄、甜椒、茄子、青椒｜點一下看常溫區的庫存'],
  VegCrate2: ['根菜木箱', '紅蘿蔔、牛蒡、白蘿蔔、大蔥｜點一下看常溫區的庫存'],
  VegBasket: ['蔬菜提籃', '小黃瓜、櫛瓜、白菜、高麗菜、青花菜、櫻桃蘿蔔｜點一下看常溫區的庫存'],
}
export type VegNode = 'VegCrate' | 'VegCrate2' | 'VegBasket'
/** the stock each kind of vegetable in them shows (item 262: as many as there are, the first so many, bottom up; none at none); null, a kind
 * that isn't on the menu (the basket's cabbage, napa, broccoli, radishes, zucchini): there while the larder has anything at all */
const VEG_STOCK: Record<string, string | null> = { Tomato: 'Tomato', Paprika: 'Paprika', Eggplant: 'Eggplant', Piman: 'Piman', Carrot: 'Carrot',
  Gobo: 'Gobo', Daikon: 'Daikon', Negi: 'Negi', Cucumber: 'Cucumber', Zucchini: null, Napa: null, Cabbage: null, Broccoli: null, Radish: null }
const LARDER = ['Potato', 'SweetPotato', 'Onion', ...Object.values(VEG_STOCK).filter((x): x is string => !!x)]
/**
 * One of the two baskets of vegetables on the floor in front of the sacks (blender/produce.py's VegCrate, a slatted wooden crate, or
 * VegBasket, a wicker basket with a handle; item 133, the owner's): inked, folded by material; pointed at, what's in it; clicked, the stock
 * opens on the room-temperature tab, as the sacks' does.
 */
export function VegBasket({ node }: { node: VegNode }) {
  const gltf = useGLTF(PRODUCE_URL) as unknown as { scene: THREE.Group }
  const { obj, kinds } = useMemo(() => {
    // (each vegetable its own piece in the model, <node>_<Kind>_<i>, the first at the bottom (blender/produce.py, item 262): kept out of the
    // container's merging, to be counted out as there's stock)
    const vegRe = new RegExp(`^${node}_(?!Frame)([A-Za-z]+)_(\\d+)$`)
    const vegOf = (o: THREE.Object3D) => { for (let q: THREE.Object3D | null = o; q; q = q.parent) { const x = vegRe.exec(q.name); if (x) return { kind: x[1], i: +x[2] } } return null }
    // (a fine ink line: the room's 4 mm round vegetables this small drew a thick black ring round each, a cartoon's blobs (item 153))
    const r = partOf(gltf.scene, node, 0.0015, (o) => !!vegOf(o))
    r.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    // (each kind's pieces by material (a tomato's red and its green calyx), in the vegetables' order: one mesh and one line each, cut to the
    // first so many (countedBatch, as the sacks' potatoes))
    const byKind = new Map<string, Map<THREE.Material, { m: THREE.Mesh; i: number }[]>>()
    r.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || (m.material as THREE.Material).side === THREE.BackSide) return
      const v = vegOf(o)
      if (!v) return
      const mats = byKind.get(v.kind) ?? new Map<THREE.Material, { m: THREE.Mesh; i: number }[]>()
      byKind.set(v.kind, mats)
      const list = mats.get(m.material as THREE.Material) ?? []
      mats.set(m.material as THREE.Material, list)
      list.push({ m, i: v.i })
    })
    const kinds = [...byKind].map(([kind, mats]) => {
      const lists = [...mats.values()].map((list) => list.sort((a, b) => a.i - b.i))
      const all = Math.max(...lists.flatMap((l) => l.map((x) => x.i))) + 1
      return { stock: VEG_STOCK[kind] ?? null, all, shown: -1, batches: lists.map((l) => ({ at: l.map((x) => x.i), b: countedBatch(r, l.map((x) => x.m)) })) }
    })
    return { obj: r, kinds }
  }, [gltf, node])
  useFrame(() => {
    // (none of anything in the larder: the kinds that aren't on the menu go too; no shop running: all of them there)
    const any = LARDER.some((id) => SUPPLIES.has(id) !== 0)
    for (const k of kinds) {
      const n = pileShown(k.stock ? SUPPLIES.has(k.stock) : any ? -1 : 0, k.all)
      if (n === k.shown) continue
      k.shown = n
      for (const bt of k.batches) bt.b.show(bt.at.filter((i) => i < n).length)
    }
  })
  const [title, hint] = VEG_SAYS[node]
  return (
    <group onPointerOver={(e) => { if (getEdit().on) return; tipOver(title, hint).onPointerOver(e) }}
      onPointerOut={(e) => { if (getEdit().on) return; tipOver(title, '').onPointerOut(e) }}
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
