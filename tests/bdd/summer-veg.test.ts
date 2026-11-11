import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { storageOf, stockNameOf } from '@/data/storage'
import { DISHES } from '@/data/menu'
import { COST_SHARE } from '@/game/economy'
import { PAIRING } from '@/game/taste'

const NEW = ['Tomato', 'Cucumber', 'Eggplant', 'Piman', 'Paprika']
const shop = DISHES.find((d) => d.id === 'grilledfish')!

feature('夏季蔬菜：番茄、小黃瓜、茄子、青椒、甜椒放常溫，胡蘿蔔改冷藏', () => {
  scenario('放在哪裡', ({ then, and }) => {
    then('五種新蔬菜都放常溫（木籃）', () => { for (const id of NEW) expect(storageOf(id)).toBe('ambient') })
    and('胡蘿蔔改放冷藏', () => { expect(storageOf('Carrot')).toBe('chilled') })
    and('庫存上叫生鮮的名字', () => {
      expect(stockNameOf('Tomato', 'zh')).toBe('小番茄')
      expect(stockNameOf('Piman', 'zh')).toBe('青椒')
      expect(stockNameOf('Paprika', 'ja')).toBe('パプリカ')
    })
  })
  scenario('都上得了菜單：有價錢、成本、烤的時間與菜名，鹽烤都合', ({ then, and }) => {
    then('都在菜單上，有成本比例', () => {
      for (const id of NEW) {
        expect(shop.items.some((x) => x.id === id)).toBe(true)
        expect(COST_SHARE[id]).toBeGreaterThan(0)
      }
    })
    and('都有烤的時間與菜名', () => {
      for (const id of NEW) {
        expect(shop.roast!.times[id]).toBeGreaterThan(0)
        expect(shop.roast!.names[id]).toBeTruthy()
      }
    })
    and('鹽烤都加分，煉乳都扣分', () => {
      for (const id of NEW) {
        expect(PAIRING.salt[id]).toBeGreaterThan(0)
        expect(PAIRING.milk[id]).toBeLessThan(0)
      }
    })
    and('茄子最配味噌', () => { expect(PAIRING.miso.Eggplant).toBeGreaterThanOrEqual(Math.max(...NEW.map((id) => PAIRING.miso[id] ?? 0))) })
    and('獅子唐與青椒是兩樣東西，名字不重複', () => {
      expect(shop.items.find((x) => x.id === 'Shishito')!.name).toBe('獅子唐')
      expect(shop.items.find((x) => x.id === 'Piman')!.name).toBe('青椒串')
    })
  })
})
