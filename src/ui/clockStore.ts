// The game's clock as it runs (game/clock): moved on by the app's second, read by the clock under the round buttons and by the app for
// the time of day (only what each reads redraws it: the clock's face each minute, the app at dusk and dawn, a new day at midnight).
import { useSyncExternalStore } from 'react'
import { START, tick, type Clock } from '@/game/clock'

let clock: Clock = START
const subs = new Set<() => void>()
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

export const getClock = () => clock
export function setClock(c: Clock) {
  if (c === clock) return
  clock = c
  subs.forEach((f) => f())
}
/** on by so many real seconds (already sped up by the game's speed) */
export const advanceClock = (seconds: number) => setClock(tick(clock, seconds))
/** one thing about the clock, redrawing only when that changes (a number, a string: compared as they are) */
export function useClock<T extends string | number | boolean>(pick: (c: Clock) => T): T {
  return useSyncExternalStore(subscribe, () => pick(clock))
}
