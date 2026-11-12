import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOWL_HAND_MAX, BOWL_WARM_MAX, warmToEat } from '@/game/plates'

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
    given('碗裡已有 10 份（兩層滿了）', (w) => { w.kept = BOWL_HAND_MAX })
    when('再放一份進去', (w) => { w.eat = warmToEat(w.kept + 1, BOWL_HAND_MAX) })
    then('最早放進去的那份被吃掉，碗裡仍是 10 份', (w) => { expect(w.kept + 1 - w.eat).toBe(BOWL_HAND_MAX) })
  })
})
