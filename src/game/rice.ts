// The kitchen's rice (the owner's: the rice balls' rice is cooked in the shop, not just there): the electric cooker (電鍋) cooks a pot's worth
// and keeps it warm, and each rice ball's rice is taken straight from it (the owner's, 2026-11-11: the rice tub and the old rice pot on its
// stove are out of use); when it's empty, the plater washes a pot's worth of rice at the sink, sets it in the cooker, and it cooks (steaming,
// its lid lifting). Pure rules; GuestBar3D walks it, Decor draws it.

/** how many rice balls' rice the cooker holds (a pot's worth: it's the big one now) */
export const RICE_FULL = 16
/** seconds: washing the rice at the sink; the cooker cooking; scooping raw rice from the sack; a rice ball shaped in the hands */
export const WASH_S = 3
export const COOK_S = 15
export const SCOOP_S = 1.2
export const SHAPE_S = 1.2

/** the cooker: empty, cooking (seconds left), or cooked and keeping its rice warm */
export type Kama = { state: 'empty' | 'cooking' | 'done'; left: number }
export const emptyKama = (): Kama => ({ state: 'empty', left: 0 })
/** cooked and keeping warm (the shop opens with a pot's worth in it) */
export const warmKama = (): Kama => ({ state: 'done', left: 0 })

/** whether the next pot's to be washed and put on: the cooker empty */
export const riceGoes = (kama: Kama) => kama.state === 'empty'

/** the cooker set on with washed rice */
export const setOn = (): Kama => ({ state: 'cooking', left: COOK_S })

/** time passing for the cooker: cooking down to cooked (and the moment it's cooked, said: it's full then, RICE_FULL) */
export function kamaTick(k: Kama, dt: number): { kama: Kama; cooked: boolean } {
  if (k.state !== 'cooking') return { kama: k, cooked: false }
  const left = k.left - dt
  return left > 0 ? { kama: { state: 'cooking', left }, cooked: false } : { kama: warmKama(), cooked: true }
}

/** a rice ball's rice taken from the cooker (none left: still made, from the last of the pot (the order's never held up)); the last of it
 * taken, the cooker's empty, to be washed and put on again */
export function takeRice(rice: number, kama: Kama): { rice: number; kama: Kama } {
  const left = Math.max(0, rice - 1)
  return { rice: left, kama: left === 0 && kama.state === 'done' ? emptyKama() : kama }
}
