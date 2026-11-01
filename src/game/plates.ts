// The plates: all of them kept on the dish racks (碗盤櫃). A plate for a customer is taken off the racks (by a server who walks there for
// it, or sent over when there's none); once they've eaten it goes to the sink, and the dirty ones are washed there a batch at a time and put
// back on the racks.

/** how many plates the racks hold when full (and how many the shop has) */
export const RACK_FULL = 50
/** the dirty plates at the sink are washed once there are this many (or straight away when the racks have run out) */
export const WASH_AT = 5

/** a plate off the racks, if there's one left: the racks' count after, and whether one was got */
export const takePlate = (rack: number) => (rack > 0 ? { rack: rack - 1, got: true } : { rack, got: false })

/** whether the sink's dirty plates are washed now: a batch of them, or any at all once the racks are bare; never twice at once */
export const washNow = (dirty: number, rack: number, washing: boolean) => !washing && dirty > 0 && (dirty >= WASH_AT || rack === 0)

/** the racks' count once the washed plates are put back: as many as there's room for */
export const putBack = (rack: number, washed: number, full = RACK_FULL) => Math.min(full, rack + washed)


/** how many washed plates one person carries back to the racks at a time (a stack on the tray) */
export const CARRY_CLEAN = 5
/** what a free server does next (or the owner, with no server: nobody's plates fly) */
export type Chore = 'serve' | 'clear' | 'restock' | null
/**
 * What a free server does next. Food out at the pass for a seated customer comes first (`serve`: 'ready' when they've a plate already,
 * 'plate' when one's to be fetched off the racks on the way); if the racks are bare and washed plates are stacked by the sink, those go back
 * first; then a plate left dirty at a seat is cleared to the sink; then, with nothing else to do, the washed plates go back to the racks.
 */
export function nextChore({ serve, dirty, clean, rack }: { serve: 'ready' | 'plate' | null; dirty: number; clean: number; rack: number }): Chore {
  if (serve === 'ready' || (serve === 'plate' && rack > 0)) return 'serve'
  if (rack === 0 && clean > 0) return 'restock'
  if (dirty > 0) return 'clear'
  if (clean > 0) return 'restock'
  return null
}
/** how many of the washed plates stacked by the sink one trip takes back */
export const carryClean = (clean: number) => Math.max(0, Math.min(CARRY_CLEAN, clean))
/** a plate washed: off the dirty stack in the sink onto the washed stack beside it (nobody's carried it back yet) */
export const washOne = (dirty: number, clean: number) => (dirty > 0 ? { dirty: dirty - 1, clean: clean + 1 } : { dirty, clean })
