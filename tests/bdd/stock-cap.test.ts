import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DISHES } from '@/data/menu'
import { averageOrder, eachOrder, roomFor, STOCK_CAP, topUpOrder, goodsOf, type Stock } from '@/game/economy'
import { CHARCOAL, NORI, seasonId } from '@/game/supplies'

const grill = DISHES.find((d) => d.id === 'grilledfish')!
const fish = grill.items[0].id

feature('庫存容量', () => {
  scenario('一樣食材最多放 100 份', ({ given, then, and }) => {
    given('上限是 100', () => { expect(STOCK_CAP).toBe(100) })
    then('還有 95 份時只放得下 5 份', () => { expect(roomFor(fish, 95)).toBe(5) })
    and('放滿了就放不下', () => { expect(roomFor(fish, 100)).toBe(0) })
    and('以前沒有上限、超過的（691 份）也一樣放不下，但不會被拿走', () => { expect(roomFor(fish, 691)).toBe(0) })
  })

  scenario('白米以袋計，只放得下整袋', ({ then, and }) => {
    then('還有 85 份（空 15 份）時放得下一袋 10 份', () => { expect(roomFor('Onigiri', 85)).toBe(10) })
    and('還有 95 份時一袋也放不下', () => { expect(roomFor('Onigiri', 95)).toBe(0) })
  })

  scenario('調味料、海苔、木炭不算在這個上限裡', ({ then }) => {
    then('它們永遠放得下', () => {
      expect(roomFor(seasonId('salt'), 500)).toBe(Infinity)
      expect(roomFor(NORI, 500)).toBe(Infinity)
      expect(roomFor(CHARCOAL, 500)).toBe(Infinity)
    })
  })

  scenario('各補 5 的時候，滿的不補、快滿的只補到滿', ({ given, when, then, and }) => {
    given('一樣魚有 98 份、另一樣已經 100 份', (w) => {
      w.a = goodsOf(grill)[0].id; w.b = goodsOf(grill)[1].id
      w.stock = { [w.a]: 98, [w.b]: 100 } as Stock
    })
    when('各補 5', (w) => { w.o = eachOrder(grill, 5, w.stock) })
    then('98 份的只補 2 份', (w) => { expect(w.o.buy[w.a]).toBe(2) })
    and('滿的那樣不補', (w) => { expect(w.o.buy[w.b]).toBeUndefined() })
  })

  scenario('補到平均、補滿都不會超過上限', ({ given, when, then }) => {
    given('一樣魚已經 100 份，其他都沒有', (w) => { w.stock = { [fish]: 100 } as Stock })
    when('補到平均、補滿', (w) => { w.avg = averageOrder(grill, w.stock); w.top = topUpOrder(grill, w.stock) })
    then('那樣魚兩種補法都不再買', (w) => { expect(w.avg.buy[fish]).toBeUndefined(); expect(w.top.buy[fish]).toBeUndefined() })
  })
})
