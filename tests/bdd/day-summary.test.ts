import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { addDay, daySummary, KEEP_DAYS, soldBetween } from '@/game/daySummary'
import type { Visit } from '@/game/reputation'
import { caseCost, CASE_SIZE, unitCost } from '@/game/drinkStock'

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
  // (item 203: the reviews bought and the shrine's offerings came out of the cash, never out of the day's profit)
  scenario('買的評論與神棚的供品也從利潤扣掉', ({ given, then, and }) => {
    given('今天花了 400 元買評論、60 元供品', (w) => {
      w.s = daySummary({ ...open, promo: 0, offering: 100 }, { ...shut, promo: 400, offering: 160 }, [], {})
    })
    then('利潤再少 460 元', (w) => { expect(w.s.profit).toBe(6000 - 2000 - 300 - 1200 - 60 - 460) })
    and('結算單上有這一行', (w) => { expect(w.s.other).toBe(460) })
  })
  scenario('一瓶飲料的成本是整箱的價錢除以瓶數', ({ then }) => {
    then('瓶裝啤酒一箱 20 瓶、960 元，一瓶 48 元', () => {
      expect(CASE_SIZE.beer).toBe(20)
      expect(caseCost('beer')).toBe(960)
      expect(unitCost('beer')).toBe(48)
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
    then('帳本多一天：第 3 天的營業額、利潤、來客、最暢銷，與人事（算人事費率）', (w) => { expect(w.days).toEqual([{ day: 3, revenue: 6000, profit: w.s.profit, guests: 1, stars: w.s.stars, best: { key: 'a', n: 2 }, ...(w.s.wage > 0 ? { wage: w.s.wage } : {}) }]) })
    and('同一天開關兩次，兩次加在一起', (w) => { const again = addDay(w.days, 3, w.s); expect(again.length).toBe(1); expect(again[0].revenue).toBe(12000); expect(again[0].guests).toBe(2); expect(again[0].stars).toBeCloseTo(w.s.stars!) })
    and(`只留最近 ${KEEP_DAYS} 天`, (w) => { let d = [] as typeof w.days; for (let i = 1; i <= KEEP_DAYS + 5; i++) d = addDay(d, i, w.s); expect(d.length).toBe(KEEP_DAYS); expect(d[0].day).toBe(6) })
  })
})

feature('營業時間記進帳本（店主 2026-11-15：營業時間也得記錄下來）', () => {
  const sum = (o: Partial<ReturnType<typeof daySummary>> = {}) => ({ ...daySummary({ revenue: 0, food: 0, fuel: 0, wage: 0 }, { revenue: 1000, food: 300, fuel: 0, wage: 200, overtime: 40 }, [], {}), ...o })
  scenario('打烊時，那天的開店、收店時間與晚了多久跟著存進帳本', ({ given, when, then, and }) => {
    given('第 3 天 16:30 開店、05:30 收店（晚 60 分），加班費 40', (w) => { w.s = sum() })
    when('打烊記帳', (w) => { w.days = addDay([], 3, w.s, { open: '16:30', close: '05:30', late: 60 }) })
    then('那天的紀錄有營業時間', (w) => { expect(w.days[0]).toMatchObject({ day: 3, open: '16:30', close: '05:30', late: 60 }) })
    and('也有加班費，而且加班費算在人事裡', (w) => { expect(w.days[0].overtime).toBe(40); expect(w.s.wage).toBe(200); expect(w.s.profit).toBe(1000 - 300 - 200) })
  })
  scenario('同一天開兩次：開店取第一次、收店取最後一次，加班費加起來', ({ given, when, then }) => {
    given('第 5 天先開 16:30–20:00', (w) => { w.days = addDay([], 5, sum({ overtime: 0 }), { open: '16:30', close: '20:00', late: 0 }) })
    when('又開到 05:00（晚 30 分），加班費 25', (w) => { w.days = addDay(w.days, 5, sum({ overtime: 25 }), { open: '21:00', close: '05:00', late: 30 }) })
    then('記成 16:30–05:00、晚 30 分、加班費 25', (w) => { expect(w.days[0]).toMatchObject({ open: '16:30', close: '05:00', late: 30, overtime: 25 }) })
  })
})
