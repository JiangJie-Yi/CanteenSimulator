// The sake stand on the cook table (item 89, the owner's, 2026-11-14: "pour from it, it's on the menu, the customers order it"): five
// bottles, three of 1.8 litres and two of 720 ml; a tokkuri of sake (one gō, 180 ml) poured from one of them, by a click on it or for a
// customer's order; a bottle that can't fill another is finished, and a new one opened in its place. Pure rules; Roasting takes the orders,
// Decor draws the stand and pours.

/** what each bottle holds (ml), in the stand's order (blender/sakestand.py: the three tall at the back, the two at the front) */
export const SAKE_BOTTLE_ML = [1800, 1800, 1800, 720, 720] as const
/** a tokkuri's worth: one gō */
export const TOKKURI_ML = 180
/** how many of those ordering add a tokkuri of sake alongside (sat at the bar, not a takeaway); and how long after their order it's poured
 * and set at their place (seconds of the shop's clock) */
export const SAKE_SIDE = 0.12
export const SAKE_SERVE_S = 8

/** every bottle full (the day's start, a new shop) */
export const fullStand = () => SAKE_BOTTLE_ML.map(() => 1)

/** how many tokkuri a bottle still gives at this level */
export const poursLeft = (k: number, level: number) => Math.floor((level * SAKE_BOTTLE_ML[k]) / TOKKURI_ML + 1e-9)

/** which bottle the next tokkuri comes from: the one already open (the least full that still gives one), so one's finished before the
 * next's opened; none open, the first */
export function pourFrom(levels: readonly number[]) {
  let best = -1
  levels.forEach((l, k) => { if (poursLeft(k, l) > 0 && l < 1 - 1e-9 && (best < 0 || l < levels[best])) best = k })
  return best >= 0 ? best : Math.max(0, levels.findIndex((l, k) => poursLeft(k, l) > 0))
}

/**
 * A tokkuri poured from bottle k: its level down by one gō; if it then can't give another, it's finished and a new one stands in its place,
 * full (`opened`). What it was before, for the pour to be drawn going down from.
 */
export function pour(levels: readonly number[], k: number): { levels: number[]; k: number; was: number; opened: boolean } {
  const out = [...levels]
  const was = out[k]
  out[k] = Math.max(0, was - TOKKURI_ML / SAKE_BOTTLE_ML[k])
  const opened = poursLeft(k, out[k]) === 0
  if (opened) out[k] = 1
  return { levels: out, k, was, opened }
}
