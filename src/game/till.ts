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


/**
 * A customer's bill as the shop's books keep it (App's; item 195): what they've had at the menu's prices, less what was let go and given
 * back, for how many things; the drink they took from the fridge; the sides ordered with the dishes, each at its own price (item 203: the
 * miso soup or the sake, booked into the takings and never on the bill); whether they pay it at the till on the way out (those sat in: a
 * takeaway's paid as it's ordered), and whether they have.
 */
export type Tab = { paid: number; parts: number; drink?: number; side?: Side[]; atTill?: boolean; settled?: boolean }
/** a side on a bill: what it is and its price */
export type Side = { id: string; price: number }
/** what the sides on a bill come to */
export const sideTotal = (t: Tab) => (t.side ?? []).reduce((a, s) => a + s.price, 0)
/** what a customer's bill comes to at the till: their dishes, their sides and their drink */
export const tabTotal = (t: Tab) => t.paid + sideTotal(t) + (t.drink ?? 0)
/** what's still owed at the till, by those sat in who haven't paid yet: not in the shop's hand till it's paid (a card's comes in then, cash
 * goes into the drawer) */
export function owedAtTill(tabs: Iterable<Tab>) {
  let n = 0
  for (const t of tabs) if (t.atTill && !t.settled) n += tabTotal(t)
  return n
}
/** what one who walks out gets back for so many of the things on their bill that they didn't get: that share of what they'd paid */
export const refundOf = (t: Tab, things: number) => (t.parts > 0 ? Math.round((t.paid * Math.min(things, t.parts)) / t.parts) : 0)
/** their bill once that's given back: the refund off what they pay, the things off how many they had (item 195: the till rang up the whole
 * bill all the same, and the money went into the drawer) */
export const afterRefund = (t: Tab, things: number): Tab => ({ ...t, paid: t.paid - refundOf(t, things), parts: Math.max(0, t.parts - things) })
/** what one who walks out gets back for the things (`ids`) they didn't get, and their bill after: a side at its own price, the rest the
 * dishes' share of what was paid for them (item 203: one whose sake never came was refunded the fish they'd eaten) */
export function refundFor(t: Tab, ids: readonly string[]): { back: number; tab: Tab } {
  const side = [...(t.side ?? [])]
  let back = 0, dishes = 0
  for (const id of ids) {
    const k = side.findIndex((s) => s.id === id)
    if (k >= 0) { back += side[k].price; side.splice(k, 1) } else dishes++
  }
  return { back: back + refundOf(t, dishes), tab: { ...afterRefund(t, dishes), side } }
}
/** whether one leaving has anything to pay at the till: one who'd nothing and drank nothing walks past it (one whose bill isn't known pays
 * as ever) */
export const paysAtTill = (t: Tab | null) => !t || tabTotal(t) > 0
/** the dishes rung up for a bill, one line each: the bill split over so many, the last line taking what doesn't divide */
export function dishLines(paid: number, n: number) {
  if (paid <= 0) return []
  const len = Math.max(1, n), each = Math.floor(paid / len)
  return Array.from({ length: len }, (_, i) => each + (i === len - 1 ? paid - each * len : 0))
}

/** a drawer as kept (across a lost 3D view): every note and coin a count, or none */
export function drawerFrom(x: unknown): DrawerCash | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  for (const k of DENOMS) if (typeof o[k] !== 'number' || !Number.isInteger(o[k]) || (o[k] as number) < 0) return null
  return Object.fromEntries(DENOMS.map((k) => [k, o[k] as number])) as DrawerCash
}
