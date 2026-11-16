import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { REARM, fullHouse } from '@/game/fullHouse'

// (item 209, the owner's, 2026-11-16: 「我要讓這遊戲看起來覺得好玩」: a busy night went by with nothing to say so)
feature('大入：吧台坐滿時蓋一個大入的章（第 209 項）', () => {
  scenario('最後一個位子坐下時蓋章', ({ given, when, then }) => {
    given('8 個位子坐了 7 位', (w) => { w.s = fullHouse({ armed: true }, 7, 8) })
    when('第 8 位坐下', (w) => { w.s = fullHouse(w.s, 8, 8) })
    then('大入', (w) => { expect(w.s.full).toBe(true) })
  })
  scenario('一直坐滿不會一直蓋', ({ given, when, then }) => {
    given('剛蓋過章', (w) => { w.s = fullHouse({ armed: true }, 8, 8) })
    when('一位起身、下一位馬上坐下', (w) => { w.s = fullHouse(fullHouse(w.s, 7, 8), 8, 8) })
    then('不再蓋', (w) => { expect(w.s.full).toBe(false) })
  })
  scenario(`空出 ${REARM} 個位子再坐滿，再蓋一次`, ({ given, when, then }) => {
    given('剛蓋過章', (w) => { w.s = fullHouse({ armed: true }, 8, 8) })
    when(`空出 ${REARM} 位，又坐滿`, (w) => { w.s = fullHouse(fullHouse(w.s, 8 - REARM, 8), 8, 8) })
    then('再蓋一次', (w) => { expect(w.s.full).toBe(true) })
  })
  scenario('沒有位子的店不算', ({ then }) => {
    then('0 個位子永遠不是大入', () => { expect(fullHouse({ armed: true }, 0, 0).full).toBe(false) })
  })
})
