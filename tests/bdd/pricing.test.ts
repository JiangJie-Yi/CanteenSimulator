import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ALL_DISHES } from '@/data/menu'
import { suggestPrice, MENU_MAX, MENU_MIN } from '@/data/recipes'
import { buyAllCost, costOf, goodsOf, supplierDiscount } from '@/game/economy'

feature('成本與定價', () => {
  scenario('建議售價永遠比成本高，而且是 5 元的倍數', ({ when, then }) => {
    when('對各種成本求建議售價', (w) => { w.rows = [1, 7, 33, 80, 150, 400].map((c) => [c, suggestPrice(c)]) })
    then('售價大於成本、是 5 的倍數、至少 10 元', (w) => {
      for (const [c, p] of w.rows as [number, number][]) { expect(p).toBeGreaterThan(c * 1.5); expect(p % 5).toBe(0); expect(p).toBeGreaterThanOrEqual(10) }
    })
  })

  scenario('每間店賣的每樣東西都有正的成本', ({ given, then }) => {
    given('四間店的全部商品', (w) => { w.goods = ALL_DISHES.flatMap((d) => goodsOf(d)) })
    then('每一樣的成本都大於 0 且低於它的售價', (w) => {
      for (const g of w.goods as ReturnType<typeof goodsOf>) { expect(costOf(g)).toBeGreaterThan(0); expect(costOf(g)).toBeLessThan(g.price) }
    })
  })

  scenario('全買 n 份的成本隨份數線性增加', ({ given, when, then }) => {
    given('日式烤魚店', (w) => { w.d = ALL_DISHES.find((d) => d.id === 'grilledfish')! })
    when('分別全買 1 份和 3 份', (w) => { w.one = buyAllCost(w.d, 1); w.three = buyAllCost(w.d, 3) })
    then('3 份是 1 份的 3 倍', (w) => { expect(w.three).toBe(w.one * 3) })
  })

  scenario('倉儲員越熟練，進貨折扣越高，但最多 5%', ({ when, then }) => {
    when('看技能 0、60、80、100 的折扣', (w) => { w.off = [0, 60, 80, 100].map(supplierDiscount) })
    then('新手沒有折扣，折扣隨技能增加，上限 5%', (w) => {
      const o = w.off as number[]
      expect(o[0]).toBe(0)
      expect(o[2]).toBeGreaterThan(o[1])
      expect(Math.max(...o)).toBeLessThanOrEqual(0.05)
    })
  })

  scenario('開店要有足夠的菜，菜單也有上限', ({ then }) => {
    then('每間店至少要 10 道才能開，最多 40 道', () => {
      for (const d of ALL_DISHES) expect(MENU_MIN[d.id]).toBeGreaterThanOrEqual(1)
      expect(MENU_MAX).toBeGreaterThan(Math.max(...Object.values(MENU_MIN)))
    })
  })
})
