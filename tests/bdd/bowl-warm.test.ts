import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOWL_WARM_MAX, warmToEat } from '@/game/plates'

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
})
