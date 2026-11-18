/**
 * What part of the day it is, for what's said (item 372, the owner's, 2026-11-19: 「老闆的話要能對得上時間」): the owner's muttering by the
 * game's clock and whether the doors are open (data/bossLines), the staff's by the part of the night they're working (data/crewLines). It
 * was the page's light theme before, dark or light, so 「午餐時間要快」 came at a quarter past five in the evening and 「今天的最後一條魚」 at six.
 */
import type { BossSituation } from '@/data/bossLines'
import type { TalkPart } from '@/data/crewLines'
import { CLOSE_AT, LAST_CALL_MIN, OPEN_AT } from './hours'

const H = 60
/** the evening's rush from (18:30), over by (21:30) */
export const PEAK_FROM = 18 * H + 30
export const PEAK_TO = 21 * H + 30
/** closed for the day from dawn to (08:00) the morning, the morning's to midday, the afternoon's getting ready to the opening (16:30) */
export const MORNING_FROM = 8 * H
export const PREP_FROM = 12 * H
/** still shut so late (23:00) it's no use opening */
export const SHUT_LATE_FROM = 23 * H

export type { TalkPart }
/** the part of the business night: the opening's first two hours, the dinner rush, the drinkers' evening, the deep night, the last orders */
export function talkPart(minute: number): TalkPart {
  const m = ((minute % 1440) + 1440) % 1440
  if (m >= CLOSE_AT - LAST_CALL_MIN && m < OPEN_AT) return 'last'
  if (m < CLOSE_AT - LAST_CALL_MIN) return 'late'
  if (m < PEAK_FROM) return 'early'
  if (m < PEAK_TO) return 'peak'
  return 'night'
}

/** which of his lines the owner's on: open, by the part of the night; shut, by the part of the day (and shut in the hours, a shop that
 * should be open) */
export function bossSituation(minute: number, open: boolean): BossSituation {
  const m = ((minute % 1440) + 1440) % 1440
  if (open) {
    const p = talkPart(m)
    return p === 'early' ? 'openEarly' : p === 'peak' ? 'openPeak' : p === 'night' ? 'openNight' : p === 'late' ? 'openLate' : 'openLast'
  }
  if (m >= CLOSE_AT && m < MORNING_FROM) return 'closedDawn'
  if (m >= MORNING_FROM && m < PREP_FROM) return 'closedMorning'
  if (m >= PREP_FROM && m < OPEN_AT) return 'closedPrep'
  if (m >= OPEN_AT && m < SHUT_LATE_FROM) return 'closedEvening'
  return 'closedLate'
}
