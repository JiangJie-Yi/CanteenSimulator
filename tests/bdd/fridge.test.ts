import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DISHES } from '@/data/menu'
import { storageOf } from '@/data/storage'
import { PAR, averageOrder, eachOrder, goodsOf, topUpOrder, type Stock } from '@/game/economy'

const grill = DISHES.find((d) => d.id === 'grilledfish')!

feature('食材櫃分冷凍、冷藏、常溫', () => {
  scenario('魚和海鮮放冷凍', ({ then }) => {
    then('秋刀魚、紅喉、蝦串都是冷凍', () => { for (const id of ['Saury', 'Nodoguro', 'ShrimpSkewer']) expect(storageOf(id)).toBe('frozen') })
  })
  scenario('清酒不放冷凍也不放冷藏', ({ then }) => {
    then('清酒是常溫', () => { expect(storageOf('Sake')).toBe('ambient') })
  })
  scenario('肉串和蔬菜放冷藏', ({ then }) => {
    then('雞肉串、青椒是冷藏', () => { for (const id of ['Yakitori', 'Shishito']) expect(storageOf(id)).toBe('chilled') })
  })
  scenario('每樣食材都有地方放', ({ then }) => {
    then('都屬於三區之一', () => { for (const g of goodsOf(grill)) expect(['frozen', 'chilled', 'ambient']).toContain(storageOf(g.id)) })
  })
})

feature('三個補貨鍵', () => {
  scenario('補到平均：低於平均的拉到平均，其他不動', ({ given, when, then, and }) => {
    given('有的食材很多，有的很少', (w) => {
      const goods = goodsOf(grill)
      w.stock = Object.fromEntries(goods.map((g, i) => [g.id, i % 2 ? 12 : 2])) as Stock
      w.goods = goods
    })
    when('按「補到平均」', (w) => { w.o = averageOrder(grill, w.stock) })
    then('少的補到平均', (w) => {
      for (const g of w.goods) if (w.stock[g.id] < w.o.avg) expect(w.stock[g.id] + w.o.buy[g.id]).toBe(w.o.avg)
    })
    and('本來就多的不買', (w) => { for (const g of w.goods) if (w.stock[g.id] >= w.o.avg) expect(w.o.buy[g.id]).toBeUndefined() })
  })
  scenario('各補 5：每樣都多 5 份', ({ when, then }) => {
    when('按「各補 5」', (w) => { w.o = eachOrder(grill, 5) })
    then('每樣都買 5 份', (w) => { for (const g of goodsOf(grill)) expect(w.o.buy[g.id]).toBe(5) })
  })
  scenario('補滿：每樣補到標準量', ({ given, when, then }) => {
    given('庫存全空', (w) => { w.stock = {} as Stock })
    when('按「補滿」', (w) => { w.o = topUpOrder(grill, w.stock) })
    then(`每樣都補到 ${PAR}`, (w) => { for (const g of goodsOf(grill)) expect(w.o.buy[g.id]).toBe(PAR) })
  })
})
