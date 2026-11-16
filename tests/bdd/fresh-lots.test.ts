import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { addLot, ageLots, lotGrades, lotsFrom, lotsTotal, settleLots, stalest, takeLots, tossSpoiled, type Lot } from '@/game/lots'
import { INEDIBLE } from '@/game/freshness'

feature('食材分批：先進先出', () => {
  scenario('買新貨不會讓快壞的變新鮮', ({ given, when, then, and }) => {
    given('冰箱裡有 10 份鮮度 35 的秋刀魚', (w) => { w.lots = lotsFrom(10, 35) as Lot[] })
    when('再進 10 份新的', (w) => { w.lots = addLot(w.lots, 10, 2) })
    then('舊的那批還是 35', (w) => { expect(stalest(w.lots)).toBe(35) })
    and('新的那批是 100，總共 20 份', (w) => {
      expect(Math.max(...(w.lots as Lot[]).map((l) => l.fresh))).toBe(100)
      expect(lotsTotal(w.lots)).toBe(20)
    })
  })
  scenario('做菜先用最舊的那批', ({ given, when, then, and }) => {
    given('10 份鮮度 35 與 10 份鮮度 100', (w) => { w.lots = addLot(lotsFrom(10, 35), 10, 2) })
    when('用掉 4 份', (w) => { w.t = takeLots(w.lots, 4) })
    then('用掉的是鮮度 35 的', (w) => { expect(w.t.fresh).toBe(35) })
    and('舊的那批剩 6 份，新的 10 份沒動', (w) => {
      expect(lotGrades(w.t.lots)).toEqual({ fresh: 10, good: 0, tired: 6, spoiled: 0 })
    })
  })
  scenario('一次用掉的跨過兩批，鮮度是那幾份的平均', ({ then }) => {
    then('2 份 40 與 2 份 100 一起用掉，是 70', () => {
      const t = takeLots(addLot(lotsFrom(2, 40), 5, 1), 4)
      expect(t.fresh).toBe(70)
      expect(lotsTotal(t.lots)).toBe(3)
    })
  })
  scenario('每一批各自變質', ({ then }) => {
    then('過一段時間，每批各少一樣多，不會互相拉平', () => {
      const lots = ageLots(addLot(lotsFrom(3, 60), 3, 1), (f) => f - 10)
      expect(lots.map((l) => l.fresh).sort((a, b) => a - b)).toEqual([50, 90])
    })
  })
  scenario('庫存數量就是準：多了算新進的一批、少了從最舊的扣', ({ then, and }) => {
    then('5 份變 8 份：多一批 3 份、鮮度 100', () => {
      const s = settleLots(lotsFrom(5, 50), 8, 3)
      expect(lotGrades(s.lots)).toEqual({ fresh: 3, good: 5, tired: 0, spoiled: 0 })
      expect(s.used).toBe(0)
    })
    and('8 份變 6 份：從鮮度 50 那批扣 2 份，用掉的是 50', () => {
      const s = settleLots(addLot(lotsFrom(5, 50), 3, 3), 6)
      expect(s.used).toBe(2)
      expect(s.fresh).toBe(50)
      expect(lotsTotal(s.lots)).toBe(6)
    })
    and('都沒有了，顯示 100（沒有東西會壞）', () => { expect(stalest(settleLots(lotsFrom(2, 20), 0).lots)).toBe(100) })
  })

  // (item 203: spoiled stock couldn't be thrown out: it sat in the fridge, counted as stock, and went on the fire before the fresh)
  scenario('壞掉的丟掉：只丟不可食用的那幾批，其他的照舊', ({ given, when, then, and }) => {
    given('冰箱裡 4 份壞了（鮮度 12）、3 份即期（鮮度 40）、5 份新的', (w) => {
      w.lots = [{ n: 4, fresh: 12, day: 1 }, { n: 3, fresh: 40, day: 2 }, { n: 5, fresh: 100, day: 3 }] as Lot[]
    })
    when('把壞掉的丟掉', (w) => { w.r = tossSpoiled(w.lots) })
    then('丟了 4 份', (w) => { expect(INEDIBLE).toBe(30); expect(w.r.n).toBe(4) })
    and('剩 8 份，最舊的是鮮度 40 那批', (w) => {
      expect(lotsTotal(w.r.lots)).toBe(8)
      expect(stalest(w.r.lots)).toBe(40)
    })
    and('沒有壞掉的就什麼都不丟', (w) => { expect(tossSpoiled(w.r.lots).n).toBe(0) })
  })
})
