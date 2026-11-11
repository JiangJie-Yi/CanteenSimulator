import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { HEAT_S, SOUP_BOWLS, emptyPot, potTick, setSoup, soupGoes, soupReady, takeBowl } from '@/game/soup'

feature('味噌湯：開店時湯鍋是空的，三廚煮好才有', () => {
  scenario('湯鍋空著才去煮', ({ then, but }) => {
    then('空了：去煮', () => { expect(soupGoes(emptyPot())).toBe(true) })
    but('正在加熱、或已經熱了：不再煮', () => {
      expect(soupGoes(setSoup())).toBe(false)
      expect(soupGoes({ state: 'hot', left: 0 })).toBe(false)
    })
  })
  scenario(`煮好放進保溫座，加熱 ${HEAT_S} 秒才熱，熱的那一刻說一次`, ({ given, when, then, and }) => {
    let p = emptyPot(), hot = 0
    given('三廚把湯煮好放上保溫座', () => { p = setSoup() })
    when(`過了 ${HEAT_S - 1} 秒`, () => { for (let i = 0; i < HEAT_S - 1; i++) { const r = potTick(p, 1); p = r.pot; hot += +r.hot } })
    then('還在加熱', () => { expect(p.state).toBe('heating'); expect(hot).toBe(0) })
    and('再一秒就熱了，只說一次，之後一直保溫', () => {
      for (let i = 0; i < 3; i++) { const r = potTick(p, 1); p = r.pot; hot += +r.hot }
      expect(p.state).toBe('hot')
      expect(hot).toBe(1)
    })
  })
  scenario('空的湯鍋放著不會自己變熱', ({ then }) => {
    then('時間過去還是空的', () => { expect(potTick(emptyPot(), 100).pot.state).toBe('empty') })
  })
  scenario(`一鍋 ${SOUP_BOWLS} 碗，客人點了就從鍋裡盛一碗，盛完了鍋子空了要再煮`, ({ then, and, but }) => {
    const hot = { state: 'hot' as const, left: 0 }
    then('熱的、還有：可以盛', () => { expect(soupReady(hot, 3)).toBe(true) })
    but('還沒熱，或一碗都不剩：不能盛', () => {
      expect(soupReady(setSoup(), SOUP_BOWLS)).toBe(false)
      expect(soupReady(hot, 0)).toBe(false)
    })
    and('盛一碗少一碗，最後一碗盛走鍋子就空了', () => {
      expect(takeBowl(hot, 5)).toEqual({ pot: hot, left: 4 })
      const last = takeBowl(hot, 1)
      expect(last.left).toBe(0)
      expect(soupGoes(last.pot)).toBe(true)
    })
  })
})
