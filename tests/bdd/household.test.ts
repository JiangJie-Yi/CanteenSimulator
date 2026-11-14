import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DISH_SOAP, HOUSEHOLD, HOUSEHOLD_PACK, TOILET_CLEANER, householdName, householdOrder } from '@/game/household'
import { startingSupplies, supplyName } from '@/game/supplies'
import { tablewareList, TABLEWARE } from '@/game/tableware'
import { PLATES_ALL } from '@/game/plates'
import { SKEWER_POOL } from '@/game/skewers'

feature('庫存的餐具與清潔用品（店主要的，第 83 項）', () => {
  scenario('耗材有洗碗精與廁所清潔劑，新店各有一組，可以一組一組訂', ({ then, and }) => {
    then('新店有洗碗精 4 瓶、廁所清潔劑 3 瓶', () => {
      const s = startingSupplies()
      expect(s[DISH_SOAP]).toBe(HOUSEHOLD_PACK[DISH_SOAP].start)
      expect(s[TOILET_CLEANER]).toBe(HOUSEHOLD_PACK[TOILET_CLEANER].start)
    })
    and('訂兩組：瓶數與價錢都是一組的兩倍', () => {
      for (const id of HOUSEHOLD) expect(householdOrder(id, 2)).toEqual({ bottles: 2 * HOUSEHOLD_PACK[id].bottles, cost: 2 * HOUSEHOLD_PACK[id].cost })
    })
    and('名字三種語言都有，庫存的名字也認得它們', () => {
      expect(householdName(DISH_SOAP, 'zh')).toBe('洗碗精')
      expect(supplyName(TOILET_CLEANER, 'ja')).toBe('トイレ用洗剤')
    })
  })
  scenario('餐具分頁列出店裡自己的餐具，數量跟店裡實際的一樣', ({ given, then, and }) => {
    let list: ReturnType<typeof tablewareList> = []
    given('8 個座位的店', () => { list = tablewareList(8) })
    then('盤子是碗盤架上全部的，碗、湯匙、筷子是碗盤櫃裡的，鐵籤是鐵籤的總數', () => {
      const n = (id: string) => list.find((w) => w.id === id)!.n
      expect(n('plates')).toBe(PLATES_ALL)
      expect([n('riceBowls'), n('soupBowls'), n('spoons'), n('chopsticks')]).toEqual([TABLEWARE.riceBowls, TABLEWARE.soupBowls, TABLEWARE.spoons, TABLEWARE.chopsticks])
      expect(n('skewers')).toBe(SKEWER_POOL)
    })
    and('每個座位一個筷架、一個醬油碟', () => {
      expect(list.find((w) => w.id === 'rests')!.n).toBe(8)
      expect(list.find((w) => w.id === 'soyDishes')!.n).toBe(8)
    })
  })
})
