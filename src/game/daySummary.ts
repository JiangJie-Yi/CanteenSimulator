/**
 * The day's takings, worked out as the shop shuts (the owner's: a closing-up sheet once the last customer's out of the door and the staff
 * have gone): what came in and what went out between opening and shutting (the books as they stood at each), the profit as the ledger
 * reckons it (takings less the food, the charcoal, the wages and the power and water), who came, how pleased they were, and the dish that
 * sold best.
 */
import { satisfaction, starsOf, type Visit } from './reputation'

export type Books = { revenue: number; food: number; fuel: number; wage: number; utility?: number }
export type DaySummary = {
  revenue: number; food: number; fuel: number; wage: number; utility: number
  profit: number
  /** the profit over the takings (null with none) */
  margin: number | null
  guests: number
  /** those who went without eating (or walked out) */
  walkedOut: number
  /** their stars on average (null: nobody stayed to eat) */
  stars: number | null
  /** the dish ordered most, and how many times (null: none) */
  best: { key: string; n: number } | null
}

/** the day between the books at opening (`from`) and at shutting (`to`): the visits made in it, and each dish's orders in it */
export function daySummary(from: Books, to: Books, visits: Visit[], sold: Record<string, number>): DaySummary {
  const d = (k: keyof Books) => Math.max(0, (to[k] ?? 0) - (from[k] ?? 0))
  const revenue = d('revenue'), food = d('food'), fuel = d('fuel'), wage = d('wage'), utility = d('utility')
  const profit = revenue - food - fuel - wage - utility
  const ate = visits.filter((v) => !v.walkedOut)
  const stars = ate.length ? ate.reduce((a, v) => a + starsOf(satisfaction(v)), 0) / ate.length : null
  let best: DaySummary['best'] = null
  for (const [key, n] of Object.entries(sold)) if (n > 0 && (!best || n > best.n)) best = { key, n }
  return { revenue, food, fuel, wage, utility, profit, margin: revenue > 0 ? profit / revenue : null, guests: visits.length,
    walkedOut: visits.length - ate.length, stars, best }
}

/** each dish's orders between two counts of them (orders only ever added) */
export function soldBetween(from: Record<string, number>, to: Record<string, number>) {
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(to)) { const m = n - (from[k] ?? 0); if (m > 0) out[k] = m }
  return out
}
