import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import {
  CASE_SIZE, buyCase, caseCost, depthOf, drinkCounts, emptyFillable, emptyFridge, fillFromBack, moveBetween, putInPlace, readDrinks, restockRun,
  takeFromPlace, writeDrinks, type Back, type Places,
} from '@/game/drinkStock'

/** a fridge's places from what stands in each: [drink, how many] or null */
const placesFrom = (rows: ([string, number] | null)[][]): Places => ({
  rows: rows.map((r) => r.map((x) => (x ? x[0] : null))),
  counts: rows.map((r) => r.map((x) => (x ? x[1] : 0))),
})

feature('飲料櫃的後場庫存與補貨', () => {
  scenario('補進櫃子的飲料從後場扣，每一格補到前後放滿', ({ given, when, then, and }) => {
    given(`可樂 3 格（一格前後 ${depthOf('cola')} 瓶）只剩一格有 1 瓶，後場還有 10 罐`, (w) => {
      w.home = [['cola', 'cola', 'cola']]
      w.p = placesFrom([[['cola', 1], null, null]])
      w.back = { cola: 10 } as Back
    })
    when('店員來補貨（一趟最多拿 8 罐）', (w) => { w.run = restockRun(w.p, w.home, w.back, 8) })
    then('3 格都前後放滿', (w) => { expect(w.run.counts[0]).toEqual([2, 2, 2]); expect(w.run.rows[0]).toEqual(['cola', 'cola', 'cola']) })
    and('搬了 5 罐，後場剩 5 罐', (w) => { expect(w.run.moved).toBe(5); expect(w.run.back.cola).toBe(5) })
  })

  scenario('後場沒貨就補不上', ({ given, when, then }) => {
    given('烏龍茶空了 2 格，後場沒有烏龍茶', (w) => {
      w.home = [['oolong', 'oolong', 'oolong']]
      w.p = placesFrom([[null, null, ['oolong', 2]]])
      w.back = { oolong: 0 } as Back
    })
    when('店員來補貨', (w) => { w.run = restockRun(w.p, w.home, w.back, 8) })
    then('還是空的，什麼都沒搬', (w) => {
      expect(w.run.rows[0].filter((x: string | null) => x === null).length).toBe(2)
      expect(w.run.moved).toBe(0)
    })
  })

  scenario('一趟拿不完就只補一部分', ({ given, when, then }) => {
    given('罐裝啤酒 8 格全空，後場很多', (w) => {
      w.home = [Array(8).fill('beerCan')]
      w.p = emptyFridge(w.home)
      w.back = { beerCan: 48 } as Back
    })
    when('店員一趟最多拿 6 罐', (w) => { w.run = restockRun(w.p, w.home, w.back, 6) })
    then('只補上 6 罐（3 格放滿），後場少 6', (w) => {
      expect(w.run.moved).toBe(6)
      expect(w.run.back.beerCan).toBe(42)
      expect(w.run.counts[0].slice(0, 4)).toEqual([2, 2, 2, 0])
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

  scenario('倉儲看得出櫃子還缺幾瓶（後場補得了的）', ({ given, then, and }) => {
    given('可樂 2 格空、後場只剩 3 罐；烏龍茶缺 1 瓶、後場很多', (w) => {
      w.home = [['cola', 'cola', 'oolong']]
      w.p = placesFrom([[null, null, ['oolong', 1]]])
    })
    then('缺 3 + 1 = 4 瓶', (w) => { expect(emptyFillable(w.p, w.home, { cola: 3, oolong: 20 })).toBe(4) })
    and('後場都沒了就是 0', (w) => { expect(emptyFillable(w.p, w.home, {})).toBe(0) })
  })
})

feature('飲料櫃一格前後放好幾瓶，拿走前面那瓶，後面的還在', () => {
  scenario('大瓶與罐子一格前後 2 瓶，小瓶、咖啡罐、紙盒 3 瓶', ({ then, and }) => {
    then('啤酒、可樂、罐裝啤酒 2', () => { for (const id of ['beer', 'cola', 'beerCan']) expect(depthOf(id)).toBe(2) })
    and('清酒、養樂多、咖啡、蘋果汁 3', () => { for (const id of ['sake', 'yakult', 'coffee', 'appleJuice']) expect(depthOf(id)).toBe(3) })
  })

  scenario('拿走一瓶只少一瓶，那一格還有剩下的', ({ given, when, then, and }) => {
    given('清酒一格放滿 3 瓶', (w) => { w.p = placesFrom([[['sake', 3]]]) })
    when('拿走一瓶', (w) => { w.got = takeFromPlace(w.p, 0, 0) })
    then('拿到清酒', (w) => { expect(w.got).toBe('sake') })
    and('那一格還有 2 瓶，還是清酒的', (w) => { expect(w.p.counts[0][0]).toBe(2); expect(w.p.rows[0][0]).toBe('sake') })
  })

  scenario('最後一瓶拿走，那一格才空', ({ given, when, then }) => {
    given('啤酒一格只剩 1 瓶', (w) => { w.p = placesFrom([[['beer', 1]]]) })
    when('拿走', (w) => { takeFromPlace(w.p, 0, 0) })
    then('空了', (w) => { expect(w.p.rows[0][0]).toBeNull(); expect(w.p.counts[0][0]).toBe(0) })
  })

  scenario('放回去：空格或同一種還有空位才放得進去', ({ given, then, and, but }) => {
    given('可樂一格有 1 瓶、一格空', (w) => { w.p = placesFrom([[['cola', 1], null]]) })
    then('同一種放得進去（變 2 瓶）', (w) => { expect(putInPlace(w.p, 0, 0, 'cola')).toBe(true); expect(w.p.counts[0][0]).toBe(2) })
    and('滿了就放不進去', (w) => { expect(putInPlace(w.p, 0, 0, 'cola')).toBe(false) })
    and('空格放什麼都可以', (w) => { expect(putInPlace(w.p, 0, 1, 'oolong')).toBe(true); expect(w.p.rows[0][1]).toBe('oolong') })
    but('別種飲料的格子放不進去', (w) => { expect(putInPlace(w.p, 0, 1, 'cola')).toBe(false) })
  })

  scenario('拖到別格：只搬那一瓶', ({ given, when, then, and }) => {
    given('咖啡一格 3 瓶，旁邊一格空', (w) => { w.p = placesFrom([[['coffee', 3], null]]) })
    when('把前面那瓶拖到旁邊', (w) => { w.ok = moveBetween(w.p, [0, 0], [0, 1]) })
    then('搬過去了', (w) => { expect(w.ok).toBe(true) })
    and('原本那格剩 2 瓶、旁邊那格 1 瓶', (w) => { expect(w.p.counts[0]).toEqual([2, 1]); expect(w.p.rows[0]).toEqual(['coffee', 'coffee']) })
  })

  scenario('各剩一瓶的兩種可以對調；別種放滿的格子拖不進去', ({ given, then, and }) => {
    given('可樂一格 1 瓶、烏龍茶一格 1 瓶、綠茶一格 2 瓶', (w) => { w.p = placesFrom([[['cola', 1], ['oolong', 1], ['greenTea', 2]]]) })
    then('可樂與烏龍茶對調', (w) => { expect(moveBetween(w.p, [0, 0], [0, 1])).toBe(true); expect(w.p.rows[0].slice(0, 2)).toEqual(['oolong', 'cola']) })
    and('拖到綠茶那格不行，什麼都不變', (w) => {
      expect(moveBetween(w.p, [0, 0], [0, 2])).toBe(false)
      expect(w.p.rows[0]).toEqual(['oolong', 'cola', 'greenTea']); expect(w.p.counts[0]).toEqual([1, 1, 2])
    })
  })
})

feature('飲料櫃一開始是空的，自己從後場補', () => {
  scenario('新開的店飲料櫃是空的', ({ given, when, then }) => {
    given('一台櫃子，兩層各三格', (w) => { w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']] })
    when('剛開店', (w) => { w.p = emptyFridge(w.home) })
    then('每一格都是空的', (w) => { expect(w.p.rows.flat().every((x: string | null) => x === null)).toBe(true); expect(w.p.counts.flat().every((n: number) => n === 0)).toBe(true) })
  })

  scenario('補一種飲料：那種的空位從後場補滿，後場扣掉', ({ given, when, then, and }) => {
    given('可樂 3 格空、烏龍茶 3 格空，後場可樂 10、烏龍茶 10', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']]
      w.p = emptyFridge(w.home)
      w.back = { cola: 10, oolong: 10 } as Back
    })
    when('只補可樂', (w) => { w.r = fillFromBack(w.p, w.home, w.back, 'cola') })
    then('可樂 3 格都前後放滿', (w) => { expect(w.r.rows[0]).toEqual(['cola', 'cola', 'cola']); expect(w.r.counts[0]).toEqual([2, 2, 2]) })
    and('烏龍茶沒動', (w) => { expect(w.r.rows[1]).toEqual([null, null, null]) })
    and('後場可樂剩 4、烏龍茶還是 10', (w) => { expect(w.r.back.cola).toBe(4); expect(w.r.back.oolong).toBe(10); expect(w.r.moved).toBe(6) })
  })

  scenario('後場不夠就只補到後場有的量', ({ given, when, then }) => {
    given('綠茶 5 格空，後場只剩 3', (w) => { w.home = [Array(5).fill('greenTea')]; w.p = emptyFridge(w.home); w.back = { greenTea: 3 } as Back })
    when('補綠茶', (w) => { w.r = fillFromBack(w.p, w.home, w.back, 'greenTea') })
    then('只補上 3 瓶，後場歸零', (w) => { expect(w.r.moved).toBe(3); expect(w.r.back.greenTea).toBe(0); expect(w.r.counts[0]).toEqual([2, 1, 0, 0, 0]) })
  })

  scenario('全部補滿：每種都從後場補', ({ given, when, then }) => {
    given('兩種各空 3 格，後場都夠', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong', 'oolong']]
      w.p = emptyFridge(w.home)
      w.back = { cola: 24, oolong: 12 } as Back
    })
    when('全部補滿', (w) => { w.r = fillFromBack(w.p, w.home, w.back) })
    then('沒有空位了', (w) => { expect(w.r.rows.flat().some((x: string | null) => x === null)).toBe(false); expect(w.r.moved).toBe(12) })
  })

  scenario('數得出每種飲料櫃裡有幾瓶、放得下幾瓶（看得到幾瓶就是幾瓶）', ({ given, when, then }) => {
    given('可樂 3 格只有 1 瓶，烏龍茶 2 格放滿', (w) => {
      w.home = [['cola', 'cola', 'cola'], ['oolong', 'oolong']]
      w.p = placesFrom([[['cola', 1], null, null], [['oolong', 2], ['oolong', 2]]])
    })
    when('數一數', (w) => { w.c = drinkCounts(w.p, w.home) })
    then('可樂 1/6、烏龍茶 4/4', (w) => { expect(w.c.cola).toEqual({ have: 1, places: 6, astray: 0 }); expect(w.c.oolong).toEqual({ have: 4, places: 4, astray: 0 }) })
  })

  scenario('放到別的飲料格子裡的，不算在它自己架上', ({ given, when, then, and }) => {
    given('咖啡 3 格放了 2 格各 3 瓶，另 1 瓶被拖到黑咖啡的空格', (w) => {
      w.home = [['coffee', 'coffee', 'coffee', 'blackCoffee', 'blackCoffee']]
      w.p = placesFrom([[['coffee', 3], null, ['coffee', 3], ['coffee', 1], null]])
    })
    when('數一數', (w) => { w.c = drinkCounts(w.p, w.home) })
    then('咖啡架上 6/9', (w) => { expect(w.c.coffee.have).toBe(6); expect(w.c.coffee.places).toBe(9) })
    and('另有 1 瓶在別格', (w) => { expect(w.c.coffee.astray).toBe(1) })
    and('黑咖啡自己的格子一瓶都沒有', (w) => { expect(w.c.blackCoffee.have).toBe(0) })
  })

  scenario('櫃子與後場存起來再讀回來一樣；讀不懂的就用一開始的樣子', ({ given, when, then, and }) => {
    given('櫃子一格放了 1 瓶可樂，後場可樂 9', (w) => {
      w.home = [['cola', 'cola']]
      w.saved = writeDrinks({ units: [[['cola', null]]], counts: [[[1, 0]]], back: { cola: 9 } })
    })
    when('讀回來', (w) => { w.back = readDrinks(w.saved, [w.home]) })
    then('一樣', (w) => { expect(w.back?.units[0][0]).toEqual(['cola', null]); expect(w.back?.counts[0][0]).toEqual([1, 0]); expect(w.back?.back.cola).toBe(9) })
    and('壞掉或形狀不對的就不用', (w) => {
      expect(readDrinks('{oops', [w.home])).toBeNull()
      expect(readDrinks(JSON.stringify({ units: [[['cola']]], back: {} }), [w.home])).toBeNull()
      expect(readDrinks(JSON.stringify({ units: [[['beer', null]]], back: {} }), [w.home])).toBeNull()
    })
  })

  scenario('以前存的（每格一瓶、沒有瓶數）：有飲料的格子照以前看到的前後放滿，不會清空', ({ given, when, then, and }) => {
    given('以前存的櫃子：一格可樂、一格空，後場可樂 9', (w) => {
      w.home = [['cola', 'cola']]
      w.saved = JSON.stringify({ units: [[['cola', null]]], back: { cola: 9 } })
    })
    when('讀回來', (w) => { w.r = readDrinks(w.saved, [w.home]) })
    then('那一格前後 2 瓶、空格還是空的', (w) => { expect(w.r?.counts[0][0]).toEqual([2, 0]); expect(w.r?.units[0][0]).toEqual(['cola', null]) })
    and('後場不變', (w) => { expect(w.r?.back.cola).toBe(9) })
  })
})
