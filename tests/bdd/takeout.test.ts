import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { lastCall, seatsOpen } from '@/game/hours'
import { canRide, kindOf, RIDER_KINDS } from '@/data/guests'
import { LAST_CALL_GAP, TAKEOUT_GAP, TAKEOUT_MAX, takeoutGap, takeoutSize } from '@/game/takeout'

const at = (h: number, m = 0) => h * 60 + m

feature('外帶與外送', () => {
  scenario('打烊前 30 分鐘不收內用的客人，只做外帶', ({ then, and, but }) => {
    then('04:00 起是最後半小時', () => { expect(lastCall(at(4))).toBe(true); expect(lastCall(at(4, 29))).toBe(true) })
    and('那時不再讓客人入座', () => { expect(seatsOpen(at(4, 10))).toBe(false) })
    but('03:59 還可以入座', () => { expect(lastCall(at(3, 59))).toBe(false); expect(seatsOpen(at(3, 59))).toBe(true) })
    and('打烊後與開店前都不算', () => { expect(lastCall(at(4, 30))).toBe(false); expect(lastCall(at(12))).toBe(false) })
  })
  scenario('最後半小時外帶來得比較勤', ({ then }) => {
    then('間隔縮成四分之一：最後半小時（30 秒）會來兩三位', () => {
      expect(takeoutGap(true)).toBe(TAKEOUT_GAP * LAST_CALL_GAP); expect(takeoutGap(false)).toBe(TAKEOUT_GAP)
      expect(30 / takeoutGap(true)).toBeGreaterThan(2)
    })
  })
  scenario('外帶一到兩樣，外送最多三樣；同時最多兩張單在等', ({ then, and }) => {
    then('外帶 1～2 樣', () => { expect(takeoutSize(false, 0)).toBe(1); expect(takeoutSize(false, 0.99)).toBe(2) })
    and('外送 1～3 樣', () => { expect(takeoutSize(true, 0.99)).toBe(3) })
    and(`同時最多 ${TAKEOUT_MAX} 張`, () => { expect(TAKEOUT_MAX).toBe(2) })
  })
  scenario('外送員是會做這份工作的人', ({ then, and }) => {
    then('大學生、大叔、不良少年、暴走族可以當外送員', () => { expect([...RIDER_KINDS].sort()).toEqual(['bosozoku', 'collegeStudent', 'delinquent', 'uncle']) })
    and('穿浴衣的、小學生、老奶奶不會', () => {
      for (let id = 1; id < 400; id++) if (['yukataLady', 'kid', 'grandma'].includes(kindOf(id).kind)) expect(canRide(id)).toBe(false)
    })
    and('往後找總找得到一位', () => { for (const from of [1, 50, 300]) { let i = from; while (!canRide(i) && i < from + 400) i++; expect(canRide(i)).toBe(true) } })
  })
})
