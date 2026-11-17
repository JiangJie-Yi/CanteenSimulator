/**
 * The day's takings, worked out as the shop shuts (the owner's: a closing-up sheet once the last customer's out of the door and the staff
 * have gone): what came in and what went out between opening and shutting (the books as they stood at each), the profit as the ledger
 * reckons it (takings less the food, the charcoal, the wages and the power and water, the rent, the delivery platform's cut and the card
 * company's fee (item 210: a shop in Osaka), and the reviews bought and the shrine's offerings (item 203: they came out of the cash, never the
 * profit)), who came, how pleased they were, and the dish that sold best.
 */
import { satisfaction, starsOf, type Visit } from './reputation'

export type Books = { revenue: number; food: number; fuel: number; wage: number; utility?: number; promo?: number; offering?: number
  /** of the wages, what was paid over the hour's pay for the hours past eight in the day's work (game/hours' payFor): in `wage` already */
  overtime?: number
  /** of the wages, what was paid over the hour's pay for the night's hours, 22:00 to 05:00 (深夜): in `wage` already */
  night?: number
  /** the rent (game/costs' rentDue), the delivery platform's cut of the riders' orders, the card company's fee (item 210) */
  rent?: number; platform?: number; cardFee?: number
  /** of the food, what was thrown away gone off (in `food` already); of what was ordered, what was given back to those who left before
   * it all came (out of `revenue` already) (item 329) */
  tossed?: number; refunds?: number }
export type DaySummary = {
  revenue: number; food: number; fuel: number; wage: number; utility: number
  /** of the wages, the overtime's extra (the owner's, 2026-11-15), and the night's (item 210) */
  overtime: number; night: number
  /** the rent, the delivery platform's cut, the card company's fee (item 210) */
  rent: number; platform: number; cardFee: number
  /** of the food, what was thrown away; given back to those who left before it all came (item 329) */
  tossed: number; refunds: number
  /** the wages over the takings (人件費率; null with none): with the food's, what a shop's run on (FL) */
  labour: number | null
  /** the reviews bought and the shrine's offerings (item 203) */
  other: number
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
  const revenue = d('revenue'), food = d('food'), fuel = d('fuel'), wage = d('wage'), utility = d('utility'), overtime = d('overtime')
  const night = d('night'), rent = d('rent'), platform = d('platform'), cardFee = d('cardFee'), tossed = d('tossed'), refunds = d('refunds')
  const other = d('promo') + d('offering')
  const profit = revenue - food - fuel - wage - utility - rent - platform - cardFee - other
  const ate = visits.filter((v) => !v.walkedOut)
  const stars = ate.length ? ate.reduce((a, v) => a + starsOf(satisfaction(v)), 0) / ate.length : null
  let best: DaySummary['best'] = null
  for (const [key, n] of Object.entries(sold)) if (n > 0 && (!best || n > best.n)) best = { key, n }
  return { revenue, food, fuel, wage, utility, overtime, night, rent, platform, cardFee, tossed, refunds, labour: revenue > 0 ? wage / revenue : null, other, profit,
    margin: revenue > 0 ? profit / revenue : null, guests: visits.length, walkedOut: visits.length - ate.length, stars, best }
}

/**
 * What the day's sheet points out could be done better (item 329, the owner's, 2026-11-18: 「帳簿變扣得比較快，原因是?」: a day with every
 * job filled lost money, the books said so, and not why): past where a shop's usually run, each with what it came to and its share.
 * The wages over a third and a half of the takings (a shop's run on about a third: the staff on for the hours, for the customers there
 * were); what was thrown away over a sixth of the food (bought more than's sold); what was given back to those who left before it all came
 * over a twentieth of what was ordered (the food too slow for them)
 */
export const ADVICE_AT = { labour: 0.45, tossed: 0.15, refunds: 0.05 }
export type Advice = { kind: 'labour' | 'tossed' | 'refunds'; share: number; amount: number }
export function adviceOf(s: DaySummary): Advice[] {
  const out: Advice[] = []
  if (s.labour !== null && s.labour > ADVICE_AT.labour) out.push({ kind: 'labour', share: s.labour, amount: s.wage })
  if (s.food > 0 && s.tossed / s.food > ADVICE_AT.tossed) out.push({ kind: 'tossed', share: s.tossed / s.food, amount: s.tossed })
  const ordered = s.revenue + s.refunds
  if (ordered > 0 && s.refunds / ordered > ADVICE_AT.refunds) out.push({ kind: 'refunds', share: s.refunds / ordered, amount: s.refunds })
  return out
}

/** each dish's orders between two counts of them (orders only ever added) */
export function soldBetween(from: Record<string, number>, to: Record<string, number>) {
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(to)) { const m = n - (from[k] ?? 0); if (m > 0) out[k] = m }
  return out
}

/** a day kept in the books (the owner's: the closing sheets gathered into the ledger), the most recent last */
export type DayRecord = { day: number; revenue: number; profit: number; guests: number; stars: number | null; best: { key: string; n: number } | null
  /** when it opened and shut ("HH:MM"), how many minutes past the hours' end it shut, and the overtime paid for it (the owner's, 2026-11-15:
   * "the hours must be kept too", "as past them the staff's pay goes up"); none on a day kept before they were */
  open?: string; close?: string; late?: number; overtime?: number
  /** the day's wages, for its wages over its takings (item 210) */
  wage?: number }
/** a day's hours as it went: opened, shut, minutes past the hours' end */
export type DayHours = { open: string; close: string; late: number }
/** how many days the books keep */
export const KEEP_DAYS = 60
/** the books with the day just closed added (opened and shut twice in a day: the two put together, the stars weighed by their customers) */
export function addDay(days: DayRecord[], day: number, s: DaySummary, hours?: DayHours): DayRecord[] {
  const was = days.find((d) => d.day === day)
  const rated = (r: { guests: number; stars: number | null }) => (r.stars === null ? 0 : r.guests)
  const rec: DayRecord = was
    ? { day, revenue: was.revenue + s.revenue, profit: was.profit + s.profit, guests: was.guests + s.guests,
      stars: rated(was) + rated(s) ? ((was.stars ?? 0) * rated(was) + (s.stars ?? 0) * rated(s)) / (rated(was) + rated(s)) : null,
      best: !was.best || (s.best && s.best.n > was.best.n) ? s.best : was.best }
    : { day, revenue: s.revenue, profit: s.profit, guests: s.guests, stars: s.stars, best: s.best }
  // (its hours: opened when it first opened, shut when it last shut; the overtime of the two together)
  // (each only when there's one: a day without them reads as it always did)
  const open = was?.open ?? hours?.open, close = hours?.close ?? was?.close, late = hours ? hours.late : was?.late
  const overtime = (was?.overtime ?? 0) + s.overtime
  const wage = (was?.wage ?? 0) + s.wage
  if (open !== undefined) rec.open = open
  if (close !== undefined) rec.close = close
  if (late !== undefined) rec.late = late
  if (overtime > 0) rec.overtime = overtime
  if (wage > 0) rec.wage = wage
  const next = [...days.filter((d) => d.day !== day), rec]
  return next.length > KEEP_DAYS ? next.slice(-KEEP_DAYS) : next
}
