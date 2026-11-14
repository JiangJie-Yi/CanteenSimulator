// The stack of dirty plates on the sink's counter when the shop is first taken over (item 103, the owner's, 2026-11-14): left there for the
// player to wash, nobody else touches it; it stays from one day to the next till it's washed. On the third day, if it's still there, the
// owner says so and goes and washes it himself.

/** how many plates the stack starts with (the same six as the day's first washing up had: game/plates START_DIRTY) */
export const PILE_START = 6
/** the day the owner gives up waiting and washes it (the shop's first day is 1) */
export const PILE_BOSS_DAY = 3

/** the stack's left as the sink's count falls: it's the bottom of the sink's plates, so never more than are there */
export const pileLeft = (pile: number, dirty: number) => Math.max(0, Math.min(pile, dirty))
/** the sink's plates the staff (and the owner standing in for them) wash: all but the stack */
export const staffSink = (dirty: number, pile: number) => Math.max(0, dirty - pileLeft(pile, dirty))
/** whether the owner goes to wash the stack now: it's still there, and it's the third day or later */
export const bossCleans = (day: number, pile: number) => pile > 0 && day >= PILE_BOSS_DAY
/** what he says first */
export const PILE_LINE = { zh: ['怎麼都沒人去洗那疊盤子？'], ja: ['あの皿の山、誰も洗ってないのか？'], en: ['Has nobody washed that stack of plates?'] } as const
