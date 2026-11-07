import * as THREE from 'three'
import { startSkewers, type Skewers } from '@/game/skewers'
import { RUSH } from '@/game/shopState'
import { TUB_FULL, emptyKama, type Kama } from '@/game/rice'
import type { Gripe } from '@/game/reputation'
import { BOX_SHEETS } from '@/game/tissues'
import type { Use } from '@/game/utilities'
import { glowLeave, glowOnly, HOVER } from '@/scene/hoverGlow'
import { aimTip, setTip } from '@/scene/hoverTip'
import { openingFloat, startingRolls, type DrawerCash, type Rolls } from '@/game/till'
import { RACK_FULL, type Dryer } from '@/game/plates'
import type { Flower } from '@/game/shrineFlowers'
import { freshRoom } from '@/game/restroom'
import { emptyFridge, readDrinks, startBack, writeDrinks, type Back } from '@/game/drinkStock'
import { replaces } from '@/scene/hot'
import { ROLL_SLIPS } from '@/game/receipts'

/*
 * Where the customers sit: one or more counters, each a straight run of stools. A counter is given by its middle
 * (`at`, on the floor), the way it runs (`along`) and the way across it toward the cook (`lay`); its customers sit on
 * the far side, facing the cook. (along × up = lay, so every counter's frame turns the same way.) Behind each row of
 * stools runs an aisle, and the customers walk in along the aisles, never through the stools.
 */
export type Counter = { at: THREE.Vector3; along: THREE.Vector3; lay: THREE.Vector3; length: number; seats: number
  /** how far apart its stools are; its length over its seats if not given */
  pitch?: number
  /** its stools moved along it this far from evenly spaced about its middle (clear of a gate at one end) */
  shift?: number
  /** how far behind its middle line its wall stands (FLOOR_FAR unless it's further back, to make room by it) */
  far?: number }
export type Seat = {
  /** the place's middle on the counter's line (y 0): what's laid there goes by it (PLACE) */
  mid: THREE.Vector3
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

/** how far behind the counter's middle line the stools stand, and the aisle behind them (0.58: at 0.5 a sitter's big head, turned about,
 * went into the top's edge) */
export const SIT_BACK = 0.58
export const AISLE = 1.15
/**
 * Where each thing at a place stands, from the place's middle on the counter's line (along: + toward the customer's left as they sit;
 * lay: + toward the cook): the plate a little back from the middle, the chopsticks across before it, the soy dish behind on the left
 * (the owner's), what they drink behind on the right, and the soy bottle and wasabi that each two places share, at the back between them.
 */
export const PLACE = { plate: 0.04, chop: -0.135, sauce: [0.21, 0.13] as const, drink: [-0.2, 0.08] as const, shared: 0.17 }
/** along the counter, from its middle: where each pair of places' soy bottle and wasabi stand (between the two; an odd last place has its
 * own, on its right) */
export const sharedAlong = (c: Counter) => Array.from({ length: Math.ceil(c.seats / 2) }, (_, k) =>
  2 * k + 1 < c.seats ? (seatAlong(c, 2 * k) + seatAlong(c, 2 * k + 1)) / 2 : seatAlong(c, 2 * k) - 0.31)
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
/** the places whose chopsticks are up: their customer's eating (GuestBar3D fills it each frame; Roasting's BarChopsticks takes those pairs
 * off their rests, FolkFigure has them in the hand) */
export const CHOPS_UP = new Set<number>()
/** the customers whose stomachs something spoiled has upset (game/freshness sickChance): off to the toilet as soon as they can be */
export const SICK = new Set<number>()
/**
 * The people about the kitchen (the owner, the cooks, the servers), each figure put in by its own while it's drawn and taken out when it
 * goes: the cook's table's cupboard doors don't swing into anyone stood or passing in front of them (read from their world matrices).
 */
export const KITCHEN_FOLK = new Set<THREE.Object3D>()

/**
 * Serving through the pass, when there's a server on the floor: what's grilled is put out at the pass (the end of the
 * first counter by the clean plates); a server picks it up there with a plate and carries it to the customer, and
 * sets it down in front of them. Roasting moves the food, GuestBar3D the server and the plates; this is what they tell
 * each other, by the food's key.
 */
/** how fresh each food in the pantry is just now (0..100, game/freshness), kept by the App, read when a dish is tasted */
export const PANTRY = { fresh: {} as Record<string, number>,
  /** how fresh the portions last used of each food were (game/lots: the stalest lot first): what a dish made of it tastes of */
  used: {} as Record<string, number> }
/** water (and the power heating it) used about the shop since App last metered it (game/utilities' uses: a plate washed, a flush, the
 * washlet, hands washed, the dipper...): App drains it every second into the month's meter */
export const UTILITY: { uses: Partial<Record<Use, number>> } = { uses: {} }
export const meterWater = (u: Use, n = 1) => { UTILITY.uses[u] = (UTILITY.uses[u] ?? 0) + n }
/** the cook table's fridges' doors open (for what they draw open) */
export const CUBBY_OPEN = { left: false, right: false }
/** when the chef last reached into each fridge under the cook table (performance.now()): its doors open part way for him a moment */
export const CUBBY_KICK = { left: -1e9, right: -1e9 }
/** the staff door held open till then (performance.now()): one of the staff going up or coming down the stair behind it */
export const STAFF_DOOR_HOLD = { until: -1e9 }
/**
 * The shoe cupboard's cubbies (the owner's: a customer's shoes go into one as they come in and out of it as they go): the colour of the
 * shoes in each (by cell, 0..8), when each one's door was last opened for them (performance.now(): open a moment), and where the cupboard
 * stands (the world: the customers turn to it)
 */
export const SHOE_CELLS = { shoes: new Map<number, string>(), kick: new Map<number, number>(), at: new THREE.Vector3(), ready: false }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __shoes?: typeof SHOE_CELLS }).__shoes = SHOE_CELLS
export const TISSUES_KEY = 'jgs-tissues-1'
/** each place's box of tissues (sheets left; game/tissues): a customer takes a few as they finish, the owner one at a time from the
 * drawer; swapped for a full box from the spares before each opening (App); kept in the browser */
export const TISSUES: { boxes: number[] } = { boxes: (() => {
  try { const v = JSON.parse(localStorage.getItem(TISSUES_KEY) ?? 'null'); if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return v as number[] } catch { /* (none kept) */ }
  return []
})() }
/** a place's box (full, for a place never seen before) */
export const tissuesAt = (seat: number) => TISSUES.boxes[seat] ?? BOX_SHEETS
export function setTissues(seat: number, sheets: number) {
  while (TISSUES.boxes.length <= seat) TISSUES.boxes.push(BOX_SHEETS)
  TISSUES.boxes[seat] = sheets
  try { localStorage.setItem(TISSUES_KEY, JSON.stringify(TISSUES.boxes)) } catch { /* (not kept) */ }
}
/** what's put each customer out while they're here (game/reputation's gripes), for their visit's score as they go (Roasting) */
export const GRIPES = new Map<number, Set<Gripe>>()
export const gripe = (id: number, g: Gripe) => {
  const s = GRIPES.get(id) ?? new Set<Gripe>(); s.add(g); GRIPES.set(id, s)
  if (g === 'wait') RUSH.at = performance.now()
}
/** a gripe that comes after a customer's visit's been scored (at the till, paying: no receipt), added to it by App, and said */
export const LATE_GRIPE: { add: (id: number, g: Gripe) => void } = { add: gripe }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __lateGripe?: typeof LATE_GRIPE }).__lateGripe = LATE_GRIPE
/** the receipt printer's roll (game/receipts): slips left on it; `ver` counts its changes, for the stock's panel to follow */
export const PRINTER = { slips: ROLL_SLIPS, ver: 0 }
const printerSubs = new Set<() => void>()
export const onPrinter = (f: () => void) => { printerSubs.add(f); return () => { printerSubs.delete(f) } }
export function setPrinter(slips: number) { if (PRINTER.slips === slips) return; PRINTER.slips = slips; PRINTER.ver++; printerSubs.forEach((f) => f()) }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __printer?: typeof PRINTER }).__printer = PRINTER
/**
 * A customer dragged to another stool (the owner's: customers can be, the owner and the staff can't): GuestBar3D asks (`ask`), Roasting
 * answers (`answer`): yes only while they're sat waiting with nothing cooked theirs yet (a dish is tied to a stool once it's off the fire)
 * and the stool's free; then both move them, Roasting's guest and GuestBar3D's figure.
 */
export const SEAT_MOVE: { ask: { guest: number; from: number; to: number } | null; answer: { guest: number; to: number; ok: boolean } | null } = { ask: null, answer: null }
/** the shop's fifty iron skewers (game/skewers): clean in the holder, dirty in the used tray, carried to the sink; `inUse`, those on food now
 * (Roasting counts them each frame) */
export const SKEWERS: { s: Skewers; inUse: number } = { s: startSkewers(), inUse: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __skewers?: typeof SKEWERS }).__skewers = SKEWERS
/** the owner out on the floor serving (no server hired: he carries the plates, clears them and takes the washed ones back himself, the
 * owner's: nothing flies): GuestBar3D walks a figure of him; Roasting's, at his place in the kitchen, is hidden meanwhile */
export const OWNER_OUT = { on: false }
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
export type Gate = { end: 1 | -1; w: number; leaf: number
  /** the whole gate (post, doorway and door) slid this far along its counter toward the counter's end, its width as it was: the base and top then run on
   * that much further, up to the post */
  shift?: number }
export const BAR_GATES: Gate[] = [{ end: 1, w: 0.43, leaf: 0.47 }, { end: -1, w: 0.56, leaf: 0.55 }]
/** how far the counter's base and top stop short of its end for a gate: its width, less however far the gate's been slid toward the end */
export const gateCut = (g: { w: number; shift?: number }) => g.w - (g.shift ?? 0)
/** a gate's hinge (along its counter, from the middle), and the middle of its doorway, in the bar's frame */
export function gateOf(c: Counter, g: Gate) {
  const hinge = g.end * ((c.length + 0.2) / 2 - gateCut(g))
  return { hinge, mid: c.at.clone().addScaledVector(c.along, hinge + g.end * g.leaf / 2).addScaledVector(c.lay, 0.08) }
}
/**
 * The little dish of sauce at a seat (the bar's frame, on its top): to the customer's left of their place (+ along: the owner's), or their
 * right at a seat where the left would be off the top, by a gate. Its offset along the counter, given its seat's.
 */
export function sauceSide(c: Counter, gate: { end: 1 | -1; w: number; shift?: number } | undefined, x: number) {
  const topX1 = (c.length + 0.3) / 2 - (gate && gate.end > 0 ? gateCut(gate) : 0)
  return x + PLACE.sauce[0] + 0.06 > topX1 ? -PLACE.sauce[0] : PLACE.sauce[0]
}
/** things in the room that can be clicked (the toilets' doors, the shrine's omiki): how many are under the pointer */
export const POINTER_HINT = { hand: 0 }
/** handlers for one of those: a hand over it */
export const handOver = {
  onPointerOver: (e: { stopPropagation: () => void; nativeEvent: Event; eventObject?: THREE.Object3D; camera?: THREE.Camera }) => {
    e.stopPropagation()
    // (in edit mode nothing answers the pointer: only the pieces themselves)
    if (HOVER.paused) return
    // (and the thing itself lights up, so it's plain which one is under the pointer; its tag stands over it)
    glowOnly(e.eventObject)
    aimTip(e)
    POINTER_HINT.hand++
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style) el.style.cursor = 'pointer'
  },
  onPointerOut: (e: { nativeEvent: Event; eventObject?: THREE.Object3D }) => {
    if (HOVER.paused) return
    glowLeave(e.eventObject)
    POINTER_HINT.hand = Math.max(0, POINTER_HINT.hand - 1)
    const el = e.nativeEvent.target as HTMLElement | null
    if (el?.style && !POINTER_HINT.hand) el.style.cursor = ''
  },
}
/** a thing that's only named when pointed at, with nothing to do with it (an omamori, a helmet, an offering): its tag by the pointer, but
 * no glow and the cursor left as it is (the owner's: a glow and a pointing hand say it can be clicked, and these can't) */
export const nameOver = (title: string, hint: string) => ({
  onPointerOver: (e: { stopPropagation: () => void; eventObject?: THREE.Object3D; camera?: THREE.Camera; nativeEvent?: Event }) => { e.stopPropagation(); if (HOVER.paused) return; aimTip(e); setTip({ title, hint }) },
  onPointerOut: () => { if (HOVER.paused) return; setTip(null) },
})
/** `handOver` that also names the thing and says what to do with it, in a tag by the pointer */
export const tipOver = (title: string, hint: string) => ({
  onPointerOver: (e: Parameters<typeof handOver.onPointerOver>[0]) => { handOver.onPointerOver(e); setTip({ title, hint }) },
  onPointerOut: (e: Parameters<typeof handOver.onPointerOut>[0]) => { handOver.onPointerOut(e); setTip(null) },
})
/** each toilet's door's width, and how far it slides open along the wall */
export const WC_W = 0.82
export const WC_SLIDE = WC_W - 0.1
/**
 * Each toilet's rooms behind its door (the owner's: the door slid open shows the washstand and its mirror first; the toilet's round the
 * corner): the washroom straight in, D deep from the wall to its back wall, where the washstand stands; and off its side, away from the other
 * toilet, the toilet's own little room, running E on along the wall, from X0 back (clear of the wall's thickness) to that same back wall.
 * In the room's own frame: x from the door's wall back, z across the door from its middle.
 */
export const WC_ROOM = { D: 0.9, E: 0.84, X0: 0.24 }
/**
 * The two toilets, the men's and the women's, side by side in the side counter's wall where it runs into the corner:
 * each one's door along that counter (from its middle), the spot on the floor before it, and inside: just in at the door, at the
 * washstand, the turn round the corner and before the toilet. With only the one counter there are none.
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
    // (a spot in the rooms, in their own frame: x back from the wall, across from the door's middle; the toilet's room is on the side `k`)
    const room = (x: number, across: number) => c.at.clone().addScaledVector(c.along, z + k * across).addScaledVector(c.lay, farOf(c) - x)
    const { D, X0, E } = WC_ROOM
    return { z, front: at(farOf(c) + 0.45), aisle: at(-AISLE),
      // (just in at the door; before the washstand, facing it; the turn toward the toilet's room; before the toilet, round the corner)
      inside: room(0.12, 0), basin: room(D - 0.6, 0), turn: room(0.34, WC_W / 2 - 0.11), stall: room((X0 + D) / 2 - 0.02, WC_W / 2 + E * 0.13),
      // (the way they face at the washstand: into the room, away from the door)
      basinYaw: Math.atan2(-c.lay.x, -c.lay.z) }
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
    // (a hand's width apart: their signs on top stand a little wider than the cabinets)
    const z = z0 - n * (FRIDGE.W + 0.08)
    const at = (lay: number) => c.at.clone().addScaledVector(c.along, z).addScaledVector(c.lay, lay)
    return { n, z, at: at(farOf(c) + FRIDGE.D / 2 + 0.01), yaw: Math.atan2(c.lay.x, c.lay.z), front: at(farOf(c) + FRIDGE.D + 0.34).add(side), aisle: at(-AISLE) }
  })
}
/** the fridge's size: across, up, deep */
export const FRIDGE = { W: 0.86, H: 2.17, D: 0.75 }
/** each fridge's door: how many are at it just now (GuestBar3D), and whether the player's opened it (a click) */
export const FRIDGE_STATE = [{ passing: 0, open: false }, { passing: 0, open: false }]
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fridgeDoors?: unknown }).__fridgeDoors = FRIDGE_STATE
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fridge?: typeof FRIDGE_STATE }).__fridge = FRIDGE_STATE
/** what's in it, and what each costs (NT$) */
export const DRINKS = [
  // bottles
  { id: 'beer', zh: '瓶裝啤酒', ja: '瓶ビール', en: 'Bottled beer', price: 120, color: '#7a4a1a', cap: '#d4b04a', glass: false, shape: 'bottle', label: ['#c8a040', '#7a1a12', '生ビール'] },
  { id: 'sake', zh: '清酒', ja: '日本酒', en: 'Sake', price: 150, color: '#e8eef0', cap: '#c4302a', glass: true, shape: 'bottle', label: ['#f4efe2', '#b8261c', '清酒'] },
  { id: 'oolong', zh: '烏龍茶', ja: 'ウーロン茶', en: 'Oolong tea', price: 50, color: '#9a5a1a', cap: '#2a6a3a', glass: false, shape: 'bottle', label: ['#3a6a3a', '#f2e6c8', '烏龍茶'] },
  { id: 'ramune', zh: '彈珠汽水', ja: 'ラムネ', en: 'Ramune', price: 60, color: '#8ad0e8', cap: '#2a6ab0', glass: true, shape: 'bottle', label: ['#2a6ab0', '#ffffff', 'ラムネ'] },
  // cans
  { id: 'beerCan', zh: '罐裝啤酒', ja: '缶ビール', en: 'Canned beer', price: 100, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#e8d070', '#b8261c', 'ビール'] },
  { id: 'highball', zh: '調酒', ja: 'ハイボール', en: 'Highball', price: 110, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#1c2a4a', '#e8c45a', 'ハイボール'] },
  { id: 'coffee', zh: '罐裝咖啡', ja: '缶コーヒー', en: 'Canned coffee', price: 45, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#4a2a18', '#f2e2c0', '珈琲'] },
  { id: 'greenTea', zh: '綠茶', ja: '緑茶', en: 'Green tea', price: 40, color: '#9bb85a', cap: '#2f7a3a', glass: false, shape: 'can', label: ['#4a8a3a', '#ffffff', 'お茶'] },
  { id: 'cola', zh: '可樂', ja: 'コーラ', en: 'Cola', price: 40, color: '#4a2414', cap: '#c4302a', glass: false, shape: 'can', label: ['#b8201c', '#ffffff', 'コーラ'] },
  // the little bottles of cultured milk drink
  { id: 'yakult', zh: '養樂多', ja: '乳酸菌飲料', en: 'Cultured milk', price: 20, color: '#f2ece0', cap: '#c4302a', glass: false, shape: 'small', label: ['#f2ece0', '#c4302a', '乳酸菌'] },
  // a sports drink in its plastic bottle, the glass milk bottle with its paper cap, a chuhai in a can
  { id: 'sports', zh: '運動飲料', ja: 'スポーツドリンク', en: 'Sports drink', price: 50, color: '#a8d8ee', cap: '#1f6fb8', glass: true, shape: 'bottle', label: ['#f4f9fc', '#1f6fb8', 'スポーツ'] },
  { id: 'milk', zh: '牛奶', ja: '牛乳', en: 'Milk', price: 45, color: '#f6f2e6', cap: '#f4efe2', glass: true, shape: 'bottle', label: ['#f4f0e4', '#3a6ab0', '牛乳'] },
  { id: 'chuhai', zh: '檸檬沙瓦', ja: 'チューハイ', en: 'Chu-hi', price: 90, color: '#c8ccd2', cap: '#9aa0a8', glass: false, shape: 'can', label: ['#f6b8c4', '#ffffff', 'チューハイ'] },
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
/** the drinks in the fridges and in the back, kept in the browser: a new shop's fridges are empty (stocked from the back by hand, in the drinks'
 * panel, or by a hired stocker), its back two cases of each */
export const DRINKS_KEY = 'jgs-drinks-1'
const DRINK_HOMES = FRIDGE_UNITS.map((u) => u.shelves.map((sh) => [...sh.ids] as string[]))
const keptDrinks = (() => { try { return readDrinks(localStorage.getItem(DRINKS_KEY), DRINK_HOMES) } catch { return null } })()
/** the drinks kept in the back (the crates and cartons by the fridges, game/drinkStock): what's carried out to the fridges, bought by the case */
export const DRINK_BACK: { back: Back; ver: number } = { back: keptDrinks?.back ?? startBack(), ver: 0 }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __drinkBack?: typeof DRINK_BACK }).__drinkBack = DRINK_BACK
/** the shop's cash, for buying from the room itself (App fills it in): how much there is, and paying out (a purchase in the ledger) */
export const SHOP_PURSE = { cash: () => Infinity as number, spend: (n: number) => { void n } }
export const FRIDGE_STOCK = {
  units: (keptDrinks?.units as (DrinkId | null)[][][] | undefined) ?? FRIDGE_UNITS.map((u) => emptyFridge<DrinkId>(u.shelves.map((sh) => sh.ids))),
  /** (x, z: out on the floor before the fridge, in its own frame; w: set down on a table, anywhere, in the scene's) */
  out: [] as { id: DrinkId; unit: number; x: number; z: number; w?: [number, number, number]; fy?: number; vy?: number; fell?: number; tip?: number; roll?: number; tipped?: boolean }[],
  ver: 0,
}
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __stock?: typeof FRIDGE_STOCK }).__stock = FRIDGE_STOCK
// (kept again whenever the fridges or the back change: looked at every second and a half)
if (typeof window !== 'undefined') {
  let seen = ''
  const id = window.setInterval(() => {
    const v = `${FRIDGE_STOCK.ver}|${DRINK_BACK.ver}`
    if (v === seen) return
    seen = v
    try { localStorage.setItem(DRINKS_KEY, writeDrinks({ units: FRIDGE_STOCK.units, back: DRINK_BACK.back })) } catch { /* (not kept) */ }
  }, 1500)
  // (stopped when a hot update swaps this module for a new copy: one more of them with every edit, before)
  replaces(import.meta.hot, () => window.clearInterval(id))
}
/** the drinks' stock panel (shops/grill/DrinkStockPanel), opened from the back stock by the fridges: open or not, and who's watching */
export const DRINK_PANEL = { open: false }
const drinkPanelSubs = new Set<() => void>()
export function setDrinkPanel(open: boolean) { if (DRINK_PANEL.open === open) return; DRINK_PANEL.open = open; drinkPanelSubs.forEach((f) => f()) }
export const onDrinkPanel = (f: () => void) => { drinkPanelSubs.add(f); return () => { drinkPanelSubs.delete(f) } }
/** the ingredients' freezer clicked open (Decor): App takes the camera to the grill and opens the pantry's panel there, while the shop's shut */
/** the stock panel asked for from the room, on a tab: by the freezer opened, a fridge's doors under the cook table opened, the charcoal's sack
 * clicked; `close`, how what asked is shut again when the panel's shut (the freezer's lid, the fridge's doors) */
type PantryAsk = (tab: string, from: 'freezer' | 'sack' | 'cubby', close?: () => void, focus?: string) => void
const pantryAsks = new Set<PantryAsk>()
export function askPantry(tab: string = 'frozen', from: 'freezer' | 'sack' | 'cubby' = 'freezer', close?: () => void, focus?: string) { pantryAsks.forEach((f) => f(tab, from, close, focus)) }
export const onPantryAsk = (f: PantryAsk) => { pantryAsks.add(f); return () => { pantryAsks.delete(f) } }
/** the freezer's lid (or a fridge's doors) shut in the room: the stock panel it opened shuts with it (the owner's) */
const pantryShuts = new Set<() => void>()
export function shutPantry() { pantryShuts.forEach((f) => f()) }
export const onPantryShut = (f: () => void) => { pantryShuts.add(f); return () => { pantryShuts.delete(f) } }
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
  if (kind === 'schoolgirl' || kind === 'schoolboy') return of(['cola', 'ramune', 'greenTea', 'coffee', 'yakult'])
  if (kind === 'salaryman' || kind === 'civilServant') return of(['beerCan', 'coffee', 'highball', 'beer'])
  if (kind === 'uncle') return of(['beer', 'sake', 'highball', 'beerCan'])
  return of(['beer', 'highball', 'sake', 'beerCan', 'oolong', 'coffee', 'cola'])
}

/** each toilet: how many are going through its door just now and whether someone's inside, locked (GuestBar3D); whether the player's
 * opened it; its upkeep (game/restroom: how clean, how much paper); whether its washstand's tap's been turned on by hand (metered by the
 * minute, App); and when it last flushed, was scrubbed, played its Otohime, was knocked at, or a guest last washed their hands at its
 * washstand, or dried them at its hand dryer (performance.now() ms, for the room's animations and sounds) */
const wcOf = () => ({ passing: 0, inside: 0, open: false, room: freshRoom(), tap: false, flushAt: -1e9, scrubAt: -1e9, otoAt: -1e9, knockAt: -1e9,
  rollAt: -1e9, washAt: -1e9, handAt: -1e9, dryAt: -1e9 })
export const TOILETS = { m: wcOf(), f: wcOf() }
/** points off the taste of what each guest eats, for what they found in the toilet (Roasting reads it) */
export const WC_GRUMBLE = new Map<number, number>()
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __toilets?: typeof TOILETS }).__toilets = TOILETS

/**
 * How far the kitchen's floor lies below the customers' (in the scene's own units): less than 0, it's raised above it, a dais the
 * cooks stand on, so the cook's table comes to their waist (they're the boss's height); a step up at each gate and across its end.
 */
export const KITCHEN_DROP = -0.16
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
  const a = [g0.hinge, g0.hinge + BAR_GATES[0].end * gateCut(BAR_GATES[0])].sort((p, q) => p - q) as [number, number]
  let side: [number, number] | null = null
  if (c1 && BAR_GATES[1]) {
    const g1 = gateOf(c1, BAR_GATES[1])
    const at = (s: number) => c1.at.clone().addScaledVector(c1.along, s).sub(c0.at).dot(c0.lay)
    // (the steps reach a good way further in than the door, along the counter, to fill the well beside it)
    side = [at(g1.hinge), at(g1.hinge + BAR_GATES[1].end * (gateCut(BAR_GATES[1]) + SIDE_STEP_EXTRA))].sort((p, q) => p - q) as [number, number]
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
  /** what's rung up for the customer paying: each dish, then the drink if any; and how many of those are dishes */
  parts: [] as number[], items: 0,
  /** the drawer pulled out by hand (clicked), apart from the customers' payments */
  manual: false,
  /** the one paying pays by card (on the reader, no cash), how many groups are waiting to pay, and so whether the tablet's in use (game/till) */
  card: false, queue: 0, tablet: false,
  /** what the one paying owes, and their number */
  bill: 0, payer: 0,
  /** this payment's receipt printed (cashRegister: none with the printer out of paper and no spare roll) */
  slip: true }
/** what a customer's bill comes to: the dishes they ordered and the drink from the fridge, if they took one */
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __till?: typeof TILL_STATE }).__till = TILL_STATE
/**
 * the money in the register's drawer (game/till): the day's float, and each cash customer's bill put in as they pay; the owner takes a
 * compartment's worth out by clicking it, and `onTake` (set by App) puts it to the shop's cash
 */
export const TILL_CASH: { drawer: DrawerCash; rolls: Rolls; onTake: ((amount: number) => void) | null } = { drawer: openingFloat(), rolls: startingRolls(), onTake: null }
/** the dish racks' plates (game/plates): how many are on them (all the shop's but those out at the seats, in the sink, or being carried) */
export const PLATE_RACK = { n: RACK_FULL }
/** the sink (Sink.tsx): its plates being washed (the tap runs); and its tap turned on by hand (the owner's: its handle's to be turned) */
export const SINK = { washing: false, tap: false }
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __plates: PLATE_RACK, __sink: SINK })
/** the grill's own way to put charcoal on from outside the scene (App's fire bar): `place` throws a portion on and says how many went on
 * (none when the bed is full); the scene sets it while it's showing */
export const COAL_BRIDGE: { place: (() => number) | null } = { place: null }
/**
 * The kitchen's supplies as App holds them (game/supplies): how many sticks of binchotan are left in the sack by the table, the crate on the
 * table refilled from it (how many went in), and a dab of a seasoning taken from stock (false: there's none left, it doesn't go on). App sets
 * them; until it does, there's no end to any of it.
 */
export const SUPPLIES: { coal: () => number; refillCrate: (cap: number) => number; dab: (k: string) => boolean; has: (id: string) => number
  take: (id: string, n: number) => boolean } = {
  coal: () => Infinity, refillCrate: (cap) => cap, dab: () => true,
  // (how many of a food there are in stock, for what's said of it in the room; -1, not known: no shop's running)
  has: () => -1,
  // (n of something taken out of stock, if there are as many: a spare box of tissues, the stock keeper's)
  take: () => true,
}
/** the stock keeper at a toilet just now, to change its roll: which, whether near enough its door to have it open, whether in (the guests
 * leave that toilet till he's done; the door opens and shuts for him as for them) */
export const STOCKER_WC: { who: 'm' | 'f' | null; near: boolean; inside: boolean } = { who: null, near: false, inside: false }
/** the places whose drawer the stock keeper has out just now, changing the box of tissues in it */
export const DRAWER_HELD = new Set<number>()
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
  // (stood a step back from the counter's marble edge, which comes to their chest: close, it went into them)
  return { spot: at(TILL.along, TILL.lay - TILL.D / 2 - 0.46), lane: at(0.4, TILL.lay - TILL.D / 2 - 0.46), aisle: at(0.4, -AISLE) }
}

/** how tall the raised lip along the counters' cook's side stands over their tops */
export const LIP_H = 0.15
/**
 * The chef's plating place (盛り付け), on the cook table right beside him (the owner's: no pass on the bar any more; the chef plates what's
 * grilled where he stands, sets it down ready (ORDER_READY) on the table's front edge, and a server comes into the kitchen to him for it).
 * In the scene's frame (ALONG and LAY, the table's top at y 0): where a ready plate is set down (`along`, `lay`), its clean plates' stack just
 * behind it (`stackLay`), where a server stands in front of it to take it up (`serverLay`) and where the plater sets down what they bring
 * (`platerAlong`): to the right of the tasting bowl, clear of it and of the bin behind (measured from above, 2026-11-04)
 */
export const PLATING_SPOT = { along: 2.86, lay: 1.8, stackLay: 1.3, serverLay: 2.6, platerAlong: 3.15 }
/** a place in the scene's frame (ALONG, LAY, height) into the bar's (what toGrillScene undoes) */
const sceneToBar = (along: number, lay: number, y = 0) => new THREE.Vector3().addScaledVector(ALONG, along).addScaledVector(LAY, lay).setY(y)
  .sub(GRILL_OFFSET).divideScalar(GRILL_SCALE)
/** how many plates can stand ready at the plating place at once (one seat's each); and where along it (from the ready place, toward the
 * chef's side: LAY) each stands, its stack of clean plates behind them */
export const READY_SLOTS = 1
export const readyAlong = (k: number) => -0.24 * k
export const PLATE_STACK_ALONG = (PLATING_SPOT.stackLay - PLATING_SPOT.lay) / 2 // (the bar's sizes: GRILL_SCALE, 2, is set further down)
/**
 * The plating place, in the bar's frame (the frame GuestBar3D walks its servers in): the ready plate's place on the table (`at`, its `top`
 * the table's top), the way its places run (`dir`, unit: back across the table from the front edge) and across it (`across`); where a
 * server stands on the kitchen's floor in front of it to take a plate up (`out`) and where the plater stands to set the clean ones down
 * (`in`), both beside the chef at his notch.
 */
export function platingOf() {
  const top = sceneToBar(0, 0, 0).y
  const at = sceneToBar(PLATING_SPOT.along, PLATING_SPOT.lay).setY(top)
  const dir = LAY.clone().normalize(), across = ALONG.clone().normalize()
  return { at, top, dir, across, out: sceneToBar(PLATING_SPOT.along, PLATING_SPOT.serverLay).setY(0),
    in: sceneToBar(PLATING_SPOT.platerAlong, PLATING_SPOT.serverLay).setY(0) }
}
/** what's ready at the plating place just now: one of its slots, the seat it's for, whether a plate's laid there (the seat's plate isn't out
 * yet), and how many of its pieces are flying to it and are down on it (Roasting counts them every frame) */
export type ReadyPlate = { seat: number; plate: boolean; flying: number; landed: number }
/**
 * The plating place: the clean plates stacked there for plating on (the kitchen's plater brings them from the racks: `coming`, on their
 * way), and its slots, each a plate ready for a server (Roasting lays a plate in one for a seat whose first food is done and puts that
 * seat's food on it; GuestBar3D draws the plate and has a server come for it, the slot freed as it's taken up)
 */
export const PLATING = { stock: 0, coming: 0, slots: Array.from({ length: READY_SLOTS }, () => null as ReadyPlate | null) }
/** the seats whose plate is out (set down at them, or on its way there): their later food is set out at the plating place loose, for adding to it */
export const PLATES_OUT = new Set<number>()
/** the kitchen's plater (the third cook, or the second) off their place, fetching plates for the plating place: GuestBar3D walks a figure of them,
 * Roasting's at their place is hidden meanwhile (the owner, plating with no cook to, is OWNER_OUT) */
export const PLATER_OUT: { id: string | null } = { id: null }
/** the dish dryer in the sink's cabinet (game/plates' Dryer: what's in it, its time left); `open`, its door down (0..1) to load or unload it
 * (Sink.tsx draws it, GuestBar3D runs it) */
export const DRYER: Dryer & { open: number } = { n: 0, left: null, open: 0 }
/** the bin by the sink: how many used sticks are in it (cleared off the customers' plates with them; the owner's: thrown away there) */
export const SINK_BIN = { sticks: 0 }
/** the sticks each seat's plate has on it, of what's been eaten off it (Roasting counts what's set down; GuestBar3D clears them with the plate) */
export const SEAT_STICKS = new Map<number, number>()
/** the whole fish each seat's eaten (their bones left on the plate, the owner's), and which of the foods are a whole fish to leave them */
export const SEAT_BONES = new Map<number, number>()
/**
 * The kitchen's rice (game/rice): how many rice balls' rice the tub holds now, the iron pot on its stove (cooking, cooked, empty), and
 * whether someone's washing the next pot's rice at the sink just now (GuestBar3D's plater does it all; Decor draws the pot; Roasting
 * takes a portion for each rice ball)
 */
export const RICE: { tub: number; kama: Kama; washing: boolean } = { tub: TUB_FULL, kama: emptyKama(), washing: false }
/**
 * The fire kept by the third cook (三廚, the plater: the owner's, a robata's kitchen split three ways): the grill (Roasting) asks for charcoal
 * when the fire's low or for water when it's run too hot (`want`); the third cook, walking (GuestBar3D's platerRun), takes it from the crate
 * or the bucket on the floor to the hearth's far side, and says it's done (`done`), and only then does the grill drop the sticks in or damp
 * it down. `tender`: whether there's anyone to send (the plater's there); with none, the grill does it itself at once, as it used to.
 */
export const FIRE_TEND: { want: null | 'coal' | 'water'; done: null | 'coal' | 'water'; tender: boolean } = { want: null, done: null, tender: false }
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fireTend?: typeof FIRE_TEND }).__fireTend = FIRE_TEND
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __rice: RICE })
export const WHOLE_FISH = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Shishamo', 'Hokke', 'Nodoguro'])
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __plating: PLATING, __dryer: DRYER, __sinkBin: SINK_BIN })

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
/** where the owner stands while the shop's open (Roasting's frame: along the aisle in front of the cook table), and the way he faces there */
export const OWNER_SPOT = new THREE.Vector3().addScaledVector(LAY, 2.62).addScaledVector(ALONG, 1.2)
export const OWNER_YAW = (() => { const v = new THREE.Vector3().addScaledVector(LAY, 2.0).addScaledVector(ALONG, -0.4); return Math.atan2(-v.x, -v.z) })()

/** a counter's places spread evenly from one end place to the other (along it, from its middle): its pitch and shift */
const spread = (seats: number, from: number, to: number) => ({ pitch: (to - from) / (seats - 1), shift: (from + to) / 2 })
/** where a counter's n-th place is along it, from its middle: what the stools, the places' settings and their drawers all go by */
export const seatAlong = (c: Counter, n: number) => (n - (c.seats - 1) / 2) * (c.pitch ?? c.length / c.seats) + (c.shift ?? 0)
/** where a counter's pendant lamps hang along it, from its middle: one between each two places next to each other, midway (the owner's: a
 * lamp between one customer and the next) */
export const lampsAlong = (c: Counter) => Array.from({ length: Math.max(0, c.seats - 1) }, (_, n) => (seatAlong(c, n) + seatAlong(c, n + 1)) / 2)

export function seatsOf(cs: Counter[]): Seat[] {
  return cs.flatMap((c, ci) => Array.from({ length: c.seats }, (_, n) => {
    const mid = c.at.clone().addScaledVector(c.along, seatAlong(c, n))
    return {
      mid,
      plate: mid.clone().addScaledVector(c.lay, PLACE.plate),
      stool: mid.clone().addScaledVector(c.lay, -SIT_BACK),
      aisle: mid.clone().addScaledVector(c.lay, -AISLE),
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
// (its step drawn back toward the bar: a longer stone floor to come in on, take off one's shoes and step up, not crowded at the door)
export const GENKAN = { depth: 0.1, along: [0.15, 1.45] as [number, number], lay: [FLOOR_FAR, -0.42] as [number, number] }
/** whether a point (the bar's frame) is down in the genkan */
export function inGenkan(cs: Counter[], p: THREE.Vector3) {
  const c0 = cs[0], d = p.clone().sub(c0.at)
  const a = d.dot(c0.along) - c0.length / 2, l = d.dot(c0.lay)
  return a > GENKAN.along[0] && a < GENKAN.along[1] + 0.01 && l > GENKAN.lay[0] - 0.01 && l < GENKAN.lay[1]
}
/** where the first counter's aisle meets another counter's (the aisle behind its stools) */
export function aisleCornerOf(cs: Counter[], c: Counter) {
  const c0 = cs[0]
  const p0 = c0.at.clone().addScaledVector(c0.lay, -AISLE)
  return p0.clone().addScaledVector(c0.along, c.at.clone().addScaledVector(c.lay, -AISLE).sub(p0).dot(c0.along))
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
    // (the legs walked past measured without making anything: it's called for every walker every frame)
    const len = path[i].distanceTo(path[i - 1])
    if (d <= len || i === path.length - 1) {
      const seg = path[i].clone().sub(path[i - 1])
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
/** how much shorter the first counter is than it was laid out: the room closes up along it by this (twice it, the bar being drawn double) */
export const BAR_TRIM = 0.4
export const GRILL_COUNTERS: Counter[] = [
  // (its start drawn in to meet the side counter, which is drawn in from the wall by SIDE_PULL: the far end stays where it was)
  // (and its far end drawn in by BAR_TRIM: the strip of floor that was left between the kitchen and the till taken out, all past it closing up)
  // (its places drawn back a little from the gate's end: the last one's chopsticks reached the gap, its drawer the gate's post)
  // (four places spread evenly over all the run there is (the owner's: the places moved along into the empty end and spread evenly): from one
  // by the gate, drawn back from it (the owner's: place 1 was too near the genkan's door), to one by the corner end, where the run was left
  // bare when that end's place went round to the side counter)
  { at: new THREE.Vector3().addScaledVector(LAY, -2.45).addScaledVector(ALONG, -0.35 + SIDE_PULL / 2 - BAR_TRIM / 2), along: ALONG, lay: LAY, length: 5.2 - SIDE_PULL - BAR_TRIM, seats: 4,
    ...spread(4, -1.5, 1.45) },
  // (the side counter drawn back from its wall by SIDE_PULL, so the fridges' doors swing clear of its stools)
  // (four places (the long counter's by the corner brought round, four and four) spread evenly over its whole run (the owner's: the corner
  // end was left bare): from the one by the gate, where it was, to one by the corner, its stool clear of the long counter's back)
  { at: new THREE.Vector3().addScaledVector(LAY, -0.42 + 0.25).addScaledVector(ALONG, -2.75 + SIDE_PULL), along: LAY.clone().negate(), lay: ALONG, length: 3.14 + 0.5, seats: 4,
    ...spread(4, -0.875, 1.62),
    // (its wall set further back, for the drinks fridges by the toilets: where it was, the counter having moved off it)
    far: FLOOR_FAR - 0.45 - SIDE_PULL },
]
export const GRILL_SEATS = seatsOf(GRILL_COUNTERS)
/** the number a place shows on its tag (the owner's: the bar's places numbered): from the door in, along the long counter to the corner, then
 * on along the side counter away from it, so they run 1, 2, 3… left to right for whoever sits at either counter (the places' own order runs
 * the other way: the long counter's from the corner, the side one's toward it) */
export const seatLabel = (k: number) => {
  const [c0, c1] = GRILL_COUNTERS
  return k < c0.seats ? c0.seats - k : c0.seats + (c1 ? c1.seats - (k - c0.seats) : 0)
}
/**
 * The staff's way home once the shop's shut and empty (the first counter's frame): from just inside its gate by the till, through it and
 * along the aisle out of the front door, as the customers go. Each comes to it their own way first.
 */
export function staffWayOut(cs: Counter[]): THREE.Vector3[] {
  const c = cs[0], { mid } = gateOf(c, BAR_GATES[0])
  return [mid.clone().addScaledVector(c.lay, 0.45), mid.clone().addScaledVector(c.lay, -0.5), doorOf(cs)]
}
/** a way across the kitchen's floor (the first counter's frame, its points on the floor) round the cook's table and all that stands on it:
 * GuestBar3D's kitchen route (game/kitchenPath), for the crew too (Roasting: the cooks' way home); null till the bar's drawn */
export const KITCHEN_ROUTE: { route: ((from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[]) | null } = { route: null }
/** whether a place (the first counter's frame) is over the kitchen's raised floor */
export function inKitchen(cs: Counter[], p: THREE.Vector3) {
  const k = kitchenOf(cs), d = p.clone().sub(cs[0].at), a = d.dot(cs[0].along), l = d.dot(cs[0].lay)
  return a > k.along[0] && a < k.along[1] && l > k.lay[0] && l < k.lay[1]
}
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
 * The cubby cut into the cook's table under its top, in its front face (the cook's side): open to the front, a low plinth
 * at its foot and one shelf over its right-hand part (the customers' plates aren't kept here any more: all of them are on the dish racks).
 * (along and lay in the first counter's frame, from the table's own sizes in Roasting; heights in the scene.)
 */
/** the second cubby, at the table's left: the trash bin on its floor, the basket on its shelf */
export const CUBBY2 = { along: [-1.5, -0.35], lay: [0.95, 2.1] }
// (the right-hand one as wide as the left-hand one (the owner's: the two alike; it ran from 1.36 to 3.0), in the middle of the table's face
// between the notch and the table's end, the marble either side of it (first it was set against the notch's side: it stood off to one side))
export const CUBBY = { along: [1.605, 2.755], lay: [0.95, 2.1], plinth: 0.1, shelfThick: 0.04 }
/** the notch cut into the cook's table's front under the hearth (along from–to, lay from–to): somewhere to stand right up at the fire */
export const COOK_NOTCH = { along: [-0.04, 1.26], lay: [1.26, 2.1] }
/** the cubby's floor and shelf surfaces, in the scene: the table's top is y = 0 */
export const CUBBY_FLOOR_Y = GRILL_OFFSET.y - KITCHEN_DROP + CUBBY.plinth
export const CUBBY_SHELF_Y = CUBBY_FLOOR_Y + 0.3
/** a place in the cubby (along, lay, and which tier it is on), in the scene */
export const cubbyAt = (along: number, lay: number, tier: 'floor' | 'shelf') =>
  new THREE.Vector3().addScaledVector(ALONG, along).addScaledVector(LAY, lay).setY(tier === 'floor' ? CUBBY_FLOOR_Y : CUBBY_SHELF_Y)
/** a point given in the bar's own sizes, where it is in the scene as drawn */
export const toGrillScene = (v: THREE.Vector3) => v.clone().multiplyScalar(GRILL_SCALE).add(GRILL_OFFSET)

/** the flowers standing in the shrine's two vases, left and right (game/shrineFlowers: each kind its own blessing); kept in the browser */
const FLOWERS_KEY = 'jgs-shrine-flowers-1'
export const SHRINE_FLOWERS: Flower[] = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(FLOWERS_KEY) ?? 'null')
    if (Array.isArray(v) && v.length === 2 && v.every((x) => x === 0 || x === 1 || x === 2)) return v as Flower[]
  } catch { /* (none kept) */ }
  return [0, 0]
})()
export function setShrineFlower(slot: number, f: Flower) {
  SHRINE_FLOWERS[slot] = f
  try { localStorage.setItem(FLOWERS_KEY, JSON.stringify(SHRINE_FLOWERS)) } catch { /* (not kept) */ }
}
