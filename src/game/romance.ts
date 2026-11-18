// Romance with one of the staff (item 340, the owner's, 2026-11-18: 「強化關係系統，女員工關係好到一定程度可談戀愛」), on top of each one's
// feeling for the owner (game/affinity's bond). Pure rules: App keeps the state on each hand's rota (dating since, last asked, last date),
// the office shows it and has the buttons.
//
// - Only a woman on the staff, and of age (twenty and over: the shop serves drink, and a date's a dinner out), once her feeling for the owner
//   is up at CONFESS_AT; one at a time (asking another while seeing someone isn't on offer).
// - Asked, she says yes the more likely the fonder she is: a half at CONFESS_AT, nearly sure at 100. No: a little awkward between them (her
//   feeling down a little), and not asked again for RETRY_DAYS.
// - Seeing each other: her feeling up a little every day; a date on a day the shop's shut (once a day, its cost paid from the cash) up more;
//   the work's mood a little lighter with her on. Her feeling fallen under BREAKUP_AT (overworked, unpaid...): it's over, and it shows.

const clamp = (v: number) => Math.max(0, Math.min(100, v))

export const ADULT = 20
export const CONFESS_AT = 80
export const RETRY_DAYS = 7
export const BREAKUP_AT = 45
export const DATE_COST = 1500
export const DATE_BOND = 6
export const DATING_DAILY = 1
export const FAIL_BOND = -5
export const BREAKUP_BOND = -10
/** how much lighter the work's mood is (game/affinity's atmosphere, 0..100) with the one the owner's seeing on today */
export const ROMANCE_ATMOS = 3

/** what romance keeps on a hand's rota: the day they started seeing each other (none: not), the day she was last asked and said no, the
 * day of their last date */
export type Romance = { bond?: number; dating?: number; askedOn?: number; datedOn?: number }

/** whether she can be asked out today: a woman of age, fond enough, not turned down within RETRY_DAYS, not already seeing him, and him seeing
 * no one else */
export function canConfess(w: { look: { female: boolean }; years: number }, r: Romance, today: number, seeingSomeone: boolean) {
  if (!w.look.female || w.years < ADULT || seeingSomeone || r.dating !== undefined) return false
  if ((r.bond ?? 0) < CONFESS_AT) return false
  return r.askedOn === undefined || today - r.askedOn >= RETRY_DAYS
}

/** how likely she says yes: a half at CONFESS_AT, rising to 0.95 at 100 */
export const yesChance = (bond: number) => Math.max(0, Math.min(0.95, 0.5 + ((bond - CONFESS_AT) / (100 - CONFESS_AT)) * 0.45))

/** asking her out, `roll` the dice (0..1): yes, seeing each other from today; no, her feeling down FAIL_BOND, not asked again for a while */
export function confess<R extends Romance>(r: R, today: number, roll: number): { r: R; yes: boolean } {
  const yes = roll < yesChance(r.bond ?? 0)
  return yes ? { r: { ...r, dating: today, askedOn: undefined }, yes } : { r: { ...r, bond: clamp((r.bond ?? 0) + FAIL_BOND), askedOn: today }, yes }
}

/** whether they can go out today: seeing each other, not out already today, the shop shut */
export const canDate = (r: Romance, today: number, shopOpen: boolean) => r.dating !== undefined && r.datedOn !== today && !shopOpen

/** a date: her feeling up DATE_BOND */
export const goOnDate = <R extends Romance>(r: R, today: number): R => ({ ...r, bond: clamp((r.bond ?? 0) + DATE_BOND), datedOn: today })

/** the day's end: seeing each other, her feeling up DATING_DAILY; fallen under BREAKUP_AT, it's over and her feeling down BREAKUP_BOND more */
export function dayRomance<R extends Romance>(r: R): { r: R; brokeUp: boolean } {
  if (r.dating === undefined) return { r, brokeUp: false }
  const b = r.bond ?? 0
  if (b < BREAKUP_AT) return { r: { ...r, dating: undefined, bond: clamp(b + BREAKUP_BOND) }, brokeUp: true }
  return { r: { ...r, bond: clamp(b + DATING_DAILY) }, brokeUp: false }
}
