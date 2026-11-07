// How fresh what's in the pantry is (0..100): new stock comes in at 100, a lot of its own (game/lots: never mixed in with what's there); it goes off
// as time passes, slowly frozen (the colder the freezer's kept, the slower: its lid left up, it warms and the frozen food goes off fast),
// faster chilled, fastest left out; the staler, the less good it tastes, and below INEDIBLE it isn't fit to eat: it tastes of it, and may
// well give whoever eats it an upset stomach (the owner's).
import { storageOf, type Storage } from '@/data/storage'

/** freshness lost a game-minute, by where it's kept (the frozen at -20) */
export const STALE_PER_MIN: Record<Storage, number> = { frozen: 0.15, chilled: 0.6, ambient: 1.2 }
/** below this it isn't fit to eat (不可食用) */
export const INEDIBLE = 30

/** how much faster frozen food goes off at a freezer's temperature than at -20: half as fast with every 5 degrees colder, twice with every 5
 * warmer (the lid left up, the cavity warms toward the room) */
export const frozenRate = (temp: number) => Math.pow(2, (temp + 20) / 5)

/** freshness after `mins` game-minutes kept where this food is kept (the frozen in a freezer at `temp`); down to nothing, spoiled */
export const ageFresh = (id: string, fresh: number, mins: number, temp = -20) => {
  const where = storageOf(id)
  return Math.max(0, fresh - STALE_PER_MIN[where] * (where === 'frozen' ? frozenRate(temp) : 1) * mins)
}

/** how much of its taste a dish keeps at this freshness: all of it fresh, three quarters just fit to eat, falling away to a fifth spoiled through */
export const freshFactor = (fresh: number) => {
  const f = Math.max(0, Math.min(100, fresh))
  return f >= INEDIBLE ? 0.75 + (0.25 * (f - INEDIBLE)) / (100 - INEDIBLE) : 0.2 + (0.55 * f) / INEDIBLE
}

/** the chance that a dish made with food this fresh upsets its eater's stomach: none while it's fit to eat; a quarter just past it, most of the
 * time spoiled through */
export const sickChance = (fresh: number) => (fresh >= INEDIBLE ? 0 : 0.25 + (0.6 * (INEDIBLE - Math.max(0, fresh))) / INEDIBLE)

/** a word for it */
export const freshGrade = (fresh: number): 'fresh' | 'good' | 'tired' | 'spoiled' =>
  fresh >= 80 ? 'fresh' : fresh >= 50 ? 'good' : fresh >= INEDIBLE ? 'tired' : 'spoiled'
