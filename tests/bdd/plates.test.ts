import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CLEAN_CAP, fromRack, putAway, RACK_FULL, TAKE } from '@/game/plates'

feature('碗盤櫃供應客人的盤子', () => {
  scenario('點碗盤櫃，拿一疊盤子到出餐口', ({ given, when, then }) => {
    given('碗盤櫃是滿的，出餐口剩 2 個乾淨盤子', (w) => { w.rack = RACK_FULL; w.clean = 2 })
    when('老闆點碗盤櫃', (w) => { w.n = fromRack(w.rack, w.clean) })
    then(`拿過去一疊 ${TAKE} 個`, (w) => { expect(w.n).toBe(TAKE) })
  })

  scenario('出餐口放不下時只拿放得下的', ({ when, then }) => {
    when('出餐口已經有 10 個', (w) => { w.n = fromRack(RACK_FULL, 10) })
    then(`只拿 ${CLEAN_CAP - 10} 個`, (w) => { expect(w.n).toBe(CLEAN_CAP - 10) })
  })

  scenario('碗盤櫃空了就拿不到', ({ when, then }) => {
    when('碗盤櫃只剩 3 個、出餐口是空的', (w) => { w.n = fromRack(3, 0); w.none = fromRack(0, 0) })
    then('拿 3 個，空了就是 0 個', (w) => { expect(w.n).toBe(3); expect(w.none).toBe(0) })
  })

  scenario('洗好的盤子先放出餐口，放不下的回碗盤櫃', ({ when, then, and }) => {
    when('出餐口有 9 個、碗盤櫃有 20 個，洗好 8 個', (w) => { w.r = putAway(20, 9, 8) })
    then('出餐口放 3 個', (w) => { expect(w.r.toStack).toBe(3) })
    and('其餘 5 個回碗盤櫃', (w) => { expect(w.r.toRack).toBe(5) })
  })
})
