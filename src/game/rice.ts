// The kitchen's rice (the owner's: the rice balls' rice is cooked in the shop, not just there): the rice tub (お櫃) holds the cooked rice
// a pot's worth at a time; when it runs low, the plater washes a pot's worth of rice at the sink, sets it in the iron pot (羽釜) on its
// little stove, and it cooks (steaming, its lid rattling); cooked, they scoop it into the tub. Each rice ball takes a portion. Pure rules;
// GuestBar3D walks it, Decor draws it.

/** how many rice balls' rice a full tub holds (a pot's worth), and how low it gets before the next pot's washed and set on */
export const TUB_FULL = 10
export const RICE_LOW = 3
/** seconds: washing the rice at the sink; the pot on the fire; scooping it into the tub; a rice ball shaped in the hands */
export const WASH_S = 3
export const COOK_S = 15
export const SCOOP_S = 1.2
export const SHAPE_S = 1.2

/** the pot on the stove: empty, cooking (seconds left), or cooked and waiting to be scooped out */
export type Kama = { state: 'empty' | 'cooking' | 'done'; left: number }
export const emptyKama = (): Kama => ({ state: 'empty', left: 0 })

/** whether the next pot's to be put on: the tub low and the pot free */
export const riceGoes = (tub: number, kama: Kama) => kama.state === 'empty' && tub <= RICE_LOW

/** the pot set on with washed rice */
export const setOn = (): Kama => ({ state: 'cooking', left: COOK_S })

/** time passing for the pot: cooking down to cooked (and the moment it's cooked, said) */
export function kamaTick(k: Kama, dt: number): { kama: Kama; cooked: boolean } {
  if (k.state !== 'cooking') return { kama: k, cooked: false }
  const left = k.left - dt
  return left > 0 ? { kama: { state: 'cooking', left }, cooked: false } : { kama: { state: 'done', left: 0 }, cooked: true }
}

/** the cooked pot scooped into the tub: as much as it holds, the pot empty again */
export const scoopIn = (tub: number): { tub: number; kama: Kama } => ({ tub: Math.max(tub, TUB_FULL), kama: emptyKama() })

/** a rice ball's rice taken from the tub (none left: still made, from the last of the pot (the order's never held up), the tub at 0) */
export const takeRice = (tub: number) => Math.max(0, tub - 1)
