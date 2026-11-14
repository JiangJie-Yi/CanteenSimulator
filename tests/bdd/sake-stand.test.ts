import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { SAKE_BOTTLE_ML, TOKKURI_ML, fullStand, pour, pourFrom, poursLeft } from '@/game/sakeStand'

feature('酒台倒酒（店主要的，第 89 項）', () => {
  scenario('一壺德利是一合，從開著的那支倒，倒完才開下一支', ({ given, when, then, and }) => {
    let levels = fullStand()
    given('五支都是滿的', () => { expect(levels).toEqual([1, 1, 1, 1, 1]) })
    when('倒一壺', () => { levels = pour(levels, pourFrom(levels)).levels })
    then('第一支少了一合（1.8 公升的十分之一）', () => {
      expect(levels[0]).toBeCloseTo(1 - TOKKURI_ML / SAKE_BOTTLE_ML[0])
    })
    and('下一壺還是從同一支倒，不會每支都開', () => {
      expect(pourFrom(levels)).toBe(0)
      levels = pour(levels, pourFrom(levels)).levels
      expect(levels.slice(1)).toEqual([1, 1, 1, 1])
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
})
