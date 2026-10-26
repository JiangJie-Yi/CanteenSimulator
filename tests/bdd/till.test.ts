import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BUSY_QUEUE, drawerOpens, paysByCard, tabletActive } from '@/game/till'

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
