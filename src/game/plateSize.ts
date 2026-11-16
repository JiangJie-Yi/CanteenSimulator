/**
 * The plates a seat's order is served on (item 228, the owner's, 2026-11-16: 「盤子種類自己設計吧，這麼大一個盤子就裝那點東西」; before,
 * item 169, two round plates, a big and a small, and a fillet or a rice cake lay alone in the middle of a plate twice its size). As an
 * izakaya serves: a whole fish, a squid or anything on its stick on the long plate (長角皿, a yakizakana-zara), as long as a saury and
 * not much wider than two; cut fillets, or a few loose things, on a round plate (丸皿) a hand across; one loose thing alone (a rice cake,
 * a rice ball, a potato) on a little plate (豆皿). What's served in its own bowl or cup (the miso soup, the rice, the sake) doesn't count.
 * One plate to a seat's order, as before (the plates counted, carried and washed as they were); its kind is how it looks.
 */
import { DISHES } from '@/data/menu'

export type PlateKind = 'long' | 'round' | 'mame'

/** what's served in its own bowl or cup, not on the plate */
export const OFF_PLATE: ReadonlySet<string> = new Set(['MisoSoup', 'Rice', 'Sake'])
/** grilled loose, on no stick (the menu's own list: the potatoes in their foil, what's toasted on the net) */
export const LOOSE_DISHES: ReadonlySet<string> = new Set(DISHES.flatMap((d) => d.roast?.loose ?? []))
/** cut fillets: their iron skewer pulled out as they're plated, a short piece left */
export const FILLETS: ReadonlySet<string> = new Set(['Salmon', 'Buri', 'Gindara'])

/** the plate a seat's order goes on: the long one for anything long (a whole fish, the squid, a skewer), the round one for fillets or a
 * few loose things, the little one for one loose thing alone */
export const plateFor = (orders: readonly string[]): PlateKind => {
  const on = orders.filter((id) => !OFF_PLATE.has(id))
  if (on.some((id) => !LOOSE_DISHES.has(id) && !FILLETS.has(id))) return 'long'
  return on.length <= 1 && on.every((id) => LOOSE_DISHES.has(id)) ? 'mame' : 'round'
}

/** each plate's size (the bar's units): its length and its width (a round one's both its diameter). The long one fits a saury (0.27) with
 * a little to spare at either end; the round one three fillets side by side (each about 0.08 by 0.045); the little one a rice cake (0.04)
 * or a rice ball with a rim round it */
export const PLATE_DIMS: Record<PlateKind, { l: number; w: number }> = { long: { l: 0.3, w: 0.115 }, round: { l: 0.17, w: 0.17 }, mame: { l: 0.11, w: 0.11 } }

/** how far apart what's on a plate lies, side by side across it (the bar's units): the first in the middle, then one either side, a fourth
 * on top of the first row (as before); close enough on the long plate that three whole fish overlap a little, as a plated row does */
export const PLATE_SPREAD: Record<PlateKind, number> = { long: 0.034, round: 0.042, mame: 0.03 }

/** where the n-th thing put on a plate lies, across it, in units of PLATE_SPREAD (the first in the middle, the next to one side, the third
 * to the other), and which layer it's in */
export const plateSide = (row: number) => ({ across: [0, -1, 1][row % 3], layer: Math.floor(row / 3) })
