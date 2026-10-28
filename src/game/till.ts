// The till's tablet and how each customer pays: rules kept out of the 3D so they can be tested.

/** how many groups waiting to pay at once puts the tablet to work as a second till */
export const BUSY_QUEUE = 3

/** whether a customer pays by card: about two in five do, the same customer always the same way (by their number) */
export const paysByCard = (id: number) => ((id * 2654435761) >>> 0) % 100 < 40

/** whether the tablet is in use: a card payment goes through it, and so does any payment while the queue's long */
export const tabletActive = (queue: number, card: boolean) => card || queue >= BUSY_QUEUE

/** whether the cash drawer comes out for a payment: only for cash (a card's paid on the reader) */
export const drawerOpens = (card: boolean) => !card

/** the notes and coins a till holds, biggest first */
export const DENOMS = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1] as const
export type Denom = (typeof DENOMS)[number]
/** how many of each note and coin are in the drawer */
export type DrawerCash = Record<Denom, number>

/** the change the day starts with: a few small notes and every coin cup with some in it, no big notes */
export const openingFloat = (): DrawerCash => ({ 10000: 0, 5000: 1, 1000: 8, 500: 6, 100: 20, 50: 10, 10: 20, 5: 10, 1: 15 })

/** what's in the drawer, all told */
export const drawerTotal = (d: DrawerCash) => DENOMS.reduce((a, k) => a + k * d[k], 0)

/** a sum as the fewest notes and coins, biggest first */
export function breakDown(sum: number): DrawerCash {
  const out = Object.fromEntries(DENOMS.map((k) => [k, 0])) as DrawerCash
  let left = Math.max(0, Math.round(sum))
  for (const k of DENOMS) { out[k] = Math.floor(left / k); left -= out[k] * k }
  return out
}

/** a cash customer's bill put into the drawer (what they handed over less their change comes to the bill) */
export const deposit = (d: DrawerCash, bill: number): DrawerCash => {
  const add = breakDown(bill)
  return Object.fromEntries(DENOMS.map((k) => [k, d[k] + add[k]])) as DrawerCash
}

/** the owner takes everything in one note's compartment or coin's cup: the drawer without it, and how much was taken */
export const takeOut = (d: DrawerCash, k: Denom): { drawer: DrawerCash; amount: number } => ({ drawer: { ...d, [k]: 0 }, amount: k * d[k] })
