/**
 * The shop's hours (the owner's: fixed, 16:30 to 04:30 the next morning, twelve hours, over midnight): opened by hand or by the
 * auto-run only within them; at their end the shop's shut up as by hand (last orders, those here finish and walk out, the staff go home, the day's sheet).
 * Minutes from midnight, as the game's clock (game/clock) keeps them.
 */
export const OPEN_AT = 16 * 60 + 30
export const CLOSE_AT = 4 * 60 + 30
/** whether the shop may be open at this minute of the day */
export const inHours = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= OPEN_AT || m < CLOSE_AT
}
/** the hours just begun between the minute before and now (the clock moved on from `was` to `now`) */
export const hoursBegin = (was: number, now: number) => !inHours(was) && inHours(now)
/** the hours just over between the minute before and now */
export const hoursEnd = (was: number, now: number) => inHours(was) && !inHours(now)
/**
 * Deep night (深夜, the owner's): from midnight till the sky lightens (05:00, game/clock's dawn): the staff tire faster (data/staff's
 * LATE_TIRE, but for the night owls), and a different crowd comes in (data/guests' comesLate), ordering more.
 */
export const LATE_FROM = 0
export const LATE_TO = 5 * 60
export const isLate = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= LATE_FROM && m < LATE_TO
}
/** the last half hour before closing (the owner's): no one more sat down to eat in, only takeaways and deliveries */
export const LAST_CALL_MIN = 30
export const lastCall = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return inHours(m) && ((CLOSE_AT - m + 1440) % 1440) <= LAST_CALL_MIN
}
/** whether a customer's let in to sit down and eat at this minute: in the hours, before the last half hour */
export const seatsOpen = (minute: number) => inHours(minute) && !lastCall(minute)
/** the hours as they read: 16:30–04:30 */
export const hoursText = () => `${hm(OPEN_AT)}–${hm(CLOSE_AT)}`
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
