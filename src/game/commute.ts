// The staff's day's end and start (the owner's: nobody gone at once where they stood, nobody marching off in step): who lives upstairs
// and who goes home, each one's own moment to set off and pace, a pause at the door to nod back in, and a word or two on the way. Pure
// rules; the walks themselves are the shop's (Roasting's crew, GuestBar3D's servers and stock keeper).

/** where someone goes when the shop shuts, and comes from when it opens: upstairs by the staff door (the owner and the cooks who live in),
 * or out of the front door and home (the servers, the till, the stock keeper, the helpers) */
export type CommuteType = 'dorm' | 'home'
export const commuteOf = (role: string): CommuteType => (role === 'owner' || role === 'chef' ? 'dorm' : 'home')

/** a number 0..1 of its own for a name and a salt, the same every time */
export function unit(id: string, salt = '') {
  let h = 2166136261
  for (const ch of id + '|' + salt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return (h % 100000) / 100000
}
/** seconds each one finishes up for before they set off (a wipe of the counter, the last bowl to the sink, a stretch): 0.5 to 4 */
export const delayOf = (id: string, day = 0) => 0.5 + 3.5 * unit(id, `delay${day}`)
/** each one's own pace, 0.9 to 1.1 of everyone's */
export const paceOf = (id: string) => 0.9 + 0.2 * unit(id, 'pace')
/** the pause at the door, turned back to the room with a nod; then out of it, fading */
export const NOD_S = 0.6
/** (no quicker than this, however short the doorway: at 0.5 s, at ×2, they were gone in a quarter of a second) */
export const FADE_S = 1.1

/**
 * How fast to go for someone ahead on the way: `gap` how far they are, `ahead` how much they're in front (the cosine between the way
 * one's going and the way to them). Close in front: wait for them; a little further: fall back to keep a sociable distance; beside or
 * behind: as you were.
 */
export function yieldTo(gap: number, ahead: number) {
  if (ahead < 0.5) return 1
  if (gap < 0.35) return 0.1
  if (gap < 0.7) return 0.5
  return 1
}

/** the line for the `k`th of those speaking that day: the day's own place in the pool, and on from it, so no two say the same thing */
export const lineOf = <T>(pool: readonly T[], k: number, day = 0) => pool[(Math.floor(unit('lines', `${day}`) * pool.length) + k) % pool.length]

/** who speaks as the day ends or begins: one or two of those going (or coming), never more; the first, and a second now and then */
export function talkersOf(ids: readonly string[], day = 0) {
  const by = [...ids].sort((a, b) => unit(a, `talk${day}`) - unit(b, `talk${day}`))
  return by.slice(0, by.length > 1 && unit(by.join(), `two${day}`) < 0.5 ? 2 : 1)
}
