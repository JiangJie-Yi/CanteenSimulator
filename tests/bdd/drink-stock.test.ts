import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CASE_SIZE, buyCase, caseCost, drinkCounts, emptyFridge, fillFromBack, readDrinks, restockRun, writeDrinks, type Back } from '@/game/drinkStock'

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

feature('飲料櫃一開始是空的，自己從後場補', () => {
  scenario('新開的店飲料櫃是空的', ({ given, when, then }) => {
    given('一台櫃子，兩層各三格', (w) => { w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']] })
    when('剛開店', (w) => { w.rows = emptyFridge(w.home) })
    then('每一格都是空的', (w) => { expect(w.rows.flat().every((x: string | null) => x === null)).toBe(true) })
  })

  scenario('補一種飲料：那種的空格從後場補滿，後場扣掉', ({ given, when, then, and }) => {
    given('可樂 3 格空、烏龍茶 3 格空，後場可樂 10、烏龍茶 10', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']]
      w.rows = emptyFridge(w.home)
      w.back = { cola: 10, oolong: 10 } as Back
    })
    when('只補可樂', (w) => { w.r = fillFromBack(w.rows, w.home, w.back, 'cola') })
    then('可樂 3 格都有了', (w) => { expect(w.r.rows[0]).toEqual(['cola', 'cola', 'cola']) })
    and('烏龍茶沒動', (w) => { expect(w.r.rows[1]).toEqual([null, null, null]) })
    and('後場可樂剩 7、烏龍茶還是 10', (w) => { expect(w.r.back.cola).toBe(7); expect(w.r.back.oolong).toBe(10); expect(w.r.moved).toBe(3) })
  })

  scenario('後場不夠就只補到後場有的量', ({ given, when, then }) => {
    given('綠茶 5 格空，後場只剩 2', (w) => { w.home = [Array(5).fill('greenTea')]; w.rows = emptyFridge(w.home); w.back = { greenTea: 2 } as Back })
    when('補綠茶', (w) => { w.r = fillFromBack(w.rows, w.home, w.back, 'greenTea') })
    then('只補上 2 格，後場歸零', (w) => { expect(w.r.moved).toBe(2); expect(w.r.back.greenTea).toBe(0) })
  })

  scenario('全部補滿：每種都從後場補', ({ given, when, then }) => {
    given('兩種各空 3 格，後場都夠', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']]
      w.rows = emptyFridge(w.home)
      w.back = { cola: 24, oolong: 12 } as Back
    })
    when('全部補滿', (w) => { w.r = fillFromBack(w.rows, w.home, w.back) })
    then('沒有空格了', (w) => { expect(w.r.rows.flat().some((x: string | null) => x === null)).toBe(false); expect(w.r.moved).toBe(6) })
  })

  scenario('數得出每種飲料櫃裡有幾瓶、有幾個位置', ({ given, when, then }) => {
    given('可樂 3 格有 1 瓶，烏龍茶 2 格滿', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong']]
      w.rows = [['cola', null, null], ['oolong', 'oolong']]
    })
    when('數一數', (w) => { w.c = drinkCounts(w.rows, w.home) })
    then('可樂 1/3、烏龍茶 2/2', (w) => { expect(w.c.cola).toEqual({ have: 1, places: 3, astray: 0 }); expect(w.c.oolong).toEqual({ have: 2, places: 2, astray: 0 }) })
  })

  scenario('放到別的飲料格子裡的，不算在它自己架上（看得到幾瓶就是幾瓶）', ({ given, when, then, and }) => {
    given('咖啡 3 格放了 2 瓶，第 3 瓶被拖到黑咖啡的空格', (w) => {
      w.home = [['coffee', 'coffee', 'coffee', 'blackCoffee', 'blackCoffee']]
      w.rows = [['coffee', null, 'coffee', 'coffee', null]]
    })
    when('數一數', (w) => { w.c = drinkCounts(w.rows, w.home) })
    then('咖啡架上 2/3', (w) => { expect(w.c.coffee.have).toBe(2); expect(w.c.coffee.places).toBe(3) })
    and('另有 1 瓶在別格', (w) => { expect(w.c.coffee.astray).toBe(1) })
    and('黑咖啡自己的格子一瓶都沒有', (w) => { expect(w.c.blackCoffee.have).toBe(0) })
  })

  scenario('櫃子與後場存起來再讀回來一樣；讀不懂的就用一開始的樣子', ({ given, when, then, and }) => {
    given('櫃子補了一瓶可樂，後場可樂 9', (w) => {
      w.home = [['cola', 'cola']]
      w.saved = writeDrinks({ units: [[['cola', null]]], back: { cola: 9 } })
    })
    when('讀回來', (w) => { w.back = readDrinks(w.saved, [w.home]) })
    then('一樣', (w) => { expect(w.back?.units[0][0]).toEqual(['cola', null]); expect(w.back?.back.cola).toBe(9) })
    and('壞掉或形狀不對的就不用', (w) => {
      expect(readDrinks('{oops', [w.home])).toBeNull()
      expect(readDrinks(JSON.stringify({ units: [[['cola']]], back: {} }), [w.home])).toBeNull()
      expect(readDrinks(JSON.stringify({ units: [[['beer', null]]], back: {} }), [w.home])).toBeNull()
    })
  })
})
