import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PER_CABINET, TABLEWARE, enoughFor } from '@/game/tableware'
import { SOUP_BOWLS } from '@/game/soup'

feature('碗盤櫃裡的碗、筷子、湯匙：數量成比例', () => {
  scenario('吧台 8 個座位，每位三套（使用中、在洗、備用）', ({ then, and }) => {
    then('飯碗、湯碗各 24 個，湯匙跟湯碗一樣多', () => {
      expect(TABLEWARE.riceBowls).toBe(24)
      expect(TABLEWARE.soupBowls).toBe(24)
      expect(TABLEWARE.spoons).toBe(TABLEWARE.soupBowls)
    })
    and(`湯碗夠裝兩鍋味噌湯（每鍋 ${SOUP_BOWLS} 碗）`, () => { expect(TABLEWARE.soupBowls).toBeGreaterThanOrEqual(SOUP_BOWLS * 2) })
    and('筷子是碗的 2.5 倍（外帶也要附）', () => { expect(TABLEWARE.chopsticks).toBe(TABLEWARE.soupBowls * 2.5) })
    and('8 個座位夠用', () => { expect(enoughFor(8)).toBe(true) })
    and('座位多到 9 個就不夠了', () => { expect(enoughFor(9)).toBe(false) })
  })
  scenario('兩個碗盤櫃各放一半', ({ then }) => {
    then('每櫃：飯碗 12、湯碗 12、湯匙 12、筷子 30 雙', () => {
      expect(PER_CABINET).toEqual({ riceBowls: 12, soupBowls: 12, spoons: 12, chopsticks: 30 })
    })
  })
})
