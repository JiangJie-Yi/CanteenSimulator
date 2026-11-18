import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { SAKE_BOTTLE_ML, STATION_GO, TOKKURI_ML, bottleFrom, fullStand, goOf, pour, pourFrom, poursLeft, stationGo } from '@/game/sakeStand'

feature('酒台倒酒（店主要的，第 89 項）', () => {
  scenario('酒台上有十二支酒：一升瓶六支、四合瓶六支（第 285 項：數量不夠）', ({ given, then, and }) => {
    given('酒台上的酒', () => { expect(SAKE_BOTTLE_ML.length).toBeGreaterThan(0) })
    then('一共十二支', () => { expect(SAKE_BOTTLE_ML.length).toBe(12) })
    and('一升瓶（1.8 公升）六支，四合瓶（720 ml）六支', () => {
      expect(SAKE_BOTTLE_ML.filter((ml) => ml === 1800).length).toBe(6)
      expect(SAKE_BOTTLE_ML.filter((ml) => ml === 720).length).toBe(6)
    })
    and('一支一升瓶倒十壺、一支四合瓶倒四壺', () => {
      SAKE_BOTTLE_ML.forEach((ml, k) => expect(goOf(k)).toBe(ml === 1800 ? 10 : 4))
    })
  })
  scenario('一壺德利是一合，從開著的那支倒，倒完才開下一支', ({ given, when, then, and }) => {
    let levels = fullStand()
    given('每一支都是滿的（十二支，第 285 項）', () => { expect(levels).toEqual(SAKE_BOTTLE_ML.map(() => 1)) })
    when('倒一壺', () => { levels = pour(levels, pourFrom(levels)).levels })
    then('第一支少了一合（1.8 公升的十分之一）', () => {
      expect(levels[0]).toBeCloseTo(1 - TOKKURI_ML / SAKE_BOTTLE_ML[0])
    })
    and('下一壺還是從同一支倒，不會每支都開', () => {
      expect(pourFrom(levels)).toBe(0)
      levels = pour(levels, pourFrom(levels)).levels
      expect(levels.slice(1)).toEqual(SAKE_BOTTLE_ML.slice(1).map(() => 1))
    })
  })
  scenario('倒到不夠一壺的那支，換一支新的上去', ({ given, when, then }) => {
    let levels = fullStand(), opened = false
    given('720 ml 的那支倒了三壺（剩 180 ml，還能倒一壺）', () => {
      for (let i = 0; i < 3; i++) levels = pour(levels, 3).levels
      expect(poursLeft(3, levels[3])).toBe(1)
    })
    when('再倒一壺', () => { const r = pour(levels, 3); levels = r.levels; opened = r.opened })
    then('它倒空了，換上新的一支，滿的', () => {
      expect(opened).toBe(true)
      expect(levels[3]).toBe(1)
    })
  })

  scenario('倒空的那支，庫存沒有清酒就留著空瓶，不會自己變滿（第 199 項）', ({ given, when, then, and }) => {
    let levels = fullStand(), opened = true
    given('720 ml 的那支倒到只剩最後一壺', () => {
      for (let i = 0; i < goOf(3) - 1; i++) levels = pour(levels, 3).levels
      expect(poursLeft(3, levels[3])).toBe(1)
    })
    when('庫存沒有清酒時倒最後一壺', () => { const r = pour(levels, 3, () => bottleFrom(3, 0) / goOf(3)); levels = r.levels; opened = r.opened })
    then('它空了，沒有換新的', () => {
      expect(opened).toBe(false)
      expect(levels[3]).toBe(0)
      expect(poursLeft(3, levels[3])).toBe(0)
    })
    and('庫存只有兩合時開的新瓶，只裝兩壺', () => {
      expect(bottleFrom(0, 2)).toBe(2)
      expect(bottleFrom(0, 37)).toBe(STATION_GO)
    })
  })
})

feature('備餐檯的開封一升瓶跟著清酒庫存（店主 2026-11-16「庫存的東西沒對上」，第 199 項）', () => {
  scenario('倒完一瓶，還有清酒才開新的一瓶', ({ given, when, then, but }) => {
    let open = 1
    given('開著的那瓶只剩一壺', () => { expect(open).toBe(1) })
    when('倒完最後一壺，庫存還有 23 合', () => { open = stationGo(open - 1, 23) })
    then('開了一瓶新的，滿瓶（十壺）', () => { expect(open).toBe(STATION_GO) })
    but('庫存只剩 3 合時開的，只有 3 壺的量', () => { expect(stationGo(0, 3)).toBe(3) })
  })
  scenario('清酒賣完了，倒空的瓶子就空著', ({ given, when, then, and }) => {
    let open = 1
    given('開著的那瓶只剩一壺，庫存也沒有了', () => { expect(open).toBe(1) })
    when('倒完', () => { open = stationGo(open - 1, 0) })
    then('瓶子空著', () => { expect(open).toBe(0) })
    and('補了清酒，才開新的一瓶', () => { expect(stationGo(open, 12)).toBe(STATION_GO) })
  })
  scenario('瓶裡的不會比店裡的清酒多', ({ given, when, then }) => {
    let open = 7
    given('開著的那瓶還有七壺', () => { expect(open).toBe(7) })
    when('店裡的清酒只剩四合（丟掉壞的、點了沒倒就走的）', () => { open = stationGo(open, 4) })
    then('瓶裡只剩四壺', () => { expect(open).toBe(4) })
  })
})
