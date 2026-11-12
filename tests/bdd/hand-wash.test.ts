import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DRAIN_CAP, DRAIN_MIN, drainSays, drainTick, handOne, handWashSays, unbasket, type Drain } from '@/game/plates'
import { MINUTES_PER_SECOND } from '@/game/clock'

feature('玩家手動洗碗', () => {
  scenario('點水槽洗一個盤子，放進瀝水籃', ({ given, when, then, and }) => {
    given('水槽裡有 3 個髒盤子，瀝水籃是空的', (w) => { w.dirty = 3; w.drain = { n: 0, left: null } as Drain })
    when('玩家點一下水槽', (w) => { const r = handOne(w.dirty, w.drain); w.dirty = r.dirty; w.drain = r.drain })
    then('髒盤少一個，瀝水籃多一個', (w) => { expect(w.dirty).toBe(2); expect(w.drain.n).toBe(1) })
    and('開始瀝乾，要等遊戲時間 10 分鐘', (w) => { expect(w.drain.left! * MINUTES_PER_SECOND).toBe(DRAIN_MIN) })
  })
  scenario('還沒瀝乾不能收', ({ given, when, then }) => {
    given('瀝水籃裡 2 個盤子，還要 5 分鐘', (w) => { w.drain = { n: 2, left: 5 / MINUTES_PER_SECOND } as Drain })
    when('玩家點瀝水籃', (w) => { w.u = unbasket(w.drain) })
    then('一個都收不走，提示還要幾分鐘', (w) => { expect(w.u.take).toBe(0); expect(drainSays(w.drain)).toContain('還要 5 分鐘') })
  })
  scenario('瀝乾了點瀝水籃，盤子搬回碗盤架', ({ given, when, then }) => {
    given('瀝水籃裡 2 個盤子，時間到了', (w) => { w.drain = drainTick({ n: 2, left: 1 } as Drain, 2) })
    when('玩家點瀝水籃', (w) => { w.u = unbasket(w.drain) })
    then('兩個都收回，籃子空了', (w) => { expect(w.u.take).toBe(2); expect(w.u.drain.n).toBe(0); expect(drainSays(w.drain)).toContain('乾了') })
  })
  scenario('瀝水籃滿了就不能再洗', ({ given, then }) => {
    given('瀝水籃滿了', (w) => { w.drain = { n: DRAIN_CAP, left: 3 } as Drain })
    then('水槽提示先收乾的，洗也洗不進去', (w) => { expect(handWashSays(4, w.drain)).toContain('滿了'); expect(handOne(4, w.drain).dirty).toBe(4) })
  })
})
