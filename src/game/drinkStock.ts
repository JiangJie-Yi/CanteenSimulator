/**
 * The drinks behind the fridges: what's kept in the back (the crates by the fridges), bought by the case, and carried out to the fridges by
 * one of the staff a trip at a time. Pure: the fridges' shelves are rows of places, each holding a drink or nothing (null), each with the
 * drink it's meant for (`home`).
 */
export type Back = Record<string, number>

/** how many come in a case (bottles in a crate, cans in a carton) */
export const CASE_SIZE: Record<string, number> = {
  beer: 20, sake: 12, oolong: 12, ramune: 30, beerCan: 24, highball: 24, coffee: 30, greenTea: 24, cola: 24,
  yakult: 50, sports: 24, milk: 20, chuhai: 24,
}
/** what a case costs the shop (NT$), about four tenths of what it sells for */
const UNIT_COST: Record<string, number> = {
  beer: 48, sake: 60, oolong: 20, ramune: 24, beerCan: 40, highball: 44, coffee: 18, greenTea: 16, cola: 16, yakult: 8, sports: 20, milk: 18, chuhai: 36,
}
export const caseCost = (id: string) => (CASE_SIZE[id] ?? 24) * (UNIT_COST[id] ?? 20)
/** what the back starts with: two cases of each */
export const startBack = (): Back => Object.fromEntries(Object.keys(CASE_SIZE).map((id) => [id, CASE_SIZE[id] * 2]))

/** one case bought in, if the cash runs to it */
export function buyCase(back: Back, id: string, cash: number) {
  const cost = caseCost(id)
  if (cash < cost) return { ok: false, back: { ...back }, cash }
  return { ok: true, back: { ...back, [id]: (back[id] ?? 0) + (CASE_SIZE[id] ?? 24) }, cash: cash - cost }
}

/** one trip of restocking: the empty places filled with the drink each is meant for, from the back, as many as one can carry */
export function restockRun<T extends string>(rows: (T | null)[][], home: T[][], back: Back, carry: number) {
  const out = rows.map((r) => [...r])
  const left = { ...back }
  let moved = 0
  for (let r = 0; r < out.length && moved < carry; r++) {
    for (let k = 0; k < out[r].length && moved < carry; k++) {
      const want = home[r][k]
      if (out[r][k] !== null || !want || (left[want] ?? 0) <= 0) continue
      out[r][k] = want
      left[want]--
      moved++
    }
  }
  return { rows: out, back: left, moved }
}

/** how many places in the fridges are empty that the back could fill */
export const emptyFillable = <T extends string>(rows: (T | null)[][], home: T[][], back: Back) =>
  rows.reduce((n, r, ri) => n + r.filter((x, k) => x === null && (back[home[ri][k]] ?? 0) > 0).length, 0)
