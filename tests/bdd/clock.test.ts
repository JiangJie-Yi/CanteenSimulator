import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DAWN, DUSK, START, hhmm, isNight, themeAt, tick } from '@/game/clock'

feature('遊戲時鐘：現實一秒是遊戲一分鐘，晝夜跟著時間走', () => {
  scenario('新的一局從第一天早上十點開始，是白天', ({ given, then, and }) => {
    given('一局剛開始', (w) => { w.c = START })
    then('是第 1 天 10:00', (w) => { expect(w.c.day).toBe(1); expect(hhmm(w.c.minute)).toBe('10:00') })
    and('畫面是白天', (w) => { expect(themeAt(w.c)).toBe('light') })
  })

  scenario('現實過了一秒，遊戲過了一分鐘', ({ given, when, then, and }) => {
    given('第 1 天 10:00', (w) => { w.c = START })
    when('過了 90 秒', (w) => { w.c = tick(w.c, 90) })
    then('是 11:30', (w) => { expect(hhmm(w.c.minute)).toBe('11:30') })
    and('還是第 1 天', (w) => { expect(w.c.day).toBe(1) })
  })

  scenario('開了 ×2 時鐘也快一倍', ({ given, when, then }) => {
    given('第 1 天 10:00', (w) => { w.c = START })
    when('現實過了 30 秒、遊戲倍速 ×2', (w) => { w.c = tick(w.c, 30 * 2) })
    then('過了一個小時', (w) => { expect(hhmm(w.c.minute)).toBe('11:00') })
  })

  scenario('過了午夜就是新的一天', ({ given, when, then, and }) => {
    given('第 3 天 23:59', (w) => { w.c = { day: 3, minute: 23 * 60 + 59 } })
    when('再過兩分鐘', (w) => { w.c = tick(w.c, 2) })
    then('是第 4 天', (w) => { expect(w.c.day).toBe(4) })
    and('時間是 00:01', (w) => { expect(hhmm(w.c.minute)).toBe('00:01') })
  })

  scenario('一次過了好幾天也算得對', ({ given, when, then, and }) => {
    given('第 1 天 10:00', (w) => { w.c = START })
    when('過了兩天又一小時', (w) => { w.c = tick(w.c, 2 * 24 * 60 + 60) })
    then('是第 3 天', (w) => { expect(w.c.day).toBe(3) })
    and('11:00', (w) => { expect(hhmm(w.c.minute)).toBe('11:00') })
  })

  scenario('晚上六點到早上六點是夜晚，其餘是白天', ({ given, then, and }) => {
    given('一天裡的幾個時候', () => {})
    then('傍晚六點天黑', () => { expect(isNight(DUSK)).toBe(true); expect(isNight(DUSK - 1)).toBe(false) })
    and('早上六點天亮', () => { expect(isNight(DAWN)).toBe(false); expect(isNight(DAWN - 1)).toBe(true) })
    and('半夜是夜晚', () => { expect(themeAt({ day: 2, minute: 0 })).toBe('dark') })
    and('中午是白天', () => { expect(themeAt({ day: 2, minute: 12 * 60 })).toBe('light') })
  })

  scenario('時鐘不會倒著走', ({ given, when, then }) => {
    given('第 2 天 08:00', (w) => { w.c = { day: 2, minute: 8 * 60 } })
    when('給它負的時間', (w) => { w.c = tick(w.c, -30) })
    then('時間不動', (w) => { expect(w.c).toEqual({ day: 2, minute: 8 * 60 }) })
  })

  scenario('時鐘顯示兩位數的時與分', ({ given, then, and }) => {
    given('早上與晚上的時間', () => {})
    then('早上 6:05 寫成 06:05', () => { expect(hhmm(6 * 60 + 5)).toBe('06:05') })
    and('有零頭的分鐘捨去', () => { expect(hhmm(21 * 60 + 7.9)).toBe('21:07') })
  })
})
