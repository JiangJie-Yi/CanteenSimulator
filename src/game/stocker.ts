// The stock keeper's (倉儲) round on the floor (the owner's: they order in and restock, the bar's tissues and the toilets' paper too, and
// walk to do it): what they see to next, and which drinks they order a case of.
import { CASE_SIZE } from './drinkStock'

/** a toilet's roll is changed once it's down to this much of a roll (of 1) */
export const ROLL_LOW = 0.25
/** a place's box of tissues is changed once it's down to this many sheets */
export const BOX_LOW = 30
/** a fridge is gone to once this many of its places could be filled from the back */
export const FRIDGE_SHORT = 3

export type StockChore = { kind: 'roll'; who: 'm' | 'f' } | { kind: 'drinks'; unit: number } | { kind: 'tissue'; seat: number } | null

/**
 * What the stock keeper sees to next: a toilet's roll running out first (a customer finding it bare minds that most), while nobody's using
 * that toilet; then a fridge short of three or more that the back can fill; then a washroom's paper towels or hand soap low (the same trip
 * as a roll's: in, topped up from the spares); then a place's tissues running low (the emptiest first), while nobody sits there and there's
 * a spare box; else nothing. `fridgeShort`: how many of each fridge's drinks the back could fill.
 */
export function stockerChore({ rolls, wcBusy, fridgeShort, boxes, seatTaken, spares, rollSpares = Infinity, wcLow }: {
  rolls: { m: number; f: number }; wcBusy: { m: boolean; f: boolean }; fridgeShort: number[]; boxes: number[]; seatTaken: (n: number) => boolean
  spares: number
  /** spare toilet rolls in stock (game/washroom): none, no roll changed */
  rollSpares?: number
  /** each washroom's paper towels or hand soap down to where they're topped up, with a spare in stock for it (game/washroom) */
  wcLow?: { m: boolean; f: boolean }
}): StockChore {
  if (rollSpares > 0) for (const who of ['m', 'f'] as const) if (rolls[who] < ROLL_LOW && !wcBusy[who]) return { kind: 'roll', who }
  const unit = fridgeShort.findIndex((n) => n >= FRIDGE_SHORT)
  if (unit >= 0) return { kind: 'drinks', unit }
  if (wcLow) for (const who of ['m', 'f'] as const) if (wcLow[who] && !wcBusy[who]) return { kind: 'roll', who }
  if (spares > 0) {
    let best = -1
    boxes.forEach((n, i) => { if (n < BOX_LOW && !seatTaken(i) && (best < 0 || n < boxes[best])) best = i })
    if (best >= 0) return { kind: 'tissue', seat: best }
  }
  return null
}

/** the drinks (of those the fridges are stocked with) a case of is ordered in: those the back's down to under half a case of */
export const drinksToOrder = (back: Record<string, number>, ids: string[]) =>
  [...new Set(ids)].filter((id) => (back[id] ?? 0) < (CASE_SIZE[id] ?? 24) / 2)
