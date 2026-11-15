// The first day's guide (item 175, the owner's, 2026-11-15: "I want people who don't like playing games to want to play a little longer
// once they see it"): a newcomer is walked, one short line at a time, along the quickest way to their first customer: stock in, a crew
// hired, the second cook's ten-dish menu, the shop opened (the clock moved on to opening time if it's early), the first takings. Each step
// is worked out from how the shop is now, not kept, so whatever's done by other ways is passed over.

export type GuideStep = 'intro' | 'stock' | 'hire' | 'menu' | 'wait' | 'open' | 'firstSale' | 'outro' | 'done'

/** what the guide looks at */
export type GuideState = {
  /** the opening line read, the closing one read */
  introSeen: boolean
  outroSeen: boolean
  /** enough kinds of food in the fridge for a menu (STOCKED_KINDS) */
  kinds: number
  /** cooks taken on (second or third), dishes on the menu and the most it needs to open */
  cooks: number
  menu: number
  menuMin: number
  /** the shop open, the clock in its hours, and anything sold since it opened */
  open: boolean
  inHours: boolean
  sold: boolean
}

/** how many kinds of food in stock make a menu (the second cook's ten-dish menu uses each food at most twice, only what's in stock) */
export const STOCKED_KINDS = 8

/** the step now: the first thing missing on the way to the first customer, in order */
export function guideStep(s: GuideState): GuideStep {
  if (!s.introSeen) return 'intro'
  if (!s.open) {
    if (s.kinds < STOCKED_KINDS) return 'stock'
    if (s.cooks <= 0) return 'hire'
    if (s.menu < s.menuMin) return 'menu'
    return s.inHours ? 'open' : 'wait'
  }
  if (!s.sold) return 'firstSale'
  return s.outroSeen ? 'done' : 'outro'
}

/** the steps as the guide's dots count them (waiting for opening time is the opening's) */
export const GUIDE_DOTS: GuideStep[] = ['intro', 'stock', 'hire', 'menu', 'open', 'firstSale', 'outro']
export const dotOf = (step: GuideStep) => GUIDE_DOTS.indexOf(step === 'wait' ? 'open' : step)

/** kept in the browser: the guide finished or skipped (not shown again; ?guide=1 in the address shows it anyway) */
export const GUIDE_KEY = 'jgs-guide-1'
