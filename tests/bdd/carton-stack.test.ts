import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CARTON_CASES, cartonStack } from '@/game/cartonStack'

// (24 cans to each of these cases, as game/drinkStock's CASE_SIZE has them)
const caseOf = () => 24
const full = { beerCan: 48, greenTea: 48, cola: 48, highball: 48, chuhai: 24 }

feature('飲料櫃旁的紙箱跟著後場的備品（店主 2026-11-16「庫存的東西沒對上」，第 199 項）', () => {
  scenario('後場都滿的，九箱照原本的疊法', ({ given, then }) => {
    given('每種都有兩箱（酎ハイ一箱）', (w) => { w.at = cartonStack(full, caseOf) })
    then('九箱都在，各在原本那一層', (w) => {
      expect(w.at.every((a: { shown: boolean }) => a.shown)).toBe(true)
      w.at.forEach((a: { layer: number; col: number }, i: number) => { expect(a.layer).toBe(CARTON_CASES[i].layer); expect(a.col).toBe(CARTON_CASES[i].col) })
    })
  })
  scenario('罐裝啤酒只剩不到一箱，上面那箱不見，最上面那箱靠到高的那一邊', ({ given, then, and }) => {
    given('罐裝啤酒剩 10 罐', (w) => { w.at = cartonStack({ ...full, beerCan: 10 }, caseOf) })
    then('最下面那箱罐裝啤酒還在，第四層那箱不見', (w) => { expect(w.at[0].shown).toBe(true); expect(w.at[6].shown).toBe(false) })
    and('左邊只剩三層，右邊四層：最上面那箱放在右邊那疊上，不浮空', (w) => { expect(w.at[8]).toEqual({ shown: true, layer: 4, col: 1 }) })
  })
  scenario('可樂賣光了，它上面的箱子落下來', ({ given, then, and }) => {
    given('可樂 0 罐', (w) => { w.at = cartonStack({ ...full, cola: 0 }, caseOf) })
    then('兩箱可樂都不見', (w) => { expect(w.at[2].shown).toBe(false); expect(w.at[5].shown).toBe(false) })
    and('上面的各落一層', (w) => {
      expect(w.at[4].layer).toBe(1)
      expect(w.at[6].layer).toBe(2)
      expect(w.at[7].layer).toBe(2)
    })
    and('兩邊一樣高，最上面那箱照樣橫跨兩疊', (w) => { expect(w.at[8]).toEqual({ shown: true, layer: 3, col: -1 }) })
  })
  scenario('後場什麼都沒有，一箱都不畫', ({ given, then }) => {
    given('每種都 0', (w) => { w.at = cartonStack({}, caseOf) })
    then('九箱都不見', (w) => { expect(w.at.some((a: { shown: boolean }) => a.shown)).toBe(false) })
  })
})
