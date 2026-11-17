/**
 * The staff's feeling for the owner and for each other (item 323, the owner's, 2026-11-18: 「新增與員工的好感度」「人事旁放一個關係圖，是老闆與
 * 員工，員工與員工之間，以及誰留宿」「關係之間會影響工作氣氛，這部份就讓你發揮」). Pure rules: App keeps the numbers (each hand's `bond` on their
 * rota, each pair's in the books), the office shows them.
 *
 * - **Their bond with the owner** (0..100, from 50): a word of praise (once a day), a staff meal (まかない, once a day, paid), rest earn it; a
 *   long day past ten hours, going home worn out, a day the shop couldn't pay its way cost it. As they feel, they work: at 0 a tenth slower
 *   and clumsier, at 100 a little quicker; past the bottom for three days running, they hand in their notice.
 * - **Each pair's** (0..100, from 50): a day worked side by side brings them closer, living upstairs together closer still; one carrying the
 *   other through a day (one worn out, the other not) wears it.
 * - **The shop's atmosphere** (工作氣氛, 0..100): what those on today feel for the owner and for each other, together. A warm shop works a
 *   little quicker and talks more; a cold one, slower and quiet.
 */
export const BOND_START = 50
/** what each thing does to someone's bond with the owner */
export const BOND_DELTA = { praise: 3, meal: 4, rested: 1, overwork: -2, worn: -3, unpaid: -8 } as const
export type BondEvent = keyof typeof BOND_DELTA
/** the most praise counts for, a day (a second word the same day is just words) */
export const PRAISE_PER_DAY = 1
/** a staff meal for each one on today, NT$ (まかない: a bowl of rice, soup, a piece of fish) */
export const MEAL_COST = 180
/** under this, unhappy; this many days running and they give notice */
export const LOW_BOND = 15
export const QUIT_AFTER = 3
/** past these hours in the day, a long one; at or over this tiredness going home, worn out; under this, rested */
export const LONG_DAY_H = 10
export const WORN_AT = 70
export const RESTED_UNDER = 30

const clamp = (v: number) => Math.max(0, Math.min(100, v))
export const bondOf = (b: number | undefined) => (b === undefined || !Number.isFinite(b) ? BOND_START : clamp(b))
/** someone's bond after one thing */
export const bondAfter = (b: number | undefined, e: BondEvent) => clamp(bondOf(b) + BOND_DELTA[e])

/**
 * Someone's bond with the owner at the day's end: `hours` they worked, `fatigue` going home (0..100), whether the shop paid its way
 * (`unpaid`: its cash under nothing at the day's end); and how many days running it's been under LOW_BOND (`low`)
 */
export function dayBond(b: number | undefined, day: { hours: number; fatigue: number; unpaid?: boolean }, low = 0) {
  let v = bondOf(b)
  if (day.hours > LONG_DAY_H) v += BOND_DELTA.overwork
  if (day.fatigue >= WORN_AT) v += BOND_DELTA.worn
  else if (day.fatigue < RESTED_UNDER) v += BOND_DELTA.rested
  if (day.unpaid) v += BOND_DELTA.unpaid
  v = clamp(v)
  return { bond: v, low: v < LOW_BOND ? low + 1 : 0 }
}
/** whether they've had enough: under LOW_BOND QUIT_AFTER days running */
export const givesNotice = (low: number | undefined) => (low ?? 0) >= QUIT_AFTER

/** how they work for how they feel: their pace and care, 0.9 at 0, 1 at 50, 1.08 at 100 */
export const bondPace = (b: number | undefined) => {
  const v = bondOf(b)
  return v < 50 ? 0.9 + (0.1 * v) / 50 : 1 + (0.08 * (v - 50)) / 50
}

/** a pair's key, the same either way round */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
/** what a day together does to a pair: worked it side by side +2, both living upstairs +1 more; one worn out and the other not −2 */
export const PAIR_DELTA = { together: 2, dorm: 1, carried: -2 } as const
/** the pairs' bonds after a day: `crew` those who worked it, whether each lives upstairs and went home worn out */
export function dayPairs(pairs: Record<string, number>, crew: readonly { id: string; dorm: boolean; worn: boolean }[]) {
  const out = { ...pairs }
  for (let i = 0; i < crew.length; i++) for (let j = i + 1; j < crew.length; j++) {
    const a = crew[i], b = crew[j], k = pairKey(a.id, b.id)
    let v = out[k] ?? BOND_START
    v += PAIR_DELTA.together
    if (a.dorm && b.dorm) v += PAIR_DELTA.dorm
    if (a.worn !== b.worn) v += PAIR_DELTA.carried
    out[k] = clamp(v)
  }
  return out
}

/** the shop's atmosphere (0..100): the owner's bonds with those on, and theirs with each other, together; nobody on, as it stands (50) */
export function atmosphere(ownerBonds: readonly number[], pairBonds: readonly number[]) {
  const all = [...ownerBonds, ...pairBonds]
  return all.length ? all.reduce((s, v) => s + bondOf(v), 0) / all.length : BOND_START
}
/** what the atmosphere does to the crew's pace: 0.95 cold, 1 as it stands, 1.05 warm */
export const moodPace = (a: number) => 0.95 + 0.1 * (clamp(a) / 100)
/** how it's put in words (the office's meter): cold, stiff, as usual, good, warm */
export const moodWord = (a: number) => (a < 25 ? 0 : a < 42 ? 1 : a < 58 ? 2 : a < 75 ? 3 : 4)
