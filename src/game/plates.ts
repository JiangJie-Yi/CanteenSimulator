// The plates' supply: the dish rack holds the shop's plates; the clean stack at the pass is filled from it, a stack's worth at a time
// (by the owner's click, or by a server when the stack runs out), and washed plates go back onto the stack while there's room, the rest
// back on the rack.

/** how many plates the rack holds when full */
export const RACK_FULL = 50
/** how many the clean stack at the pass holds */
export const CLEAN_CAP = 12
/** how many are carried over from the rack at once */
export const TAKE = 6

/** how many plates come off the rack onto the clean stack: up to `want`, no more than the rack has or the stack has room for */
export const fromRack = (rack: number, clean: number, want = TAKE, cap = CLEAN_CAP) => Math.max(0, Math.min(want, rack, cap - clean))

/** where washed plates go: onto the clean stack while there's room, the rest back on the rack (as many as it has room for) */
export function putAway(rack: number, clean: number, washed: number, cap = CLEAN_CAP, full = RACK_FULL) {
  const toStack = Math.max(0, Math.min(washed, cap - clean))
  const toRack = Math.max(0, Math.min(washed - toStack, full - rack))
  return { toStack, toRack }
}
