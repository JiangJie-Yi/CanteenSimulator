import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { SKIES, START, hhmm, isNight, nextSky, skyAt, themeAt, tick, type Sky } from '@/game/clock'

/** how long a part of the day lasts, in game minutes */
const lengthOf = (s: Sky) => {
  const k = SKIES.findIndex((p) => p.sky === s)
  const next = SKIES[(k + 1) % SKIES.length].from
  return (next - SKIES[k].from + 24 * 60) % (24 * 60)
}

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

  scenario('一天分成清晨、白天、黃昏、黑夜，清晨與黃昏比較短', ({ given, then, and }) => {
    given('一天裡的幾個時候', () => {})
    then('早上五點天開始亮，是清晨', () => { expect(skyAt(5 * 60)).toBe('dawn'); expect(skyAt(5 * 60 - 1)).toBe('night') })
    and('六點半是白天', () => { expect(skyAt(6 * 60 + 30)).toBe('day'); expect(skyAt(6 * 60 + 29)).toBe('dawn') })
    and('傍晚五點是黃昏', () => { expect(skyAt(17 * 60)).toBe('dusk'); expect(skyAt(17 * 60 - 1)).toBe('day') })
    and('六點半天黑', () => { expect(skyAt(18 * 60 + 30)).toBe('night'); expect(skyAt(18 * 60 + 29)).toBe('dusk') })
    and('半夜是黑夜', () => { expect(skyAt(0)).toBe('night'); expect(isNight(0)).toBe(true) })
    and('清晨與黃昏各一個半小時，白天、黑夜都長得多', () => {
      expect(lengthOf('dawn')).toBe(90)
      expect(lengthOf('dusk')).toBe(90)
      expect(lengthOf('day')).toBeGreaterThan(lengthOf('dawn') * 4)
      expect(lengthOf('night')).toBeGreaterThan(lengthOf('dusk') * 4)
    })
    and('四段加起來是一整天', () => { expect(SKIES.reduce((n, p) => n + lengthOf(p.sky), 0)).toBe(24 * 60) })
  })

  scenario('畫面只有黑夜是暗的，清晨與黃昏的面板還是亮的', ({ given, then, and }) => {
    given('一天裡的幾個時候', () => {})
    then('半夜是暗的', () => { expect(themeAt({ day: 2, minute: 0 })).toBe('dark') })
    and('清晨、中午、黃昏是亮的', () => {
      for (const m of [5 * 60 + 30, 12 * 60, 17 * 60 + 30]) expect(themeAt({ day: 2, minute: m })).toBe('light')
    })
  })

  scenario('按一下時鐘上的太陽，時間跳到下一段的開頭（測光源用）', ({ given, when, then, and }) => {
    given('第 2 天中午 12:00', (w) => { w.c = { day: 2, minute: 12 * 60 } })
    when('按一下', (w) => { w.c = nextSky(w.c) })
    then('是第 2 天 17:00，黃昏', (w) => { expect(w.c).toEqual({ day: 2, minute: 17 * 60 }); expect(skyAt(w.c.minute)).toBe('dusk') })
    when('再按一下', (w) => { w.c = nextSky(w.c) })
    then('18:30，黑夜', (w) => { expect(hhmm(w.c.minute)).toBe('18:30'); expect(skyAt(w.c.minute)).toBe('night') })
    when('再按一下', (w) => { w.c = nextSky(w.c) })
    then('隔天早上五點，清晨', (w) => { expect(w.c).toEqual({ day: 3, minute: 5 * 60 }); expect(skyAt(w.c.minute)).toBe('dawn') })
    when('再按一下', (w) => { w.c = nextSky(w.c) })
    then('06:30，白天', (w) => { expect(hhmm(w.c.minute)).toBe('06:30'); expect(skyAt(w.c.minute)).toBe('day') })
  })

  scenario('半夜按一下，是同一天的清晨', ({ given, when, then }) => {
    given('第 4 天 02:00', (w) => { w.c = { day: 4, minute: 2 * 60 } })
    when('按一下', (w) => { w.c = nextSky(w.c) })
    then('第 4 天 05:00', (w) => { expect(w.c).toEqual({ day: 4, minute: 5 * 60 }) })
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
