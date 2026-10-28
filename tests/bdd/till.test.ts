import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BUSY_QUEUE, breakDown, deposit, drawerOpens, drawerTotal, openingFloat, paysByCard, tabletActive, takeOut } from '@/game/till'

feature('收銀櫃的平板與付款方式', () => {
  scenario('平時平板不啟用', ({ given, then }) => {
    given('只有一組客人排隊結帳、付現金', (w) => { w.on = tabletActive(1, false) })
    then('平板不啟用', (w) => { expect(w.on).toBe(false) })
  })

  scenario('排隊結帳到 3 組以上時平板啟用', ({ when, then, but }) => {
    when('排隊的客人有 3 組', (w) => { w.on = tabletActive(BUSY_QUEUE, false) })
    then('平板啟用，當第二台收銀', (w) => { expect(BUSY_QUEUE).toBe(3); expect(w.on).toBe(true) })
    but('只有 2 組時不啟用', () => { expect(tabletActive(2, false)).toBe(false) })
  })

  scenario('客人刷卡時平板啟用，錢櫃不打開', ({ given, then, and }) => {
    given('一位刷卡的客人', (w) => { w.card = true })
    then('平板啟用', (w) => { expect(tabletActive(0, w.card)).toBe(true) })
    and('收銀機的錢櫃不彈出', (w) => { expect(drawerOpens(w.card)).toBe(false); expect(drawerOpens(false)).toBe(true) })
  })

  scenario('大約四成客人刷卡，同一位客人每次都一樣', ({ when, then }) => {
    when('看 1000 位客人', (w) => { w.cards = Array.from({ length: 1000 }, (_, i) => paysByCard(i + 1)).filter(Boolean).length })
    then('刷卡的在三到五成之間，且結果固定', (w) => {
      expect(w.cards).toBeGreaterThan(300)
      expect(w.cards).toBeLessThan(500)
      expect(paysByCard(7)).toBe(paysByCard(7))
    })
  })
})

feature('老闆從收銀機抽屜拿錢', () => {
  scenario('開店時抽屜裡有零錢，沒有萬元鈔', ({ given, then }) => {
    given('一天開始的抽屜', (w) => { w.d = openingFloat() })
    then('有一些零錢，萬元鈔是 0 張', (w) => { expect(drawerTotal(w.d)).toBeGreaterThan(0); expect(w.d[10000]).toBe(0) })
  })

  scenario('付現的客人結帳後，帳單金額進抽屜', ({ given, when, then }) => {
    given('一天開始的抽屜', (w) => { w.d = openingFloat(); w.before = drawerTotal(w.d) })
    when('客人付了 1,140 元的帳', (w) => { w.d = deposit(w.d, 1140) })
    then('抽屜多了 1,140 元，用最少的鈔票和硬幣', (w) => {
      expect(drawerTotal(w.d) - w.before).toBe(1140)
      expect(breakDown(1140)).toMatchObject({ 1000: 1, 100: 1, 10: 4 })
    })
  })

  scenario('老闆點一格，整格的錢拿走，加到總金額', ({ given, when, then, and }) => {
    given('抽屜裡有 8 張千元鈔', (w) => { w.d = openingFloat() })
    when('老闆點千元鈔那格', (w) => { const r = takeOut(w.d, 1000); w.d2 = r.drawer; w.amount = r.amount })
    then('拿到 8,000 元', (w) => { expect(w.amount).toBe(8000) })
    and('那格空了，其他格不變', (w) => {
      expect(w.d2[1000]).toBe(0)
      expect(w.d2[500]).toBe(w.d[500])
      expect(drawerTotal(w.d) - drawerTotal(w.d2)).toBe(8000)
    })
  })

  scenario('空的格子拿不到錢', ({ when, then }) => {
    when('老闆點空的萬元鈔那格', (w) => { w.r = takeOut(openingFloat(), 10000) })
    then('拿到 0 元', (w) => { expect(w.r.amount).toBe(0) })
  })
})
