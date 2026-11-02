// The game's clock (the owner's: a second of ours is a minute of the game's; day and night come round with the time): the day it is and the
// minute of it, a new day at midnight; the day in four parts by its light, dawn and dusk between day and night and shorter than either (the
// owner's). Pure: the app moves it on by the second (sped up with the game, ×2); the sun on the clock moves it on to the next part.

/** game minutes to a real second (the owner's) */
export const MINUTES_PER_SECOND = 1
export const DAY_MINUTES = 24 * 60
/** the parts of the day by its light */
export type Sky = 'dawn' | 'day' | 'dusk' | 'night'
/** where each part starts, in its order from midnight: night till five, dawn till half past six, day till five in the evening, dusk till
 * half past six, night again (dawn and dusk an hour and a half each, the owner's: shorter than day and night) */
export const SKIES: readonly { sky: Sky; from: number }[] = [
  { sky: 'dawn', from: 5 * 60 },
  { sky: 'day', from: 6 * 60 + 30 },
  { sky: 'dusk', from: 17 * 60 },
  { sky: 'night', from: 18 * 60 + 30 },
]

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

/** the part of the day it is at this minute */
export function skyAt(minute: number): Sky {
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  let sky: Sky = 'night'
  for (const p of SKIES) if (m >= p.from) sky = p.sky
  return sky
}

export const isNight = (minute: number) => skyAt(minute) === 'night'

/** the page's look in this part of the day: dark only by night (its panels light at dawn and dusk) */
export const themeOf = (sky: Sky): 'light' | 'dark' => (sky === 'night' ? 'dark' : 'light')
export const themeAt = (c: Clock) => themeOf(skyAt(c.minute))

/** the clock moved on to where the next part of the day starts (the sun on the clock pressed: to see the shop in each light without waiting);
 * after dusk's night, the next day's dawn */
export function nextSky(c: Clock): Clock {
  const ahead = SKIES.find((p) => p.from > c.minute)
  return ahead ? { day: c.day, minute: ahead.from } : { day: c.day + 1, minute: SKIES[0].from }
}

/** the time as a clock shows it, 24-hour, the minute's fraction dropped: 06:05 */
export function hhmm(minute: number) {
  const m = Math.floor(minute) % DAY_MINUTES
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
