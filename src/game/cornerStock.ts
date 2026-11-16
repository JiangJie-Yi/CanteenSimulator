/**
 * The spares stacked in the corner by the drinks fridge (item 199, the owner's, 2026-11-16: 「庫存的東西沒對上」: the stack was always the
 * same, two full cartons of tissue boxes, a carton of cleaning things and a whole pack of toilet rolls, whatever was in stock): what of it
 * is there, by the stock, and how far down what's left drops to sit on what's under it (none of it in the air).
 * - the tissue boxes, TISSUE_PACK.boxes to a carton: none, no carton; up to a carton's, the lower one; more, both;
 * - the cleaning things' carton: there while there's a spare bottle of dish soap or toilet cleaner;
 * - the pack of toilet rolls, in two layers of six: its lower layer while there's a roll, its upper while there are more than six.
 * (`n` < 0: not counted, as full.)
 */
import { TISSUE_PACK } from './tissues'

/** the stack's heights as blender/supplies.py builds it: the two tissue cartons, the cleaning carton (its foot on the upper tissue carton) */
export const CARTON_H = [0.27, 0.24] as const
export const CLEAN_H = 0.22
/** a layer of the pack of rolls: how many rolls */
export const ROLL_LAYER = 6

export type CornerStack = { tissue: [boolean, boolean]; clean: boolean; rolls: [boolean, boolean]
  /** how far the cleaning carton (and the sprays by it) drops, and the rolls, from where they're built */
  dropClean: number; dropRolls: number }

export function cornerStack({ tissue, clean, rolls }: { tissue: number; clean: number; rolls: number }): CornerStack {
  const full = (n: number) => (n < 0 ? Infinity : n)
  const t = full(tissue), c = full(clean), r = full(rolls)
  const t0 = t >= 1, t1 = t > TISSUE_PACK.boxes
  const under = (t0 ? CARTON_H[0] : 0) + (t1 ? CARTON_H[1] : 0)
  const dropClean = CARTON_H[0] + CARTON_H[1] - under
  const hasClean = c >= 1
  const dropRolls = dropClean + (hasClean ? 0 : CLEAN_H)
  return { tissue: [t0, t1], clean: hasClean, rolls: [r >= 1, r > ROLL_LAYER], dropClean, dropRolls }
}
