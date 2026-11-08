import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { hoursBegin, hoursEnd, hoursText, inHours } from '@/game/hours'

const at = (h: number, m = 0) => h * 60 + m

feature('固定營業時間 14:30–02:30（12 小時）', () => {
  scenario('只有營業時間內能開店，跨過午夜', ({ then, and, but }) => {
    then('14:30 到午夜都在營業', () => { expect(inHours(at(14, 30))).toBe(true); expect(inHours(at(17))).toBe(true); expect(inHours(at(23, 59))).toBe(true) })
    and('午夜到 02:29 也在營業', () => { expect(inHours(at(0, 0))).toBe(true); expect(inHours(at(2, 29))).toBe(true) })
    but('02:30 起到 14:29 不營業', () => { expect(inHours(at(2, 30))).toBe(false); expect(inHours(at(10))).toBe(false); expect(inHours(at(14, 29))).toBe(false) })
  })
  scenario('時鐘走過 14:30 開門、走過 02:30 打烊', ({ then, and }) => {
    then('14:29 → 14:30 是開門的那一刻', () => { expect(hoursBegin(at(14, 29), at(14, 30))).toBe(true); expect(hoursEnd(at(14, 29), at(14, 30))).toBe(false) })
    and('02:29 → 02:30 是打烊的那一刻', () => { expect(hoursEnd(at(2, 29), at(2, 30))).toBe(true) })
    and('營業中一分鐘一分鐘走不會重複觸發', () => { expect(hoursBegin(at(20), at(20, 1))).toBe(false); expect(hoursEnd(at(20), at(20, 1))).toBe(false) })
  })
  scenario('營業時間的寫法', ({ then }) => {
    then('寫成 14:30–02:30', () => { expect(hoursText()).toBe('14:30–02:30') })
  })
})
