import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { AVOID, AVOID_BY, BOARD_SLOTS, RING_AZ, RING_SLOTS, boardRoom, freeRingSlot, gapDeg } from '@/game/fireSlots'
import { nextTrip } from '@/game/chefFlow'

feature('灶台的固定位置：火邊、砧板（尖峰時段不再疊成一堆）', () => {
  scenario('火邊最多八串，每串一個固定的位置', ({ then, and }) => {
    then('八個位置', () => { expect(RING_AZ.length).toBe(RING_SLOTS); expect(RING_SLOTS).toBe(8) })
    and('都避開鏡頭看火的方向與以前放盤子的地方', () => {
      for (const a of RING_AZ) for (const v of AVOID) expect(gapDeg(a, v)).toBeGreaterThanOrEqual(AVOID_BY - 1e-6)
    })
    and('彼此至少隔 30 度，串與串不會撞在一起', () => {
      for (let i = 0; i < RING_AZ.length; i++) for (let j = i + 1; j < RING_AZ.length; j++) expect(gapDeg(RING_AZ[i], RING_AZ[j])).toBeGreaterThanOrEqual(30)
    })
  })

  scenario('火邊滿了就不再上火', ({ given, then, and }) => {
    given('八個位置都有串', (w) => { w.taken = new Set(Array.from({ length: RING_SLOTS }, (_, k) => k)) })
    then('沒有空位', (w) => { expect(freeRingSlot(w.taken)).toBeNull() })
    and('拿掉一串就空出那一個', (w) => { w.taken.delete(5); expect(freeRingSlot(w.taken)).toBe(5) })
  })

  scenario('砧板上最多四串生串，滿了二廚就在砧板旁等，不再去拿料', ({ given, when, then, and }) => {
    given('冷凍櫃裡等著拿的有三份', (w) => { w.q = [{ key: 'a', id: 'Mackerel', at: 1 }, { key: 'b', id: 'Aji', at: 2 }, { key: 'c', id: 'Iwashi', at: 3 }] })
    when('砧板上已經有四串', (w) => { w.trip = nextTrip(w.q, boardRoom(BOARD_SLOTS)) })
    then('他不走', (w) => { expect(w.trip).toBeNull() })
    and('砧板上有兩串時，只拿得回兩份', (w) => { expect(nextTrip(w.q, boardRoom(2))!.keys).toEqual(['a', 'b']) })
    and('路上已經有一份要放上去時，再少一份', (w) => { expect(nextTrip(w.q, boardRoom(2, 1))!.keys).toEqual(['a']) })
  })
})
