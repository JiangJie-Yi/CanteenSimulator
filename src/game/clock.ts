// The game's clock (the owner's: a second of ours is a minute of the game's; day and night come round with the time, not at a button): the
// day it is and the minute of it, a new day at midnight. Pure: the app moves it on by the second (sped up with the game, ×2).

/** game minutes to a real second (the owner's) */
export const MINUTES_PER_SECOND = 1
export const DAY_MINUTES = 24 * 60
/** the day's light: from six in the morning to six in the evening */
export const DAWN = 6 * 60
export const DUSK = 18 * 60

/** the day (from 1) and the minute of it (0 to 1440, a fraction of one between seconds) */
export type Clock = { day: number; minute: number }

/** a new game: its first day, ten in the morning */
export const START: Clock = { day: 1, minute: 10 * 60 }

/** the clock after so many real seconds (already sped up by the game's speed); never back */
export function tick(c: Clock, seconds: number): Clock {
  if (!(seconds > 0)) return c
  const m = c.minute + seconds * MINUTES_PER_SECOND
  const days = Math.floor(m / DAY_MINUTES)
  return { day: c.day + days, minute: m - days * DAY_MINUTES }
}

/** night from dusk to dawn */
export const isNight = (minute: number) => minute < DAWN || minute >= DUSK

/** the page's look at this time */
export const themeAt = (c: Clock): 'light' | 'dark' => (isNight(c.minute) ? 'dark' : 'light')

/** the time as a clock shows it, 24-hour, the minute's fraction dropped: 06:05 */
export function hhmm(minute: number) {
  const m = Math.floor(minute) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
