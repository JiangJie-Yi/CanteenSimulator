/**
 * How long a customer sits (item 207, the owner's, 2026-11-16: 「是否有客人站位置太久，需制定用餐時間」): a sitting is STAY_MAX of the shop's
 * minutes, as an izakaya keeps its seats to a time; at it, they pay for what they've had and go, what never came given back.
 */
export const STAY_MAX = 100
/** whether one sat down at `since` (the shop's minutes) has had their time by `now` */
export const overstayed = (since: number, now: number) => now - since >= STAY_MAX
