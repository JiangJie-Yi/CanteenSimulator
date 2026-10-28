// How fresh what's in the pantry is (0..100): new stock comes in at 100, mixed in with what's already there by how much of each; it goes off
// as time passes, slowly frozen, faster chilled, fastest left out; and the staler, the less good it tastes.
import { storageOf, type Storage } from '@/data/storage'

/** freshness lost a game-minute, by where it's kept */
export const STALE_PER_MIN: Record<Storage, number> = { frozen: 0.15, chilled: 0.6, ambient: 1.2 }
/** never below this: food that's merely tired, not spoiled */
export const FRESH_FLOOR = 20

/** n new portions (at 100) added to `have` portions at `fresh`: the mix */
export const blendFresh = (have: number, fresh: number, n: number) =>
  have + n <= 0 ? 100 : (Math.max(0, have) * fresh + n * 100) / (Math.max(0, have) + n)

/** freshness after `mins` game-minutes kept where this food is kept */
export const ageFresh = (id: string, fresh: number, mins: number) =>
  Math.max(FRESH_FLOOR, fresh - STALE_PER_MIN[storageOf(id)] * mins)

/** how much of its taste a dish keeps at this freshness: all of it fresh, three quarters at the floor */
export const freshFactor = (fresh: number) => 0.75 + 0.25 * Math.max(0, Math.min(100, fresh)) / 100

/** a word for it */
export const freshGrade = (fresh: number): 'fresh' | 'good' | 'tired' => (fresh >= 80 ? 'fresh' : fresh >= 50 ? 'good' : 'tired')
