import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { addDay, daySummary, KEEP_DAYS, soldBetween } from '@/game/daySummary'
import type { Visit } from '@/game/reputation'

const open = { revenue: 10000, food: 4000, fuel: 500, wage: 3000, utility: 100 }
const shut = { revenue: 16000, food: 6000, fuel: 800, wage: 4200, utility: 160 }
const visit = (id: number, taste: number | null, walkedOut = false): Visit => ({ id, taste, waited: 30, walkedOut, gripes: [] })

feature('打烊的日結算', () => {
  scenario('只算今天開店到打烊之間的帳', ({ given, then, and }) => {
    given('開店時與打烊時的帳本', (w) => { w.s = daySummary(open, shut, [], {}) })
    then('營業額是今天多的那部分', (w) => { expect(w.s.revenue).toBe(6000) })
    and('利潤照帳簿的算法：營業額扣掉食材、燃料、人事、水電', (w) => {
      expect(w.s.profit).toBe(6000 - 2000 - 300 - 1200 - 60)
      expect(w.s.margin).toBeCloseTo(w.s.profit / 6000)
    })
  })
  scenario('來客、生氣走掉的與平均星數', ({ given, then, and }) => {
    given('三位客人，一位沒吃就走', (w) => { w.s = daySummary(open, shut, [visit(1, 90), visit(2, 70), visit(3, null, true)], {}) })
    then('來客 3 位、走掉 1 位', (w) => { expect(w.s.guests).toBe(3); expect(w.s.walkedOut).toBe(1) })
    and('星數只算有吃的，介於 1 到 5', (w) => { expect(w.s.stars).toBeGreaterThan(1); expect(w.s.stars).toBeLessThanOrEqual(5) })
  })
  scenario('最暢銷的菜是今天點最多的', ({ given, then, and, but }) => {
    given('一整天各道菜的點單累計，開店時與打烊時', (w) => { w.sold = soldBetween({ a: 5, b: 1 }, { a: 7, b: 6, c: 1 }) })
    then('今天各道菜點了幾份', (w) => { expect(w.sold).toEqual({ a: 2, b: 5, c: 1 }) })
    and('最暢銷的是 b，5 份', (w) => { expect(daySummary(open, shut, [], w.sold).best).toEqual({ key: 'b', n: 5 }) })
    but('一份都沒賣出時沒有最暢銷', () => { expect(daySummary(open, open, [], {}).best).toBeNull() })
  })
  scenario('沒有營業額時沒有利潤率', ({ then }) => {
    then('利潤率是空的', () => { expect(daySummary(open, open, [], {}).margin).toBeNull() })
  })
  scenario('每天的結算記進帳本', ({ given, when, then, and }) => {
    given('今天的結算', (w) => { w.s = daySummary(open, shut, [visit(1, 90)], { a: 2 }) })
    when('打烊時記進帳本', (w) => { w.days = addDay([], 3, w.s) })
    then('帳本多一天：第 3 天的營業額、利潤、來客、最暢銷', (w) => { expect(w.days).toEqual([{ day: 3, revenue: 6000, profit: w.s.profit, guests: 1, stars: w.s.stars, best: { key: 'a', n: 2 } }]) })
    and('同一天開關兩次，兩次加在一起', (w) => { const again = addDay(w.days, 3, w.s); expect(again.length).toBe(1); expect(again[0].revenue).toBe(12000); expect(again[0].guests).toBe(2); expect(again[0].stars).toBeCloseTo(w.s.stars!) })
    and(`只留最近 ${KEEP_DAYS} 天`, (w) => { let d = [] as typeof w.days; for (let i = 1; i <= KEEP_DAYS + 5; i++) d = addDay(d, i, w.s); expect(d.length).toBe(KEEP_DAYS); expect(d[0].day).toBe(6) })
  })
})
