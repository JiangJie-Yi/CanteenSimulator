import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { landingOf, SHATTER_H, shardsOf, sweeps } from '@/game/spills'

feature('飲料摔到地上', () => {
  scenario('玻璃瓶從 0.4 公尺以上摔下會破', ({ given, then, and }) => {
    given('門檻是 0.4 公尺', () => { expect(SHATTER_H).toBe(0.4) })
    then('彈珠汽水從架子中間（0.85 公尺）掉下去就破了', () => { expect(landingOf('glass', 0.85)).toBe('shatter') })
    and('從最下層（0.3 公尺）掉下去不會破', () => { expect(landingOf('glass', 0.3)).toBe('bounce') })
    and('剛好 0.4 公尺也不會破', () => { expect(landingOf('glass', 0.4)).toBe('bounce') })
  })

  scenario('罐裝的不會破，會倒下滾動；寶特瓶與小瓶照舊', ({ then, and }) => {
    then('罐子從高處掉下去是倒下滾動', () => { expect(landingOf('can', 1.2)).toBe('roll') })
    and('罐子從低處掉下去只是彈一下', () => { expect(landingOf('can', 0.2)).toBe('bounce') })
    and('寶特瓶不會破', () => { expect(landingOf('pet', 1.2)).toBe('bounce') })
    and('養樂多那種小瓶也不會破', () => { expect(landingOf('small', 1.2)).toBe('bounce') })
  })

  scenario('鋁箔包（紙盒）摔不破：從高處掉下是悶的一聲、側躺在地上', ({ then, and }) => {
    then('從 1.2 公尺掉下去是倒下側躺，不是破掉，也不滾', () => { expect(landingOf('pack', 1.2)).toBe('topple') })
    and('從低處掉下去只是彈一下', () => { expect(landingOf('pack', 0.3)).toBe('bounce') })
  })

  scenario('破掉的瓶子留下 6 到 10 片碎片', ({ then }) => {
    then('每一種落點都在 6 到 10 片之間，同一個落點片數一樣', () => {
      for (let s = 0; s < 40; s++) { const n = shardsOf(s * 7.3); expect(n).toBeGreaterThanOrEqual(6); expect(n).toBeLessThanOrEqual(10); expect(shardsOf(s * 7.3)).toBe(n) }
    })
  })

  scenario('外場有空就去掃；洗碗的、手上有菜要端的不去', ({ then, and }) => {
    then('管外場的有空會去', () => { expect(sweeps('floor', false)).toBe(true) })
    and('只有一位外場（或老闆自己端）也會去', () => { expect(sweeps('all', false)).toBe(true) })
    and('有兩位時管洗碗的不去', () => { expect(sweeps('dish', false)).toBe(false) })
    and('有裝好的菜要端時先端菜', () => { expect(sweeps('floor', true)).toBe(false) })
  })
})
