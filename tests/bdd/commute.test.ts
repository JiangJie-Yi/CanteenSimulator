import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { commuteOf, delayOf, lineOf, paceOf, talkersOf, yieldTo } from '@/game/commute'
import { CLOSE_DORM, CLOSE_HOME, OPEN_DORM, OPEN_HOME } from '@/data/commuteLines'

feature('打烊與開店：員工上下班', () => {
  scenario('老闆與廚師住樓上，其他人回家', ({ then, and }) => {
    then('老闆、廚師走員工門上樓', () => { expect(commuteOf('owner')).toBe('dorm'); expect(commuteOf('chef')).toBe('dorm') })
    and('外場、收銀、倉儲、三廚從大門回家', () => { for (const r of ['server', 'cashier', 'stock', 'sous']) expect(commuteOf(r)).toBe('home') })
  })

  scenario('不會同一秒一起走：每人收尾的時間與步速不同', ({ given, then, and }) => {
    given('六位員工', (w) => { w.ids = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'] })
    then('每人收尾 0.5～4 秒，而且不是全都一樣', (w) => {
      const d = w.ids.map((id: string) => delayOf(id))
      for (const x of d) { expect(x).toBeGreaterThanOrEqual(0.5); expect(x).toBeLessThanOrEqual(4) }
      expect(new Set(d.map((x: number) => x.toFixed(2))).size).toBeGreaterThan(3)
    })
    and('步速在九成到一點一倍之間', (w) => { for (const id of w.ids) { const p = paceOf(id); expect(p).toBeGreaterThanOrEqual(0.9); expect(p).toBeLessThanOrEqual(1.1) } })
    and('同一個人每天收尾的時間不同、步速一樣', () => { expect(delayOf('a1', 1)).not.toBe(delayOf('a1', 2)); expect(paceOf('a1')).toBe(paceOf('a1')) })
  })

  scenario('前面有人就放慢禮讓，不會疊在一起', ({ then, and }) => {
    then('就在正前方：幾乎停下來等', () => { expect(yieldTo(0.2, 1)).toBeLessThan(0.2) })
    and('前面一小段：放慢保持距離', () => { expect(yieldTo(0.5, 0.9)).toBe(0.5) })
    and('在旁邊或後面：照常走', () => { expect(yieldTo(0.3, 0)).toBe(1); expect(yieldTo(0.3, -1)).toBe(1) })
  })

  scenario('寒暄只有一兩句，每人說的不一樣', ({ given, then, and }) => {
    given('四位要回家的員工', (w) => { w.ids = ['s1', 's2', 'c1', 'k1'] })
    then('說話的是一到兩位', (w) => { for (let day = 0; day < 20; day++) { const n = talkersOf(w.ids, day).length; expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(2) } })
    and('每天不一定是同一位', (w) => { expect(new Set(Array.from({ length: 20 }, (_, d) => talkersOf(w.ids, d)[0])).size).toBeGreaterThan(1) })
    and('台詞都從池子裡挑、中日英都有', () => {
      for (const pool of [CLOSE_HOME, CLOSE_DORM, OPEN_DORM, OPEN_HOME]) {
        for (const lang of ['zh', 'ja', 'en'] as const) { expect(pool[lang].length).toBeGreaterThan(1); expect(pool[lang]).toContain(lineOf(pool[lang], 0, 3)) }
      }
    })
    and('同一天說話的兩位不會說同一句', () => { for (let day = 0; day < 20; day++) expect(lineOf(CLOSE_HOME.zh, 0, day)).not.toBe(lineOf(CLOSE_HOME.zh, 1, day)) })
  })
})
