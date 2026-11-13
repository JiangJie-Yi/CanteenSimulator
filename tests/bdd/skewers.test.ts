import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { SKEWER_POOL, pickUpDirty, putBackClean, skewerTotal, startSkewers, takeSkewer, usedSkewer, washAll, washGoes, washUrgent } from '@/game/skewers'

feature('50 支鐵串循環', () => {
  scenario('一支鐵串從筒裡到食物、到髒盤、洗好回筒，總數一直是 50', ({ given, when, then, and }) => {
    given('一天開始，50 支都是乾淨的', (w) => { w.s = startSkewers(); w.inUse = 0 })
    when('穿了 12 支', (w) => { for (let i = 0; i < 12; i++) w.s = takeSkewer(w.s)!; w.inUse = 12 })
    then('筒裡剩 38', (w) => { expect(w.s.clean).toBe(38); expect(skewerTotal(w.s, w.inUse)).toBe(SKEWER_POOL) })
    when('出餐時拔下 10 支放進髒盤', (w) => { for (let i = 0; i < 10; i++) w.s = usedSkewer(w.s); w.inUse = 2 })
    then('該去洗了', (w) => { expect(washGoes(w.s)).toBe(true); expect(skewerTotal(w.s, w.inUse)).toBe(SKEWER_POOL) })
    when('整盤拿去洗', (w) => { w.s = pickUpDirty(w.s) })
    then('髒盤空了、手上 10 支', (w) => { expect(w.s.dirty).toBe(0); expect(w.s.carrying).toBe(10); expect(washGoes(w.s)).toBe(false) })
    and('洗好插回筒裡', (w) => { w.s = putBackClean(w.s); expect(w.s.clean).toBe(48); expect(skewerTotal(w.s, w.inUse)).toBe(SKEWER_POOL) })
  })
  scenario('筒裡沒有就穿不了', ({ given, then }) => {
    given('50 支都在用', (w) => { w.s = { clean: 0, dirty: 0, carrying: 0 } })
    then('拿不到', (w) => { expect(takeSkewer(w.s)).toBeNull() })
  })
  scenario('筒裡快沒了，髒的不到 10 支也去洗', ({ given, then }) => {
    given('筒裡 4 支、髒盤 3 支', (w) => { w.s = { clean: 4, dirty: 3, carrying: 0 } })
    then('去洗', (w) => { expect(washGoes(w.s)).toBe(true) })
  })
  scenario('筒裡剩 5 支以下是急的（廚師快穿不了串）', ({ then, but }) => {
    then('筒裡 5 支、髒盤 12 支：急', () => { expect(washUrgent({ clean: 5, dirty: 12, carrying: 0 })).toBe(true) })
    but('筒裡 20 支、髒盤 12 支：該洗但不急', () => { expect(washGoes({ clean: 20, dirty: 12, carrying: 0 })).toBe(true); expect(washUrgent({ clean: 20, dirty: 12, carrying: 0 })).toBe(false) })
    but('已經有人拿去洗了：不急', () => { expect(washUrgent({ clean: 2, dirty: 0, carrying: 10 })).toBe(false) })
  })
  scenario('打烊時全部洗好', ({ given, then }) => {
    given('髒盤 7、手上 5、筒裡 38', (w) => { w.s = { clean: 38, dirty: 7, carrying: 5 } })
    then('全部回到筒裡', (w) => { expect(washAll(w.s)).toEqual({ clean: 50, dirty: 0, carrying: 0 }) })
  })
})
