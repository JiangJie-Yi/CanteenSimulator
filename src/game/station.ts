// The kitchen's stations off the fire (items 461, 469): what each made-to-order dish takes there, and whether it can be made from what's in
// stock (its own food, and its eggs, its frying oil, its nori: supplies' GARNISH). Pure: GuestBar3D's cooks and the stations' looks go by it.
import { kitchenDish, type Station } from '@/data/kitchenDishes'
import { GARNISH } from './supplies'
import type { Stock } from './economy'

/** which station a dish is made at (null: not one of the stations': grilled, or a side) */
export const stationOf = (id: string): Station | null => kitchenDish(id)?.station ?? null

/** how long a dish takes its cook (the game's seconds): a skilled one (skill 0..100) a fifth quicker than a new one, a middling one as
 * written */
export function cookSeconds(id: string, skill = 50) {
  const d = kitchenDish(id)
  if (!d) return 0
  const k = Math.min(1, Math.max(0, skill / 100))
  return d.cookS * (1.1 - 0.2 * k)
}

/** what a dish uses beside its own food, a portion */
export const extrasOf = (id: string): Stock => GARNISH[id] ?? {}

/** whether one of a dish can be made now: its own food and everything it uses beside it in stock */
export const canCook = (id: string, stock: Stock) =>
  (stock[id] ?? 0) >= 1 && Object.entries(extrasOf(id)).every(([k, n]) => (stock[k] ?? 0) >= n)

/**
 * The steps a dish goes through at its station (for how it looks there and what's heard): the egg beaten or what's fried put in (`start`),
 * cooking (`cook`: the pan sizzling, the oil bubbling), and turned out onto its plate (`plate`) at the end; `t` the seconds since it began,
 * `of` its whole time
 */
export function stepOf(t: number, of: number): 'start' | 'cook' | 'plate' | 'done' {
  if (t >= of) return 'done'
  if (t < Math.min(4, of * 0.15)) return 'start'
  if (t > of - Math.min(4, of * 0.12)) return 'plate'
  return 'cook'
}
