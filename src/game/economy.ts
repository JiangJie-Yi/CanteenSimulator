// Money and stock: what things cost, what a dish on the menu takes out of stock, and whether it can be served.
// Pure functions over the data in src/data, so App (and the tests) all reckon the same way.
import { TISSUE, TISSUE_LOW, tissueOrder } from './tissues'
import { ROLL, SOAP, TOWEL, WASHROOM_LOW, washroomOrder } from './washroom'
import { RECEIPT, RECEIPT_LOW, receiptOrder } from './receipts'
import { HOUSEHOLD, HOUSEHOLD_LOW, householdOrder } from './household'
import { DISHES, type Dish } from '@/data/menu'
import { findItem, SEASON_COST, suggestPrice, type Entry, type Part, type Seasoning } from '@/data/recipes'
import { CHARCOAL, CHARCOAL_LOW, charcoalOrder, FRYOIL, GARNISH, GARNISH_GOODS, GARNISH_PAR, NORI, SEASON_GOODS, SEASON_PAR, seasonId, isSeasonId } from './supplies'
import { RICE_FULL } from './rice'
import { SOUP_BOWLS } from './soup'
import { storageOf } from '@/data/storage'

export type Stock = Record<string, number>

/** the money the business starts with */
export const CAPITAL = 300000
/** what it costs to open one shop */
// (a third of the capital: the shop opens with NT$200,000 in hand, as the owner set it, to buy its stock with)
export const SHOP_COST = 100000
/** the books as App keeps them, as far as the shop's cash goes */
export type CashBooks = { revenue: number; bought: number; fuel: number; wage: number; utility?: number; setup?: number; offering?: number
  promo?: number
  /** what the owner's taken out of the till's drawer (a compartment's or a coin roll's worth at a click) */
  till?: number
  /** what of the takings has gone into the drawer: the cash customers' bills, paid in as they leave */
  tillIn?: number
  /** the rent, the delivery platform's cut, the card company's fee (item 210: game/costs) */
  rent?: number; platform?: number; cardFee?: number }
/**
 * The shop's cash in hand, the money at the top of the screen (item 195; the owner's, item 182: "the things themselves don't match the
 * interface"): the capital, the takings and the spending, less what those sat in still owe (`owed`: paid at the till as they leave) and what
 * of the takings has gone into the till's drawer, and with what the owner's taken out of the drawer. The drawer's money is the shop's, but
 * not in hand till it's taken out (a cash customer's bill was counted twice before: as they ordered, and again as it was taken out).
 */
/** the shop's savings at or under which it goes out of business (the owner's, 2026-11-17: 「存款-10w就直接收店」): the business stopped at
 * once, no further day, only starting over */
export const BANKRUPT_AT = -100_000
/** the warnings on the way down, each said once a game as the savings go under it: under nought, and half way to closing */
export const BANKRUPT_WARN: readonly number[] = [0, -50_000]
/** whether the shop's gone out of business: its savings at or under BANKRUPT_AT */
export const bankrupt = (savings: number) => savings <= BANKRUPT_AT
/** the warnings due now: those the savings are under that haven't been said yet, highest first */
export const warningsDue = (savings: number, said: readonly number[]) => BANKRUPT_WARN.filter((w) => savings < w && !said.includes(w))
/** the shop's savings: the money in hand and what's in the till's drawer not yet taken out (cashInHand leaves the drawer out till it's
 * taken: a shop with its takings in the drawer isn't broke for that) */
export const savingsOf = (cash: number, b: Pick<CashBooks, 'tillIn' | 'till'>) => cash + Math.max(0, (b.tillIn ?? 0) - (b.till ?? 0))
export const cashInHand = (b: CashBooks, owed = 0) => CAPITAL + b.revenue - b.bought - b.fuel - b.wage - (b.utility ?? 0) - (b.setup ?? 0)
  - (b.offering ?? 0) - (b.promo ?? 0) - (b.rent ?? 0) - (b.platform ?? 0) - (b.cardFee ?? 0) - owed - (b.tillIn ?? 0) + (b.till ?? 0)
/** running costs, NT$: a bag's worth of charcoal added, and a cassette gas canister's worth burnt per hour at full */
export const CHARCOAL_COST = 18
/** how much one load of charcoal raises the fire (0..1), and whether more can go on: at 100% the bed is full, so no more is added (nor paid for) */
export const CHARCOAL_BOOST = 0.18
export const canAddCharcoal = (level: number) => level < 1 - 1e-6
/** one stick of binchotan dragged from the crate onto the fire by hand: what it costs and how much it raises the fire */
export const STICK_COST = 3
export const STICK_BOOST = 0.05
export const afterCharcoal = (level: number, boost = CHARCOAL_BOOST) => (canAddCharcoal(level) ? Math.min(1, level + boost) : level)
/**
 * Fresh charcoal doesn't burn at once: put on the bed (the level above, what's on it) it catches a little at a time, and the fire's heat
 * rises to it like water filling a tank (the owner's, 2026-11-13: "the fire should go up from 0 step by step, like filling with water: more
 * real"; it jumped, a stick dragged on and the gauge at 30% that moment). FIRE_CATCH of the gauge a second (the shop's: twice as fast at x2):
 * a handful on a cold pit (18%) catches in four and a half seconds, a full bed from nothing in twenty-five.
 */
export const FIRE_CATCH = 0.04
/** the fire's heat `dt` seconds (the shop's) on: up toward what's on the bed (`bed`) at FIRE_CATCH a second, never past it; down with it at
 * once as it burns away or is doused */
export const heatStep = (heat: number, bed: number, dt: number) => (heat < bed ? Math.min(bed, heat + FIRE_CATCH * dt) : bed)
/** how many sticks make one portion (the fire bar's button, the chef's handful) */
export const STICKS_PER_PORTION = 6.5
/**
 * What charcoal put on the fire costs and how much it raises the fire: only for the sticks that actually went on. A bed that's full takes
 * none, and then nothing is paid and the fire isn't raised. By hand it's a stick at a time (STICK_COST, STICK_BOOST); a portion's sticks are
 * a little cheaper each (CHARCOAL_COST over STICKS_PER_PORTION).
 */
export function coalCharge(placed: number, byHand = false) {
  if (placed <= 0) return { cost: 0, boost: 0 }
  return byHand
    ? { cost: placed * STICK_COST, boost: placed * STICK_BOOST }
    : { cost: Math.round((CHARCOAL_COST * placed) / STICKS_PER_PORTION), boost: (CHARCOAL_BOOST * placed) / STICKS_PER_PORTION }
}

/**
 * What the ingredients of something on the menu cost, as a share of its price, as in Osaka's izakaya (item 210: the shop's in Tenma; they were
 * Taiwan's small eateries', the fish about half its price): a menu's food about three tenths of the takings (原価率), the fish and seafood
 * dearer (a third and more, the nodoguro dearest), meat about three tenths, vegetables and mushrooms a fifth or so, rice and miso soup the
 * cheapest.
 */
export const COST_SHARE: Record<string, number> = {
  ExtraFish: 0.36, Saury: 0.35, Mackerel: 0.36, Aji: 0.34, Iwashi: 0.3, Shishamo: 0.32, Salmon: 0.38, Hokke: 0.36,
  Buri: 0.38, Gindara: 0.39, Nodoguro: 0.42, ShrimpSkewer: 0.39, Scallop: 0.41, Squid: 0.38, Yakitori: 0.3,
  PorkBelly: 0.32, Sausage: 0.29, BloodCake: 0.23, GrilledCorn: 0.21, GrilledShiitake: 0.23, Shishito: 0.19,
  KingOyster: 0.23, Asparagus: 0.24, Okra: 0.21, Potato: 0.17, SweetPotato: 0.17, Onigiri: 0.17, NetMochi: 0.18,
  Rice: 0.14, MisoSoup: 0.15, Sake: 0.3, Onion: 0.18, Negi: 0.2, Carrot: 0.18, Gobo: 0.23, Daikon: 0.18,
  Tomato: 0.21, Cucumber: 0.18, Eggplant: 0.21, Piman: 0.2, Paprika: 0.24,
  // (the kitchen's dishes (data/kitchenDishes): their own food's share, their eggs, oil and nori bought apart (supplies' GARNISH))
  Tamagoyaki: 0.12, Omurice: 0.2, HandRoll: 0.28, EggDropSoup: 0.12, Fries: 0.18, Tempura: 0.32,
}
/** the share for anything not in the list */
export const COST_SHARE_ELSE = 0.29

/** what one of something costs to buy in */
export const costOf = (x: { id?: string; price: number; cost?: number }) =>
  x.cost ?? Math.round(x.price * (COST_SHARE[x.id ?? ''] ?? COST_SHARE_ELSE))

const shopOf = (e: Entry) => DISHES.find((x) => x.id === e.shop)!
/** what a dish on the menu is worth (item 210): its parts at their own prices (menuPrice), a set at all of them */
export const fairPrice = (e: Entry) => e.parts.reduce((n, p) => n + menuPrice(shopOf(e), p), 0)

/** what a thing takes out of stock (a set: its parts; it isn't bought as a set) */
export const takesOf = (d: Dish, id: string): Stock =>
  (findItem(d, id) as { includes?: Stock } | undefined)?.includes ?? { [id]: 1 }

/** a part's cost: the food, and what's put on it */
export const partCost = (d: Dish, p: Part) => costOf(findItem(d, p.id) ?? { price: 0 }) +
  p.dabs.reduce((n, k) => n + SEASON_COST[k as Seasoning], 0)

/** a dish's parts but so many of each part's id (`skip`), the first of each: what's made of them is one kept warm, already cooked and paid
 * for when its first customer ordered it (item 203: sold again, it was taken out of stock and its food cost booked a second time) */
const partsLeft = (e: Entry, skip: Stock) => {
  const left: Stock = { ...skip }
  return e.parts.filter((p) => { if ((left[p.id] ?? 0) > 0) { left[p.id] -= 1; return false } return true })
}
/** what a dish on the menu costs to make (but its parts kept warm, `skip`: made already) */
export const entryCost = (e: Entry, skip: Stock = {}) => {
  const d = shopOf(e)
  return partsLeft(e, skip).reduce((n, p) => n + partCost(d, p), 0)
}

/** what a dish on the menu takes out of stock: its food, and a dose of each seasoning that goes on it */
export const needOf = (e: Entry, skip: Stock = {}): Stock => {
  const d = shopOf(e)
  const need: Stock = {}
  for (const p of partsLeft(e, skip)) {
    for (const [k, q] of Object.entries(takesOf(d, p.id))) {
      need[k] = (need[k] ?? 0) + q
      // (and what goes with it: a sheet of nori round each onigiri, in a set as on its own)
      for (const [g, n] of Object.entries(GARNISH[k] ?? {})) need[g] = (need[g] ?? 0) + n * q
    }
    for (const k of p.dabs ?? []) need[seasonId(k)] = (need[seasonId(k)] ?? 0) + 1
  }
  return need
}

/** how many of each thing a dish puts out to be cooked */
export const partsOf = (e: Entry): Stock => {
  const n: Stock = {}
  for (const p of e.parts) n[p.id] = (n[p.id] ?? 0) + 1
  return n
}

/** whether there's stock enough for one of a dish */
export const canServe = (e: Entry, stock: Stock, skip: Stock = {}) => Object.entries(needOf(e, skip)).every(([k, q]) => (stock[k] ?? 0) >= q)

/** how many of a dish could be made from what's in stock */
export const portionsLeft = (e: Entry, stock: Stock) =>
  Math.min(...Object.entries(needOf(e)).map(([k, q]) => Math.floor((stock[k] ?? 0) / q)))

/** stock less what a dish takes (null if there isn't enough) */
export const takeStock = (e: Entry, stock: Stock): Stock | null => {
  if (!canServe(e, stock)) return null
  const next = { ...stock }
  for (const [k, q] of Object.entries(needOf(e))) next[k] -= q
  return next
}

/** everything a shop buys in (not its ready-made sets: those are made up from the rest) */
export const goodsOf = (d: Dish) => [...d.bases.filter((b) => !b.includes), ...d.items]

/** what's bought in packs, not portions: the rice by the sack (the owner's: a kitchen buys polished rice by the sack and cooks it, it
 * doesn't buy onigiri): a 5 kg bag, about 33 合, cooks about sixty portions (item 210: it was ten to a bag), three pots and more; stock keeps
 * portions, an order is whole bags */
export const PACK: Record<string, number> = { Onigiri: 60 }
export const packOf = (id: string) => PACK[id] ?? 1
/** n portions wanted, as whole packs' worth (none for none) */
export const inPacks = (id: string, n: number) => n <= 0 ? 0 : Math.ceil(n / packOf(id)) * packOf(id)
/** what's dry and keeps (the rice): it doesn't go off */
export const keepsDry = (id: string) => id === 'Onigiri' || id === NORI || id === FRYOIL

/** what buying n of every good of a shop costs (what comes in packs, whole packs) */
export const buyAllCost = (d: Dish, n: number) => goodsOf(d).reduce((t, g) => t + costOf(g) * inPacks(g.id, n), 0)

/**
 * The most portions of any one food the shop has room to keep (its freezer, its fridges, its shelves: the owner's, 2026-11-10: there was no
 * limit, and a fish's card read 691): an order's cut to the room left, what comes in packs to whole packs (the rice, ten to a bag). What
 * isn't a food (a seasoning, the nori, the charcoal, the tissues, the receipt paper) keeps to its own usual stock instead
 */
export const STOCK_CAP = 100
/** whether a good is kept within STOCK_CAP: a food */
export const capped = (id: string) => !isSeasonId(id) && !(id in GARNISH_PAR) && id !== CHARCOAL && !id.startsWith('supply:')
/** how many more of a good there's room for, in whole packs (no end to it for what isn't capped) */
export const roomFor = (id: string, have: number) => {
  if (!capped(id)) return Infinity
  const room = Math.max(0, STOCK_CAP - have)
  return Math.floor(room / packOf(id)) * packOf(id)
}

/** a stock keeper (倉儲) tops up whatever the menu uses once it's down to this many portions, back up to PAR */
export const PAR = 10
export const REORDER_AT = 3
/**
 * What goes off soon kept lean (item 343, the owner's: 「自動模式要聰明點，不然食物很容易就搞壞掉」): chilled food is past eating in about half a
 * day, what's kept out in a quarter (game/freshness), and what's ordered is in stock the moment it's ordered: so only a few portions' worth
 * of each on hand (a dish's worth for each portion it takes), more ordered once it's down to its last (`LEAN_LOW`); topped up to PAR, most of
 * it went off before it was used. The frozen (two days and more), the rice and the seasonings, the charcoal and the sake (none of which go
 * off) as before
 */
export const LEAN_PAR: Record<'chilled' | 'ambient', number> = { chilled: 3, ambient: 2 }
export const LEAN_LOW = 1
const KEEPS_LONG = new Set(['charcoal', 'Sake'])
/** whether a good's ordered lean (it goes off soon): not frozen, not the sides' rice or soup, nor what keeps */
export const orderedLean = (id: string) => storageOf(id) !== 'frozen' && !(id in SIDE_PAR) && !keepsDry(id) && !KEEPS_LONG.has(id) && !isSeasonId(id) && !(id in GARNISH_PAR)
/** the rice and the miso soup had alongside the dishes, whatever's on the menu board (items 205, 207: kept to PAR, ten portions, like any good,
 * a pot of rice was cooked with what rice there was, three bowls' worth, the cooker holding twenty; and the miso, not on the board, was never
 * ordered at all: in a rush three of twenty-one who'd asked for rice had it, one of ten their soup): kept to a day's worth, two pots of rice
 * and three of soup, and ordered once there's less than a pot's; the rice by its bag (item 210: a 5 kg bag, more than two pots), a bag kept */
export const SIDE_PAR: Record<string, number> = { Onigiri: Math.max(2 * RICE_FULL, PACK.Onigiri), MisoSoup: 3 * SOUP_BOWLS }
export const SIDE_LOW: Record<string, number> = { Onigiri: RICE_FULL, MisoSoup: SOUP_BOWLS }
/** a good's standard stock: PAR, or the sides' day's worth */
export const parOf = (id: string) => Math.max(PAR, SIDE_PAR[id] ?? 0)
/** how much off the suppliers' price a stock keeper gets: nothing for a beginner, up to 5% for a skilled one */
export const supplierDiscount = (skill: number) => Math.max(0, Math.min(0.05, (skill - 60) / 800))

/**
 * What a stock keeper orders in for a shop: everything its menu uses that's running low, topped back up to PAR (more
 * for what a dish takes several of). Only what there's cash for is ordered, cheapest first left out last.
 */
export function restockOrder(d: Dish, menu: Entry[], stock: Stock, cash: number, skill: number, use?: Stock) {
  const per: Stock = {}
  for (const e of menu) for (const [k, q] of Object.entries(needOf(e))) per[k] = Math.max(per[k] ?? 0, q)
  // (and the sides' rice and soup, whatever's on the menu, once there's a menu at all)
  if (menu.length) for (const id of Object.keys(SIDE_PAR)) per[id] = Math.max(per[id] ?? 0, 1)
  const goods = new Map([...goodsOf(d), ...SEASON_GOODS, ...GARNISH_GOODS].map((g) => [g.id, g]))
  const off = 1 - supplierDiscount(skill)
  const buy: Stock = {}
  let cost = 0
  for (const [id, q] of Object.entries(per)) {
    const g = goods.get(id)
    const have = stock[id] ?? 0
    // (a seasoning, counted in doses, is kept at its own usual stock: ordered once it's down to a third of it)
    const kept = isSeasonId(id) ? SEASON_PAR : GARNISH_PAR[id] ?? 0
    // (what goes off soon, a few portions' worth on hand, ordered again at its last (item 343))
    const lean = !kept && orderedLean(id)
    const where = storageOf(id)
    // (and enough of it for one and a half of what went since the last round, where that's known (`use`), so what sells fast doesn't run out
    // before the next; never more than PAR)
    const want = lean ? Math.min(PAR * q, Math.max(LEAN_PAR[where === 'ambient' ? 'ambient' : 'chilled'] * q, Math.ceil((use?.[id] ?? 0) * 1.5))) : 0
    const par = kept || (lean ? want : Math.max(PAR * q, SIDE_PAR[id] ?? 0))
    if (!g || have > (kept ? kept / 3 : lean ? Math.max(LEAN_LOW * q, Math.ceil((use?.[id] ?? 0) * 0.5)) : Math.max(REORDER_AT * q, (SIDE_LOW[id] ?? 0) - 1))) continue
    const n = Math.min(inPacks(id, par - have), roomFor(id, have))
    if (n <= 0) continue
    const c = Math.round(costOf(g) * n * off)
    if (cost + c > cash) continue
    buy[id] = n
    cost += c
  }
  // (and a pack of tissue boxes once the spares are low)
  if (menu.length && (stock[TISSUE] ?? 0) < TISSUE_LOW) {
    const t = tissueOrder(1)
    const c = Math.round(t.cost * off)
    if (cost + c <= cash) { buy[TISSUE] = t.boxes; cost += c }
  }
  // (and the washrooms' spares, a pack of each once it's low: toilet rolls, paper towels, hand soap)
  if (menu.length) for (const id of [ROLL, TOWEL, SOAP]) {
    if ((stock[id] ?? 0) >= WASHROOM_LOW[id]) continue
    const o = washroomOrder(id, 1)
    const c = Math.round(o.cost * off)
    if (cost + c <= cash) { buy[id] = o.n; cost += c }
  }
  // (and the dish soap and the toilet cleaner, a pack of each once the spare bottles are low: used now (item 203))
  if (menu.length) for (const id of HOUSEHOLD) {
    if ((stock[id] ?? 0) >= HOUSEHOLD_LOW[id]) continue
    const o = householdOrder(id, 1)
    const c = Math.round(o.cost * off)
    if (cost + c <= cash) { buy[id] = o.bottles; cost += c }
  }
  // (and a pack of receipt paper once the spare rolls are low)
  if (menu.length && (stock[RECEIPT] ?? 0) < RECEIPT_LOW) {
    const r = receiptOrder(1)
    const c = Math.round(r.cost * off)
    if (cost + c <= cash) { buy[RECEIPT] = r.rolls; cost += c }
  }
  // (and the charcoal, a sack at a time, once the sack's running low: paid as fuel)
  let fuel = 0
  if ((stock[CHARCOAL] ?? 0) < CHARCOAL_LOW) {
    const sacks = charcoalOrder(2)
    const c = Math.round(sacks.cost * off)
    if (cost + c <= cash) { buy[CHARCOAL] = sacks.sticks; fuel = c }
  }
  return { buy, cost, fuel }
}

/** 一鍵補貨: everything the shop sells topped up to PAR portions, and every seasoning to its own usual stock (what's already over it is left as
 * it is) */
export function topUpOrder(d: Dish, stock: Stock, par = PAR) {
  const buy: Stock = {}
  let cost = 0
  for (const g of goodsOf(d)) {
    const have = stock[g.id] ?? 0
    const n = Math.min(inPacks(g.id, Math.max(par === PAR ? parOf(g.id) : par, packOf(g.id)) - have), roomFor(g.id, have))
    if (n <= 0) continue
    buy[g.id] = n
    cost += costOf(g) * n
  }
  for (const g of [...SEASON_GOODS, ...GARNISH_GOODS]) {
    const n = (GARNISH_PAR[g.id] ?? SEASON_PAR) - (stock[g.id] ?? 0)
    if (n <= 0) continue
    buy[g.id] = n
    cost += costOf(g) * n
  }
  return { buy, cost }
}

/** 補到平均: every good below the average stock (over all of this shop's goods, rounded) is brought up to it; the rest left as they are */
export function averageOrder(d: Dish, stock: Stock) {
  const goods = goodsOf(d)
  const avg = Math.round(goods.reduce((n, g) => n + (stock[g.id] ?? 0), 0) / Math.max(1, goods.length))
  const buy: Stock = {}
  let cost = 0
  for (const g of goods) {
    const have = stock[g.id] ?? 0
    const n = Math.min(inPacks(g.id, avg - have), roomFor(g.id, have))
    if (n <= 0) continue
    buy[g.id] = n
    cost += costOf(g) * n
  }
  return { buy, cost, avg }
}

/** 各補 n: n more of every good, as much of it as there's room for (none of what's full) */
export function eachOrder(d: Dish, n: number, stock: Stock = {}) {
  const buy: Stock = {}
  let cost = 0
  for (const g of goodsOf(d)) {
    const k = Math.min(inPacks(g.id, n), roomFor(g.id, stock[g.id] ?? 0))
    if (k <= 0) continue
    buy[g.id] = k
    cost += costOf(g) * k
  }
  return { buy, cost }
}

/** what to ask for a dish on the menu: the food's own price plus a little for what goes on it (at the grill: the
 * price list is a mid-range Taipei robata's), or, for something without a price of its own, three times its cost */
export const menuPrice = (d: Dish, p: Part) => {
  const it = findItem(d, p.id)
  if (!it?.price) return suggestPrice(partCost(d, p))
  return Math.round((it.price + p.dabs.reduce((n, k) => n + SEASON_COST[k as Seasoning], 0) * 3) / 5) * 5
}
