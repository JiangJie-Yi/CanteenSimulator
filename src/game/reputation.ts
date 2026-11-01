// The shop's name among its customers (the owner's: a rating, like a review site's stars, made of how satisfied everyone who came in
// left; the shop's sign clicked shows it). Each visit is scored as the customer goes, from what they thought of the food, how long they
// waited for it, and what put them out (no tissues at their place, a dirty toilet, the lights off, an upset stomach, nothing on the menu
// they could have); the shop's stars are the recent visits' average, the newer counting more; and what each said.

export type Gripe = 'wait' | 'tissue' | 'toilet' | 'dark' | 'sick' | 'nothing'
/** one customer's visit, as they leave: what they thought of what they ate (0..100, none if they ate nothing), how long they waited for
 * their first piece (seconds), whether they walked out, and what put them out */
export type Visit = { id: number; taste: number | null; waited: number; walkedOut: boolean; gripes: Gripe[] }
/** how much each kind of upset takes off a visit's satisfaction */
export const GRIPE_COST: Record<Gripe, number> = { wait: 12, tissue: 8, toilet: 10, dark: 18, sick: 35, nothing: 25 }
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
  const has = (v: Visit, g: Gripe) => v.gripes.includes(g)
  return {
    stars: avg(satisfaction),
    n: visits.length,
    food: avg((v) => v.taste),
    service: avg((v) => clamp(100 - Math.min(60, Math.max(0, v.waited - 60) / 2) - (v.walkedOut ? 50 : 0) - (has(v, 'nothing') ? 30 : 0), 0, 100)),
    place: avg((v) => clamp(100 - (has(v, 'tissue') ? 25 : 0) - (has(v, 'toilet') ? 30 : 0) - (has(v, 'dark') ? 35 : 0) - (has(v, 'sick') ? 40 : 0), 0, 100)),
  }
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
