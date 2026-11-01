// The tissues at each place (the owner's: a box of two hundred in each place's drawer, a consumable like the charcoal): a customer uses a
// few as they finish, the box runs down, and one who finds it empty minds it (the shop's rating, game/reputation's 'tissue'). Spare boxes
// are kept in stock; before each opening an empty (or nearly empty) box is swapped for a full one, as many as there are spares.

/** sheets in a full box */
export const BOX_SHEETS = 200
/** a box this low is swapped before the day (it wouldn't last it) */
export const BOX_LOW = 20
/** the stock's id for the spare boxes */
export const TISSUE = 'supply:tissue'
/** they're bought five boxes to a pack */
export const TISSUE_PACK = { boxes: 5, cost: 145 }
/** spare boxes a new shop starts with */
export const TISSUE_START = 10
/** the stock keeper orders a pack when the spares fall below this */
export const TISSUE_LOW = 4

/** how many sheets a customer takes as they finish (fixed by their id): two to seven */
export const sheetsFor = (id: number) => 2 + (((id * 2654435761) >>> 0) % 6)
/** a customer's tissues taken from their place's box: what's left, and whether there weren't enough (they mind it) */
export function takeSheets(box: number, want: number) {
  return { box: Math.max(0, box - want), short: box < want }
}
/** before the day: every box that's empty or nearly swapped for a full one from the spares, as far as they go (the first places first) */
export function refillBoxes(boxes: number[], spares: number) {
  const out = [...boxes]
  let left = spares
  for (let i = 0; i < out.length && left > 0; i++) {
    if (out[i] < BOX_LOW) { out[i] = BOX_SHEETS; left-- }
  }
  return { boxes: out, spares: left }
}
/** packs of spare boxes bought: how many boxes, and what they cost */
export const tissueOrder = (packs: number) => ({ boxes: packs * TISSUE_PACK.boxes, cost: packs * TISSUE_PACK.cost })
