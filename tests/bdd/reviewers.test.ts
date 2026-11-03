import { expect } from 'vitest'
import { reviewerName, reviewerNames, REVIEWER_NAMES } from '@/data/reviewers'
import { guestLabel } from '@/data/guests'
import { initialOf } from '@/game/avatars'
import { feature, scenario } from './bdd'

feature('評價上的名字：像地圖 App 的評論，每位客人有自己的名字，類型只是小標註', () => {
  scenario('同一位客人每次看到的都是同一個名字', ({ given, then }) => {
    given('客人 42', (w) => { w.a = reviewerName(42, 'zh'); w.b = reviewerName(42, 'zh') })
    then('兩次一樣', (w) => { expect(w.a).toBe(w.b) })
  })
  scenario('名字跟著語言換，而且不是客人的類型', ({ given, then, and }) => {
    given('客人 7 在三種語言的名字', (w) => { w.n = (['zh', 'ja', 'en'] as const).map((l) => reviewerName(7, l)) })
    then('每種語言各一個名字，都在那種語言的名字裡', (w) => {
      const [zh, ja, en] = w.n as string[]
      expect(REVIEWER_NAMES.zh).toContain(zh)
      expect(REVIEWER_NAMES.ja).toContain(ja)
      expect(REVIEWER_NAMES.en).toContain(en)
    })
    and('不是「上班族」這種類型', (w) => { expect((w.n as string[])[0]).not.toBe(guestLabel(7, 'zh')) })
  })
  scenario('名字很少重複：面板上一次看到的六位幾乎都不一樣', ({ given, then, and }) => {
    given('客人 1～300', (w) => { w.names = Array.from({ length: 300 }, (_, i) => reviewerName(i + 1, 'zh')) })
    then('一百位裡至少 40 個不同的名字', (w) => { expect(new Set((w.names as string[]).slice(0, 100)).size).toBeGreaterThanOrEqual(40) })
    and('連續六位裡有重名的不到三成', (w) => {
      const n = w.names as string[]
      let dup = 0
      for (let i = 0; i + 6 <= n.length; i++) if (new Set(n.slice(i, i + 6)).size < 6) dup++
      expect(dup / (n.length - 5)).toBeLessThan(0.3)
    })
  })
  scenario('同一頁上的評論不會同名', ({ given, then, and }) => {
    given('兩位本來同名的客人與另外四位', (w) => {
      const a = 1, b = Array.from({ length: 500 }, (_, i) => i + 2).find((i) => reviewerName(i, 'zh') === reviewerName(a, 'zh'))!
      w.ids = [a, b, 3, 4, 5, 6]
      w.names = reviewerNames(w.ids as number[], 'zh')
    })
    then('六個名字都不一樣', (w) => { expect(new Set(w.names as string[]).size).toBe(6) })
    and('第一位照舊是他自己的名字', (w) => { expect((w.names as string[])[0]).toBe(reviewerName(1, 'zh')) })
  })
  scenario('頭貼上的字是名字的第一個字', ({ given, then }) => {
    given('客人 99 的名字', (w) => { w.name = reviewerName(99, 'en') })
    then('第一個字母，大寫', (w) => { expect(initialOf(w.name as string)).toBe([...(w.name as string)][0].toUpperCase()) })
  })
})
