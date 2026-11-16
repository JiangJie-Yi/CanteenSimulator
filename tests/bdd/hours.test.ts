import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CLOSE_AT, OPEN_AT, PAY, dayPay, hoursBegin, hoursEnd, hoursText, inHours, isLate, isNightWork, lateBy, minutesOf, payFor, payRate } from '@/game/hours'

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

feature('打烊結算寫出晚了多久開、多久結束（店主要的，2026-11-10）', () => {
  scenario('照 16:30 開店、04:30 打烊算', ({ then, and }) => {
    then('16:34 開店是晚 4 分鐘', () => { expect(lateBy(OPEN_AT, at(16, 34))).toBe(4) })
    and('05:30 結束是晚 60 分鐘（過了午夜也算對）', () => { expect(lateBy(CLOSE_AT, at(5, 30))).toBe(60) })
    and('04:20 就關是提早 10 分鐘', () => { expect(lateBy(CLOSE_AT, at(4, 20))).toBe(-10) })
    and('晚到半夜才開也是晚，不是提早', () => { expect(lateBy(OPEN_AT, at(0, 10))).toBe(460) })
    and('時間字串讀得回來', () => { expect(minutesOf('05:30')).toBe(at(5, 30)); expect(minutesOf('x')).toBeNull() })
  })
})

feature('員工的薪水照日本的勞動基準法（店在大阪，店主 2026-11-16）', () => {
  // (opened at 16:30: worked minutes are those since then)
  const since = (h: number, m = 0) => ((at(h, m) - OPEN_AT + 1440) % 1440)
  scenario('開店後的前段照原本的時薪', ({ then }) => {
    then('16:30 到 21:59 都是 1 倍', () => { expect(payRate(at(16, 30), 0)).toBe(1); expect(payRate(at(21, 59), since(21, 59))).toBe(1) })
  })
  scenario('晚上 22:00 到早上 05:00 是深夜，多 25%', ({ then, and }) => {
    then('22:00 是 1.25 倍', () => { expect(payRate(at(22), since(22))).toBe(1.25) })
    and('深夜是 22:00 到 04:59', () => { expect(isNightWork(at(22))).toBe(true); expect(isNightWork(at(4, 59))).toBe(true); expect(isNightWork(at(5))).toBe(false); expect(isNightWork(at(21, 59))).toBe(false) })
  })
  scenario('做滿 8 小時以後再多 25%，跟深夜一起是 1.5 倍', ({ then, and }) => {
    then('16:30 開店，00:30 剛滿 8 小時還是 1.25 倍', () => { expect(payRate(at(0, 30), since(0, 30))).toBe(1.25) })
    and('00:31 起是 1.5 倍', () => { expect(payRate(at(0, 31), since(0, 31))).toBe(1 + PAY.over + PAY.night) })
    and('收店拖到 05:30：天亮了，只剩加班的 1.25 倍', () => { expect(payRate(at(5, 30), since(5, 30))).toBe(1.25) })
  })
  scenario('工資照店裡的時鐘算：做一小時就付一小時', ({ when, then, and }) => {
    when('時薪加起來 NT$1,000 的人在 18:00 做了 60 分鐘', (w) => { w.p = payFor(1000, 60, at(18), since(18)) })
    then('付 NT$1,000，沒有加給', (w) => { const p = w.p as ReturnType<typeof payFor>; expect(p.pay).toBeCloseTo(1000, 6); expect(p.over).toBe(0); expect(p.night).toBe(0) })
    and('01:00 做的 60 分鐘付 NT$1,500，加班與深夜各 NT$250', () => {
      const p = payFor(1000, 60, at(1), since(1))
      expect(p.pay).toBeCloseTo(1500, 6); expect(p.over).toBeCloseTo(250, 6); expect(p.night).toBeCloseTo(250, 6)
    })
  })
  scenario('一整天（16:30 到 04:30）的工資：12 小時，加給算進去約 14.6 小時', ({ then }) => {
    then('時薪 NT$1,000 一天付 NT$14,625', () => { expect(dayPay(1000)).toBeCloseTo(14625, 3) })
  })
})
