/**
 * The two restrooms' upkeep: how clean each is and how much is left on its roll of paper. Every visit dirties it a little and uses a
 * share of the roll; a guest who finds it dirty, or the roll bare, grumbles, and what they eat afterwards tastes that much worse to
 * them. The owner sets it right by clicking (the toilet to scrub it, the holder for a new roll); the staff clean up before each day's
 * opening, but nobody else changes the paper.
 */
export type Room = { clean: number; paper: number; uses: number }
export type Complaint = null | 'dirty' | 'paper'

/** how much one visit dirties it (of 1), and how many visits a roll lasts */
export const DIRT_PER_USE = 0.13
export const ROLL_USES = 5
/** below this, a guest notices it's dirty; below FLIES_AT, flies come */
export const DIRTY_AT = 0.45
export const FLIES_AT = 0.2

export const freshRoom = (): Room => ({ clean: 1, paper: 1, uses: 0 })

/** one visit: what it leaves behind, and what the guest makes of it (no paper is worse than a dirty floor, and they say only the worse) */
export function visitRoom(r: Room): { room: Room; complaint: Complaint } {
  const share = 1 / ROLL_USES
  const complaint: Complaint = r.paper < share - 1e-6 ? 'paper' : r.clean < DIRTY_AT ? 'dirty' : null
  return {
    room: { clean: Math.max(0, r.clean - DIRT_PER_USE), paper: Math.max(0, r.paper - share), uses: r.uses + 1 },
    complaint,
  }
}

/** points off the taste of what that guest eats after it */
export const penaltyOf = (c: Complaint) => (c === 'paper' ? 18 : c === 'dirty' ? 10 : 0)

export const cleanRoom = (r: Room): Room => ({ ...r, clean: 1 })
export const newRoll = (r: Room): Room => ({ ...r, paper: 1 })
/** the staff's sweep before opening: clean again, the paper as it was left */
export const openRoom = (r: Room): Room => ({ ...r, clean: 1, uses: 0 })

/** how it looks: spotless, used, dirty (marks on the floor), filthy (flies) */
export function looksOf(r: Room): 'fresh' | 'used' | 'dirty' | 'flies' {
  if (r.clean < FLIES_AT) return 'flies'
  if (r.clean < DIRTY_AT) return 'dirty'
  return r.clean > 0.95 ? 'fresh' : 'used'
}
