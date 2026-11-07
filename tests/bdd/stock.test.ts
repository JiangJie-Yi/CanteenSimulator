import { NORI } from '@/game/supplies'
import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { canServe, portionsLeft, takeStock } from '@/game/economy'
import type { Entry } from '@/data/recipes'

const ayuSet: Entry = { key: 'ayu', shop: 'grilledfish', name: '鹽烤香魚套餐', ja: '鮎定食', price: 420, parts: [{ id: 'ayu' }] } as Entry

feature('庫存與出餐', () => {
  scenario('庫存足夠時可以出餐，並且扣掉庫存', ({ given, when, then, and }) => {
    given('倉庫有一份套餐要用的所有食材', (w) => {
      w.stock = { ExtraFish: 1, Onigiri: 1, Shishito: 1, KingOyster: 1, Potato: 1, MisoSoup: 1, [NORI]: 1 }
    })
    when('客人點了鹽烤香魚套餐', (w) => { w.next = takeStock(ayuSet, w.stock) })
    then('可以出餐', (w) => { expect(w.next).not.toBeNull() })
    and('這些食材都被用完', (w) => { for (const v of Object.values(w.next as Record<string, number>)) expect(v).toBe(0) })
  })

  scenario('飯糰要包一片海苔，沒有海苔就做不出來', ({ given, then, and }) => {
    given('白米、配菜都夠，海苔用完了', (w) => { w.stock = { ExtraFish: 5, Onigiri: 5, Shishito: 5, KingOyster: 5, Potato: 5, MisoSoup: 5 } })
    then('套餐（有飯糰）做不出來', (w) => { expect(canServe(ayuSet, w.stock)).toBe(false) })
    and('補一片海苔就可以，做完海苔少一片', (w) => {
      const next = takeStock(ayuSet, { ...w.stock, [NORI]: 3 })
      expect(next?.[NORI]).toBe(2)
    })
  })

  scenario('缺一樣食材就不能出餐，庫存原封不動', ({ given, when, then }) => {
    given('倉庫缺了味噌湯', (w) => {
      w.stock = { ExtraFish: 5, Onigiri: 5, Shishito: 5, KingOyster: 5, Potato: 5 }
    })
    when('客人點了鹽烤香魚套餐', (w) => { w.next = takeStock(ayuSet, w.stock) })
    then('不能出餐', (w) => { expect(canServe(ayuSet, w.stock)).toBe(false); expect(w.next).toBeNull() })
    then('一份都做不出來', (w) => { expect(portionsLeft(ayuSet, w.stock)).toBe(0) })
  })
})
