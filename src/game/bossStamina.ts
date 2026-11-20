// The owner's stamina (item 444, the owner's, 2026-11-21: 「老闆也有體力值，累了也會在一樓打地舖睡」): he tires as his staff do, at his fire
// through the shop's hours, and rests with it shut; and the nights he's worn out, he doesn't make it up the stair: he lays a futon down on
// the shop's floor at its foot, by the staff's door, and sleeps there till he's rested (or he's wanted: the shop opening, his fire), then
// folds it away. Pure: the 3D (Boss, the futon) and the page (App's ticking, the office's bar) take it from here.
import { IDLE_TIRE, LATE_TIRE, TIRED_AT, restPerHour, tirePerHour } from '@/data/staff'

/** his own stamina, on his staff's scale: a cook used to long nights (tirePerHour: 8.4 fatigue an hour at it) */
export const BOSS_STAMINA = 80
/** how tired he is (fatigue, 0..100) as the shop's shut, from which he lays his futon down on the shop's floor instead of going up */
export const FUTON_AT = 70
/** asleep on it, the fatigue he sheds an hour (the game's): more than resting awake (restPerHour, 12) */
export const FUTON_REST = 16
/** rested enough to get up off it of his own accord */
export const WAKE_AT = 20

/** his fatigue after `hours` (the game's) at his fire with the shop open: busy (something on the fire, someone waiting for it) at his full
 * rate, standing by at a fifth of it (as his staff do, data/staff's IDLE_TIRE), faster in the deep night (LATE_TIRE) */
export function bossTire(fatigue: number, hours: number, busy: boolean, late: boolean) {
  const rate = tirePerHour({ stamina: BOSS_STAMINA }) * (busy ? 1 : IDLE_TIRE) * (late ? LATE_TIRE : 1)
  return Math.min(100, fatigue + rate * hours)
}
/** his fatigue after `hours` with the shop shut: asleep on the futon (FUTON_REST), else resting as his staff do (restPerHour) */
export function bossRest(fatigue: number, hours: number, asleep: boolean) {
  return Math.max(0, fatigue - (asleep ? FUTON_REST : restPerHour) * hours)
}
/** worn out: as his staff are past TIRED_AT (shown by him, and on the office's bar) */
export const bossWorn = (fatigue: number) => fatigue >= TIRED_AT
/** as the shop's shut: lays his futon down here (too tired for the stair) */
export const sleepsDown = (fatigue: number) => fatigue >= FUTON_AT
/** asleep on it: gets up, rested enough, or wanted (the shop opening, or the player at his fire) */
export const wakesUp = (fatigue: number, wanted: boolean) => wanted || fatigue <= WAKE_AT

/** laying it down and getting in (s): the mattress unrolled from its fold, the pillow put at its head, lying down onto it, the quilt pulled
 * over; then asleep */
export const LAY_S = { unroll: 1.4, pillow: 0.5, lie: 1.0, cover: 0.9 }
export type LayPhase = 'unroll' | 'pillow' | 'lie' | 'cover' | 'asleep'
/** where in laying it down he is, `t` seconds after he's reached its place: the phase, and how far through it (0..1) */
export function layBeat(t: number): { phase: LayPhase; k: number } {
  let left = t
  for (const phase of ['unroll', 'pillow', 'lie', 'cover'] as const) {
    if (left < LAY_S[phase]) return { phase, k: Math.max(0, left / LAY_S[phase]) }
    left -= LAY_S[phase]
  }
  return { phase: 'asleep', k: 1 }
}
/** getting up and putting it away (s): the quilt thrown back as he sits up, on his feet, the quilt and the mattress folded and the pillow on
 * them, carried off out of the way; then done */
export const RISE_S = { sit: 0.9, stand: 0.7, fold: 1.6 }
export type RisePhase = 'sit' | 'stand' | 'fold' | 'done'
export function riseBeat(t: number): { phase: RisePhase; k: number } {
  let left = t
  for (const phase of ['sit', 'stand', 'fold'] as const) {
    if (left < RISE_S[phase]) return { phase, k: Math.max(0, left / RISE_S[phase]) }
    left -= RISE_S[phase]
  }
  return { phase: 'done', k: 1 }
}
/** how long laying it down takes, all told, and getting up */
export const LAY_TOTAL = LAY_S.unroll + LAY_S.pillow + LAY_S.lie + LAY_S.cover
export const RISE_TOTAL = RISE_S.sit + RISE_S.stand + RISE_S.fold

/** the owner's body, shared by the page and the 3D: his fatigue (App ticks it), and where he is with his futon (Boss: 'off' up and about,
 * 'going' to its place, 'laying' it down and getting in, 'asleep', 'rising' and putting it away), since when (performance.now), and how far
 * through the walk there he is (0..1) */
export const BOSS_BODY = { fatigue: 0, bed: 'off' as 'off' | 'going' | 'laying' | 'asleep' | 'rising', since: 0 }
export { TIRED_AT }
