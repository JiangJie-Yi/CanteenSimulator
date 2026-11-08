/**
 * Shifts (the owner's: two lots of staff taken on, working turn about): each one hired is on the A shift, the B shift, or both. The shop's
 * business days take turns, the first A, the next B, and so on: on a day it's open only that shift's staff come in (and are paid, and
 * tire). Working days on end, a night's rest doesn't make up all of it: the second day running only four fifths of the day's tiredness goes
 * by morning, the third three quarters, the fourth two thirds, and from then on half, never less; a day off and they're fresh again.
 */
export type Shift = 'A' | 'B' | 'both'
/** the crew that works business day `day` (1 the first): A on odd days, B on even */
export const crewOf = (day: number): 'A' | 'B' => (day % 2 === 1 ? 'A' : 'B')
/** whether someone on `shift` works business day `day` */
export const onShift = (shift: Shift | undefined, day: number) => (shift ?? 'A') === 'both' || (shift ?? 'A') === crewOf(day)
/** how much of a day's tiredness a night's rest takes away, by how many days running they've worked (1: the first, all of it) */
export const RECOVER = [1, 4 / 5, 3 / 4, 2 / 3, 1 / 2]
export const recoverShare = (streak: number) => RECOVER[Math.min(Math.max(0, streak - 1), RECOVER.length - 1)]

/** one of the staff's place in the rota: their shift, how many days running they've worked (to `last`, the business day), and the tiredness
 * a night's rest can't take below (`floor`) */
export type Rota = { fatigue: number; shift?: Shift; streak?: number; last?: number; floor?: number }

/** at opening on business day `day`: those working it count it to their run (a day missed, a run of one again), those off rest it all */
export function openDay(r: Rota, day: number): Rota {
  if (!onShift(r.shift, day)) return { ...r, streak: 0, floor: 0 }
  const streak = r.last === day - 1 ? (r.streak ?? 0) + 1 : 1
  return { ...r, streak, last: day }
}
/** at shutting: what of today's tiredness a night's rest won't take away, by their run */
export function shutDay(r: Rota, day: number): Rota {
  if (r.last !== day) return r
  return { ...r, floor: r.fatigue * (1 - recoverShare(r.streak ?? 1)) }
}

/**
 * The rota made out (the auto-run's, the owner's): for each job, `max` a shift, its people (best first) put on A till it's full, then B; a
 * shift short of hands (fewer than two shifts' worth taken on), the best of A on both too
 */
export function arrange(people: { id: string }[], max: number): Record<string, Shift> {
  const out: Record<string, Shift> = {}
  const a = people.slice(0, max), b = people.slice(max, max * 2)
  for (const w of a) out[w.id] = 'A'
  for (const w of b) out[w.id] = 'B'
  for (const w of a.slice(0, Math.max(0, max - b.length))) out[w.id] = 'both'
  return out
}
