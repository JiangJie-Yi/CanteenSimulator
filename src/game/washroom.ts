// The washrooms' consumables (the owner's, 2026-11-10: the soap can be pressed and is used up, the paper towels a box of 150 at most, and
// everything in stock shown under 民生): the toilet rolls, the paper towels in each box, the hand soap in each bottle. Spares are kept in
// stock and put in from it: a roll on its holder as the stock keeper (or the owner) changes it (no spare, no new roll), the towel box and
// the soap bottle topped up from the spares before each day's opening. Each guest presses the soap once as they wash their hands, and
// one in two takes a paper towel as they dry them.

/** the stock's ids for the spares: toilet rolls (one roll each), paper towel packs (each fills a box), hand soap refills (each fills a
 * bottle) */
export const ROLL = 'supply:roll'
export const TOWEL = 'supply:towel'
export const SOAP = 'supply:soap'
/** sheets in a full towel box (the owner's: 150 at most) and presses in a full soap bottle */
export const TOWEL_FULL = 150
export const SOAP_FULL = 250
/** how they're bought: so many to a pack, at so much (NT$) */
export const WASHROOM_PACKS: Record<string, { n: number; cost: number }> = {
  [ROLL]: { n: 12, cost: 180 },
  [TOWEL]: { n: 5, cost: 260 },
  [SOAP]: { n: 3, cost: 240 },
}
/** spares a new shop starts with, and the stock keeper orders a pack once they're below the low mark */
export const WASHROOM_START: Record<string, number> = { [ROLL]: 12, [TOWEL]: 4, [SOAP]: 2 }
export const WASHROOM_LOW: Record<string, number> = { [ROLL]: 4, [TOWEL]: 2, [SOAP]: 1 }
/** a towel box or a soap bottle this low is topped up before the day (it wouldn't last it) */
export const TOWEL_REFILL_AT = 40
export const SOAP_REFILL_AT = 60

/** one taken from a box or a bottle (a sheet, a press): what's left, and whether there was one to take */
export const takeOne = (n: number) => ({ left: Math.max(0, n - 1), got: n > 0 })
/** before the day: a towel box or a soap bottle below its mark filled from a spare, if there's one */
export function topUp(level: number, full: number, below: number, spares: number) {
  return level < below && spares > 0 ? { level: full, spares: spares - 1 } : { level, spares }
}
/** packs bought: how many spares, and what they cost */
export const washroomOrder = (id: string, packs: number) => ({ n: packs * (WASHROOM_PACKS[id]?.n ?? 0), cost: packs * (WASHROOM_PACKS[id]?.cost ?? 0) })
/** whether a guest takes a paper towel as they dry their hands (fixed by their id): one in two */
export const takesTowel = (id: number) => (Math.imul(id, 2654435761) >>> 0) % 2 === 0
