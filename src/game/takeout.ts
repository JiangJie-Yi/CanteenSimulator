/**
 * Takeaways and deliveries (the owner's): now and then someone comes to the till for a takeaway, or a delivery rider for an order placed
 * with them; in the last half hour before closing (game/hours' lastCall) they're all that's taken, and they come several times as often
 * (that half hour's thirty of the shop's seconds: two or three of them in it). Their food
 * is cooked like anyone's, packed into a box at the plating place instead of plated, carried out to them at the till by a server, and off
 * they go with it.
 */
/** about how many of the shop's seconds between one takeaway order and the next (scaled by the day's crowd, give or take) */
export const TAKEOUT_GAP = 45
/** how many may be waiting at the till at once */
export const TAKEOUT_MAX = 2
/** how many of them are delivery riders */
export const RIDER_SHARE = 0.5
/** how much shorter the gap is in the last half hour */
export const LAST_CALL_GAP = 0.25
/** the gap before the next one: a quarter in the last half hour */
export const takeoutGap = (lastCall: boolean, crowd = 1) => TAKEOUT_GAP * crowd * (lastCall ? LAST_CALL_GAP : 1)
/** how many dishes an order's for: a takeaway one or two, a delivery up to three */
export const takeoutSize = (rider: boolean, r: number) => 1 + Math.floor(r * (rider ? 3 : 2))
/** one order: who for (their number), a rider or not, how many dishes, how many packed so far; then taken out of the kitchen by a server,
 * handed to them at the till, and their going out of the door */
export type TakeoutOrder = { id: number; rider: boolean; items: number; packed: number; ready: boolean; taken: boolean; handed: boolean; gone: boolean }
