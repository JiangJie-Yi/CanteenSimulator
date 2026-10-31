import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { FREEZER_DEFAULT, FREEZER_MAX, FREEZER_MIN, driftTemp, stepTemp } from '@/game/freezer'

feature('食材冷凍櫃的溫控', () => {
  scenario('預設設在 -20℃', ({ then }) => {
    then('一開始的設定溫度是 -20℃', () => { expect(FREEZER_DEFAULT).toBe(-20) })
  })

  scenario('按上、下鍵一次調一度', ({ given, when, then, and }) => {
    given('設定在 -20℃', (w) => { w.set = -20 })
    when('按一下「上」', (w) => { w.up = stepTemp(w.set, 1) })
    then('變成 -19℃', (w) => { expect(w.up).toBe(-19) })
    and('按一下「下」變成 -21℃', (w) => { expect(stepTemp(w.set, -1)).toBe(-21) })
  })

  scenario('溫度調不出冷凍的範圍', ({ then, and }) => {
    then('最冷只到下限', () => { expect(stepTemp(FREEZER_MIN, -1)).toBe(FREEZER_MIN) })
    and('最暖只到上限，仍在冰點以下', () => { expect(stepTemp(FREEZER_MAX, 1)).toBe(FREEZER_MAX); expect(FREEZER_MAX).toBeLessThan(0) })
  })

  scenario('蓋子開著時櫃內慢慢變暖，關上後回到設定溫度', ({ given, when, then, and }) => {
    given('設定 -20℃，櫃內也是 -20℃', (w) => { w.t = -20 })
    when('蓋子開著 10 秒', (w) => { for (let i = 0; i < 100; i++) w.t = driftTemp(w.t, -20, true, 0.1) })
    then('櫃內變暖了，但沒有超過冰點', (w) => { expect(w.t).toBeGreaterThan(-20); expect(w.t).toBeLessThan(0) })
    and('關上 60 秒後回到 -20℃', (w) => {
      for (let i = 0; i < 600; i++) w.t = driftTemp(w.t, -20, false, 0.1)
      expect(Math.round(w.t)).toBe(-20)
    })
  })
})
