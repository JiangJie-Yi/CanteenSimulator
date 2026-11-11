/**
 * What's kept in the two dish cabinets under the plate racks besides the plates (the owner's, 2026-11-11: the bowls in the cupboard, the
 * chopsticks and the spoons in the drawers, counted, in sensible proportion): each cabinet holds half. One guest's setting takes a rice
 * bowl, a soup bowl and its renge, and a pair of chopsticks; there are three settings' bowls and spoons for every seat (one in use, one in
 * the wash, one spare: two pots of miso soup's worth), and the chopsticks two and a half times that (they go out with the takeaways too).
 */
import { SOUP_BOWLS } from './soup'

export const TABLEWARE = { riceBowls: 24, soupBowls: 24, spoons: 24, chopsticks: 60 }
/** each cabinet's half: what's behind its doors and in its drawers */
export const PER_CABINET = { riceBowls: TABLEWARE.riceBowls / 2, soupBowls: TABLEWARE.soupBowls / 2, spoons: TABLEWARE.spoons / 2, chopsticks: TABLEWARE.chopsticks / 2 }
/** settings for this many seats: bowls and spoons three times over, enough for two pots of soup, chopsticks two and a half times the bowls */
export const enoughFor = (seats: number) =>
  TABLEWARE.soupBowls >= seats * 3 && TABLEWARE.riceBowls >= seats * 3 && TABLEWARE.soupBowls >= SOUP_BOWLS * 2 &&
  TABLEWARE.spoons === TABLEWARE.soupBowls && TABLEWARE.chopsticks >= TABLEWARE.soupBowls * 2.5
