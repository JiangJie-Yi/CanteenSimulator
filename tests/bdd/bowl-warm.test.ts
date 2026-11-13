import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOWL_GAP, BOWL_HAND_MAX, BOWL_ROW, BOWL_WARM_MAX, bowlPlace, warmToEat } from '@/game/plates'

feature('保溫大碗的上限', () => {
  scenario('大碗裡的魚不會堆積如山', ({ given, when, then }) => {
    given('客人走了、碗裡已有 20 份保溫的菜', (w) => { w.kept = 20 })
    when('員工清理', (w) => { w.eat = warmToEat(w.kept) })
    then('最舊的吃掉到只剩上限那麼多', (w) => { expect(w.kept - w.eat).toBe(BOWL_WARM_MAX) })
  })
  scenario('沒超過上限就不動', ({ given, when, then }) => {
    given('碗裡有 3 份', (w) => { w.kept = 3 })
    when('員工清理', (w) => { w.eat = warmToEat(w.kept) })
    then('一份都不吃', (w) => { expect(w.eat).toBe(0) })
  })
  scenario('手動研製時試吃碗也不會疊成山', ({ given, when, then }) => {
    given('碗裡那一排已經放滿', (w) => { w.kept = BOWL_HAND_MAX })
    when('再放一份進去', (w) => { w.eat = warmToEat(w.kept + 1, BOWL_HAND_MAX) })
    then('最早放進去的那份被吃掉，碗裡仍是滿滿一排', (w) => { expect(w.kept + 1 - w.eat).toBe(BOWL_HAND_MAX) })
  })
  scenario('碗裡的菜只排一排，不會疊第二層', ({ given, when, then, and }) => {
    given('研製時與營業時，碗裡最多能放的份數', (w) => { w.most = Math.max(BOWL_HAND_MAX, BOWL_WARM_MAX) })
    when('每一份照放進去的位置排好', (w) => { w.places = Array.from({ length: w.most }, (_, k) => bowlPlace(k)) })
    then('全部都在第一層', (w) => { for (const p of w.places) expect(p.layer).toBe(0) })
    and('一排的寬度在碗裡（碗口 0.8，最寬的一份 0.2）', (w) => {
      const far = Math.max(...w.places.map((p: { across: number }) => Math.abs(p.across)))
      expect(far + 0.1).toBeLessThanOrEqual(0.4)
      expect(BOWL_GAP * (BOWL_ROW - 1)).toBeLessThan(0.8 - 0.2)
    })
  })
})
