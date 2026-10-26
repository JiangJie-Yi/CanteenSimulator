import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DISHES } from '@/data/menu'
import { PAR, REORDER_AT, restockOrder, topUpOrder, goodsOf, costOf, type Stock } from '@/game/economy'
import type { Entry } from '@/data/recipes'

const grill = DISHES.find((d) => d.id === 'grilledfish')!
const entryOf = (id: string): Entry => ({ key: id, shop: 'grilledfish', name: id, ja: id, price: 100, parts: [{ id, dabs: [], name: id, ja: id }] })

feature('倉儲自動補貨', () => {
  scenario('庫存快用完的品項會被補到標準量', ({ given, when, then }) => {
    given('菜單只有一道魚，庫存只剩 1 份', (w) => {
      w.id = grill.items[0].id
      w.menu = [entryOf(w.id)]
      w.stock = { [w.id]: 1 } as Stock
    })
    when('倉儲員在錢夠的時候下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('補到標準量 PAR', (w) => { expect(w.o.buy[w.id]).toBe(PAR - 1) })
  })

  scenario('庫存還夠的品項不補', ({ given, when, then }) => {
    given('庫存高於補貨門檻', (w) => { w.id = grill.items[0].id; w.menu = [entryOf(w.id)]; w.stock = { [w.id]: REORDER_AT + 2 } as Stock })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('什麼都不買', (w) => { expect(w.o.buy).toEqual({}); expect(w.o.cost).toBe(0) })
  })

  scenario('錢不夠時不會下超過現金的單', ({ given, when, then }) => {
    given('菜單上有好幾道魚，庫存全空，口袋只有 50 元', (w) => {
      w.menu = grill.items.slice(0, 6).map((i) => entryOf(i.id)); w.stock = {} as Stock
    })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 50, 60) })
    then('下單的總額不超過 50 元', (w) => { expect(w.o.cost).toBeLessThanOrEqual(50) })
  })

  scenario('一鍵補貨把所有商品補到 PAR，已經超過的不動', ({ given, when, then, and }) => {
    given('一樣商品庫存已經超過 PAR，其他都是空的', (w) => { w.rich = goodsOf(grill)[0].id; w.stock = { [w.rich]: PAR + 5 } as Stock })
    when('一鍵補貨', (w) => { w.o = topUpOrder(grill, w.stock) })
    then('庫存超過的那樣不再買', (w) => { expect(w.o.buy[w.rich]).toBeUndefined() })
    and('其他每樣都補到 PAR，總價是它們成本的總和', (w) => {
      const rest = goodsOf(grill).filter((g) => g.id !== w.rich)
      for (const g of rest) expect(w.o.buy[g.id]).toBe(PAR)
      expect(w.o.cost).toBe(rest.reduce((t, g) => t + costOf(g) * PAR, 0))
    })
  })
})
