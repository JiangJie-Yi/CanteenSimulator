/**
 * The shop's hours (the owner's: fixed, 14:30 to 02:30 the next morning, twelve hours, over midnight): opened by hand or by the
 * auto-run only within them; at their end the shop's shut up as by hand (last orders, those here finish and walk out, the staff go home, the day's sheet).
 * Minutes from midnight, as the game's clock (game/clock) keeps them.
 */
export const OPEN_AT = 14 * 60 + 30
export const CLOSE_AT = 2 * 60 + 30
/** whether the shop may be open at this minute of the day */
export const inHours = (minute: number) => {
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return m >= OPEN_AT || m < CLOSE_AT
}
/** the hours just begun between the minute before and now (the clock moved on from `was` to `now`) */
export const hoursBegin = (was: number, now: number) => !inHours(was) && inHours(now)
/** the hours just over between the minute before and now */
export const hoursEnd = (was: number, now: number) => inHours(was) && !inHours(now)
/** the hours as they read: 14:30–02:30 */
export const hoursText = () => `${hm(OPEN_AT)}–${hm(CLOSE_AT)}`
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
