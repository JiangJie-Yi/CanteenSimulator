/**
 * The drinks behind the fridges: what's kept in the back (the crates by the fridges), bought by the case, and carried out to the fridges by
 * one of the staff a trip at a time. Pure: the fridges' shelves are rows of places, each holding a drink or nothing (null), each with the
 * drink it's meant for (`home`).
 */
export type Back = Record<string, number>

/** how many come in a case (bottles in a crate, cans in a carton) */
export const CASE_SIZE: Record<string, number> = {
  beer: 20, sake: 12, oolong: 12, ramune: 30, beerCan: 24, highball: 24, coffee: 30, greenTea: 24, cola: 24,
  yakult: 50, sports: 24, milk: 20, chuhai: 24, blackCoffee: 30, cafeAuLait: 30, yuzuSoda: 24, darkBeer: 20, shochu: 6, umeshu: 6,
}
/** what a case costs the shop (NT$), about four tenths of what it sells for */
const UNIT_COST: Record<string, number> = {
  beer: 48, sake: 60, oolong: 20, ramune: 24, beerCan: 40, highball: 44, coffee: 18, greenTea: 16, cola: 16, yakult: 8, sports: 20, milk: 18, chuhai: 36,
  blackCoffee: 18, cafeAuLait: 18, yuzuSoda: 24, darkBeer: 52, shochu: 56, umeshu: 52,
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

/** one trip of restocking: the empty places filled with the drink each is meant for (or only `only`'s), from the back, as many as one can carry */
export function restockRun<T extends string>(rows: (T | null)[][], home: T[][], back: Back, carry: number, only?: T) {
  const out = rows.map((r) => [...r])
  const left = { ...back }
  let moved = 0
  for (let r = 0; r < out.length && moved < carry; r++) {
    for (let k = 0; k < out[r].length && moved < carry; k++) {
      const want = home[r][k]
      if (out[r][k] !== null || !want || (only && want !== only) || (left[want] ?? 0) <= 0) continue
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

/** a fridge with nothing in it: a new shop's (its drinks are put in from the back, by hand or by the stocker) */
export const emptyFridge = <T extends string>(home: T[][]): (T | null)[][] => home.map((r) => r.map(() => null))

/** the empty places filled from the back by hand, each with the drink it's meant for: all of them, or only `only`'s; as far as the back goes */
export const fillFromBack = <T extends string>(rows: (T | null)[][], home: T[][], back: Back, only?: T) => restockRun(rows, home, back, Infinity, only)

/** each drink's count in a fridge (whatever place it stands in), and how many places are meant for it */
export function drinkCounts<T extends string>(rows: (T | null)[][], home: T[][]) {
  const out: Record<string, { have: number; places: number }> = {}
  home.forEach((r) => r.forEach((id) => { (out[id] ??= { have: 0, places: 0 }).places++ }))
  rows.forEach((r) => r.forEach((id) => { if (id) (out[id] ??= { have: 0, places: 0 }).have++ }))
  return out
}

/** the fridges' places (each fridge's rows) and the back, as kept in the browser */
export type DrinkSave = { units: (string | null)[][][]; back: Back }
export const writeDrinks = (d: DrinkSave) => JSON.stringify(d)
/** the fridges and the back as they were kept, if they fit the fridges as they are now (`homes`: each fridge's places, the drink each is
 * meant for) and hold only drinks those know; else null (a new shop's are used) */
export function readDrinks(text: string | null, homes: string[][][]): DrinkSave | null {
  let raw: { units?: unknown; back?: unknown } | null
  try { raw = JSON.parse(text ?? 'null') } catch { return null }
  if (!raw || !Array.isArray(raw.units) || !raw.back || typeof raw.back !== 'object' || raw.units.length !== homes.length) return null
  const known = new Set(homes.flat(2))
  const units = raw.units as unknown[][][]
  for (let u = 0; u < homes.length; u++) {
    if (!Array.isArray(units[u]) || units[u].length !== homes[u].length) return null
    for (let r = 0; r < homes[u].length; r++) {
      const row = units[u][r]
      if (!Array.isArray(row) || row.length !== homes[u][r].length || row.some((x) => x !== null && !known.has(x as string))) return null
    }
  }
  const back: Back = {}
  for (const [k, v] of Object.entries(raw.back as Record<string, unknown>)) if (typeof v === 'number' && v >= 0) back[k] = Math.floor(v)
  return { units: units as (string | null)[][][], back }
}
