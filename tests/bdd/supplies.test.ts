import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { canServe, needOf, restockOrder, takeStock, topUpOrder } from '@/game/economy'
import { burnCharcoal, CHARCOAL, CHARCOAL_LOW, charcoalOrder, crateRefill, dabFrom, isSupply, SACK_COST, SACK_STICKS, SEASON_PAR, seasonId, startingSupplies } from '@/game/supplies'
import { storageOf } from '@/data/storage'
import { DISHES } from '@/data/menu'
import type { Entry } from '@/data/recipes'

const grill = DISHES.find((d) => d.id === 'grilledfish')!
/** 醬刷玉米撒花生粉: corn with soy brushed on and peanut powder over */
const corn: Entry = { key: 'corn', shop: 'grilledfish', name: '醬刷花生玉米', ja: '', price: 120,
  parts: [{ id: 'GrilledCorn', dabs: ['soy', 'peanut'], name: '', ja: '' }] }

feature('調味料與木炭（耗材）', () => {
  scenario('調味料會用掉：一道菜撒了什麼，就用掉那幾樣各一份', ({ when, then, and }) => {
    when('看醬刷花生玉米要用掉什麼', (w) => { w.need = needOf(corn) })
    then('一根玉米', (w) => { expect(w.need.GrilledCorn).toBe(1) })
    and('醬油、花生粉各一份', (w) => {
      expect(w.need[seasonId('soy')]).toBe(1)
      expect(w.need[seasonId('peanut')]).toBe(1)
    })
  })

  scenario('調味料不夠就做不出來，夠的話出餐時一起扣掉', ({ given, then, and }) => {
    given('有玉米、花生粉，醬油卻用完了', (w) => { w.stock = { GrilledCorn: 3, [seasonId('peanut')]: 5, [seasonId('soy')]: 0 } })
    then('醬刷花生玉米做不出來', (w) => { expect(canServe(corn, w.stock)).toBe(false) })
    and('補了醬油就做得出來，出餐時玉米、醬油、花生粉各扣一份', (w) => {
      const next = takeStock(corn, { ...w.stock, [seasonId('soy')]: 2 })!
      expect(next.GrilledCorn).toBe(2)
      expect(next[seasonId('soy')]).toBe(1)
      expect(next[seasonId('peanut')]).toBe(4)
    })
  })

  scenario('手動撒調味也會用掉，用完就撒不上去', ({ then, and }) => {
    then('還有鹽：撒一下少一份', () => { expect(dabFrom({ [seasonId('salt')]: 2 }, 'salt')![seasonId('salt')]).toBe(1) })
    and('鹽用完了：撒不上去', () => { expect(dabFrom({ [seasonId('salt')]: 0 }, 'salt')).toBeNull() })
  })

  scenario('醬料放冷藏，乾的調味放常溫', ({ then, and }) => {
    then('醬油、味噌、煉乳、山葵、柚子胡椒、檸檬在冷藏', () => {
      for (const k of ['soy', 'miso', 'milk', 'wasabi', 'yuzu', 'lemon'] as const) expect(storageOf(seasonId(k))).toBe('chilled')
    })
    and('鹽、花生粉、七味粉在常溫', () => {
      for (const k of ['salt', 'peanut', 'shichimi'] as const) expect(storageOf(seasonId(k))).toBe('ambient')
    })
    and('調味料與木炭不是食材，不會放到壞', () => {
      expect(isSupply(seasonId('soy'))).toBe(true)
      expect(isSupply(CHARCOAL)).toBe(true)
      expect(isSupply('Saury')).toBe(false)
    })
  })

  scenario('補滿也會把每樣調味料補到常備量', ({ when, then }) => {
    when('醬油剩 10 份，其他調味料都沒了，按補滿', (w) => { w.order = topUpOrder(grill, { [seasonId('soy')]: 10 }) })
    then(`醬油補 ${SEASON_PAR - 10} 份，其他各補 ${SEASON_PAR} 份`, (w) => {
      expect(w.order.buy[seasonId('soy')]).toBe(SEASON_PAR - 10)
      expect(w.order.buy[seasonId('salt')]).toBe(SEASON_PAR)
    })
  })

  scenario('倉儲看到菜單要用的調味料快沒了會叫貨，木炭快沒了也會叫兩袋', ({ given, when, then, and }) => {
    given('菜單上有醬刷花生玉米，醬油只剩 2 份，木炭剩 10 根', (w) => {
      w.stock = { GrilledCorn: 20, [seasonId('soy')]: 2, [seasonId('peanut')]: 25, [CHARCOAL]: 10 }
    })
    when('倉儲巡一次', (w) => { w.order = restockOrder(grill, [corn], w.stock, 100000, 60) })
    then('醬油補到常備量', (w) => { expect(w.order.buy[seasonId('soy')]).toBe(SEASON_PAR - 2) })
    and('花生粉還夠，不叫', (w) => { expect(w.order.buy[seasonId('peanut')]).toBeUndefined() })
    and(`木炭不到 ${CHARCOAL_LOW} 根，叫兩袋，算在燃料`, (w) => {
      expect(w.order.buy[CHARCOAL]).toBe(2 * SACK_STICKS)
      expect(w.order.fuel).toBeGreaterThan(0)
    })
  })

  scenario('木炭從麻袋補到桌上的炭箱，麻袋空了就補不了', ({ then, and }) => {
    then('麻袋還有 100 根：炭箱補滿 36 根，麻袋剩 64 根', () => { expect(crateRefill(100, 36)).toEqual({ crate: 36, sack: 64 }) })
    and('麻袋只剩 10 根：全部倒進炭箱', () => { expect(crateRefill(10, 36)).toEqual({ crate: 10, sack: 0 }) })
    and('麻袋空了：炭箱還是空的', () => { expect(crateRefill(0, 36)).toEqual({ crate: 0, sack: 0 }) })
  })

  scenario('炭火要燒木炭：庫存不夠就加不上去', ({ then, and }) => {
    then('有 10 根，加 7 根剩 3 根', () => { expect(burnCharcoal({ [CHARCOAL]: 10 }, 7)![CHARCOAL]).toBe(3) })
    and('只剩 3 根，加不了 7 根', () => { expect(burnCharcoal({ [CHARCOAL]: 3 }, 7)).toBeNull() })
  })

  scenario(`木炭一袋 ${SACK_STICKS} 根、NT$${SACK_COST}；新開的店有兩袋，調味料各有一些`, ({ then, and }) => {
    then('訂兩袋', () => { expect(charcoalOrder(2)).toEqual({ sticks: 2 * SACK_STICKS, cost: 2 * SACK_COST }) })
    and('開店時的耗材', () => {
      const s = startingSupplies()
      expect(s[CHARCOAL]).toBe(2 * SACK_STICKS)
      expect(s[seasonId('soy')]).toBeGreaterThan(0)
    })
  })
})
