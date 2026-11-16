/**
 * The cases of canned drinks stacked by the crates at the back of the drinks (item 199, the owner's, 2026-11-16: 「庫存的東西沒對上」: the
 * stack stood the same nine cases whatever was in the back): what of it is there, by the cans in the back, and where each case left stands,
 * none of it in the air.
 * - each drink as many cases as its cans fill, a part-case counting as one, at most its cases in the stack; its lowest kept;
 * - in each of the two columns the cases left drop onto what's under them;
 * - the one across the top lies across both columns when they're level, else on the taller one alone (and on the floor with none under it).
 */

/** the stack as blender/drinkcartons.py builds it (LAYOUT, PRINT_OF, and the game's CARTON_DRINKS): each case's drink, its column (0 the
 * left, 1 the right, -1 the one across the top) and its layer, bottom up */
export const CARTON_CASES: readonly { drink: string; col: 0 | 1 | -1; layer: number }[] = [
  { drink: 'beerCan', col: 0, layer: 0 }, { drink: 'greenTea', col: 1, layer: 0 },
  { drink: 'cola', col: 0, layer: 1 }, { drink: 'highball', col: 1, layer: 1 },
  { drink: 'chuhai', col: 0, layer: 2 }, { drink: 'cola', col: 1, layer: 2 },
  { drink: 'beerCan', col: 0, layer: 3 }, { drink: 'highball', col: 1, layer: 3 },
  { drink: 'greenTea', col: -1, layer: 4 },
]

/** where a case stands now: whether it's there, its layer, its column (the top one's: -1 across both, or the column it's come down on) */
export type CartonAt = { shown: boolean; layer: number; col: 0 | 1 | -1 }

/** the stack laid out for what's in the back (`back`: cans of each drink; `caseOf`: how many to its case) */
export function cartonStack(back: Readonly<Record<string, number>>, caseOf: (id: string) => number): CartonAt[] {
  // (each drink's cases kept, bottom up: as many as its cans fill)
  const left = new Map<string, number>()
  for (const c of CARTON_CASES) if (!left.has(c.drink)) left.set(c.drink, Math.ceil(Math.max(0, back[c.drink] ?? 0) / Math.max(1, caseOf(c.drink))))
  const order = CARTON_CASES.map((c, i) => ({ c, i })).sort((a, b) => a.c.layer - b.c.layer)
  const shown = new Array<boolean>(CARTON_CASES.length).fill(false)
  for (const { c, i } of order) {
    const n = left.get(c.drink) ?? 0
    if (n > 0) { shown[i] = true; left.set(c.drink, n - 1) }
  }
  // (each column's cases dropped onto what's under them)
  const height = [0, 0]
  const out: CartonAt[] = CARTON_CASES.map((c) => ({ shown: false, layer: c.layer, col: c.col }))
  for (const { c, i } of order) {
    if (c.col < 0 || !shown[i]) continue
    out[i] = { shown: true, layer: height[c.col]++, col: c.col }
  }
  // (the one across the top: across both when they're level, else on the taller)
  for (const { c, i } of order) {
    if (c.col >= 0 || !shown[i]) continue
    const col: 0 | 1 | -1 = height[0] === height[1] ? -1 : height[0] > height[1] ? 0 : 1
    out[i] = { shown: true, layer: Math.max(height[0], height[1]), col }
  }
  return out
}
