// Drinks let fall on the floor (the owner's, 2026-11-10): a glass bottle dropped from higher than SHATTER_H breaks, its shards and its drink
// left on the floor, a mess (hazard_spill) till a floor server sweeps it up; a can never breaks, it's knocked over and rolls; a plastic
// bottle or a little cultured milk bottle bounces as it always has; a paper pack never breaks either: from as high it lands with a dull thud
// and lies on its side (the owner's, 2026-11-10). Pure: the room (DiningRoom) asks what a landing does, the floor staff (GuestBar3D) whether
// to go and sweep.
import type { Duty } from './plates'

/** how high (metres, its foot above the floor) a glass bottle can be let fall from and not break */
export const SHATTER_H = 0.4
/** what a drink comes in */
export type Vessel = 'glass' | 'can' | 'pet' | 'small' | 'pack'
/** what landing does to it: broken, knocked over rolling, knocked onto its side (a box doesn't roll), or a bounce (stood, or tipped as it
 * happens) */
export type Landing = 'shatter' | 'roll' | 'topple' | 'bounce'
/** what its landing does to a drink let fall from `height` metres */
export function landingOf(vessel: Vessel, height: number): Landing {
  if (!(height > SHATTER_H)) return 'bounce'
  return vessel === 'glass' ? 'shatter' : vessel === 'can' ? 'roll' : vessel === 'pack' ? 'topple' : 'bounce'
}
/** how many shards a broken bottle leaves: 6 to 10, the same for the same seed */
export const shardsOf = (seed: number) => 6 + (Math.abs(Math.floor(seed)) % 5)
/** how long sweeping a mess up takes (seconds, at an ordinary pace) */
export const SWEEP_S = 4
/** whether a server goes to sweep a mess up: on the floor (or the one server, or the owner serving), not with a plate ready to carry out */
export const sweeps = (duty: Duty, serving: boolean) => duty !== 'dish' && !serving
/**
 * Swept up a piece at a time (the owner's, 2026-11-13, item 63: the shards were all drawn in and shrunk together from whole to nothing, not
 * as a broom takes them): each piece (shard, crumb, the neck, the base) has its own moment in the sweep, `at`, and goes in GO_SPAN of it,
 * quickly; till then it lies as it fell. `left` runs from 1 (untouched) to 0 (all gone).
 */
export const GO_SPAN = 0.08
/** how much of a piece is still there (1 lying as it fell, 0 gone) with `left` of the mess left, the piece going at `at` */
export const pieceLeft = (left: number, at: number) => Math.max(0, Math.min(1, (left - at) / GO_SPAN + 1))
/** each of n pieces' moment, spread evenly over the sweep from its start to its end, in an order of `rnd`'s (the last going at the end) */
export function sweepOrder(n: number, rnd: () => number): number[] {
  const at = Array.from({ length: n }, (_, i) => Math.min(1, GO_SPAN + (1 - GO_SPAN) * (n > 1 ? i / (n - 1) : 1)))
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [at[i], at[j]] = [at[j], at[i]] }
  return at
}
