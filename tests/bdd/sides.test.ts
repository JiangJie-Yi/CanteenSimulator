import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { beatAt, beatsLength, fillAt, RICE_BEATS, sideChance, SOUP_BEATS } from '@/game/sides'

// (items 205, 206, the owner's, 2026-11-16: 「我看客人都沒叫白飯跟味噌湯」「打飯的動畫？我要看到好的動畫品質」)
feature('白飯與味噌湯（第 205、206 項）', () => {
  scenario('點了烤魚的客人多半加點白飯與味噌湯，只點串燒的少一些', ({ then, and }) => {
    then('點了秋刀魚：七成加白飯、六成加味噌湯', () => {
      expect(sideChance('rice', ['Saury', 'Shishito'])).toBe(0.7)
      expect(sideChance('soup', ['Saury'])).toBe(0.6)
    })
    and('只點雞肉串與年糕：白飯三成五、味噌湯三成', () => {
      expect(sideChance('rice', ['Yakitori', 'NetMochi'])).toBe(0.35)
      expect(sideChance('soup', ['Yakitori'])).toBe(0.3)
    })
  })

  scenario('盛一碗白飯：掀鍋蓋、拿碗、拿飯匙、盛兩匙、拍一拍、放回飯匙、蓋回鍋蓋', ({ then, and }) => {
    then('一共 4 秒左右，照這個順序', () => {
      expect(RICE_BEATS.map(([b]) => b)).toEqual(['lid', 'bowl', 'paddle', 'scoop', 'scoop', 'pat', 'paddleBack', 'lidOn'])
      expect(beatsLength(RICE_BEATS)).toBeCloseTo(4.05, 5)
    })
    and('第 1.5 秒在盛第一匙，第 2.3 秒在盛第二匙', () => {
      expect(beatAt(RICE_BEATS, 1.5)).toMatchObject({ beat: 'scoop', n: 0 })
      expect(beatAt(RICE_BEATS, 2.3)).toMatchObject({ beat: 'scoop', n: 1 })
    })
    and('碗是一匙一匙滿的：盛之前空的，第一匙倒下去以後半碗，第二匙以後一整碗', () => {
      expect(fillAt(RICE_BEATS, 'scoop', 1.0)).toBe(0)
      expect(fillAt(RICE_BEATS, 'scoop', 2.0)).toBeCloseTo(0.5, 5)
      expect(fillAt(RICE_BEATS, 'scoop', 3.0)).toBe(1)
      expect(fillAt(RICE_BEATS, 'scoop', 99)).toBe(1)
    })
  })

  scenario('盛一碗味噌湯：拿碗、拿湯杓、舀兩杓倒進碗裡、放回湯杓', ({ then, and }) => {
    then('照這個順序', () => {
      expect(SOUP_BEATS.map(([b]) => b)).toEqual(['bowl', 'ladle', 'dip', 'pour', 'dip', 'pour', 'ladleBack'])
    })
    and('倒第一杓的時候湯面一點一點升到一半，倒完兩杓是滿的', () => {
      const pour1 = SOUP_BEATS.slice(0, 3).reduce((s, [, d]) => s + d, 0)
      expect(fillAt(SOUP_BEATS, 'pour', pour1)).toBe(0)
      const mid = fillAt(SOUP_BEATS, 'pour', pour1 + 0.55 * 0.6)
      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThan(0.5)
      expect(fillAt(SOUP_BEATS, 'pour', pour1 + 0.55)).toBeCloseTo(0.5, 5)
      expect(fillAt(SOUP_BEATS, 'pour', beatsLength(SOUP_BEATS))).toBe(1)
    })
  })
})
