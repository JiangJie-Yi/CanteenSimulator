// The kitchen's miso soup (the owner's, 2026-11-11: the soup and the rice empty when the day starts, the third cook makes them): the pot on the
// warming counter's well starts the day empty; the third cook goes to it, puts in the water and the dashi and stirs the miso in (MAKE_S),
// and it heats up in the well (HEAT_S); hot, it's kept so the rest of the day. Pure rules; GuestBar3D walks it, Decor draws it.

/** how many bowls a pot gives (the owner's, 2026-11-11: the soup ordered, as it's on the menu); and how long after a customer's order
 * theirs is ladled out and set at their place (seconds of the shop's clock) */
export const SOUP_BOWLS = 12
export const SOUP_SERVE_S = 12
/** how many of those ordering add a bowl of it alongside (it's not on the menu board: the board's dishes are those worked out at the fire, and
 * the soup's not grilled) */
export const SOUP_SIDE = 0.35
/** a bowl ladled out of the pot: one fewer in it; the last of it, it's empty, to be made again */
export const takeBowl = (pot: SoupPot, left: number): { pot: SoupPot; left: number } =>
  pot.state !== 'hot' || left <= 0 ? { pot, left: Math.max(0, left) } : left - 1 > 0 ? { pot, left: left - 1 } : { pot: emptyPot(), left: 0 }
/** whether a bowl can be ladled now: hot, some left */
export const soupReady = (pot: SoupPot, left: number) => pot.state === 'hot' && left > 0

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
