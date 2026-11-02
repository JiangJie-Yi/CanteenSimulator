// What the kitchen uses up besides its food: the seasonings, a dose with every dab (kept with the food: the sauces in the fridge, salt and the
// dry powders at room temperature), and the binchotan for the fire, kept in a sack on the floor by the table and taken from it into the
// crate on the table's top as the crate runs out. Each is bought in, held in stock and used up (the owner's: they aren't free).
import { TISSUE, TISSUE_START } from './tissues'
import { RECEIPT, RECEIPT_START } from './receipts'
import { SEASONINGS, SEASON_COST, SEASON_NAME, type Seasoning } from '@/data/recipes'
import type { Lang } from '@/data/i18n'
import type { Stock } from './economy'

/** a seasoning's place in the stock (counted in doses: one a dab) */
export const seasonId = (k: Seasoning) => `season:${k}`
export const isSeasonId = (id: string) => id.startsWith('season:')
export const seasonOf = (id: string) => (isSeasonId(id) ? (id.slice(7) as Seasoning) : null)
/** the binchotan in the sack (counted in sticks) */
export const CHARCOAL = 'charcoal'
/** what isn't food: kept out of what goes stale */
export const isSupply = (id: string) => isSeasonId(id) || id === CHARCOAL

/** the usual stock of each seasoning (補滿 tops it up to this), and what a new shop has of each */
export const SEASON_PAR = 30
export const SEASON_START = 30
/** a sack of binchotan: how many sticks, and what it costs */
export const SACK_STICKS = 60
export const SACK_COST = 170
/** a new shop's charcoal: two sacks */
export const CHARCOAL_START = 2 * SACK_STICKS
/** a stock keeper orders more charcoal once the sack's down to this many sticks */
export const CHARCOAL_LOW = 40

/** the seasonings as goods to be bought in: each dose at what a dab costs */
export const SEASON_GOODS = SEASONINGS.map((k) => ({ id: seasonId(k), price: 0, cost: SEASON_COST[k] }))

/** what a new shop starts with besides its food */
export const startingSupplies = (): Stock => ({
  ...Object.fromEntries(SEASONINGS.map((k) => [seasonId(k), SEASON_START])),
  [CHARCOAL]: CHARCOAL_START,
  // (spare boxes of tissues for the places' drawers: game/tissues)
  [TISSUE]: TISSUE_START,
  // (and spare rolls of receipt paper for the register's printer: game/receipts)
  [RECEIPT]: RECEIPT_START,
})

/** a dab of a seasoning taken from stock (null when there's none left: it can't go on) */
export function dabFrom(stock: Stock, k: Seasoning): Stock | null {
  const id = seasonId(k)
  if ((stock[id] ?? 0) < 1) return null
  return { ...stock, [id]: stock[id] - 1 }
}

/** the crate on the table run out: filled again from the sack, as much as it holds or as much as there is */
export function crateRefill(sack: number, cap: number) {
  const n = Math.max(0, Math.min(cap, Math.floor(sack)))
  return { crate: n, sack: sack - n }
}

/** sticks put on the fire, taken from the sack (null if there aren't that many: none go on) */
export function burnCharcoal(stock: Stock, sticks: number): Stock | null {
  if ((stock[CHARCOAL] ?? 0) < sticks) return null
  return { ...stock, [CHARCOAL]: (stock[CHARCOAL] ?? 0) - sticks }
}

/** sacks of charcoal bought in: how many sticks they add and what they cost */
export const charcoalOrder = (sacks: number) => ({ sticks: sacks * SACK_STICKS, cost: sacks * SACK_COST })

/** what a supply's called (null for food) */
export function supplyName(id: string, lang: Lang): string | null {
  const k = seasonOf(id)
  if (k) return SEASON_NAME[lang][k]
  if (id === TISSUE) return lang === 'ja' ? 'ティッシュ（箱）' : lang === 'en' ? 'tissues (boxes)' : '衛生紙（盒）'
  if (id === RECEIPT) return lang === 'ja' ? 'レシート用紙（巻）' : lang === 'en' ? 'receipt paper (rolls)' : '發票紙（捲）'
  return id === CHARCOAL ? (lang === 'ja' ? '備長炭' : lang === 'en' ? 'binchotan' : '備長炭') : null
}
