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

