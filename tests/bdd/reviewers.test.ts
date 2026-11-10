import { expect } from 'vitest'
import { reviewerName, reviewerNames, reviewerProfile, REVIEWER_NAMES } from '@/data/reviewers'
import { guestLabel } from '@/data/guests'
import { initialOf } from '@/game/avatars'
import { feature, scenario } from './bdd'

feature('評價上的名字：像地圖 App 的評論，每位客人有自己的名字，類型只是小標註', () => {
  scenario('同一位客人每次看到的都是同一個名字', ({ given, then }) => {
    given('客人 42', (w) => { w.a = reviewerName(42); w.b = reviewerName(42) })
    then('兩次一樣', (w) => { expect(w.a).toBe(w.b) })
  })
  scenario('店在大阪：寫評論的大多是日本人，其他是台灣與更遠來的客人', ({ given, then, and }) => {
    given('客人 1～400 的名字', (w) => { w.names = Array.from({ length: 400 }, (_, i) => reviewerName(i + 1)) })
    then('約四分之三是日本人', (w) => {
      const jp = (w.names as string[]).filter((n) => REVIEWER_NAMES.japanese.includes(n)).length / 400
      expect(jp).toBeGreaterThan(0.68)
      expect(jp).toBeLessThan(0.84)
    })
    and('也有台灣與外國的客人', (w) => {
      const n = w.names as string[]
      expect(n.filter((x) => REVIEWER_NAMES.taiwanese.includes(x)).length).toBeGreaterThan(20)
      expect(n.filter((x) => REVIEWER_NAMES.foreign.includes(x)).length).toBeGreaterThan(20)
    })
    and('名字不是客人的類型', () => { expect(reviewerName(7)).not.toBe(guestLabel(7, 'zh')) })
  })
  scenario('名字很少重複：面板上一次看到的六位幾乎都不一樣', ({ given, then, and }) => {
    given('客人 1～300', (w) => { w.names = Array.from({ length: 300 }, (_, i) => reviewerName(i + 1)) })
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
      const a = 1, b = Array.from({ length: 2000 }, (_, i) => i + 2).find((i) => reviewerName(i) === reviewerName(a))!
      w.ids = [a, b, 3, 4, 5, 6]
      w.names = reviewerNames(w.ids as number[])
    })
    then('六個名字都不一樣', (w) => { expect(new Set(w.names as string[]).size).toBe(6) })
    and('第一位照舊是他自己的名字', (w) => { expect((w.names as string[])[0]).toBe(reviewerName(1)) })
  })
  scenario('頭貼上的字是名字的第一個字', ({ given, then }) => {
    given('客人 99 的名字', (w) => { w.name = reviewerName(99) })
    then('第一個字，英文的話大寫', (w) => { expect(initialOf(w.name as string)).toBe([...(w.name as string)][0].toUpperCase()) })
  })
  scenario('每位評論者有自己的檔案：約三分之一是在地嚮導，寫過的評論數各不同', ({ given, then, and }) => {
    given('客人 1～300 的檔案', (w) => { w.p = Array.from({ length: 300 }, (_, i) => reviewerProfile(i + 1)) })
    then('在地嚮導約三分之一', (w) => {
      const g = (w.p as ReturnType<typeof reviewerProfile>[]).filter((x) => x.guide).length / 300
      expect(g).toBeGreaterThan(0.25)
      expect(g).toBeLessThan(0.43)
    })
    and('在地嚮導寫過的評論比一般人多', (w) => {
      const p = w.p as ReturnType<typeof reviewerProfile>[]
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      expect(avg(p.filter((x) => x.guide).map((x) => x.reviews))).toBeGreaterThan(avg(p.filter((x) => !x.guide).map((x) => x.reviews)))
    })
    and('同一位每次一樣', () => { expect(reviewerProfile(5)).toEqual(reviewerProfile(5)) })
  })
})
