/**
 * The drinks behind the fridges: what's kept in the back (the crates by the fridges), bought by the case, and carried out to the fridges by
 * one of the staff a trip at a time. Pure: the fridges' shelves are rows of places, each holding a drink or nothing (null), each with the
 * drink it's meant for (`home`), and how many of it stand there one behind another (the owner's, 2026-11-10: a place was one drink, and the
 * ones seen behind it went with it when it was taken; now each is a bottle of its own, taken from the front).
 */
export type Back = Record<string, number>

/** how many come in a case (bottles in a crate, cans in a carton) */
export const CASE_SIZE: Record<string, number> = {
  beer: 20, sake: 12, oolong: 12, ramune: 30, beerCan: 24, highball: 24, coffee: 30, greenTea: 24, cola: 24,
  yakult: 50, sports: 24, milk: 20, chuhai: 24, blackCoffee: 30, cafeAuLait: 30, yuzuSoda: 24, darkBeer: 20, shochu: 20, umeshu: 6,
  grapeSoju: 20, yogurt: 30, lacticSoda: 24, appleJuice: 24, barleyTea: 24, vegJuice: 24,
}
/** what a case costs the shop (NT$), about four tenths of what it sells for */
const UNIT_COST: Record<string, number> = {
  beer: 48, sake: 60, oolong: 20, ramune: 24, beerCan: 40, highball: 44, coffee: 18, greenTea: 16, cola: 16, yakult: 8, sports: 20, milk: 18, chuhai: 36,
  blackCoffee: 18, cafeAuLait: 18, yuzuSoda: 24, darkBeer: 52, shochu: 46, umeshu: 52, grapeSoju: 50, yogurt: 18, lacticSoda: 20,
  appleJuice: 16, barleyTea: 14, vegJuice: 18,
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

/**
 * How many of a drink stand in one place, one behind another, the front one and those behind it all the way back to the fridge's back wall
 * (the owner's, 2026-11-11: full to the back, each by its own size, the same gap between them): from the front row's middle (0.16 in the
 * fridge's frame, blender/drinkfridge.py) back to a centimetre off the liner's back (-0.336), each its own depth and 5 mm apart
 * (DiningRoom's rankStep and shelfSize, measured with tests/e2e/_rankfit.mjs); one for a drink this doesn't know
 */
export const PLACE_DEPTH: Record<string, number> = {
  oolong: 6, greenTea: 7, sports: 7, cola: 7, beer: 7, darkBeer: 7,
  yuzuSoda: 8, lacticSoda: 8, beerCan: 8, highball: 8, chuhai: 8, ramune: 8, sake: 8, shochu: 8, grapeSoju: 8,
  milk: 9, coffee: 9, blackCoffee: 9, cafeAuLait: 9, yogurt: 9, umeshu: 9,
  appleJuice: 11, barleyTea: 11, vegJuice: 11, yakult: 11,
}
export const depthOf = (id: string | null | undefined) => (id ? PLACE_DEPTH[id] ?? 1 : 1)

/** a fridge's places: each one's drink (or nothing), and how many of it stand there (0 when there's nothing) */
export type Places<T extends string = string> = { rows: (T | null)[][]; counts: number[][] }
const copyOf = <T extends string>(p: Places<T>): Places<T> => ({ rows: p.rows.map((r) => [...r]), counts: p.counts.map((r) => [...r]) })

/** how many more of `id` a place has room for: none if another drink stands in it */
export const roomFor = <T extends string>(p: Places<T>, r: number, k: number, id: T) =>
  p.rows[r][k] === null || p.rows[r][k] === id ? Math.max(0, depthOf(id) - (p.rows[r][k] === null ? 0 : p.counts[r][k])) : 0

/** one taken from a place, its front one (a customer's, the player's): the drink, or null if there was none; the place emptied with its last */
export function takeFromPlace<T extends string>(p: Places<T>, r: number, k: number): T | null {
  const id = p.rows[r][k]
  if (!id || p.counts[r][k] <= 0) { p.rows[r][k] = null; p.counts[r][k] = 0; return null }
  p.counts[r][k]--
  if (p.counts[r][k] <= 0) { p.rows[r][k] = null; p.counts[r][k] = 0 }
  return id
}
/** one put into a place (by hand): an empty one, or in front of the others of its own kind if there's room; whether it went in */
export function putInPlace<T extends string>(p: Places<T>, r: number, k: number, id: T) {
  if (roomFor(p, r, k, id) <= 0) return false
  if (p.rows[r][k] === null) { p.rows[r][k] = id; p.counts[r][k] = 0 }
  p.counts[r][k]++
  return true
}
/** one carried by hand from one place to another: into an empty one or among its own kind there; a lone one swapped with a lone one of
 * another kind; otherwise (another kind fills it) it goes back where it was. Whether anything moved */
export function moveBetween<T extends string>(p: Places<T>, from: [number, number], to: [number, number]) {
  const [fr, fk] = from, [tr, tk] = to
  if (fr === tr && fk === tk) return false
  const id = p.rows[fr][fk]
  if (!id) return false
  if (roomFor(p, tr, tk, id) > 0) { takeFromPlace(p, fr, fk); putInPlace(p, tr, tk, id); return true }
  const there = p.rows[tr][tk]
  if (there && there !== id && p.counts[fr][fk] === 1 && p.counts[tr][tk] === 1) {
    p.rows[fr][fk] = there
    p.rows[tr][tk] = id
    return true
  }
  return false
}

/** one trip of restocking: the places filled with the drink each is meant for (or only `only`'s), each as far as it goes, from the back,
 * as many as one can carry */
export function restockRun<T extends string>(places: Places<T>, home: T[][], back: Back, carry: number, only?: T) {
  const p = copyOf(places)
  const left = { ...back }
  let moved = 0
  for (let r = 0; r < p.rows.length && moved < carry; r++) {
    for (let k = 0; k < p.rows[r].length && moved < carry; k++) {
      const want = home[r][k]
      if (!want || (only && want !== only)) continue
      while (moved < carry && (left[want] ?? 0) > 0 && putInPlace(p, r, k, want)) { left[want]--; moved++ }
    }
  }
  return { rows: p.rows, counts: p.counts, back: left, moved }
}

/** how many drinks the fridges have room for that the back could fill (each kind's room, as far as the back has of it) */
export function emptyFillable<T extends string>(p: Places<T>, home: T[][], back: Back) {
  const room: Record<string, number> = {}
  home.forEach((row, r) => row.forEach((id, k) => { if (id) room[id] = (room[id] ?? 0) + roomFor(p, r, k, id) }))
  return Object.entries(room).reduce((n, [id, k]) => n + Math.min(k, back[id] ?? 0), 0)
}

/** a fridge with nothing in it: a new shop's (its drinks are put in from the back, by hand or by the stocker) */
export const emptyFridge = <T extends string>(home: T[][]): Places<T> => ({ rows: home.map((r) => r.map(() => null)), counts: home.map((r) => r.map(() => 0)) })

/** the places filled from the back by hand, each with the drink it's meant for: all of them, or only `only`'s; as far as the back goes */
export const fillFromBack = <T extends string>(p: Places<T>, home: T[][], back: Back, only?: T) => restockRun(p, home, back, Infinity, only)

/** each drink in a fridge: how many stand in its own places (what's seen on its shelf), how many its places hold, and how many of it stand
 * in another drink's places (moved there by hand): those aren't on its shelf (the owner's, 2026-11-10: a coffee dragged into a black
 * coffee's empty place, and the coffee's shelf, a gap in it, still said 3/3) */
export function drinkCounts<T extends string>(p: Places<T>, home: T[][]) {
  const out: Record<string, { have: number; places: number; astray: number }> = {}
  home.forEach((r) => r.forEach((id) => { (out[id] ??= { have: 0, places: 0, astray: 0 }).places += depthOf(id) }))
  p.rows.forEach((r, i) => r.forEach((id, k) => {
    if (!id) return
    const c = (out[id] ??= { have: 0, places: 0, astray: 0 })
    if (home[i]?.[k] === id) c.have += p.counts[i][k]
    else c.astray += p.counts[i][k]
  }))
  return out
}

/** the fridges' places (each fridge's rows, and how many stand in each) and the back, as kept in the browser */
export type DrinkSave = { units: (string | null)[][][]; counts?: number[][][]; back: Back }
export const writeDrinks = (d: DrinkSave) => JSON.stringify(d)
/** the fridges and the back as they were kept, if they fit the fridges as they are now (`homes`: each fridge's places, the drink each is
 * meant for) and hold only drinks those know; else null (a new shop's are used). Kept before each place held more than one (no counts):
 * every place holding a drink full, as its ranks were drawn behind it then */
export function readDrinks(text: string | null, homes: string[][][]): (DrinkSave & { counts: number[][][] }) | null {
  let raw: { units?: unknown; counts?: unknown; back?: unknown } | null
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
  // (how many stand in each: as kept, within what the place holds; a count that doesn't fit, or none kept at all, the place full)
  const kept = Array.isArray(raw.counts) ? (raw.counts as unknown[][][]) : null
  const counts = homes.map((rows, u) => rows.map((row, r) => row.map((_, k) => {
    const id = units[u][r][k] as string | null
    if (!id) return 0
    const n = kept?.[u]?.[r]?.[k]
    return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(depthOf(id), Math.floor(n)) : depthOf(id)
  })))
  const back: Back = {}
  for (const [k, v] of Object.entries(raw.back as Record<string, unknown>)) if (typeof v === 'number' && v >= 0) back[k] = Math.floor(v)
  return { units: units as (string | null)[][][], counts, back }
}
