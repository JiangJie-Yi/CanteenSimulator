// The kitchen's and the washrooms' cleaning things (the owner's, 2026-11-13, item 83: "and the everyday things: the dish soap, the toilet
// cleaner"): kept in stock as the other consumables are (game/supplies), bought by the pack in the stock's supplies tab.
import type { Lang } from '@/data/i18n'

/** the dish soap by the sink, in bottles */
export const DISH_SOAP = 'supply:dishsoap'
/** the toilet cleaner for the two washrooms, in bottles */
export const TOILET_CLEANER = 'supply:toiletcleaner'
export const HOUSEHOLD = [DISH_SOAP, TOILET_CLEANER] as const
export type Household = (typeof HOUSEHOLD)[number]
/** each one's pack: how many bottles, what it costs, and how many a new shop has */
export const HOUSEHOLD_PACK: Record<Household, { bottles: number; cost: number; start: number }> = {
  [DISH_SOAP]: { bottles: 4, cost: 220, start: 4 },
  [TOILET_CLEANER]: { bottles: 3, cost: 270, start: 3 },
}
/** a bottle of dish soap: so many squeezes (each into a sinkful that washes game/handWash's SOAP_PUMP plates) */
export const DISH_SOAP_SQUEEZES = 40
/** a bottle of toilet cleaner: so many scrubs of a toilet */
export const CLEANER_SCRUBS = 20
/** the stock keeper orders a pack once the spare bottles are fewer than this (as the washrooms' spares, game/washroom's WASHROOM_LOW) */
export const HOUSEHOLD_LOW: Record<Household, number> = { [DISH_SOAP]: 2, [TOILET_CLEANER]: 2 }
/**
 * A dose out of the bottle in use (item 203: the dish soap and the toilet cleaner were stocked and bought, and nothing ever used them): it
 * has `left` doses in it; empty, a new one's opened from stock (`open` takes one out, false with none there), `doses` in a full one.
 * Whether there was a dose to be had, and how many are left in the bottle after.
 */
export function takeDose(left: number, doses: number, open: () => boolean): { left: number; had: boolean } {
  if (left <= 0) {
    if (!open()) return { left: 0, had: false }
    left = doses
  }
  return { left: left - 1, had: true }
}
/** packs of one bought in: how many bottles, what they cost */
export const householdOrder = (id: Household, packs: number) => ({ bottles: packs * HOUSEHOLD_PACK[id].bottles, cost: packs * HOUSEHOLD_PACK[id].cost })
/** what a new shop has of each */
export const householdStart = () => Object.fromEntries(HOUSEHOLD.map((id) => [id, HOUSEHOLD_PACK[id].start])) as Record<Household, number>
export const isHousehold = (id: string): id is Household => (HOUSEHOLD as readonly string[]).includes(id)

const NAMES: Record<Household, [string, string, string]> = {
  [DISH_SOAP]: ['洗碗精', '食器用洗剤', 'Dish soap'],
  [TOILET_CLEANER]: ['廁所清潔劑', 'トイレ用洗剤', 'Toilet cleaner'],
}
export const householdName = (id: Household, lang: Lang) => NAMES[id][lang === 'ja' ? 1 : lang === 'en' ? 2 : 0]
