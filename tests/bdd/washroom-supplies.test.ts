import { expect } from 'vitest'
import { stockerChore } from '@/game/stocker'
import { ROLL, SOAP, SOAP_FULL, SOAP_REFILL_AT, takeOne, takesTowel, topUp, TOWEL, TOWEL_FULL, TOWEL_REFILL_AT, WASHROOM_PACKS, WASHROOM_START, washroomOrder } from '@/game/washroom'
import { startingSupplies, supplyName } from '@/game/supplies'
import { feature, scenario } from './bdd'

feature('洗手間的耗材：捲筒衛生紙、擦手紙（一盒最多 150 張）、洗手乳（按壓就用掉），備品都算在庫存的民生裡', () => {
  scenario('擦手紙一盒最多 150 張，抽一張少一張，沒了就抽不出來', ({ given, when, then, and }) => {
    given(`滿的一盒 ${TOWEL_FULL} 張`, (w) => { w.n = TOWEL_FULL })
    when('抽一張', (w) => { const t = takeOne(w.n as number); w.n = t.left; w.got = t.got })
    then('剩 149 張', (w) => { expect(w.n).toBe(149); expect(w.got).toBe(true) })
    and('空的盒子抽不到', () => { expect(takeOne(0)).toEqual({ left: 0, got: false }) })
  })
  scenario('洗手乳按一下用掉一下，用完就按不出來', ({ then, and }) => {
    then(`一瓶 ${SOAP_FULL} 下`, () => { expect(takeOne(SOAP_FULL).left).toBe(SOAP_FULL - 1) })
    and('空瓶按不出來', () => { expect(takeOne(0).got).toBe(false) })
  })
  scenario('開店前快沒的擦手紙與洗手乳用備品補滿，沒有備品就不補', ({ then, and }) => {
    then('擦手紙剩 30 張、有 2 包備品：補滿、備品剩 1', () => { expect(topUp(30, TOWEL_FULL, TOWEL_REFILL_AT, 2)).toEqual({ level: TOWEL_FULL, spares: 1 }) })
    and('還夠的不補', () => { expect(topUp(120, TOWEL_FULL, TOWEL_REFILL_AT, 2)).toEqual({ level: 120, spares: 2 }) })
    and('洗手乳快沒了但沒有補充包：不補', () => { expect(topUp(10, SOAP_FULL, SOAP_REFILL_AT, 0)).toEqual({ level: 10, spares: 0 }) })
  })
  scenario('沒有備用的捲筒衛生紙，倉儲就不去換', ({ given, then, and }) => {
    given('男廁的紙快用完了', (w) => { w.args = { rolls: { m: 0.1, f: 1 }, wcBusy: { m: false, f: false }, fridgeShort: [0, 0], boxes: [200], seatTaken: () => false, spares: 0 } })
    then('有備品：去換', (w) => { expect(stockerChore({ ...(w.args as Parameters<typeof stockerChore>[0]), rollSpares: 3 })).toEqual({ kind: 'roll', who: 'm' }) })
    and('沒有備品：不去', (w) => { expect(stockerChore({ ...(w.args as Parameters<typeof stockerChore>[0]), rollSpares: 0 })).toBeNull() })
  })
  scenario('擦手紙或洗手乳快沒了、有備品：倉儲去那間補（飲料之後）', ({ given, then, and }) => {
    given('女廁的擦手紙快沒了，男廁好好的', (w) => { w.args = { rolls: { m: 1, f: 1 }, wcBusy: { m: false, f: false }, fridgeShort: [0, 0], boxes: [200], seatTaken: () => false, spares: 0, wcLow: { m: false, f: true } } })
    then('去女廁', (w) => { expect(stockerChore(w.args as Parameters<typeof stockerChore>[0])).toEqual({ kind: 'roll', who: 'f' }) })
    and('飲料櫃缺很多時先補飲料', (w) => { expect(stockerChore({ ...(w.args as Parameters<typeof stockerChore>[0]), fridgeShort: [5, 0] })).toEqual({ kind: 'drinks', unit: 0 }) })
    and('有人在用那間就先不去', (w) => { expect(stockerChore({ ...(w.args as Parameters<typeof stockerChore>[0]), wcBusy: { m: false, f: true } })).toBeNull() })
  })
  scenario('新開的店有這三樣的備品，買的時候照包算', ({ then, and }) => {
    then('新店的備品', () => { const s = startingSupplies(); for (const id of [ROLL, TOWEL, SOAP]) expect(s[id]).toBe(WASHROOM_START[id]) })
    and('兩包捲筒衛生紙', () => { expect(washroomOrder(ROLL, 2)).toEqual({ n: 2 * WASHROOM_PACKS[ROLL].n, cost: 2 * WASHROOM_PACKS[ROLL].cost }) })
    and('三樣都有名字', () => { for (const id of [ROLL, TOWEL, SOAP]) for (const l of ['zh', 'ja', 'en'] as const) expect(supplyName(id, l)).toBeTruthy() })
  })
  scenario('一半的客人烘手時會抽一張擦手紙', ({ then }) => {
    then('一百位裡約一半', () => { const n = Array.from({ length: 100 }, (_, i) => takesTowel(i + 1)).filter(Boolean).length; expect(n).toBeGreaterThan(35); expect(n).toBeLessThan(65) })
  })
})
