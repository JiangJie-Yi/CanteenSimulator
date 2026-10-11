// Money and stock: what things cost, what a dish on the menu takes out of stock, and whether it can be served.
// Pure functions over the data in src/data, so App (and the tests) all reckon the same way.
import { DISHES, type Dish } from '@/data/menu'
import { findItem, SEASON_COST, type Entry, type Part, type Seasoning } from '@/data/recipes'

export type Stock = Record<string, number>

/** the money the business starts with */
export const CAPITAL = 300000
/** what it costs to open one shop */
// (the first takes less than half the capital: what's left buys stock, and a little earned opens the second)
export const SHOP_COST = 120000
/** running costs, NT$: a bag's worth of charcoal added, and a cassette gas canister's worth burnt per hour at full */
export const CHARCOAL_COST = 18
export const GAS_PER_HOUR = 30

/**
 * What the ingredients of something on the menu cost, as a share of its price, roughly as in small eateries in
 * Taiwan: fish and seafood dear (around half), meat a little less, vegetables, tofu and mushrooms cheap, rice and
 * miso soup cheapest; a soup base or a bowl of noodles in between.
 */
export const COST_SHARE: Record<string, number> = {
  // dough: flour, butter, eggs, sugar (what goes on it is costed on its own)
  CroissantDough: 0.38, BaguetteDough: 0.26, BriocheDough: 0.34, SourdoughDough: 0.3,
  ExtraFish: 0.48, Saury: 0.46, Mackerel: 0.48, Aji: 0.45, Iwashi: 0.4, Shishamo: 0.42, Salmon: 0.5, Hokke: 0.48,
  Buri: 0.5, Gindara: 0.52, Nodoguro: 0.56, ShrimpSkewer: 0.52, Scallop: 0.55, Squid: 0.5, Shrimp: 0.5, CrabStick: 0.42,
  BeefSlice: 0.45, Meatball: 0.36, Fishball: 0.34, Yakitori: 0.4, PorkBelly: 0.42, Sausage: 0.38, BloodCake: 0.3,
  BeefShank: 0.48, Tendon: 0.45, Tripe: 0.4, BraisedEgg: 0.25,
  NapaCabbage: 0.22, Tofu: 0.24, FriedTofu: 0.26, Taro: 0.28, Corn: 0.28, GrilledCorn: 0.28, ShiitakeCap: 0.3,
  GrilledShiitake: 0.3, Enoki: 0.25, Shishito: 0.25, KingOyster: 0.3, Asparagus: 0.32, Okra: 0.28, BokChoy: 0.2,
  PickledGreens: 0.18, Potato: 0.22, SweetPotato: 0.22, Onigiri: 0.22, NetMochi: 0.24, Rice: 0.18, MisoSoup: 0.2, Sake: 0.35,
  ExtraNoodles: 0.25, mala: 0.32, tomato: 0.3, kombu: 0.26, braised: 0.4, clear: 0.42, plain: 0.3, dry: 0.3, sesame: 0.32,
}

/** what one of something costs to buy in */
export const costOf = (x: { id?: string; price: number; cost?: number }) =>
  x.cost ?? Math.round(x.price * (COST_SHARE[x.id ?? ''] ?? 0.38))

const shopOf = (e: Entry) => DISHES.find((x) => x.id === e.shop)!

/** what a thing takes out of stock (a bowl that comes with its beef: the beef; it isn't bought as a bowl) */
export const takesOf = (d: Dish, id: string): Stock =>
  (findItem(d, id) as { includes?: Stock } | undefined)?.includes ?? { [id]: 1 }

/** a part's cost: the food, and what's put on it */
export const partCost = (d: Dish, p: Part) => costOf(findItem(d, p.id) ?? { price: 0 }) +
  p.dabs.reduce((n, k) => n + SEASON_COST[k as Seasoning], 0)

/** what a dish on the menu costs to make */
export const entryCost = (e: Entry) => {
  const d = shopOf(e)
  return e.parts.reduce((n, p) => n + partCost(d, p), 0)
}

/** what a dish on the menu takes out of stock */
export const needOf = (e: Entry): Stock => {
  const d = shopOf(e)
  const need: Stock = {}
  for (const p of e.parts) for (const [k, q] of Object.entries(takesOf(d, p.id))) need[k] = (need[k] ?? 0) + q
  return need
}

/** how many of each thing a dish puts out to be cooked */
export const partsOf = (e: Entry): Stock => {
  const n: Stock = {}
  for (const p of e.parts) n[p.id] = (n[p.id] ?? 0) + 1
  return n
}

/** whether there's stock enough for one of a dish */
export const canServe = (e: Entry, stock: Stock) => Object.entries(needOf(e)).every(([k, q]) => (stock[k] ?? 0) >= q)

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

/** what buying n of every good of a shop costs */
export const buyAllCost = (d: Dish, n: number) => goodsOf(d).reduce((t, g) => t + costOf(g) * n, 0)
