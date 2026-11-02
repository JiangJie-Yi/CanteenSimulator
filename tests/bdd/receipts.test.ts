import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { RECEIPT, RECEIPT_LOW, RECEIPT_PACK, RECEIPT_START, ROLL_SLIPS, printSlip, receiptOrder } from '@/game/receipts'
import { startingSupplies } from '@/game/supplies'
import { GRIPE_COST, rateShop, satisfaction, type Visit } from '@/game/reputation'
import { restockOrder } from '@/game/economy'
import { DISHES } from '@/data/menu'
import type { Entry } from '@/data/recipes'

const grill = DISHES.find((d) => d.id === 'grilledfish')!
const menu: Entry[] = [{ key: 'x', shop: 'grilledfish', name: 'x', ja: 'x', price: 100, parts: [{ id: grill.items[0].id, dabs: [], name: 'x', ja: 'x' }] }]

feature('發票紙是耗材：每位客人結帳印一張，印表機的紙用完換一捲備品', () => {
  scenario(`新開的店：印表機裝著一捲（${ROLL_SLIPS} 張），另有 ${RECEIPT_START} 捲備品`, ({ given, then }) => {
    given('一間新開的店', (w) => { w.stock = startingSupplies() })
    then(`備品有 ${RECEIPT_START} 捲`, (w) => { expect(w.stock[RECEIPT]).toBe(RECEIPT_START) })
  })

  scenario('每位客人結帳印一張發票：印表機的紙少一張，備品不動', ({ when, then, and }) => {
    when('一捲全新的紙印了一張', (w) => { w.r = printSlip(ROLL_SLIPS, 5) })
    then('印出來了', (w) => { expect(w.r.printed).toBe(true) })
    and(`印表機剩 ${ROLL_SLIPS - 1} 張`, (w) => { expect(w.r.roll).toBe(ROLL_SLIPS - 1) })
    and('備品還是 5 捲、沒有換紙', (w) => { expect(w.r.spares).toBe(5); expect(w.r.changed).toBe(false) })
  })

  scenario('印表機的紙用完了：收銀員換上一捲備品，再印這一張', ({ when, then, and }) => {
    when('紙只剩 0 張時要印一張，還有 2 捲備品', (w) => { w.r = printSlip(0, 2) })
    then('換了紙、印出來了', (w) => { expect(w.r.changed).toBe(true); expect(w.r.printed).toBe(true) })
    and('備品少一捲', (w) => { expect(w.r.spares).toBe(1) })
    and(`新的那一捲印了這張，剩 ${ROLL_SLIPS - 1} 張`, (w) => { expect(w.r.roll).toBe(ROLL_SLIPS - 1) })
  })

  scenario('紙用完、也沒有備品：開不出發票', ({ when, then, and }) => {
    when('紙只剩 0 張、備品也是 0 捲', (w) => { w.r = printSlip(0, 0) })
    then('印不出來', (w) => { expect(w.r.printed).toBe(false) })
    and('什麼都沒少', (w) => { expect(w.r.roll).toBe(0); expect(w.r.spares).toBe(0) })
  })

  scenario('沒拿到發票的客人有點不滿：評價比拿到的低一點，影響服務分', ({ given, when, then, and }) => {
    given('兩位吃到一樣好吃、一樣快上菜的客人', (w) => {
      w.ok = { id: 1, taste: 80, waited: 30, walkedOut: false, gripes: [] } satisfies Visit
      w.no = { id: 2, taste: 80, waited: 30, walkedOut: false, gripes: ['receipt'] } satisfies Visit
    })
    when('一位拿到發票、一位沒拿到', (w) => { w.a = satisfaction(w.ok); w.b = satisfaction(w.no) })
    then('沒拿到的滿意度少一些', (w) => { expect(w.a - w.b).toBe(GRIPE_COST.receipt) })
    and('只是小小的不滿（比等太久、沒衛生紙都輕）', (w) => { expect(GRIPE_COST.receipt).toBeLessThan(GRIPE_COST.tissue); expect(GRIPE_COST.receipt).toBeLessThan(GRIPE_COST.wait) })
    and('服務分比較低', (w) => { expect(rateShop([w.no]).service!).toBeLessThan(rateShop([w.ok]).service!) })
  })

  scenario(`發票紙一組 ${RECEIPT_PACK.rolls} 捲、NT$${RECEIPT_PACK.cost}`, ({ when, then }) => {
    when('訂兩組', (w) => { w.o = receiptOrder(2) })
    then(`${RECEIPT_PACK.rolls * 2} 捲、NT$${RECEIPT_PACK.cost * 2}`, (w) => { expect(w.o).toEqual({ rolls: RECEIPT_PACK.rolls * 2, cost: RECEIPT_PACK.cost * 2 }) })
  })

  scenario(`倉儲在發票紙備品少於 ${RECEIPT_LOW} 捲時叫一組`, ({ given, when, then, but }) => {
    given(`備品只剩 ${RECEIPT_LOW - 1} 捲，其他都夠`, (w) => { w.stock = { ...startingSupplies(), [RECEIPT]: RECEIPT_LOW - 1 } })
    when('倉儲巡貨', (w) => { w.order = restockOrder(grill, menu, w.stock, 1e9, 60) })
    then('叫了一組發票紙', (w) => { expect(w.order.buy[RECEIPT]).toBe(RECEIPT_PACK.rolls) })
    but('備品夠的時候不叫', () => { expect(restockOrder(grill, menu, { ...startingSupplies(), [RECEIPT]: RECEIPT_LOW }, 1e9, 60).buy[RECEIPT] ?? 0).toBe(0) })
  })
})
