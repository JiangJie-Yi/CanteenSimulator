// The square iron tray (角バット) by the owner at the fire (item 317, the owner's, 2026-11-18: 「開店的時候老闆的碗會收起來換成方形鐵盤，用來
// 放剛烤好的料理用的，就是會從那個方形鐵把鐵籤給收回來，然後料理部份再由服務員用夾子(會放在旁邊)夾到碗內給客人」). With the shop open the
// tasting bowl's put away and the tray set out in its place: what the owner takes off the fire is laid on it and its skewer drawn out there
// (into the used skewers' tray, to be washed); the floor's server, come for a customer's plate, lifts their food off it onto the plate with
// the tongs lying beside it, a piece at a time, and only then takes the plate up. Cooked for nobody (its customer gone), a piece is kept
// warm on it for the next who orders one. Shut, the tray's put away and the bowl's back.

/** what stands by the fire for what comes off it: the tasting bowl with the shop shut, the tray with it open */
export type BesideFire = 'bowl' | 'tray'
export const besideFire = (open: boolean): BesideFire => (open ? 'tray' : 'bowl')

/** how many pieces lie on the tray side by side (one row, as many as the bowl held; each a place of its own, never one on another) */
export const TRAY_PLACES = 4

/**
 * Where a piece just done goes on the tray: the first place free (`taken`: the places in use, by what waits there for its plate and by
 * what's kept warm). The tray full, the oldest of what's kept warm is eaten by the staff to make room for a customer's (`warmOldest`: its
 * place; the customer's comes first), and with none kept warm, -1: it waits by the fire till a place is free.
 */
export function trayPlace(taken: Iterable<number>, warmOldest: number | null = null): { place: number; eat: number | null } {
  const used = new Set(taken)
  for (let i = 0; i < TRAY_PLACES; i++) if (!used.has(i)) return { place: i, eat: null }
  return warmOldest !== null ? { place: warmOldest, eat: warmOldest } : { place: -1, eat: null }
}

/** the tongs: how long the server takes to lift a piece off the tray onto the plate (s), and to take them up first (quick, as a server
 * does it: at 0.55 a piece the floor's servers stood at the plating place long enough that the plates left at the seats waited a quarter
 * longer to be cleared, tests/e2e/flowhealth.mjs) */
export const TONG_S = 0.45
export const TONG_TAKE_S = 0.25
/** when each of a plate's `n` pieces leaves the tray, in seconds from the server's being there: the tongs taken up, then one after another */
export const tongTimes = (n: number) => Array.from({ length: n }, (_, k) => TONG_TAKE_S + k * TONG_S)

/** whether the server can take the plate up: nothing of its food left on the tray, nothing in the air on its way to it */
export const plateGoes = (onTray: number, flying: number) => onTray === 0 && flying === 0
