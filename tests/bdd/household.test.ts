import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CLEANER_SCRUBS, DISH_SOAP, DISH_SOAP_SQUEEZES, HOUSEHOLD, HOUSEHOLD_PACK, TOILET_CLEANER, householdName, householdOrder, takeDose } from '@/game/household'
import { BRUSH_ONLY, freshRoom, scrubRoom } from '@/game/restroom'
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
  // (item 203: the dish soap and the toilet cleaner were stocked and bought, and nothing ever used them)
  scenario('洗碗精一瓶擠 40 次，用完了才從庫存開新的一瓶', ({ given, when, then, and }) => {
    given('流理台上一瓶新的洗碗精，庫存 4 瓶', (w) => { w.left = DISH_SOAP_SQUEEZES; w.stock = 4 })
    const open = (w: Record<string, number>) => () => (w.stock > 0 ? (w.stock -= 1, true) : false)
    when('擠了 40 次', (w) => { for (let i = 0; i < 40; i++) w.left = takeDose(w.left, DISH_SOAP_SQUEEZES, open(w)).left })
    then('這瓶用完了，庫存還是 4 瓶', (w) => { expect(DISH_SOAP_SQUEEZES).toBe(40); expect(w.left).toBe(0); expect(w.stock).toBe(4) })
    and('再擠一次：開新的一瓶，庫存剩 3 瓶', (w) => {
      const r = takeDose(w.left, DISH_SOAP_SQUEEZES, open(w))
      expect(r.had).toBe(true); expect(r.left).toBe(DISH_SOAP_SQUEEZES - 1); expect(w.stock).toBe(3)
    })
  })
  scenario('用完了、庫存也沒有，就擠不出來', ({ given, when, then }) => {
    given('瓶子空了，庫存 0 瓶', (w) => { w.left = 0 })
    when('擠一次', (w) => { w.r = takeDose(w.left, DISH_SOAP_SQUEEZES, () => false) })
    then('什麼都沒擠出來', (w) => { expect(w.r).toEqual({ left: 0, had: false }) })
  })
  scenario('刷馬桶用一次清潔劑，一瓶刷 20 次；沒有清潔劑只用刷子刷，沒那麼乾淨', ({ given, when, then, and }) => {
    given('很髒的馬桶（清潔度 30%）', (w) => { w.room = { ...freshRoom(), clean: 0.3 } })
    when('用清潔劑刷', (w) => { w.with = scrubRoom(w.room, true); w.without = scrubRoom(w.room, false) })
    then('乾乾淨淨', (w) => { expect(CLEANER_SCRUBS).toBe(20); expect(w.with.clean).toBe(1) })
    and('沒有清潔劑只刷到七成', (w) => { expect(w.without.clean).toBe(BRUSH_ONLY); expect(BRUSH_ONLY).toBe(0.7) })
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
