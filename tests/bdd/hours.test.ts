import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { hoursBegin, hoursEnd, hoursText, inHours, isLate } from '@/game/hours'

const at = (h: number, m = 0) => h * 60 + m

feature('固定營業時間 16:30–04:30（12 小時）與深夜模式', () => {
  scenario('只有營業時間內能開店，跨過午夜', ({ then, and, but }) => {
    then('16:30 到午夜都在營業', () => { expect(inHours(at(16, 30))).toBe(true); expect(inHours(at(20))).toBe(true); expect(inHours(at(23, 59))).toBe(true) })
    and('午夜到 04:29 也在營業', () => { expect(inHours(at(0, 0))).toBe(true); expect(inHours(at(4, 29))).toBe(true) })
    but('04:30 起到 16:29 不營業', () => { expect(inHours(at(4, 30))).toBe(false); expect(inHours(at(10))).toBe(false); expect(inHours(at(16, 29))).toBe(false) })
  })
  scenario('時鐘走過 16:30 開門、走過 04:30 打烊', ({ then, and }) => {
    then('16:29 → 16:30 是開門的那一刻', () => { expect(hoursBegin(at(16, 29), at(16, 30))).toBe(true); expect(hoursEnd(at(16, 29), at(16, 30))).toBe(false) })
    and('04:29 → 04:30 是打烊的那一刻', () => { expect(hoursEnd(at(4, 29), at(4, 30))).toBe(true) })
    and('營業中一分鐘一分鐘走不會重複觸發', () => { expect(hoursBegin(at(20), at(20, 1))).toBe(false); expect(hoursEnd(at(20), at(20, 1))).toBe(false) })
  })
  scenario('過了午夜 12 點進入深夜模式，到天亮（05:00）', ({ then, and, but }) => {
    then('00:00 起是深夜', () => { expect(isLate(at(0))).toBe(true); expect(isLate(at(3, 30))).toBe(true); expect(isLate(at(4, 59))).toBe(true) })
    but('23:59 還不是', () => { expect(isLate(at(23, 59))).toBe(false) })
    and('05:00 天亮就結束', () => { expect(isLate(at(5))).toBe(false) })
  })
  scenario('營業時間的寫法', ({ then }) => {
    then('寫成 16:30–04:30', () => { expect(hoursText()).toBe('16:30–04:30') })
  })
})
