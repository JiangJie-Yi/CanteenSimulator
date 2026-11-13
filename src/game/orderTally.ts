// Orders and words said in the day's log at once (item 56). The same customer ordering the same dish again at once (two of it ordered
// together, next to each other or not) is told as the one line with how many, as a takeaway's order is (data/lines' tallyNames:
// 味噌烤白蘿蔔×2), not the same line twice over; and the same words said again at once (the chef putting two of a dish on the fire
// together) are said once.

/** how close together two things are taken as said at once (the shop orders a customer's dishes one after another in the same moment) */
export const TOGETHER_MS = 500

/** an order said: whose, which dish, how many of it so far, its line in the log, when (performance.now()) */
export type OrderSaid = { guest: number; dish: string; n: number; line: number; at: number }

/**
 * This order said: one more on the line of the same customer's same dish said at once (`again`, its count up, that line; between them
 * may be another of their dishes: 味噌烤香菇, 鹽烤秋刀魚, 味噌烤香菇), else a line of its own (n 1; its line not known yet, -1).
 * `recent`: the orders said lately (those older than TOGETHER_MS don't count).
 */
export function orderSaid(recent: readonly OrderSaid[], guest: number, dish: string, at: number): OrderSaid & { again: boolean } {
  const m = recent.find((r) => r.guest === guest && r.dish === dish && at - r.at < TOGETHER_MS)
  if (m) return { ...m, n: m.n + 1, at, again: true }
  return { guest, dish, n: 1, line: -1, at, again: false }
}

/** the orders said lately with this one put in (in place of the one it added to), those said longer ago than TOGETHER_MS let go */
export const withOrder = (recent: readonly OrderSaid[], o: OrderSaid) =>
  [...recent.filter((r) => o.at - r.at < TOGETHER_MS && !(r.guest === o.guest && r.dish === o.dish)), o]

/** whether these words are the last line's again, at once: not written a second time */
export const saidAgain = (last: { text: string; at: number } | null, text: string, at: number) => !!last && last.text === text && at - last.at < TOGETHER_MS
