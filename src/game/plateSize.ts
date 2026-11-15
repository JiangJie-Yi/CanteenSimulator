/**
 * The shop's two plates (item 169, the owner's, 2026-11-15: "the plates should have a standard set out: the bigger dishes on big plates, the
 * small ones and the snacks on small ones"): a seat's plate is the big one when what it's ordered has a big dish on it (a whole fish, a
 * fillet, a whole squid: a set has its fish), the small one when it's all small things (skewers, vegetables, mushrooms, a rice ball, a mochi,
 * the little shishamo). What's served in its own bowl (the miso soup) doesn't count.
 */
export type PlateSize = 'big' | 'small'

/** what's served on the big plate: the fish and fillets, and the squid */
export const BIG_DISHES: ReadonlySet<string> = new Set(['ExtraFish', 'Saury', 'Mackerel', 'Aji', 'Iwashi', 'Salmon', 'Hokke', 'Buri', 'Gindara', 'Nodoguro', 'Squid'])

/** the plate a seat's order goes on */
export const plateFor = (orders: readonly string[]): PlateSize => (orders.some((id) => BIG_DISHES.has(id)) ? 'big' : 'small')

/** how big each is drawn, against the shop's one plate as it was (the big one is that one) */
export const PLATE_SCALE: Record<PlateSize, number> = { big: 1, small: 0.8 }
