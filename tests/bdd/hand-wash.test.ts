import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DRAIN_CAP, DRAIN_MIN, drainSays, drainTick, handOne, handWashSays, unbasket, type Drain } from '@/game/plates'
import { MINUTES_PER_SECOND } from '@/game/clock'
import { WASH_BEATS, WASH_WATER, beatLength, handStops, scrubbed, washBeat, washPlateS } from '@/game/handWash'

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

feature('手洗交給老闆（店主 2026-11-15：不是會有老闆接手來洗嗎）', () => {
  const ready = (o: Partial<{ dirty: number; drain: Drain; water: number; soap: number }> = {}) =>
    ({ dirty: 6, drain: { n: 0, left: null } as Drain, plug: true, water: 1, soap: 3, sponge: true, ...o })
  scenario('有水、有洗碗精、還有髒盤，老闆就繼續刷', ({ given, then }) => {
    given('水槽備好，6 個髒盤，洗碗精夠 3 個', (w) => { w.s = ready() })
    then('他不停手', (w) => { expect(handStops(w.s)).toBeNull() })
  })
  scenario('每刷一個用掉一份洗碗精，用完就停手說一聲', ({ given, when, then }) => {
    given('洗碗精夠 3 個', (w) => { w.s = ready({ soap: 3 }) })
    when('他刷了 3 個', (w) => { for (let k = 0; k < 3; k++) { const r = handOne(w.s.dirty, w.s.drain); w.s = { ...w.s, dirty: r.dirty, drain: r.drain, soap: scrubbed(w.s.soap) } } })
    then('洗碗精沒了，他停手', (w) => { expect(w.s.dirty).toBe(3); expect(handStops(w.s)).toBe('soap') })
  })
  scenario('全部洗完、瀝水籃滿了、水不夠，各自停手', ({ then, and }) => {
    then('沒有髒盤：洗好了', () => { expect(handStops(ready({ dirty: 0 }))).toBe('done') })
    and('瀝水籃滿了', () => { expect(handStops(ready({ drain: { n: DRAIN_CAP, left: 3 } as Drain }))).toBe('basketFull') })
    and('水不到可以洗的高度', () => { expect(handStops(ready({ water: WASH_WATER / 2 }))).toBe('water') })
  })
})

feature('老闆手洗一個盤子的動作', () => {
  scenario('一個盤子依序：拿起、端到水上、刷、沖、放進瀝水籃', ({ given, then, and }) => {
    given('一個中等髒的盤子', (w) => { w.dirt = 0.5 })
    then('一開始是伸手拿盤子', (w) => { expect(washBeat(0, w.dirt as number).beat).toBe('take') })
    and('每一段接著下一段，順序不變', (w) => {
      let t = 0
      for (const b of WASH_BEATS) {
        expect(washBeat(t + 0.001, w.dirt as number).beat).toBe(b)
        t += beatLength(b, w.dirt as number)
      }
    })
    and('全部做完時停在放進瀝水籃的最後', (w) => { expect(washBeat(washPlateS(w.dirt as number), w.dirt as number)).toEqual({ beat: 'rack', k: 1 }) })
  })
  scenario('越髒的盤子刷越久，刷是最長的一段', ({ then, and }) => {
    then('很髒的比幾乎乾淨的多花時間', () => { expect(washPlateS(1)).toBeGreaterThan(washPlateS(0.1)) })
    and('刷比其他每一段都長', () => {
      for (const b of WASH_BEATS) if (b !== 'scrub') expect(beatLength('scrub', 0)).toBeGreaterThan(beatLength(b, 0))
    })
  })
  scenario('每一段的進度都在 0 到 1 之間', ({ then }) => {
    then('從頭到尾每 0.05 秒看一次', () => {
      for (let t = -0.2; t < washPlateS(1) + 0.3; t += 0.05) { const { k } = washBeat(t, 1); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(1) }
    })
  })
})
