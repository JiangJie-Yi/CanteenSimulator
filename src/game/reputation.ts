// The shop's name among its customers (the owner's: a rating, like a review site's stars, made of how satisfied everyone who came in
// left; the shop's sign clicked shows it). Each visit is scored as the customer goes, from what they thought of the food, how long they
// waited for it, and what put them out (no tissues at their place, a dirty toilet, the lights off, an upset stomach, nothing on the menu
// they could have); the shop's stars are the recent visits' average, the newer counting more; and what each said.

export type Gripe = 'wait' | 'tissue' | 'toilet' | 'dark' | 'sick' | 'nothing' | 'receipt'
/** one customer's visit, as they leave: what they thought of what they ate (0..100, none if they ate nothing), how long they waited for
 * their first piece (seconds), whether they walked out, and what put them out; the game's day it was, and whether it's a review bought
 * (no customer behind it) */
export type Visit = { id: number; taste: number | null; waited: number; walkedOut: boolean; gripes: Gripe[]; day?: number; bought?: boolean }
/** how much each kind of upset takes off a visit's satisfaction */
export const GRIPE_COST: Record<Gripe, number> = { wait: 12, tissue: 8, toilet: 10, dark: 18, sick: 35, nothing: 25, receipt: 6 }
/** how long a wait for the first piece is taken in good part (seconds); after that, a point off every six seconds, up to twenty */
export const WAIT_OK = 90

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** how satisfied a visit left them (0..100): the food (or, with none eaten, little), less the wait and each upset once; walked out, a
 * quarter at most */
export function satisfaction(v: Visit) {
  let s = v.taste ?? (v.walkedOut ? 15 : 40)
  s -= Math.min(20, Math.max(0, v.waited - WAIT_OK) / 6)
  for (const g of new Set(v.gripes)) s -= GRIPE_COST[g]
  if (v.walkedOut) s = Math.min(s, 25)
  return clamp(s, 0, 100)
}
/** stars for a satisfaction: nothing 1.0, everything 5.0 */
export const starsOf = (sat: number) => 1 + (4 * clamp(sat, 0, 100)) / 100
/** how many of the latest visits make the rating, and how much less each one back counts than the one after it */
export const RECENT = 60
export const FADE = 0.97
export type Rating = { stars: number | null; n: number; food: number | null; service: number | null; place: number | null }
/** the shop's rating: the latest visits' stars, the newer counting more (two decimals, as review sites show them); and its three sides,
 * the food (what was eaten), the service (waits, walking out, nothing to be had) and the place (tissues, the toilet, the light, stomachs) */
export function rateShop(visits: Visit[]): Rating {
  const vs = visits.slice(-RECENT)
  if (!vs.length) return { stars: null, n: 0, food: null, service: null, place: null }
  const avg = (score: (v: Visit) => number | null) => {
    let sum = 0, wt = 0
    vs.forEach((v, i) => {
      const s = score(v)
      if (s === null) return
      const w = FADE ** (vs.length - 1 - i)
      sum += w * starsOf(s)
      wt += w
    })
    return wt ? Math.round((sum / wt) * 100) / 100 : null
  }
  const food = avg(foodScore), service = avg(serviceScore), place = avg(placeScore)
  return { stars: weighed(food, service, place), n: visits.length, food, service, place }
}
/** the three sides weighed into the whole (the owner's: the food most, then the service, then the place), so the stars are what the three
 * shown beside them make (they were the visits' own satisfaction, not the sides': 3.57 beside 4.07, 4.52 and 4.81); with no food eaten by
 * anyone, the other two */
export const WEIGHTS = { food: 0.45, service: 0.35, place: 0.2 }
function weighed(food: number | null, service: number | null, place: number | null) {
  const parts = [[food, WEIGHTS.food], [service, WEIGHTS.service], [place, WEIGHTS.place]].filter(([v]) => v !== null) as [number, number][]
  if (!parts.length) return null
  const w = parts.reduce((a, [, k]) => a + k, 0)
  return Math.round((parts.reduce((a, [v, k]) => a + v * k, 0) / w) * 100) / 100
}
const has = (v: Visit, g: Gripe) => v.gripes.includes(g)
/** a visit's three sides (0..100): the food (what was eaten; none, nothing), the service (the wait, walking out (nothing at all), nothing to
 * be had, no receipt), the place (tissues, the toilet, the light, stomachs) */
const foodScore = (v: Visit) => v.taste
const serviceScore = (v: Visit) => (v.walkedOut ? 0 : clamp(100 - Math.min(60, Math.max(0, v.waited - 60) / 2) - (has(v, 'nothing') ? 30 : 0) - (has(v, 'receipt') ? 20 : 0), 0, 100))
const placeScore = (v: Visit) => clamp(100 - (has(v, 'tissue') ? 25 : 0) - (has(v, 'toilet') ? 30 : 0) - (has(v, 'dark') ? 35 : 0) - (has(v, 'sick') ? 40 : 0), 0, 100)
/** one visit's own stars, by the same weighing as the shop's; walked out without eating, one */
export function visitStars(v: Visit) {
  if (v.walkedOut) return 1
  const f = foodScore(v)
  return weighed(f === null ? null : starsOf(f), starsOf(serviceScore(v)), starsOf(placeScore(v)))!
}

/**
 * What the shop's name brings in (the owner's): how many more (or fewer) customers come, and how patient they are, by its stars, taken as
 * the day's business opens. A famous shop has them queueing (half as many again, a tenth more patient); a poor name thins them out and has
 * them doubting (fewer, less patient); a ruined one, a few passing drinkers. No rating yet: as it is.
 */
export function flowOf(stars: number | null): { more: number; patience: number } {
  if (stars === null) return { more: 1, patience: 1 }
  if (stars >= 4.6) return { more: 1.5, patience: 1.1 }
  if (stars >= 4.0) return { more: 1.2, patience: 1 }
  if (stars >= 3.5) return { more: 1, patience: 1 }
  if (stars >= 2.5) return { more: 0.62, patience: 0.85 }
  return { more: 0.32, patience: 0.85 }
}
/** what a customer says of their visit: walking out, the worst thing that put them out, or what they thought of the food */
export type Remark = 'walkedOut' | Gripe | 'great' | 'good' | 'fine' | 'poor'
export function remarkOf(v: Visit): Remark {
  if (v.walkedOut) return 'walkedOut'
  const worst = [...v.gripes].sort((a, b) => GRIPE_COST[b] - GRIPE_COST[a])[0]
  if (worst) return worst
  const t = v.taste ?? 0
  return t >= 80 ? 'great' : t >= 60 ? 'good' : t >= 40 ? 'fine' : 'poor'
}
/** how many visits are kept (the rating needs only the latest; a few more for the list) */
export const KEEP_VISITS = 120
export const keepVisits = (vs: Visit[]) => (vs.length > KEEP_VISITS ? vs.slice(-KEEP_VISITS) : vs)

/** a visit's three sides as a map app's review of a restaurant shows them (料理 5/5, サービス 4/5, 雰囲気 5/5): whole stars, 1 to 5; nothing
 * eaten, none for the food */
export function visitSides(v: Visit): { food: number | null; service: number; place: number } {
  const whole = (s: number) => Math.max(1, Math.min(5, Math.round(starsOf(s))))
  const f = foodScore(v)
  return { food: f === null ? null : whole(f), service: v.walkedOut ? 1 : whole(serviceScore(v)), place: whole(placeScore(v)) }
}
/** how many of the visits rate it 5, 4, 3, 2 and 1 star (each its own stars, rounded), for the bars beside the score */
export function starCounts(visits: Visit[]): [number, number, number, number, number] {
  const c: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const v of visits) c[5 - Math.max(1, Math.min(5, Math.round(visitStars(v))))]++
  return c
}
/** the reviews in an order (the owner's: as a map app sorts them): most relevant (newest first, but those with something to say ahead of the
 * bare praise bought in), newest, highest, lowest */
export type ReviewOrder = 'relevant' | 'newest' | 'highest' | 'lowest'
export function sortReviews(visits: Visit[], by: ReviewOrder): Visit[] {
  const at = new Map(visits.map((v, i) => [v, i]))
  const newest = (a: Visit, b: Visit) => at.get(b)! - at.get(a)!
  const vs = [...visits]
  if (by === 'newest') return vs.sort(newest)
  if (by === 'highest') return vs.sort((a, b) => visitStars(b) - visitStars(a) || newest(a, b))
  if (by === 'lowest') return vs.sort((a, b) => visitStars(a) - visitStars(b) || newest(a, b))
  return vs.sort((a, b) => Number(!!a.bought) - Number(!!b.bought) || newest(a, b))
}
/** how long ago a visit was, in the game's days: today, so many days, weeks, months */
export function agoOf(day: number | undefined, today: number): { n: number; unit: 'today' | 'day' | 'week' | 'month' } {
  const d = Math.max(0, today - (day ?? today))
  if (d === 0) return { n: 0, unit: 'today' }
  if (d < 7) return { n: d, unit: 'day' }
  if (d < 30) return { n: Math.floor(d / 7), unit: 'week' }
  return { n: Math.floor(d / 30), unit: 'month' }
}
/** reviews to be bought (the owner's: a shop can pay for its stars), so many at so much (NT$) */
export const REVIEW_PACKS = [{ n: 5, cost: 2500 }, { n: 10, cost: 4500 }, { n: 30, cost: 12000 }] as const
/** the reviews a pack brings: four and five stars, nothing to complain of, dated `day`, numbered down from `first` (bought ones are numbered
 * below every customer's, who count up from one) */
export function boughtVisits(n: number, first: number, day: number): Visit[] {
  return Array.from({ length: n }, (_, i) => {
    const id = first - i, h = (Math.imul(id, 2654435761) >>> 0) % 1000 / 1000
    return { id, taste: 78 + Math.round(h * 21), waited: 20 + Math.round(h * 40), walkedOut: false, gripes: [], day, bought: true }
  })
}
