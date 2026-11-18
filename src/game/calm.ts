/**
 * Calming a customer kept waiting (item 348, the owner's 「要有設計思維，一些交互跟互動要有」, with item 347's anger): once a third and more of
 * their patience is gone (their face, the mark by their head, the steam), the owner can see to them, each way once: a word (招呼, "it's on its
 * way!"), an apology (道歉), or a small dish on the house (送小菜, edamame, its cost the shop's). Each gives back a share of the wait they'll
 * stand, as though they'd sat down that much later; never later than now. As a real shop does: the one kept waiting is spoken to before
 * they give up, and a little something put in front of them buys the kitchen time.
 */
export type CalmKind = 'greet' | 'sorry' | 'side'
export const CALM_KINDS: readonly CalmKind[] = ['greet', 'sorry', 'side']
/** of their whole patience, how much each gives back; what it costs the shop (NT$) */
export const CALM: Record<CalmKind, { back: number; cost: number }> = {
  greet: { back: 0.15, cost: 0 },
  sorry: { back: 0.25, cost: 0 },
  side: { back: 0.5, cost: 30 },
}
/** from how cross (their patience used) the owner can see to them */
export const CALM_FROM = 0.35
/** their wait's start moved on by what it gives back (a share of `limit`, their patience), never past now */
export const calmedSince = (since: number, now: number, limit: number, kind: CalmKind) => Math.min(now, since + CALM[kind].back * limit)
/** what's still to be given them: each once */
export const calmLeft = (used: readonly CalmKind[]) => CALM_KINDS.filter((k) => !used.includes(k))
/** whether to offer it at all: cross enough, and something left to give */
export const canCalm = (fuming: number, used: readonly CalmKind[]) => fuming >= CALM_FROM && calmLeft(used).length > 0
