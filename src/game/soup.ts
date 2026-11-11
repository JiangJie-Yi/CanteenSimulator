// The kitchen's miso soup (the owner's, 2026-11-11: the soup and the rice empty when the day starts, the third cook makes them): the pot on the
// warming counter's well starts the day empty; the third cook goes to it, puts in the water and the dashi and stirs the miso in (MAKE_S),
// and it heats up in the well (HEAT_S); hot, it's kept so the rest of the day. Pure rules; GuestBar3D walks it, Decor draws it.

/** seconds: the third cook at the pot making it; the pot heating up in the well after */
export const MAKE_S = 5
export const HEAT_S = 20

/** the pot: empty, heating up (seconds left), or hot and kept so */
export type SoupPot = { state: 'empty' | 'heating' | 'hot'; left: number }
export const emptyPot = (): SoupPot => ({ state: 'empty', left: 0 })

/** whether the soup's to be made: the pot empty */
export const soupGoes = (p: SoupPot) => p.state === 'empty'

/** made, in the well: heating up */
export const setSoup = (): SoupPot => ({ state: 'heating', left: HEAT_S })

/** time passing for the pot: heating up to hot (the moment it's hot, said) */
export function potTick(p: SoupPot, dt: number): { pot: SoupPot; hot: boolean } {
  if (p.state !== 'heating') return { pot: p, hot: false }
  const left = p.left - dt
  return left > 0 ? { pot: { state: 'heating', left }, hot: false } : { pot: { state: 'hot', left: 0 }, hot: true }
}
