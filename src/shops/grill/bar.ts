import * as THREE from 'three'
import { glowOff, glowOnly } from '@/scene/hoverGlow'

/*
 * Where the customers sit: one or more counters, each a straight run of stools. A counter is given by its middle
 * (`at`, on the floor), the way it runs (`along`) and the way across it toward the cook (`lay`); its customers sit on
 * the far side, facing the cook. (along × up = lay, so every counter's frame turns the same way.) Behind each row of
 * stools runs an aisle, and the customers walk in along the aisles, never through the stools.
 */
export type Counter = { at: THREE.Vector3; along: THREE.Vector3; lay: THREE.Vector3; length: number; seats: number
  /** its stools moved along it this far from evenly spaced about its middle (clear of a gate at one end) */
  shift?: number
  /** how far behind its middle line its wall stands (FLOOR_FAR unless it's further back, to make room by it) */
  far?: number }
export type Seat = {
  /** on the counter top (y 0: set the top's height yourself): where the plate goes */
  plate: THREE.Vector3
  /** the stool, on the floor */
  stool: THREE.Vector3
  /** the aisle just behind the stool */
  aisle: THREE.Vector3
  /** which way the customer faces sat down */
  yaw: number
  along: THREE.Vector3
  lay: THREE.Vector3
  counter: number
}

/** how far behind the counter's middle line the stools stand, and the aisle behind them */
export const SIT_BACK = 0.5
export const AISLE = 1.15
/** the customers' floor runs from this far toward the cook from a counter's middle line (under the bar, up to its
 * cook's edge's reach) back to the wall behind the aisle; the kitchen's floor starts where it stops */
export const FLOOR_NEAR = 0.42
export const FLOOR_FAR = -(AISLE + 0.5)
/** where a counter's wall stands, behind its middle line */
export const farOf = (c: Counter) => c.far ?? FLOOR_FAR

/**
 * The seats with a customer's plate set down at them just now (GuestBar3D keeps it, every frame): what's grilled for
 * someone is only carried over once their plate's there, so it never lands on the bare bar before it.
 */
export const PLATES_SET = new Set<number>()
/**
 * The stools someone's at in the 3D room just now (GuestBar3D): sat there, on their way to it, away at the toilet, or
 * still getting up and going. Nobody new is given one of these, though the shop's done with whoever had it.
 */
export const SEATS_TAKEN = new Set<number>()

/**
 * Serving through the pass, when there's a server on the floor: what's grilled is put out at the pass (the end of the
 * first counter by the clean plates); a server picks it up there with a plate and carries it to the customer, and
 * sets it down in front of them. Roasting moves the food, GuestBar3D the server and the plates; this is what they tell
 * each other, by the food's key.
 */
export const SERVICE = {
  /** how many servers there are to carry (GuestBar3D says): none, and the cook hands it over the bar himself */
  servers: 0,
  /** what's out at the pass waiting to go, and for which seat (Roasting) */
  waiting: new Map<string, number>(),
  /** what's being carried, and where it is just now, in the shop's frame (GuestBar3D) */
  carried: new Map<string, THREE.Vector3>(),
  /** what's been set down at its seat (GuestBar3D; Roasting lays it on the plate and takes it out of here) */
  delivered: new Set<string>(),
  /** where the staff walking about are just now, in the bar's own frame (the gates in the bar open for them) */
  walkers: [] as THREE.Vector3[],
  /** what a server has gone to fetch from the pass (no longer waiting there for another to take) */
  claimed: new Set<string>(),
}
// (in development, to be watched from the console)
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __service?: typeof SERVICE }).__service = SERVICE
/**
 * The staff's way through each counter, at its outer end (GRILL_COUNTERS order): which end, how wide the gap in the
 * base and top is, and how wide the swing door across it (the first counter's reaches on to the till, which stands
 * against its end)
 */
export const BAR_GATES: { end: 1 | -1; w: number; leaf: number }[] = [{ end: 1, w: 0.43, leaf: 0.47 }, { end: -1, w: 0.3, leaf: 0.34 }]
/** a gate's hinge (along its counter, from the middle), and the middle of its doorway, in the bar's frame */
export function gateOf(c: Counter, g: { end: 1 | -1; w: number; leaf: number }) {
  const hinge = g.end * ((c.length + 0.2) / 2 - g.w)
  return { hinge, mid: c.at.clone().addScaledVector(c.along, hinge + g.end * g.leaf / 2).addScaledVector(c.lay, 0.08) }
}
/**
 * The little dish of sauce at a seat (the bar's frame, on its top): to the customer's left of their place, or their
 * right at a seat where the left would be off the top, by a gate. Its offset along the counter, given its seat's.
 */
export function sauceSide(c: Counter, gate: { end: 1 | -1; w: number } | undefined, x: number) {
  const topX0 = -(c.length + 0.3) / 2 + (gate && gate.end < 0 ? gate.w : 0)
  return x - 0.2 - 0.06 < topX0 ? 0.2 : -0.2
}
/** things in the room that can be clicked (the toilets' doors, the altar's incense): how many are under the pointer */
export const POINTER_HINT = { hand: 0 }
/** handlers for one of those: a hand over it */
export const handOver = {
  onPointerOver: (e: { stopPropagation: () => void; nativeEvent: Event; eventObject?: THREE.Object3D }) => {
    e.stopPropagation()
    // (and the thing itself lights up, so it's plain which one is under the pointer)
    glowOnly(e.eventObject)
    POINTER_HINT.hand++
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style) el.style.cursor = 'pointer'
  },
  onPointerOut: (e: { nativeEvent: Event; eventObject?: THREE.Object3D }) => {
    glowOff(e.eventObject)
    glowOnly(null)
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand - 1)
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style && !POINTER_HINT.hand) el.style.cursor = ''
  },
}
/** each toilet's door's width, and how far it slides open along the wall */
export const WC_W = 0.82
export const WC_SLIDE = WC_W - 0.1
/**
 * The two toilets, the men's and the women's, side by side in the side counter's wall where it runs into the corner:
 * each one's door along that counter (from its middle), the spot on the floor before it, and one inside. With only the
 * one counter there are none.
 */
export function toiletsOf(cs: Counter[]) {
  if (cs.length < 2) return null
  const c0 = cs[0], c = cs[1]
  const meet = c0.at.clone().addScaledVector(c0.lay, FLOOR_NEAR).sub(c.at).dot(c.along)
  const corner = (FLOOR_FAR - c.at.clone().sub(c0.at).dot(c0.lay)) / c.along.dot(c0.lay)
  // (set back from the corner far enough that the women's door, sliding open toward it, stays on the wall)
  const door = Math.min((meet + corner) / 2, corner - (WC_W + 0.12 + WC_SLIDE + 0.08))
  const one = (k: number) => {
    const z = door + k * (WC_W / 2 + 0.06)
    const at = (lay: number) => c.at.clone().addScaledVector(c.along, z).addScaledVector(c.lay, lay)
    return { z, front: at(farOf(c) + 0.45), aisle: at(-AISLE), inside: at(farOf(c) - 0.45) }
  }
  return { door, m: one(-1), f: one(1) }
}
/** the two drinks fridges against the side counter's wall, just along from the toilets, side by side: where each stands
 * (along that counter, and out from its middle line), the way it faces, and the spot before it where a customer helps themselves */
export function fridgesOf(cs: Counter[]) {
  const t = toiletsOf(cs)
  if (!t) return null
  const c = cs[1]
  // (the first clear of where the men's door slides open, the second on along the wall from it)
  // (as close along to the men's door's slide as it allows)
  const z0 = t.m.z - WC_W / 2 - 0.06 - WC_SLIDE - FRIDGE.W / 2 - 0.02
  // (the door's hinged on the fridge's own left, and swings out that side: whoever's helping themselves stands a little right of
  // its middle, clear of it; the fridge's own +x is (lay.z, -lay.x) in this frame)
  const side = new THREE.Vector3(c.lay.z, 0, -c.lay.x).multiplyScalar(0.17)
  return [0, 1].map((n) => {
    const z = z0 - n * (FRIDGE.W + 0.03)
    const at = (lay: number) => c.at.clone().addScaledVector(c.along, z).addScaledVector(c.lay, lay)
    return { n, z, at: at(farOf(c) + FRIDGE.D / 2 + 0.01), yaw: Math.atan2(c.lay.x, c.lay.z), front: at(farOf(c) + FRIDGE.D + 0.34).add(side), aisle: at(-AISLE) }
  })
}
/** the fridge's size: across, up, deep */
export const FRIDGE = { W: 0.86, H: 2.17, D: 0.75 }
/** each fridge's door: how many are at it just now (GuestBar3D), and whether the player's opened it (a click) */
export const FRIDGE_STATE = [{ passing: 0, open: false }, { passing: 0, open: false }]
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fridge?: typeof FRIDGE_STATE }).__fridge = FRIDGE_STATE
/** what's in it, and what each costs (NT$) */
export const DRINKS = [
  // bottles
  { id: 'beer', zh: '瓶裝啤酒', ja: '瓶ビール', price: 120, color: '#7a4a1a', cap: '#d4b04a', glass: false, shape: 'bottle', label: ['#c8a040', '#7a1a12', '生ビール'] },
  { id: 'sake', zh: '清酒', ja: '日本酒', price: 150, color: '#e8eef0', cap: '#c4302a', glass: true, shape: 'bottle', label: ['#f4efe2', '#b8261c', '清酒'] },
  { id: 'oolong', zh: '烏龍茶', ja: 'ウーロン茶', price: 50, color: '#9a5a1a', cap: '#2a6a3a', glass: false, shape: 'bottle', label: ['#3a6a3a', '#f2e6c8', '烏龍茶'] },
  { id: 'ramune', zh: '彈珠汽水', ja: 'ラムネ', price: 60, color: '#8ad0e8', cap: '#2a6ab0', glass: true, shape: 'bottle', label: ['#2a6ab0', '#ffffff', 'ラムネ'] },
  // cans
  { id: 'beerCan', zh: '罐裝啤酒', ja: '缶ビール', price: 100, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#e8d070', '#b8261c', 'ビール'] },
  { id: 'highball', zh: '調酒', ja: 'ハイボール', price: 110, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#1c2a4a', '#e8c45a', 'ハイボール'] },
  { id: 'coffee', zh: '罐裝咖啡', ja: '缶コーヒー', price: 45, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#4a2a18', '#f2e2c0', '珈琲'] },
  { id: 'greenTea', zh: '綠茶', ja: '緑茶', price: 40, color: '#9bb85a', cap: '#2f7a3a', glass: false, shape: 'can', label: ['#4a8a3a', '#ffffff', 'お茶'] },
  { id: 'cola', zh: '可樂', ja: 'コーラ', price: 40, color: '#4a2414', cap: '#c4302a', glass: false, shape: 'can', label: ['#b8201c', '#ffffff', 'コーラ'] },
  // the little bottles of cultured milk drink
  { id: 'yakult', zh: '養樂多', ja: '乳酸菌飲料', price: 20, color: '#f2ece0', cap: '#c4302a', glass: false, shape: 'small', label: ['#f2ece0', '#c4302a', '乳酸菌'] },
  // a sports drink in its plastic bottle, the glass milk bottle with its paper cap, a chuhai in a can
  { id: 'sports', zh: '運動飲料', ja: 'スポーツドリンク', price: 50, color: '#a8d8ee', cap: '#1f6fb8', glass: true, shape: 'bottle', label: ['#f4f9fc', '#1f6fb8', 'スポーツ'] },
  { id: 'milk', zh: '牛奶', ja: '牛乳', price: 45, color: '#f6f2e6', cap: '#f4efe2', glass: true, shape: 'bottle', label: ['#f4f0e4', '#3a6ab0', '牛乳'] },
  { id: 'chuhai', zh: '酎沙瓦', ja: 'チューハイ', price: 90, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#f6b8c4', '#ffffff', 'チューハイ'] },
] as const
export type DrinkId = (typeof DRINKS)[number]['id']
/**
 * The two fridges: the ordinary drinks (teas, cola, a sports drink, milk, coffee, cultured milk) in the first, the
 * alcohol (sake and beer in bottles, beer, highballs and chuhai in cans) in the second. Each shelf, bottom up, is a row
 * of places, the big bottles low; the unit a drink lives in is where a customer goes for it.
 */
export const FRIDGE_UNITS: { sign: [string, string]; shelves: { y: number; pitch: number; ids: DrinkId[] }[] }[] = [
  { sign: ['飲料', 'ドリンク'], shelves: [
    { y: 0.27, pitch: 0.082, ids: ['oolong', 'oolong', 'oolong', 'greenTea', 'greenTea', 'greenTea', 'sports', 'sports', 'sports'] },
    { y: 0.72, pitch: 0.08, ids: ['cola', 'cola', 'cola', 'cola', 'cola', 'ramune', 'ramune', 'ramune', 'ramune'] },
    { y: 1.19, pitch: 0.07, ids: ['milk', 'milk', 'milk', 'milk', 'milk', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee'] },
    { y: 1.63, pitch: 0.06, ids: ['yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult', 'yakult'] },
  ] },
  { sign: ['酒類', 'お酒'], shelves: [
    { y: 0.27, pitch: 0.082, ids: ['sake', 'sake', 'sake', 'sake', 'beer', 'beer', 'beer', 'beer', 'beer'] },
    { y: 0.72, pitch: 0.07, ids: ['beerCan', 'beerCan', 'beerCan', 'beerCan', 'beerCan', 'chuhai', 'chuhai', 'chuhai', 'chuhai', 'chuhai'] },
    { y: 1.19, pitch: 0.07, ids: ['highball', 'highball', 'highball', 'highball', 'highball', 'chuhai', 'chuhai', 'chuhai', 'chuhai', 'chuhai'] },
    { y: 1.63, pitch: 0.07, ids: ['beerCan', 'beerCan', 'beerCan', 'beerCan', 'highball', 'highball', 'highball', 'highball'] },
  ] },
]
/** which fridge a drink lives in */
export const fridgeUnitOf = (id: DrinkId) => Math.max(0, FRIDGE_UNITS.findIndex((u) => u.shelves.some((sh) => sh.ids.includes(id))))
/**
 * What stands in the fridges: each place holds a drink or nothing (taken); drinks the player's taken out stand on the floor
 * before their fridge. A customer who takes a drink empties a place (the last of that kind in its fridge); the shop puts
 * one back after a while; and the player can drag any drink to another place in the same fridge (an empty one, or
 * swapping), or out onto the floor, and back in again. `ver` goes up with every change, for the drawing to follow.
 */
export const FRIDGE_STOCK = {
  units: FRIDGE_UNITS.map((u) => u.shelves.map((sh) => [...sh.ids] as (DrinkId | null)[])),
  /** (x, z: out on the floor before the fridge, in its own frame; w: set down on a table, anywhere, in the scene's) */
  out: [] as { id: DrinkId; unit: number; x: number; z: number; w?: [number, number, number]; fy?: number; vy?: number; fell?: number; tip?: number; roll?: number; tipped?: boolean }[],
  ver: 0,
}
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __stock?: typeof FRIDGE_STOCK }).__stock = FRIDGE_STOCK
/** a customer takes a drink: the last place holding one of that kind is emptied (any kind at all if it's run out) */
export function takeDrink(id: DrinkId) {
  const home = fridgeUnitOf(id)
  for (const u of [home, ...FRIDGE_STOCK.units.map((_, i) => i).filter((i) => i !== home)]) {
    const rows = FRIDGE_STOCK.units[u]
    for (const want of [id, null as DrinkId | null]) {
      for (let r = rows.length - 1; r >= 0; r--) {
        for (let k = rows[r].length - 1; k >= 0; k--) {
          if (want ? rows[r][k] === want : rows[r][k]) {
            rows[r][k] = null
            FRIDGE_STOCK.ver++
            return
          }
        }
      }
    }
    if (u === home) break
  }
}
/** the shop puts back one drink in a fridge where one's been taken (the first empty place, its own kind) */
export function restockDrink(unit: number) {
  const rows = FRIDGE_STOCK.units[unit]
  for (let r = 0; r < rows.length; r++) {
    const k = rows[r].findIndex((x) => x === null)
    if (k >= 0) {
      rows[r][k] = FRIDGE_UNITS[unit].shelves[r].ids[k]
      FRIDGE_STOCK.ver++
      return true
    }
  }
  return false
}
/** the player moves a drink from one place to another in a fridge (swapping with what's there, if anything) */
export function moveDrink(unit: number, from: [number, number], to: [number, number]) {
  const rows = FRIDGE_STOCK.units[unit]
  const a = rows[from[0]][from[1]]
  rows[from[0]][from[1]] = rows[to[0]][to[1]]
  rows[to[0]][to[1]] = a
  FRIDGE_STOCK.ver++
}
/** the player takes a drink out of a fridge and stands it on the floor before it (x across, z out from it) */
export function pullOut(unit: number, from: [number, number], x: number, z: number, w?: [number, number, number]) {
  const id = FRIDGE_STOCK.units[unit][from[0]][from[1]]
  if (!id) return
  FRIDGE_STOCK.units[unit][from[0]][from[1]] = null
  FRIDGE_STOCK.out.push({ id, unit, x, z, w })
  FRIDGE_STOCK.ver++
}
/** a drink that's out is set down somewhere else on a table */
export function moveOut(index: number, w: [number, number, number]) {
  const o = FRIDGE_STOCK.out[index]
  if (!o) return
  o.w = w
  FRIDGE_STOCK.ver++
}
/**
 * Where a ray from the pointer meets a table a drink can be set down on, if it does: the cook's table's top (not on its
 * stone ring, not in the notch the cook stands in) and the tops of the bar's counters, wherever along them. The point, in the
 * scene's own frame, or null.
 */
export function tableHit(ray: THREE.Ray): THREE.Vector3 | null {
  const best: { p: THREE.Vector3; t: number }[] = []
  const at = (y: number, ok: (p: THREE.Vector3) => boolean) => {
    if (Math.abs(ray.direction.y) < 1e-6) return
    const t = (y - ray.origin.y) / ray.direction.y
    if (t <= 0) return
    const p = ray.origin.clone().addScaledVector(ray.direction, t)
    if (ok(p)) best.push({ p, t })
  }
  // (the cook's table: its top is the scene's y = 0)
  at(0, (p) => {
    const lay = p.dot(LAY), along = p.dot(ALONG)
    if (lay < -2.0 || lay > 2.6 || along < -2.3 || along > 3.0) return false
    if (Math.hypot(p.x, p.z) < 2.0) return false
    if (lay > 1.75 && along > -1.85 && along < -0.3) return false
    return true
  })
  // (the bar's tops)
  const top = GRILL_BAR_TOP * GRILL_SCALE + GRILL_OFFSET.y
  at(top, (p) => {
    const q = p.clone().sub(GRILL_OFFSET).divideScalar(GRILL_SCALE)
    return GRILL_COUNTERS.some((c) => {
      const d = q.clone().sub(new THREE.Vector3(c.at.x, 0, c.at.z)).setY(0)
      return Math.abs(d.dot(c.along)) <= c.length / 2 + 0.1 && Math.abs(d.dot(c.lay)) <= 0.27
    })
  })
  best.sort((a, b) => a.t - b.t)
  return best[0]?.p ?? null
}
/** and puts one back, into an empty place */
export function putBack(index: number, unit: number, to: [number, number]) {
  const o = FRIDGE_STOCK.out[index]
  if (!o || FRIDGE_STOCK.units[unit][to[0]][to[1]]) return false
  FRIDGE_STOCK.units[unit][to[0]][to[1]] = o.id
  FRIDGE_STOCK.out.splice(index, 1)
  FRIDGE_STOCK.ver++
  return true
}

/** what each kind of customer takes from the fridge: the children a ramune, the old folk tea, the rest any */
export const drinkFor = (kind: string, id: number): DrinkId => {
  const of = (l: DrinkId[]) => l[id % l.length]
  if (kind === 'kid') return of(['ramune', 'yakult', 'cola'])
  if (kind === 'grandma' || kind === 'grandpa') return of(['oolong', 'greenTea', 'yakult', 'sake'])
  if (kind === 'highSchoolGirl' || kind === 'highSchoolBoy') return of(['cola', 'ramune', 'greenTea', 'coffee', 'yakult'])
  if (kind === 'salaryman' || kind === 'civilServant') return of(['beerCan', 'coffee', 'highball', 'beer'])
  if (kind === 'uncle') return of(['beer', 'sake', 'highball', 'beerCan'])
  return of(['beer', 'highball', 'sake', 'beerCan', 'oolong', 'coffee', 'cola'])
}

/** the toilets' doors: how many are going through each just now (GuestBar3D), and whether the player's opened it */
export const TOILETS = { m: { passing: 0, open: false }, f: { passing: 0, open: false } }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __toilets?: typeof TOILETS }).__toilets = TOILETS

/**
 * How far the kitchen's floor lies below the customers' (in the scene's own units): the cooks stand lower, so the bar is
 * at a seated customer's elbow and the cook looks over it; a step or two at each gate, and risers down the rest.
 */
export const KITCHEN_DROP = 0.22
/**
 * The sunken kitchen inside the counters, in the first counter's frame (along it, and lay from its middle): from the
 * side counter's cook's face to a little past the first counter's far end, and from the first counter's cook's face
 * (the bar's base stands this far over its middle line) out to the room's front edge.
 */
export function kitchenOf(cs: Counter[]) {
  const c0 = cs[0], c1 = cs[1]
  const room = roomOf(cs)
  const along0 = c1 ? c1.at.clone().addScaledVector(c1.lay, 0.28).sub(c0.at).dot(c0.along) : -c0.length / 2
  return { along: [along0, c0.length / 2 + 0.15] as [number, number], lay: [0.28, room.lay[1]] as [number, number] }
}
/** where the staff's way through each counter's gate lies on the kitchen's edge: along the first counter's cook's face, and
 * along (in lay) the kitchen's side by the side counter */
/** how much further than the side gate's doorway its steps reach, inward along the counter */
const SIDE_STEP_EXTRA = 0.22
export function kitchenGatesOf(cs: Counter[]) {
  const c0 = cs[0], c1 = cs[1]
  const g0 = gateOf(c0, BAR_GATES[0])
  // (the way through is the gap in the base, from the hinge's post to the counter's end: its width w, not the door leaf's)
  const a = [g0.hinge, g0.hinge + BAR_GATES[0].end * BAR_GATES[0].w].sort((p, q) => p - q) as [number, number]
  let side: [number, number] | null = null
  if (c1 && BAR_GATES[1]) {
    const g1 = gateOf(c1, BAR_GATES[1])
    const at = (s: number) => c1.at.clone().addScaledVector(c1.along, s).sub(c0.at).dot(c0.lay)
    // (the steps reach a good way further in than the door, along the counter, to fill the well beside it)
    side = [at(g1.hinge), at(g1.hinge + BAR_GATES[1].end * (BAR_GATES[1].w + SIDE_STEP_EXTRA))].sort((p, q) => p - q) as [number, number]
  }
  return { first: a, side }
}

/** the till: how far past the first counter's middle it stands (it butts on to the counter's end), and its size */
export const TILL = { along: 0.75, W: 1.2, D: 0.82, rise: 0.22,
  /** how far back from the first counter's line (toward the kitchen) its middle stands */
  lay: 0.3 }

/** the till's live state: what its displays read and how far its drawer is out (0 shut, 1 open), set by the customer paying there */
export const TILL_STATE = { text: '0', drawer: 0,
  /** how far on the customer's payment has got (0..1; -1 when no one's paying), the note they hand over and the change they're due */
  k: -1, tender: 0, change: 0,
  /** the drawer pulled out by hand (clicked), apart from the customers' payments */
  manual: false }
/** what a customer's bill comes to: the dishes they ordered and the drink from the fridge, if they took one */
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __till?: typeof TILL_STATE }).__till = TILL_STATE
export const billOf = (items: number, drink?: DrinkId) => Math.max(1, items) * 380 + (drink ? 320 : 0)
/** the figures on the register's displays: a number with its thousands comma */
export const yen = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
/**
 * Where a customer pays on the way out: they stand before the till (on the floor of the room, just short of the
 * genkan's step), reached from the aisle by a lane past the bar's end, and go on from there to the door.
 */
export function payOf(cs: Counter[]) {
  const c0 = cs[0]
  const at = (along: number, lay: number) => c0.at.clone().addScaledVector(c0.along, c0.length / 2 + along).addScaledVector(c0.lay, lay)
  return { spot: at(TILL.along, TILL.lay - TILL.D / 2 - 0.25), lane: at(0.4, TILL.lay - TILL.D / 2 - 0.25), aisle: at(0.4, -AISLE) }
}

/** the pass, in the bar's own frame (on the first counter's top, at its start, the customers' side of it) */
export const passOf = (cs: Counter[]) => cs[0].at.clone().addScaledVector(cs[0].along, -cs[0].length / 2 + 0.2)
  .addScaledVector(cs[0].lay, -0.16)

/**
 * The whole shop's floor as one rectangle, in the first counter's frame (along it and across it, lay, from its middle):
 * every counter's floor from its far end and wall to where it meets the others, the strip behind the till, and the
 * kitchen inside them, squared off, so there's no corner left open.
 */
export function roomOf(cs: Counter[]) {
  const c0 = cs[0]
  const pts: THREE.Vector3[] = []
  const add = (c: Counter, along: [number, number], lay: [number, number]) => {
    for (const a of along) for (const l of lay) pts.push(c.at.clone().addScaledVector(c.along, a).addScaledVector(c.lay, l))
  }
  // (the first counter's floor runs on past its end to the door, with the till's strip behind it)
  add(c0, [-c0.length / 2 - 0.35, c0.length / 2 + 1.45], [FLOOR_FAR, 1.1])
  for (const c of cs.slice(1)) add(c, [-c.length / 2 - 0.35, c.length / 2], [farOf(c), FLOOR_NEAR])
  const al = pts.map((p) => p.clone().sub(c0.at).dot(c0.along)), ly = pts.map((p) => p.clone().sub(c0.at).dot(c0.lay))
  return { along: [Math.min(...al), Math.max(...al)] as [number, number], lay: [Math.min(...ly), Math.max(...ly)] as [number, number] }
}

export const LAY = new THREE.Vector3(0.59, 0, 0.81)
export const ALONG = new THREE.Vector3(0.81, 0, -0.59)

export function seatsOf(cs: Counter[]): Seat[] {
  return cs.flatMap((c, ci) => Array.from({ length: c.seats }, (_, n) => {
    const plate = c.at.clone().addScaledVector(c.along, (n - (c.seats - 1) / 2) * (c.length / c.seats) + (c.shift ?? 0))
    return {
      plate,
      stool: plate.clone().addScaledVector(c.lay, -SIT_BACK),
      aisle: plate.clone().addScaledVector(c.lay, -AISLE),
      yaw: Math.atan2(c.lay.x, c.lay.z),
      along: c.along,
      lay: c.lay,
      counter: ci,
    }
  }))
}

/**
 * The genkan (玄関) just inside the door: a floor of dark stone a step down from the room's boards, from the wall out
 * past the doorway and from the room's end back to the step up into the room (the first counter's frame: along it,
 * and lay, from its middle). Customers step up out of their shoes there, and into slippers.
 */
export const GENKAN = { depth: 0.1, along: [0.5, 1.45] as [number, number], lay: [FLOOR_FAR, -0.42] as [number, number] }
/** whether a point (the bar's frame) is down in the genkan */
export function inGenkan(cs: Counter[], p: THREE.Vector3) {
  const c0 = cs[0], d = p.clone().sub(c0.at)
  const a = d.dot(c0.along) - c0.length / 2, l = d.dot(c0.lay)
  return a > GENKAN.along[0] && a < GENKAN.along[1] + 0.01 && l > GENKAN.lay[0] - 0.01 && l < GENKAN.lay[1]
}
/** the way in: on the first counter's aisle, just past its far end */
export const doorOf = (cs: Counter[]) => cs[0].at.clone().addScaledVector(cs[0].along, cs[0].length / 2 + 1.0)
  .addScaledVector(cs[0].lay, -AISLE)

/**
 * From the door to a stool: along the first counter's aisle, round the corner into another counter's aisle if
 * that's where the stool is, up behind the stool, and onto it.
 */
export function pathTo(cs: Counter[], s: Seat): THREE.Vector3[] {
  const door = doorOf(cs)
  if (s.counter === 0) return [door, s.aisle, s.stool]
  const c0 = cs[0], c = cs[s.counter]
  const p0 = c0.at.clone().addScaledVector(c0.lay, -AISLE)
  const p1 = c.at.clone().addScaledVector(c.lay, -AISLE)
  const corner = p0.clone().addScaledVector(c0.along, p1.clone().sub(p0).dot(c0.along))
  return [door, corner, s.aisle, s.stool]
}

/** a point that far along a path, and the way it's heading there */
export function alongPath(path: THREE.Vector3[], d: number): { p: THREE.Vector3; dir: THREE.Vector3 } {
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].clone().sub(path[i - 1])
    const len = seg.length()
    if (d <= len || i === path.length - 1) {
      const k = len ? Math.min(1, Math.max(0, d / len)) : 1
      return { p: path[i - 1].clone().addScaledVector(seg, k), dir: len ? seg.divideScalar(len) : new THREE.Vector3(0, 0, 1) }
    }
    d -= len
  }
  return { p: path[path.length - 1].clone(), dir: new THREE.Vector3(0, 0, 1) }
}

export const pathLength = (path: THREE.Vector3[]) => path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0)

/** a single counter of four (the shops that don't lay out their own) */
export const singleCounter = (at: THREE.Vector3, length: number): Counter[] => [{ at, along: ALONG, lay: LAY, length, seats: 4 }]

/**
 * The grill's: the long counter behind the fire, and a second one down the left side of the room, its customers
 * looking in across the fire from the left. The door is past the right end of the first.
 */
/** how far the side counter, its stools and its aisle are pulled in from the wall (bar units) */
export const SIDE_PULL = 0.3
export const GRILL_COUNTERS: Counter[] = [
  // (its start drawn in to meet the side counter, which is drawn in from the wall by SIDE_PULL: the far end stays where it was)
  { at: new THREE.Vector3().addScaledVector(LAY, -2.45).addScaledVector(ALONG, -0.35 + SIDE_PULL / 2), along: ALONG, lay: LAY, length: 5.2 - SIDE_PULL, seats: 6 },
  // (the side counter drawn back from its wall by SIDE_PULL, so the fridges' doors swing clear of its stools)
  { at: new THREE.Vector3().addScaledVector(LAY, -0.42 + 0.25).addScaledVector(ALONG, -2.75 + SIDE_PULL), along: LAY.clone().negate(), lay: ALONG, length: 3.14 + 0.5, seats: 4, shift: 0.25 - 0.1,
    // (its wall set further back, for the drinks fridges by the toilets: where it was, the counter having moved off it)
    far: FLOOR_FAR - 0.45 - SIDE_PULL },
]
export const GRILL_SEATS = seatsOf(GRILL_COUNTERS)
/** the staff door in the room's front edge (the first counter's frame: along it, and lay from its middle) and the spot just
 * inside it, where the staff go in and out */
// (the mat's outer edge flush with the room's front edge, lay 3.97: its middle half its depth in from it)
export const STAFF_DOOR = { along: 1.3, lay: 4.1 }
export const staffDoorAt = (c: Counter, lay = STAFF_DOOR.lay - 0.25) => c.at.clone().addScaledVector(c.along, STAFF_DOOR.along).addScaledVector(c.lay, lay)
/**
 * The grill's bar, stools and customers are all drawn this much bigger than their sizes here, to stand beside the
 * fire pit and its big skewers: scaled about the inside corner of the two counters' cook's edges, so those edges stay
 * where they are by the fire and the rest grows away from it. Roasting moves its own uses of them to match.
 */
export const GRILL_SCALE = 2
/** how far along the table the fire (and all that's laid out round it) stands from where the table was drawn for it, to sit in the table's middle */
export const FIRE_SHIFT = new THREE.Vector3().addScaledVector(ALONG, 0.65)
/** the grill's bar top, in its own sizes */
export const GRILL_BAR_TOP = 0.64
/** the cook's own table (the fire pit and all on it) has its top at the scene's floor, y = 0; the customers' floor is
 * further down, so their bar top comes up just this much higher than it */
export const GRILL_BAR_RISE = 0.12
const GRILL_PIVOT = new THREE.Vector3().addScaledVector(LAY, -2.14).addScaledVector(ALONG, -2.44)
/** where the scaled bar's group goes (with scale GRILL_SCALE) */
export const GRILL_OFFSET = GRILL_PIVOT.clone().multiplyScalar(1 - GRILL_SCALE).setY(GRILL_BAR_RISE - GRILL_BAR_TOP * GRILL_SCALE)
/**
 * Where the customers' plates are kept (the bar's frame, on the cook's table, inside, by the pass): the clean stack
 * and the dirty one beside it, back from the bar where the customers can't reach; and the height of that table's top.
 */
/**
 * The cubby cut into the cook's table under its top, in its front face (the cook's side): open to the front, a low plinth
 * at its foot and one shelf over its right-hand part. Where the plates and dishes are kept: the customers' clean and dirty
 * stacks on its floor to the left, the cook's big plate on its floor to the right with the side dishes on the shelf over it.
 * (along and lay in the first counter's frame, from the table's own sizes in Roasting; heights in the scene.)
 */
/** the second cubby, at the table's left: the trash bin on its floor, the basket on its shelf */
export const CUBBY2 = { along: [-1.5, -0.35], lay: [0.95, 2.1] }
export const CUBBY = { along: [0.55, 3.0], lay: [0.95, 2.1], plinth: 0.1, shelfAlong: 1.85, shelfThick: 0.04 }
/** the cubby's floor and shelf surfaces, in the scene: the table's top is y = 0 */
export const CUBBY_FLOOR_Y = GRILL_OFFSET.y - KITCHEN_DROP + CUBBY.plinth
export const CUBBY_SHELF_Y = -0.76
/** a place in the cubby (along, lay, and which tier it is on), in the scene */
export const cubbyAt = (along: number, lay: number, tier: 'floor' | 'shelf') =>
  new THREE.Vector3().addScaledVector(ALONG, along).addScaledVector(LAY, lay).setY(tier === 'floor' ? CUBBY_FLOOR_Y : CUBBY_SHELF_Y)
export const PLATE_STACKS = (() => {
  // (in the bar's own frame: where those places are, under the table's top, to the left in the cubby)
  const at = (along: number) => cubbyAt(along, 1.5, 'floor').sub(GRILL_OFFSET).multiplyScalar(1 / GRILL_SCALE)
  // (a plate is 0.26 across its radius in the scene: the two stacks stand more than a diameter apart, so the plates of one never run into the other's,
  // the dirty one still clear of the shelf over the cubby's right-hand part, which starts at along 1.85)
  return { clean: at(0.93), dirty: at(1.5) }
})()
/** the height of the cubby's floor, in the bar's own frame, for the stacks of plates standing on it */
export const PLATE_STACK_Y = (CUBBY_FLOOR_Y - GRILL_OFFSET.y) / GRILL_SCALE
/** a point given in the bar's own sizes, where it is in the scene as drawn */
export const toGrillScene = (v: THREE.Vector3) => v.clone().multiplyScalar(GRILL_SCALE).add(GRILL_OFFSET)
/** the cook's table's top (the scene's y = 0), in the bar's own frame */
export const KITCHEN_TOP = -GRILL_OFFSET.y / GRILL_SCALE
