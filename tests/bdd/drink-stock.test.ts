import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CASE_SIZE, buyCase, caseCost, restockRun, type Back } from '@/game/drinkStock'

feature('飲料櫃的後場庫存與補貨', () => {
  scenario('補進櫃子的飲料從後場庫存扣', ({ given, when, then, and }) => {
    given('可樂櫃位空了 3 格，後場還有 10 罐', (w) => {
      w.rows = [['cola', null, null, null, 'cola']]
      w.home = [['cola', 'cola', 'cola', 'cola', 'cola']]
      w.back = { cola: 10 } as Back
    })
    when('店員來補貨（一趟最多拿 6 罐）', (w) => { w.run = restockRun(w.rows, w.home, w.back, 6) })
    then('3 格都補滿', (w) => { expect(w.run.rows[0].every((x: string | null) => x === 'cola')).toBe(true) })
    and('後場剩 7 罐', (w) => { expect(w.run.back.cola).toBe(7); expect(w.run.moved).toBe(3) })
  })

  scenario('後場沒貨就補不上', ({ given, when, then }) => {
    given('烏龍茶櫃位空了 2 格，後場沒有烏龍茶', (w) => {
      w.rows = [[null, null, 'oolong']]
      w.home = [['oolong', 'oolong', 'oolong']]
      w.back = { oolong: 0 } as Back
    })
    when('店員來補貨', (w) => { w.run = restockRun(w.rows, w.home, w.back, 6) })
    then('還是空的，什麼都沒搬', (w) => {
      expect(w.run.rows[0].filter((x: string | null) => x === null).length).toBe(2)
      expect(w.run.moved).toBe(0)
    })
  })

  scenario('一趟拿不完就只補一部分', ({ given, when, then }) => {
    given('啤酒空了 8 格，後場很多', (w) => {
      w.rows = [Array(8).fill(null)]
      w.home = [Array(8).fill('beerCan')]
      w.back = { beerCan: 48 } as Back
    })
    when('店員一趟最多拿 6 罐', (w) => { w.run = restockRun(w.rows, w.home, w.back, 6) })
    then('只補上 6 格，後場少 6', (w) => {
      expect(w.run.moved).toBe(6)
      expect(w.run.back.beerCan).toBe(42)
    })
  })

  scenario('訂一箱飲料要花錢，後場多一箱的量', ({ given, when, then, and }) => {
    given('現金 1000，後場可樂 0', (w) => { w.cash = 1000; w.back = { cola: 0 } as Back })
    when('訂一箱可樂', (w) => { w.r = buyCase(w.back, 'cola', w.cash) })
    then('後場多了一箱', (w) => { expect(w.r.back.cola).toBe(CASE_SIZE.cola) })
    and('現金少了一箱的進價', (w) => { expect(w.r.cash).toBe(1000 - caseCost('cola')) ; expect(caseCost('cola')).toBeGreaterThan(0) })
  })

  scenario('錢不夠就訂不了', ({ given, when, then }) => {
    given('現金只有 10', (w) => { w.back = { sake: 0 } as Back })
    when('想訂一箱清酒', (w) => { w.r = buyCase(w.back, 'sake', 10) })
    then('沒訂成，庫存與現金都不變', (w) => { expect(w.r.ok).toBe(false); expect(w.r.back.sake).toBe(0); expect(w.r.cash).toBe(10) })
  })
})
