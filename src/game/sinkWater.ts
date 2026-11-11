/**
 * The sink's basin and its plug (the owner's, 2026-11-11: a plug to hold water, the drain a hole dug through, and the water never over
 * the top): with the plug in, the running tap fills the basin; with it out, the drain empties it faster than the tap can fill it; and full
 * to the overflow in its back wall, the overflow takes the rest away, so it never rises past it. The level is 0 empty to 1 at the overflow.
 */
/** seconds the tap takes to fill the basin to its overflow; and the open drain to empty it from there */
export const FILL_S = 45
export const EMPTY_S = 10
/** the level after dt seconds: filled by the tap, emptied by the open drain, never past the overflow nor under empty */
export const waterTick = (level: number, tap: boolean, plugged: boolean, dt: number) =>
  Math.min(1, Math.max(0, level + (tap ? dt / FILL_S : 0) - (plugged ? 0 : dt / EMPTY_S)))
/** what the basin says pointed at: how full it is and whether the plug's in */
export const basinSays = (level: number, plugged: boolean) =>
  `${level <= 0 ? '沒有水' : level >= 1 ? '水滿到溢水口' : `水 ${Math.round(level * 100)}%`}｜塞子${plugged ? '塞著' : '拔開'}`
