import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { TRAY_MAX, fromTray, trayWants, warmKama, emptyKama, setOn } from '@/game/rice'

feature('三廚先捏好飯糰放在竹盤上（店主要的，第 129 項）', () => {
  scenario('竹盤沒滿、電鍋的飯煮好了，三廚才去捏', ({ then, and, but }) => {
    then('竹盤 1 個、飯還有：去捏', () => { expect(trayWants(1, 10, warmKama())).toBe(true) })
    and('竹盤滿了：不捏', () => { expect(trayWants(TRAY_MAX, 10, warmKama())).toBe(false) })
    but('電鍋還在煮或是空的：不捏', () => {
      expect(trayWants(0, 10, setOn())).toBe(false)
      expect(trayWants(0, 0, emptyKama())).toBe(false)
    })
  })
  scenario('點了飯糰，先拿竹盤上的，不夠的才現捏', ({ then, and }) => {
    then('竹盤 3 個、點 2 個：拿 2 個，不用捏', () => { expect(fromTray(3, 2)).toEqual({ use: 2, left: 1, shape: 0 }) })
    and('竹盤 1 個、點 3 個：拿 1 個，現捏 2 個', () => { expect(fromTray(1, 3)).toEqual({ use: 1, left: 0, shape: 2 }) })
    and('竹盤空的：全部現捏', () => { expect(fromTray(0, 2)).toEqual({ use: 0, left: 0, shape: 2 }) })
  })
})
