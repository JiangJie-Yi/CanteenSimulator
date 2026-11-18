import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { drawerTotal, openingFloat, payCash, takeAll, takeOut, takeTakings } from '@/game/till'

feature('收銀機的錢（第 366 項：收銀櫃的錢另外一個介面，跟總金額結合）', () => {
  scenario('取出營收時留下找零', ({ given, when, then, and }) => {
    given('開店時的零錢，再收了幾位付現的客人', (w) => {
      let d = openingFloat()
      for (const [bill, tender] of [[680, 1000], [1730, 5000], [2400, 3000], [355, 1000]]) d = payCash(d, bill, tender)
      w.d = d
    })
    when('按「取出營收」', (w) => { w.r = takeTakings(w.d) })
    then('取出的是收進來的錢：680 + 1730 + 2400 + 355', (w) => { expect(w.r.amount).toBe(680 + 1730 + 2400 + 355) })
    and('留下的剛好是開店時的零錢總額，大鈔先拿走、零錢留著找', (w) => {
      expect(drawerTotal(w.r.drawer)).toBe(drawerTotal(openingFloat()))
      for (const k of [100, 50, 10, 5, 1] as const) expect(w.r.drawer[k]).toBeGreaterThanOrEqual(Math.min(w.d[k], 1))
    })
    and('錢沒有變多或變少：取出的加上留下的，等於原本抽屜裡的', (w) => { expect(w.r.amount + drawerTotal(w.r.drawer)).toBe(drawerTotal(w.d)) })
  })

  scenario('零錢被找光的那一格，取出營收不會倒貼', ({ given, when, then }) => {
    given('一圓硬幣只剩 3 枚、其他照開店時', (w) => { w.d = { ...openingFloat(), 1: 3 } })
    when('按「取出營收」', (w) => { w.r = takeTakings(w.d) })
    then('什麼也沒取出，一圓還是 3 枚', (w) => { expect(w.r.amount).toBe(0); expect(w.r.drawer[1]).toBe(3) })
  })

  scenario('全部取出、一格一格取出', ({ given, then, and }) => {
    given('開店時的零錢', (w) => { w.d = openingFloat() })
    then('全部取出：抽屜空了，取出的是全部', (w) => {
      const r = takeAll(w.d)
      expect(r.amount).toBe(drawerTotal(w.d))
      expect(drawerTotal(r.drawer)).toBe(0)
    })
    and('只拿千圓那一格：拿 8 張，共 8000，其他不動', (w) => {
      const r = takeOut(w.d, 1000)
      expect(r.amount).toBe(8000)
      expect(r.drawer[1000]).toBe(0)
      expect(r.drawer[500]).toBe(w.d[500])
    })
  })
})
