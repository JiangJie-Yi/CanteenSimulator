import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ageFresh, blendFresh, freshFactor, freshGrade, frozenRate, INEDIBLE, sickChance } from '@/game/freshness'

feature('食材鮮度', () => {
  scenario('剛進的貨是 100，和庫存裡的混在一起算', ({ then, and }) => {
    then('空的櫃子進貨，鮮度 100', () => { expect(blendFresh(0, 0, 5)).toBe(100) })
    and('5 份鮮度 60 的，再進 5 份新的，平均是 80', () => { expect(blendFresh(5, 60, 5)).toBe(80) })
  })
  scenario('放越久越不新鮮，冷凍最慢、常溫最快', ({ then }) => {
    then('同樣放 30 分鐘，冷凍的比冷藏的新鮮，冷藏的又比常溫的新鮮', () => {
      const frozen = ageFresh('Saury', 100, 30), chilled = ageFresh('Yakitori', 100, 30), ambient = ageFresh('Potato', 100, 30)
      expect(frozen).toBeGreaterThan(chilled)
      expect(chilled).toBeGreaterThan(ambient)
    })
  })
  scenario('冷凍櫃設得越冷，冷凍食材壞得越慢；蓋子開著回溫，壞得很快', ({ when, then, and }) => {
    when('秋刀魚在冷凍櫃放 60 分鐘，櫃內分別是 -25、-20、-15 度，和蓋子開著回溫到 -5 度', (w) => {
      w.at = [-25, -20, -15, -5].map((t) => ageFresh('Saury', 100, 60, t))
    })
    then('越冷越新鮮', (w) => {
      expect(w.at[0]).toBeGreaterThan(w.at[1])
      expect(w.at[1]).toBeGreaterThan(w.at[2])
      expect(w.at[2]).toBeGreaterThan(w.at[3])
    })
    and('每冷 5 度壞的速度減半、每暖 5 度加倍', () => {
      expect(frozenRate(-20)).toBe(1)
      expect(frozenRate(-25)).toBeCloseTo(0.5)
      expect(frozenRate(-15)).toBeCloseTo(2)
    })
    and('冷藏、常溫的東西不受冷凍櫃溫度影響', () => {
      expect(ageFresh('Yakitori', 100, 30, -5)).toBe(ageFresh('Yakitori', 100, 30, -25))
    })
  })
  scenario('放太久會壞到不能吃', ({ then, and }) => {
    then('一直放下去，鮮度會掉到 0', () => { expect(ageFresh('Potato', 100, 100000)).toBe(0) })
    and(`低於 ${INEDIBLE} 就是不能吃`, () => {
      expect(freshGrade(90)).toBe('fresh')
      expect(freshGrade(60)).toBe('good')
      expect(freshGrade(INEDIBLE)).toBe('tired')
      expect(freshGrade(INEDIBLE - 1)).toBe('spoiled')
    })
  })
  scenario('越不新鮮越難吃，壞掉的更難吃', ({ then, and }) => {
    then('全新鮮保留全部味道，剛好還能吃時剩約四分之三', () => {
      expect(freshFactor(100)).toBe(1)
      expect(freshFactor(INEDIBLE)).toBeCloseTo(0.75)
    })
    and('壞透了只剩兩成', () => { expect(freshFactor(0)).toBeCloseTo(0.2) })
    and('越壞越難吃', () => { expect(freshFactor(10)).toBeLessThan(freshFactor(INEDIBLE - 1)) })
  })
  scenario('能吃的不會拉肚子，壞掉的容易拉肚子', ({ then, and }) => {
    then('還能吃的，不會讓客人拉肚子', () => {
      expect(sickChance(100)).toBe(0)
      expect(sickChance(INEDIBLE)).toBe(0)
    })
    and('剛壞的就有四分之一的機會，壞透的大多會', () => {
      expect(sickChance(INEDIBLE - 0.01)).toBeGreaterThanOrEqual(0.25)
      expect(sickChance(0)).toBeGreaterThan(0.8)
    })
  })
})
