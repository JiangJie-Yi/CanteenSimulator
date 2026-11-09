import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { understand } from '@/game/chefChat'
import { DISHES } from '@/data/menu'

const shop = DISHES.find((d) => d.id === 'grilledfish')!

feature('跟二廚說話（中、日、英都聽得懂）', () => {
  scenario('快捷鈕的三種語言意思一樣', ({ then, and }) => {
    then('一鍵生成菜單：排 10 道', () => {
      expect(understand('一鍵生成菜單 10 道', shop)).toEqual({ kind: 'menu', n: 10 })
      expect(understand('Make a 10-dish menu', shop)).toEqual({ kind: 'menu', n: 10 })
    })
    and('隨便試 3 道', () => {
      expect(understand('隨便試 3 道', shop)).toEqual({ kind: 'batch', n: 3 })
      expect(understand('Try 3 at random', shop)).toEqual({ kind: 'batch', n: 3 })
    })
    and('庫存還夠嗎', () => {
      expect(understand('庫存還夠嗎？', shop)).toEqual({ kind: 'stock' })
      expect(understand('Enough stock?', shop)).toEqual({ kind: 'stock' })
    })
    and('有什麼推薦', () => {
      expect(understand('有什麼推薦？', shop).kind).toBe('advise')
      expect(understand('Any recommendations?', shop).kind).toBe('advise')
    })
  })
  scenario('英文點一道菜', ({ then }) => {
    then('make salt-grilled corn：玉米、加鹽', () => {
      const i = understand('make salt-grilled corn', shop)
      expect(i).toEqual({ kind: 'make', id: 'GrilledCorn', dabs: ['salt'] })
    })
  })
})
