// Drinks let fall on the floor (the owner's, 2026-11-10): a glass bottle dropped from higher than SHATTER_H breaks, its shards and its drink
// left on the floor, a mess (hazard_spill) till a floor server sweeps it up; a can never breaks, it's knocked over and rolls; a plastic
// bottle or a little cultured milk bottle bounces as it always has. Pure: the room (DiningRoom) asks what a landing does, the floor staff
// (GuestBar3D) whether to go and sweep.
import type { Duty } from './plates'

/** how high (metres, its foot above the floor) a glass bottle can be let fall from and not break */
export const SHATTER_H = 0.4
/** what a drink comes in */
export type Vessel = 'glass' | 'can' | 'pet' | 'small'
/** what landing does to it: broken, knocked over rolling, or a bounce (stood, or tipped as it happens) */
export type Landing = 'shatter' | 'roll' | 'bounce'
/** what its landing does to a drink let fall from `height` metres */
export function landingOf(vessel: Vessel, height: number): Landing {
  if (!(height > SHATTER_H)) return 'bounce'
  return vessel === 'glass' ? 'shatter' : vessel === 'can' ? 'roll' : 'bounce'
}
/** how many shards a broken bottle leaves: 6 to 10, the same for the same seed */
export const shardsOf = (seed: number) => 6 + (Math.abs(Math.floor(seed)) % 5)
/** how long sweeping a mess up takes (seconds, at an ordinary pace) */
export const SWEEP_S = 4
/** whether a server goes to sweep a mess up: on the floor (or the one server, or the owner serving), not with a plate ready to carry out */
export const sweeps = (duty: Duty, serving: boolean) => duty !== 'dish' && !serving
