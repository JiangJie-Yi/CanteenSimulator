// The sake stand on the cook table (item 89, the owner's, 2026-11-14: "pour from it, it's on the menu, the customers order it"): five
// bottles, three of 1.8 litres and two of 720 ml; a tokkuri of sake (one gō, 180 ml) poured from one of them, by a click on it or for a
// customer's order; a bottle that can't fill another is finished, and a new one opened in its place. Pure rules; Roasting takes the orders,
// Decor draws the stand and pours.

/** what each bottle holds (ml), by its number in blender/sakestand.py (where each stands is that script's) */
// (eight bottles, three more makes added (item 132): 瑠璃灘, 雲雀谷, 楓霞; twelve (item 285, the owner's: 「數量也不夠」): 稲穂川 and 澄藍 in
// 1.8 l, 玄雪 (the black stoneware one) and 雪見舟 (the cloudy one) in 720 ml; six of each)
export const SAKE_BOTTLE_ML = [1800, 1800, 1800, 720, 720, 1800, 720, 720, 1800, 1800, 720, 720] as const
/** a tokkuri's worth: one gō */
export const TOKKURI_ML = 180
/** how many of those ordering add a tokkuri of sake alongside (sat at the bar, not a takeaway); and how long after their order it's poured
 * and set at their place (seconds of the shop's clock) */
export const SAKE_SIDE = 0.12
export const SAKE_SERVE_S = 8
/** with no sake station to pour it at (a bar on its own; item 177: in a shop it's poured there by hand and carried out), how long a customer's
 * tokkuri waits before it's set at their place as it is (seconds of the shop's clock) */
export const SAKE_WAIT_S = 25

/** every bottle full (the day's start, a new shop) */
export const fullStand = () => SAKE_BOTTLE_ML.map(() => 1)

/** how many tokkuri a bottle still gives at this level */
export const poursLeft = (k: number, level: number) => Math.floor((level * SAKE_BOTTLE_ML[k]) / TOKKURI_ML + 1e-9)
/** how many tokkuri a bottle gives full: a 1.8 l one ten, a 720 ml one four */
export const goOf = (k: number) => Math.round(SAKE_BOTTLE_ML[k] / TOKKURI_ML)
/** the sake station's open bottle (item 177): a 1.8 l one, ten tokkuri */
export const STATION_GO = goOf(0)

/**
 * The sake station's open bottle (item 199, the owner's 「庫存的東西沒對上」: poured empty, it stood full again at once, whether there was
 * sake in stock or none): how many tokkuri it holds, from what it held and the shop's sake not yet poured (`sake`: what's in stock and
 * what's been sold and is still to be poured, in tokkuri; Infinity with no shop running). Never more than there is (stock thrown out, sold
 * to someone gone before it was poured); finished, a new one's opened only with sake left, as full as there's sake for (a bottle at most);
 * with none, it stands empty.
 */
export function stationGo(open: number, sake: number): number {
  const left = Math.max(0, sake)
  return open > 0 ? Math.min(open, left) : Math.min(STATION_GO, left)
}

/** a new bottle for the stand from the stock (item 199): how many tokkuri it's filled with, as many as the stock has, a bottle at most
 * (`have`: the stock's; below 0, not known, no shop running: a full one) */
export const bottleFrom = (k: number, have: number) => (have < 0 ? goOf(k) : Math.max(0, Math.min(goOf(k), Math.floor(have))))

/** which bottle the next tokkuri comes from: the one already open (the least full that still gives one), so one's finished before the
 * next's opened; none open, the first */
export function pourFrom(levels: readonly number[]) {
  let best = -1
  levels.forEach((l, k) => { if (poursLeft(k, l) > 0 && l < 1 - 1e-9 && (best < 0 || l < levels[best])) best = k })
  return best >= 0 ? best : Math.max(0, levels.findIndex((l, k) => poursLeft(k, l) > 0))
}

/**
 * A tokkuri poured from bottle k: its level down by one gō; if it then can't give another, it's finished, and a new one's opened in its
 * place (`opened`) as full as `open` says there's sake in stock for (0..1; item 199: it stood full again, sake in stock or none); with
 * none, it's left standing empty. What it was before, for the pour to be drawn going down from.
 */
export function pour(levels: readonly number[], k: number, open: () => number = () => 1): { levels: number[]; k: number; was: number; opened: boolean } {
  const out = [...levels]
  const was = out[k]
  out[k] = Math.max(0, was - TOKKURI_ML / SAKE_BOTTLE_ML[k])
  let opened = false
  if (poursLeft(k, out[k]) === 0) {
    const n = open()
    opened = n > 0
    out[k] = opened ? n : 0
  }
  return { levels: out, k, was, opened }
}
