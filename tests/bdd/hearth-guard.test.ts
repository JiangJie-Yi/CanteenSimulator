import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BODY, keepOut, PIT_ROOM, type HearthZones } from '@/game/hearthGuard'

// (the shop's own: the cook table, its hearth's frame, the owner's notch and the third cook's bay, in the table's frame (Roasting))
const Z: HearthZones = {
  table: { along: [-1.8, 3.1], lay: [-2.1, 2.1] },
  pit: { along: [-0.74, 2.04], lay: [-1.21, 1.21] },
  notch: { along: [-0.04, 1.26], lay: [1.26, 2.1] },
  bay: { along: [2.33, 3.1], lay: [-0.98, 0.32] },
}
const inPit = ([al, la]: [number, number], pad = 0) => al > Z.pit.along[0] - pad && al < Z.pit.along[1] + pad && la > Z.pit.lay[0] - pad && la < Z.pit.lay[1] + pad
const onTable = ([al, la]: [number, number]) => al > Z.table.along[0] - BODY + 1e-9 && al < Z.table.along[1] + BODY - 1e-9 && la > Z.table.lay[0] - BODY + 1e-9 && la < Z.table.lay[1] + BODY - 1e-9

feature('灶台與圍爐裏是禁區', () => {
  scenario('走進火爐裡的外場被推回桌子外', ({ given, when, then }) => {
    given('一位外場的腳落在火爐正中', (w) => { w.at = [0.65, 0] })
    when('這一格畫出來之前', (w) => { w.now = keepOut(w.at[0], w.at[1], 'other', Z) })
    then('他站在灶台桌外，連桌邊的半個身體都不在桌上', (w) => { expect(onTable(w.now)).toBe(false) })
  })

  scenario('外場、二廚、收銀、客人都不能站進老闆的缺口', ({ given, when, then }) => {
    given('一位二廚走到老闆的缺口裡', (w) => { w.at = [0.61, 1.9] })
    when('這一格畫出來之前', (w) => { w.now = keepOut(w.at[0], w.at[1], 'other', Z) })
    then('他被推到桌子前面', (w) => { expect(onTable(w.now)).toBe(false); expect(w.now[1]).toBeCloseTo(Z.table.lay[1] + BODY) })
  })

  scenario('老闆站在自己的缺口裡不受影響', ({ given, when, then }) => {
    given('老闆站在缺口的木台階上', (w) => { w.at = [0.61, 2.3] })
    when('這一格畫出來之前', (w) => { w.now = keepOut(w.at[0], w.at[1], 'owner', Z) })
    then('他還在原地', (w) => { expect(w.now).toEqual([0.61, 2.3]) })
  })

  scenario('老闆也不能踩進火爐', ({ given, when, then, and }) => {
    given('老闆往前踩到火爐框邊', (w) => { w.at = [0.61, 1.3] })
    when('這一格畫出來之前', (w) => { w.now = keepOut(w.at[0], w.at[1], 'owner', Z) })
    then('他被擋在缺口裡，離火爐框留著身體的距離', (w) => { expect(inPit(w.now, PIT_ROOM + BODY - 1e-9)).toBe(false) })
    and('他沒有被推出缺口的兩側', (w) => { expect(w.now[0]).toBeCloseTo(0.61) })
  })

  scenario('三廚站在自己的凹槽裡不受影響，但也不能進火爐', ({ given, when, then, and }) => {
    given('三廚站在灶台尾端的凹槽，另一位三廚走進了火爐', (w) => { w.home = [2.75, -0.33]; w.lost = [1.5, 0] })
    when('這一格畫出來之前', (w) => { w.a = keepOut(w.home[0], w.home[1], 'sous', Z); w.b = keepOut(w.lost[0], w.lost[1], 'sous', Z) })
    then('在凹槽裡的還在原地', (w) => { expect(w.a).toEqual([2.75, -0.33]) })
    and('走進火爐的被推出火爐', (w) => { expect(inPit(w.b, PIT_ROOM)).toBe(false) })
  })

  scenario('站在灶台外的人不受影響', ({ given, when, then }) => {
    given('一位外場站在桌子前的走道上', (w) => { w.at = [0.2, 3.0] })
    when('這一格畫出來之前', (w) => { w.now = keepOut(w.at[0], w.at[1], 'other', Z) })
    then('他還在原地', (w) => { expect(w.now).toEqual([0.2, 3.0]) })
  })
})
