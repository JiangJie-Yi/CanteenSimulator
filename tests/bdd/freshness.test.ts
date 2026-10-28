import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ageFresh, blendFresh, FRESH_FLOOR, freshFactor, freshGrade } from '@/game/freshness'

feature('食材鮮度', () => {
  scenario('剛進的貨是 100，和庫存裡的混在一起算', ({ then, and }) => {
    then('空的櫃子進貨，鮮度 100', () => { expect(blendFresh(0, 0, 5)).toBe(100) })
    and('5 份鮮度 60 的，再進 5 份新的，平均是 80', () => { expect(blendFresh(5, 60, 5)).toBe(80) })
  })
  scenario('放越久越不新鮮，冷凍最慢、常溫最快，但不會低於下限', ({ then, and }) => {
    then('同樣放 30 分鐘，冷凍的比冷藏的新鮮，冷藏的又比常溫的新鮮', () => {
      const frozen = ageFresh('Saury', 100, 30), chilled = ageFresh('Yakitori', 100, 30), ambient = ageFresh('Potato', 100, 30)
      expect(frozen).toBeGreaterThan(chilled)
      expect(chilled).toBeGreaterThan(ambient)
    })
    and('放再久也停在下限', () => { expect(ageFresh('Potato', 100, 100000)).toBe(FRESH_FLOOR) })
  })
  scenario('越不新鮮，做出來越不好吃', ({ then }) => {
    then('全新鮮保留全部味道，下限只剩約八成', () => {
      expect(freshFactor(100)).toBe(1)
      expect(freshFactor(FRESH_FLOOR)).toBeLessThan(0.82)
      expect(freshGrade(90)).toBe('fresh')
      expect(freshGrade(30)).toBe('tired')
    })
  })
})
