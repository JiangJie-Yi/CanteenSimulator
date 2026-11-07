// Each food in stock kept as the lots it was bought in, not one mixed freshness (the owner's: buying fresh stock lifted the whole lot's
// freshness, the nearly spoiled with it, as no kitchen works): every purchase is a lot of its own at 100, each lot goes off on its own,
// what's used comes out of the stalest first (first in, first out), and what's shown is the stalest lot (to be used up first) with how many
// portions there are at each grade.
import { freshGrade } from './freshness'

export type Lot = {
  /** portions in it */
  n: number
  /** 0..100 */
  fresh: number
  /** the shop's day it came in */
  day: number
}

const live = (lots: Lot[]) => lots.filter((l) => l.n > 0)
/** portions in all the lots */
export const lotsTotal = (lots: Lot[] = []) => lots.reduce((s, l) => s + Math.max(0, l.n), 0)

/** n new portions bought: a lot of their own, at 100 */
export const addLot = (lots: Lot[] = [], n: number, day = 0): Lot[] => n > 0 ? [...live(lots), { n, fresh: 100, day }] : live(lots)

/** n portions used: from the stalest lot first. What's left, and the freshness of what was used (the mean of the portions taken; 100 if none) */
export function takeLots(lots: Lot[] = [], n: number): { lots: Lot[]; fresh: number } {
  const left = live(lots).map((l) => ({ ...l })).sort((a, b) => a.fresh - b.fresh || a.day - b.day)
  let want = Math.max(0, n), got = 0, sum = 0
  for (const l of left) {
    if (want <= 0) break
    const t = Math.min(l.n, want)
    l.n -= t
    want -= t
    got += t
    sum += t * l.fresh
  }
  return { lots: live(left), fresh: got > 0 ? sum / got : 100 }
}

/** every lot gone off by what `age` does to a freshness */
export const ageLots = (lots: Lot[] = [], age: (fresh: number) => number): Lot[] => live(lots).map((l) => ({ ...l, fresh: age(l.fresh) }))

/** the lots brought to `have` portions: more bought as a new lot, fewer taken from the stalest (the stock's count is the truth). What was
 * used, if any, and how fresh */
export function settleLots(lots: Lot[] = [], have: number, day = 0): { lots: Lot[]; used: number; fresh: number } {
  const now = lotsTotal(lots)
  if (have > now) return { lots: addLot(lots, have - now, day), used: 0, fresh: 100 }
  if (have < now) { const t = takeLots(lots, now - have); return { lots: t.lots, used: now - have, fresh: t.fresh } }
  return { lots: live(lots), used: 0, fresh: 100 }
}

/** the freshness shown: the stalest lot's (it's the one to use up first); 100 with nothing in */
export const stalest = (lots: Lot[] = []) => { const l = live(lots); return l.length ? Math.min(...l.map((x) => x.fresh)) : 100 }

/** how many portions there are at each grade */
export function lotGrades(lots: Lot[] = []) {
  const g = { fresh: 0, good: 0, tired: 0, spoiled: 0 }
  for (const l of live(lots)) g[freshGrade(l.fresh)] += l.n
  return g
}

/** an old save's one mixed freshness, as a single lot of what's in stock */
export const lotsFrom = (have: number, fresh: number): Lot[] => have > 0 ? [{ n: have, fresh, day: 0 }] : []
