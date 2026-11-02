import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOX_LOW, FRIDGE_SHORT, ROLL_LOW, drinksToOrder, stockerChore } from '@/game/stocker'
import { CASE_SIZE } from '@/game/drinkStock'

const calm = { rolls: { m: 1, f: 1 }, wcBusy: { m: false, f: false }, fridgeShort: [0, 0], boxes: [200, 200, 200], seatTaken: () => false, spares: 5 }

feature('倉儲員工：自己進貨、補貨，走去補飲料、吧台的衛生紙、廁所的捲筒衛生紙', () => {
  scenario('廁所的衛生紙快用完了（不到四分之一捲），沒人在用就先去換', ({ then, but }) => {
    then('女廁快沒了：去換女廁的', () => { expect(stockerChore({ ...calm, rolls: { m: 1, f: ROLL_LOW - 0.05 } })).toEqual({ kind: 'roll', who: 'f' }) })
    but('有人在用：先不進去', () => { expect(stockerChore({ ...calm, rolls: { m: 1, f: 0.1 }, wcBusy: { m: false, f: true } })).toBeNull() })
  })
  scenario(`飲料櫃缺 ${FRIDGE_SHORT} 個以上、後場補得了：去補`, ({ then, but }) => {
    then('第二台缺 5 個', () => { expect(stockerChore({ ...calm, fridgeShort: [1, 5] })).toEqual({ kind: 'drinks', unit: 1 }) })
    but('只缺 2 個：先不跑', () => { expect(stockerChore({ ...calm, fridgeShort: [2, 2] })).toBeNull() })
  })
  scenario(`吧台座位的衛生紙不到 ${BOX_LOW} 張、沒人坐、有備品：換一盒新的（最空的先）`, ({ then, and, but }) => {
    then('座位 1 剩 10 張、座位 2 剩 20 張：先換座位 1', () => {
      expect(stockerChore({ ...calm, boxes: [200, 10, 20] })).toEqual({ kind: 'tissue', seat: 1 })
    })
    but('座位 1 有人坐：換座位 2', () => {
      expect(stockerChore({ ...calm, boxes: [200, 10, 20], seatTaken: (n) => n === 1 })).toEqual({ kind: 'tissue', seat: 2 })
    })
    and('沒有備品了：不換', () => { expect(stockerChore({ ...calm, boxes: [200, 10, 20], spares: 0 })).toBeNull() })
  })
  scenario('廁所沒紙比補飲料、換衛生紙盒優先', ({ then }) => {
    then('三件都要做：先換廁所的', () => {
      expect(stockerChore({ ...calm, rolls: { m: 0, f: 1 }, fridgeShort: [6, 0], boxes: [5, 200, 200] })).toEqual({ kind: 'roll', who: 'm' })
    })
  })
  scenario('飲料後場不到半箱就叫一箱（只叫飲料櫃有賣的）', ({ then, and }) => {
    then('啤酒剩 5 瓶（一箱 20）：叫', () => { expect(drinksToOrder({ beer: 5, cola: 30 }, ['beer', 'cola'])).toEqual(['beer']) })
    and(`可樂剛好半箱（${CASE_SIZE.cola / 2}）：不叫`, () => { expect(drinksToOrder({ cola: CASE_SIZE.cola / 2 }, ['cola'])).toEqual([]) })
    and('同一種在櫃子裡好幾格，只叫一次', () => { expect(drinksToOrder({ beer: 0 }, ['beer', 'beer', 'beer'])).toEqual(['beer']) })
  })
})
