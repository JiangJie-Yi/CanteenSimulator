import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { canCookByHand, holdsCameraOne, modeOf, showsProgress, showsStockFridge } from '@/game/mode'

feature('閉店、研製料理與營業', () => {
  scenario('店關著、沒切研製：自由視角，不能手動烤魚，也沒有食材冷藏櫃', ({ given, then, and }) => {
    given('店沒有開，也沒有切到研製料理', (w) => { w.mode = modeOf(false, false) })
    then('是自由模式', (w) => { expect(w.mode).toBe('free') })
    and('不能手動烤魚、沒有進度、沒有冷藏櫃', (w) => { expect(canCookByHand(w.mode)).toBe(false); expect(showsProgress(w.mode)).toBe(false); expect(showsStockFridge(w.mode)).toBe(false) })
    and('視角是自由的', (w) => { expect(holdsCameraOne(w.mode, false)).toBe(false) })
  })

  scenario('切到研製料理：可以手動烤魚、調味，看得到進度與食材冷藏櫃', ({ given, when, then, and }) => {
    given('店沒有開，並且切到研製料理', (w) => { w.mode = modeOf(false, true) })
    when('看這個模式能做什麼', () => {})
    then('可以手動烤魚與調味', (w) => { expect(canCookByHand(w.mode)).toBe(true) })
    and('看得到烤魚進度', (w) => { expect(showsProgress(w.mode)).toBe(true) })
    and('看得到食材冷藏櫃', (w) => { expect(showsStockFridge(w.mode)).toBe(true) })
  })

  scenario('營業中：不能手動烤魚與調味，沒有進度介面，也沒有食材冷藏櫃', ({ given, then, and }) => {
    given('店開著（就算研製還開著）', (w) => { w.mode = modeOf(true, true) })
    then('不能手動烤魚與調味', (w) => { expect(canCookByHand(w.mode)).toBe(false) })
    and('不顯示烤魚進度', (w) => { expect(showsProgress(w.mode)).toBe(false) })
    and('不顯示食材冷藏櫃', (w) => { expect(showsStockFridge(w.mode)).toBe(false) })
  })

  scenario('研製時視角固定在攝影機 1，編輯房間或營業時才自由', ({ then }) => {
    then('研製且沒在編輯：固定', () => { expect(holdsCameraOne('research', false)).toBe(true) })
    then('研製但在編輯房間：自由', () => { expect(holdsCameraOne('research', true)).toBe(false) })
    then('營業中：自由', () => { expect(holdsCameraOne('service', false)).toBe(false) })
  })
})
