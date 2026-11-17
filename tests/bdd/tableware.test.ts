import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PER_CABINET, TABLEWARE, TRAYS, enoughFor, tablewareList, traysAt } from '@/game/tableware'
import { ROLES } from '@/data/staff'
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
  scenario('外場用托盤端菜、收盤，托盤也算在餐具裡', ({ then, and }) => {
    then(`店裡有 ${TRAYS} 個托盤`, () => { expect(TRAYS).toBe(4) })
    and('兩位外場上班時各拿一個，出餐口剩兩個', () => { expect(traysAt(2)).toEqual({ hands: 2, pass: 2 }) })
    and('沒人上班時都放在出餐口', () => { expect(traysAt(0)).toEqual({ hands: 0, pass: TRAYS }) })
    and('外場最多兩位，托盤一定夠，沒有人要等托盤', () => {
      const most = ROLES.grilledfish.find((r) => r.role === 'server')!.max
      expect(traysAt(most).pass).toBeGreaterThan(0)
    })
    and('餐具清單裡有托盤、方形鐵盤與夾子', () => {
      expect(tablewareList(8).map((w) => w.id)).toEqual(expect.arrayContaining(['trays', 'kakubat', 'tongs']))
    })
  })
})
