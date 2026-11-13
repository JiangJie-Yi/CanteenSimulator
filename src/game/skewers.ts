// The shop's iron skewers (the owner's: fifty, washed and used again, never made out of nothing): clean in their holder by the board, on the
// food from the board to the plate (in use: counted from the food itself), pulled out as it's plated and laid in the used skewers' tray
// (dirty), carried to the sink and washed (carrying), back into the holder. Clean + in use + dirty + carrying is always the pool.

export const SKEWER_POOL = 50
/** when the used ones go to be washed: this many dirty, or the holder down to this few */
export const WASH_AT = 10
export const WASH_LOW = 5
/** how long they take to wash at the sink (seconds) */
export const SKEWER_WASH_S = 1.8

export type Skewers = { clean: number; dirty: number; carrying: number }

/** a day's start: all of them clean but those on food already */
export const startSkewers = (inUse = 0): Skewers => ({ clean: SKEWER_POOL - inUse, dirty: 0, carrying: 0 })
/** one out of the holder for a piece of food; null when there's none clean */
export const takeSkewer = (s: Skewers): Skewers | null => (s.clean > 0 ? { ...s, clean: s.clean - 1 } : null)
/** one pulled out of the food (plated, or burnt and binned, or eaten off it): into the used skewers' tray */
export const usedSkewer = (s: Skewers): Skewers => ({ ...s, dirty: s.dirty + 1 })
/** whether the used ones should go to be washed now */
export const washGoes = (s: Skewers) => s.carrying === 0 && s.dirty > 0 && (s.dirty >= WASH_AT || s.clean <= WASH_LOW)
/** and whether it can't wait: the holder down to its last few, the cooks about to have none to skewer the next order on (item 47: then the
 * servers go to them before anything but a plate to carry) */
export const washUrgent = (s: Skewers) => washGoes(s) && s.clean <= WASH_LOW
/** the used skewers' tray emptied into someone's hands */
export const pickUpDirty = (s: Skewers): Skewers => ({ ...s, dirty: 0, carrying: s.carrying + s.dirty })
/** washed and put back in the holder */
export const putBackClean = (s: Skewers): Skewers => ({ ...s, clean: s.clean + s.carrying, carrying: 0 })
/** every used one washed at once (the shop shut, the owner cooking alone: he washes them himself) */
export const washAll = (s: Skewers): Skewers => ({ clean: s.clean + s.dirty + s.carrying, dirty: 0, carrying: 0 })
/** how many there are, counting those on food */
export const skewerTotal = (s: Skewers, inUse: number) => s.clean + s.dirty + s.carrying + inUse
