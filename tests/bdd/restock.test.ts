import { GARNISH_GOODS, GARNISH_PAR, NORI, NORI_PAR } from '@/game/supplies'
import { expect } from 'vitest'
import { TISSUE, TISSUE_PACK } from '@/game/tissues'
import { ROLL, SOAP, TOWEL, WASHROOM_PACKS } from '@/game/washroom'
import { RECEIPT } from '@/game/receipts'
import { DISH_SOAP, HOUSEHOLD_PACK, TOILET_CLEANER } from '@/game/household'
import { feature, scenario } from './bdd'
import { DISHES } from '@/data/menu'
import { LEAN_PAR, PAR, REORDER_AT, SIDE_LOW, SIDE_PAR, inPacks, orderedLean, parOf, restockOrder, topUpOrder, goodsOf, costOf, type Stock } from '@/game/economy'
import { storageOf } from '@/data/storage'
import { CHARCOAL, SEASON_GOODS, SEASON_PAR } from '@/game/supplies'
import type { Entry } from '@/data/recipes'

const grill = DISHES.find((d) => d.id === 'grilledfish')!
/** the rice and the miso soup for the sides at a day's worth (item 207): nothing of them to order */
const SIDES_FULL: Stock = { ...SIDE_PAR }
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
    given('庫存高於補貨門檻（木炭、衛生紙、發票紙也還夠）', (w) => { w.id = grill.items[0].id; w.menu = [entryOf(w.id)]; w.stock = { [w.id]: REORDER_AT + 2, ...SIDES_FULL, [CHARCOAL]: 100, [RECEIPT]: 10, [TISSUE]: 10, [ROLL]: 20, [TOWEL]: 10, [SOAP]: 10, [DISH_SOAP]: 4, [TOILET_CLEANER]: 3 } as Stock })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('什麼都不買', (w) => { expect(w.o.buy).toEqual({}); expect(w.o.cost).toBe(0) })
  })

  scenario('衛生紙備品少於 4 盒時叫一組（5 盒）', ({ given, when, then }) => {
    given('食材、木炭、發票紙都夠，衛生紙備品只剩 2 盒', (w) => { w.id = grill.items[0].id; w.menu = [entryOf(w.id)]; w.stock = { [w.id]: REORDER_AT + 2, ...SIDES_FULL, [CHARCOAL]: 100, [RECEIPT]: 10, [TISSUE]: 2, [ROLL]: 20, [TOWEL]: 10, [SOAP]: 10, [DISH_SOAP]: 4, [TOILET_CLEANER]: 3 } as Stock })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('只叫一組衛生紙', (w) => { expect(w.o.buy).toEqual({ [TISSUE]: TISSUE_PACK.boxes }) })
  })

  scenario('洗手間的捲筒衛生紙備品少於 4 捲時叫一包（12 捲）', ({ given, when, then }) => {
    given('其他都夠，捲筒衛生紙只剩 2 捲', (w) => { w.id = grill.items[0].id; w.menu = [entryOf(w.id)]; w.stock = { [w.id]: REORDER_AT + 2, ...SIDES_FULL, [CHARCOAL]: 100, [RECEIPT]: 10, [TISSUE]: 10, [ROLL]: 2, [TOWEL]: 10, [SOAP]: 10, [DISH_SOAP]: 4, [TOILET_CLEANER]: 3 } as Stock })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('只叫一包捲筒衛生紙', (w) => { expect(w.o.buy).toEqual({ [ROLL]: WASHROOM_PACKS[ROLL].n }) })
  })

  // (item 203: they're used now, so they're ordered as they run low, as the washrooms' spares are)
  scenario('洗碗精或廁所清潔劑剩不到 2 瓶時叫一組', ({ given, when, then }) => {
    given('其他都夠，洗碗精剩 1 瓶、廁所清潔劑剩 3 瓶', (w) => { w.id = grill.items[0].id; w.menu = [entryOf(w.id)]; w.stock = { [w.id]: REORDER_AT + 2, ...SIDES_FULL, [CHARCOAL]: 100, [RECEIPT]: 10, [TISSUE]: 10, [ROLL]: 20, [TOWEL]: 10, [SOAP]: 10, [DISH_SOAP]: 1, [TOILET_CLEANER]: 3 } as Stock })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('只叫一組洗碗精', (w) => { expect(w.o.buy).toEqual({ [DISH_SOAP]: HOUSEHOLD_PACK[DISH_SOAP].bottles }) })
  })

  scenario('錢不夠時不會下超過現金的單', ({ given, when, then }) => {
    given('菜單上有好幾道魚，庫存全空，口袋只有 50 元', (w) => {
      w.menu = grill.items.slice(0, 6).map((i) => entryOf(i.id)); w.stock = {} as Stock
    })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 50, 60) })
    then('下單的總額不超過 50 元', (w) => { expect(w.o.cost).toBeLessThanOrEqual(50) })
  })

  scenario('一鍵補貨把所有商品補到 PAR、調味料補到常備量，已經超過的不動', ({ given, when, then, and }) => {
    given('一樣商品庫存已經超過 PAR，其他都是空的', (w) => { w.rich = goodsOf(grill)[0].id; w.stock = { [w.rich]: PAR + 5 } as Stock })
    when('一鍵補貨', (w) => { w.o = topUpOrder(grill, w.stock) })
    then('庫存超過的那樣不再買', (w) => { expect(w.o.buy[w.rich]).toBeUndefined() })
    and('其他每樣都補到 PAR，調味料各補到常備量，總價是它們成本的總和', (w) => {
      const rest = goodsOf(grill).filter((g) => g.id !== w.rich)
      // (the sides' rice and soup to a day's worth: item 207)
      for (const g of rest) expect(w.o.buy[g.id]).toBe(parOf(g.id))
      for (const g of SEASON_GOODS) expect(w.o.buy[g.id]).toBe(SEASON_PAR)
      // (and the nori, by the sheet, the eggs and the frying oil (item 461), each to its own usual stock)
      expect(w.o.buy[NORI]).toBe(NORI_PAR)
      for (const g of GARNISH_GOODS) expect(w.o.buy[g.id]).toBe(GARNISH_PAR[g.id])
      expect(w.o.cost).toBe(rest.reduce((t, g) => t + costOf(g) * parOf(g.id), 0) + SEASON_GOODS.reduce((t, g) => t + costOf(g) * SEASON_PAR, 0)
        + GARNISH_GOODS.reduce((t, g) => t + costOf(g) * GARNISH_PAR[g.id], 0))
    })
  })

  // (item 207: kept to PAR, ten portions, like any good, a pot of rice was cooked with what rice there was (three bowls' worth, the cooker
  // holding twenty), and the miso was never ordered at all, not being on the menu board: in a rush three of twenty-one who'd asked for rice had
  // it, one of ten their soup)
  scenario('白飯與味噌湯照一天的量備，不到一鍋就叫（第 207 項）', ({ given, when, then, and }) => {
    given(`菜單只有一道魚；白米剩 ${SIDE_LOW.Onigiri - 5} 份、味噌湯剩 ${SIDE_LOW.MisoSoup - 2} 份（都不到一鍋）`, (w) => {
      w.id = grill.items[0].id
      w.menu = [entryOf(w.id)]
      w.stock = { [w.id]: PAR, Onigiri: SIDE_LOW.Onigiri - 5, MisoSoup: SIDE_LOW.MisoSoup - 2 } as Stock
    })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then(`白米補到兩鍋（${SIDE_PAR.Onigiri} 份，整袋買）`, (w) => { expect(w.o.buy.Onigiri).toBe(inPacks('Onigiri', SIDE_PAR.Onigiri - (SIDE_LOW.Onigiri - 5))) })
    and(`味噌湯補到三鍋（${SIDE_PAR.MisoSoup} 份）`, (w) => { expect(w.o.buy.MisoSoup).toBe(SIDE_PAR.MisoSoup - (SIDE_LOW.MisoSoup - 2)) })
  })
  scenario('還有一鍋以上就不叫', ({ given, when, then }) => {
    given('白米、味噌湯都剛好一鍋', (w) => {
      w.id = grill.items[0].id
      w.menu = [entryOf(w.id)]
      w.stock = { [w.id]: PAR, Onigiri: SIDE_LOW.Onigiri, MisoSoup: SIDE_LOW.MisoSoup } as Stock
    })
    when('倉儲員下單', (w) => { w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60) })
    then('不叫白米與味噌湯', (w) => { expect(w.o.buy.Onigiri).toBeUndefined(); expect(w.o.buy.MisoSoup).toBeUndefined() })
  })
  scenario('一鍵補滿也補到一天的量', ({ when, then }) => {
    when('什麼都沒有時按「補滿」', (w) => { w.o = topUpOrder(grill, {}) })
    then('白米與味噌湯補到一天的量', (w) => { expect(w.o.buy.Onigiri).toBe(SIDE_PAR.Onigiri); expect(w.o.buy.MisoSoup).toBe(SIDE_PAR.MisoSoup) })
  })
})

feature('會壞的東西不囤（第 343 項）', () => {
  scenario('冷藏的備三份、常溫的兩份，用到剩一份才再叫；冷凍的照舊備到十份', ({ given, then, and }) => {
    given('菜單上一樣冷藏、一樣常溫、一樣冷凍的，各只剩一份', (w) => {
      const lean = grill.items.filter((x) => orderedLean(x.id))
      w.chilled = lean.find((x) => storageOf(x.id) === 'chilled')!.id
      w.ambient = lean.find((x) => storageOf(x.id) === 'ambient')!.id
      w.frozen = grill.items.find((x) => storageOf(x.id) === 'frozen')!.id
      w.menu = [entryOf(w.chilled), entryOf(w.ambient), entryOf(w.frozen)]
      w.stock = { [w.chilled]: 1, [w.ambient]: 1, [w.frozen]: 1, ...SIDES_FULL } as Stock
      w.o = restockOrder(grill, w.menu, w.stock, 1e9, 60)
    })
    then('冷藏的補到三份', (w) => { expect(w.o.buy[w.chilled]).toBe(LEAN_PAR.chilled - 1) })
    and('常溫的補到兩份', (w) => { expect(w.o.buy[w.ambient]).toBe(LEAN_PAR.ambient - 1) })
    and('冷凍的照舊補到十份', (w) => { expect(w.o.buy[w.frozen]).toBe(PAR - 1) })
  })
  scenario('會壞的還有兩份就不叫', ({ given, then }) => {
    given('冷藏的剩兩份', (w) => {
      w.chilled = grill.items.filter((x) => orderedLean(x.id)).find((x) => storageOf(x.id) === 'chilled')!.id
      w.o = restockOrder(grill, [entryOf(w.chilled)], { [w.chilled]: 2, ...SIDES_FULL } as Stock, 1e9, 60)
    })
    then('不叫', (w) => { expect(w.o.buy[w.chilled] ?? 0).toBe(0) })
  })
})

feature('會壞的照用量備（第 343 項）', () => {
  scenario('上一輪到這一輪用掉很多：下一輪備一輪半的量，最多十份', ({ given, then, and }) => {
    given('一樣冷藏的，上一輪用掉 6 份，現在剩一份', (w) => {
      w.chilled = grill.items.filter((x) => orderedLean(x.id)).find((x) => storageOf(x.id) === 'chilled')!.id
      w.o = restockOrder(grill, [entryOf(w.chilled)], { [w.chilled]: 1, ...SIDES_FULL } as Stock, 1e9, 60, { [w.chilled]: 6 })
      w.o2 = restockOrder(grill, [entryOf(w.chilled)], { [w.chilled]: 1, ...SIDES_FULL } as Stock, 1e9, 60, { [w.chilled]: 20 })
    })
    then('補到九份（六份的一倍半）', (w) => { expect(w.o.buy[w.chilled]).toBe(9 - 1) })
    and('用量再多也不超過十份', (w) => { expect(w.o2.buy[w.chilled]).toBe(PAR - 1) })
  })
})
