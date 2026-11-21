import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DRAIN_CAP, DRAIN_MIN, drainSays, drainTick, handOne, handWashSays, unbasket, type Drain } from '@/game/plates'
import { MINUTES_PER_SECOND } from '@/game/clock'
import { HAND_RUB, NO_SOAP_SLOW, RINSE_RATE, SCRUB_RATE, SOAK_RATE, SOAP_X, WASH_BEATS, beatLength, handClean, handSays, handStops, scrubbed, washBeat, washPlateS } from '@/game/handWash'
import { CLEAN_AT } from '@/game/plates'

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
  // (item 217, the owner's 「這洗碗的流程定的太死」: he stopped when the liquid ran out, and the basin had to be a quarter full)
  scenario('洗碗精用完了，他照樣洗，只是刷得慢', ({ given, when, then, and }) => {
    given('洗碗精夠 3 個', (w) => { w.s = ready({ soap: 3 }) })
    when('他刷了 3 個', (w) => { for (let k = 0; k < 3; k++) { const r = handOne(w.s.dirty, w.s.drain); w.s = { ...w.s, dirty: r.dirty, drain: r.drain, soap: scrubbed(w.s.soap) } } })
    then('洗碗精沒了，他不停手', (w) => { expect(w.s.dirty).toBe(3); expect(handStops(w.s)).toBeNull() })
    and('沒有洗碗精的盤子刷得久', () => {
      expect(beatLength('scrub', 0.5, false)).toBeCloseTo(beatLength('scrub', 0.5) * NO_SOAP_SLOW)
      expect(washPlateS(0.5, false)).toBeGreaterThan(washPlateS(0.5))
    })
  })
  scenario('全部洗完、瀝水籃滿了、沒水，各自停手', ({ then, and, but }) => {
    then('沒有髒盤：洗好了', () => { expect(handStops(ready({ dirty: 0 }))).toBe('done') })
    and('瀝水籃滿了', () => { expect(handStops(ready({ drain: { n: DRAIN_CAP, left: 3 } as Drain }))).toBe('basketFull') })
    and('水龍頭關著、水槽也沒水', () => { expect(handStops(ready({ water: 0 }))).toBe('water') })
    but('水龍頭開著，水槽空的也照洗（沖著洗）', () => { expect(handStops({ ...ready({ water: 0 }), tap: true })).toBeNull() })
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

// (item 224, the owner's 「自己洗盤子的時候老闆不用來，可以拖曳盤子泡水or給水龍頭直接沖，用菜瓜布+洗碗精清潔更快」)
feature('玩家自己拿盤子洗（第 224 項）', () => {
  const bare = { sponge: false, soap: false, scrub: 0 }
  scenario('拿在手上不碰水，不會變乾淨', ({ then }) => {
    then('一秒後一樣髒', () => { expect(handClean(0.6, 1, null, bare)).toBe(0.6) })
  })
  scenario('水龍頭下沖得比泡水快', ({ then, and }) => {
    then('沖一秒少 RINSE_RATE', () => { expect(handClean(0.6, 1, 'tap', bare)).toBeCloseTo(0.6 - RINSE_RATE) })
    and('泡一秒少 SOAK_RATE，比沖的少', () => {
      expect(handClean(0.6, 1, 'water', bare)).toBeCloseTo(0.6 - SOAK_RATE)
      expect(SOAK_RATE).toBeLessThan(RINSE_RATE)
    })
  })
  // (item 458: the sponge only cleans as it's rubbed over the plate; held still it does nothing more than the water)
  scenario('菜瓜布加洗碗精洗得更快，來回刷再更快', ({ then, and }) => {
    const left = (o: { sponge: boolean; soap: boolean; scrub: number }) => 0.6 - handClean(0.6, 0.5, 'tap', o)
    then('拿著菜瓜布刷比空手搓快', () => { expect(left({ ...bare, sponge: true, scrub: 1 })).toBeGreaterThan(left({ ...bare, scrub: 1 })) })
    and('加了洗碗精又更快', () => { expect(left({ sponge: true, soap: true, scrub: 1 })).toBeGreaterThan(left({ ...bare, sponge: true, scrub: 1 })) })
    and('來回刷再更快', () => { expect(left({ sponge: true, soap: true, scrub: 1 })).toBeGreaterThan(left({ ...bare, sponge: true, soap: true })) })
    and('菜瓜布、洗碗精、用力刷，一個中等髒的盤子不到一秒半就乾淨', () => {
      let d = 0.6, t = 0
      while (d > CLEAN_AT && t < 10) { d = handClean(d, 0.05, 'tap', { sponge: true, soap: true, scrub: 1 }); t += 0.05 }
      expect(t).toBeLessThan(1.5)
    })
  })
  // (item 234, the owner's 「流理台洗碗玩法還是很不順」: nothing to aim or carry; it says how it's coming on and what would go faster)
  scenario('洗著的盤子說現在怎樣、怎樣更快', ({ then, and }) => {
    then('沒水：說要開水龍頭', () => { expect(handSays(null, 0.5, { sponge: false, soap: false, basketFull: false })).toContain('水龍頭') })
    and('沖水中沒拿菜瓜布：建議拿菜瓜布', () => { expect(handSays('tap', 0.5, { sponge: false, soap: false, basketFull: false })).toContain('菜瓜布') })
    and('拿著菜瓜布、有洗碗精：建議來回刷', () => { expect(handSays('tap', 0.5, { sponge: true, soap: true, basketFull: false })).toContain('來回刷') })
    and('乾淨了：放進瀝水籃', () => { expect(handSays('tap', 0, { sponge: true, soap: true, basketFull: false })).toContain('瀝水籃') })
    and('乾淨了但瀝水籃滿了：先收乾的', () => { expect(handSays('tap', 0, { sponge: true, soap: true, basketFull: true })).toContain('收回碗盤架') })
  })
})

// (item 458, the owner's 「字太小，然後玩的模式不對，應該是拖曳過去，然後用菜瓜布刷，有用洗碗精會加成。」: the plate dragged into the water, the
// sponge taken up and rubbed over it; the liquid a bonus on the rubbing)
feature('拖過去泡著，用菜瓜布刷，洗碗精加成（第 458 項）', () => {
  const still = { sponge: false, soap: false, scrub: 0 }
  scenario('只泡著或沖著，會慢慢變乾淨，但很慢', ({ then, and }) => {
    then('泡一秒只少 SOAK_RATE', () => { expect(handClean(0.6, 1, 'water', still)).toBeCloseTo(0.6 - SOAK_RATE) })
    and('一個很髒的盤子只泡不刷，要十秒以上', () => {
      let d = 1, t = 0
      while (d > CLEAN_AT && t < 60) { d = handClean(d, 0.1, 'water', still); t += 0.1 }
      expect(t).toBeGreaterThan(10)
    })
  })
  scenario('拿著菜瓜布不刷，不會變快', ({ then }) => {
    then('拿著不動跟沒拿一樣', () => { expect(handClean(0.6, 1, 'water', { ...still, sponge: true })).toBeCloseTo(handClean(0.6, 1, 'water', still)) })
  })
  // (how much a second comes off, from a quarter second's washing (a whole second takes a plate this dirty clean, and stops at clean))
  const perS = (o: { sponge: boolean; soap: boolean; scrub: number }) => (0.9 - handClean(0.9, 0.25, 'water', o)) / 0.25
  scenario('用菜瓜布刷是洗乾淨的主要方式', ({ then, and }) => {
    then('用力刷，每秒比泡水多刷掉 SCRUB_RATE', () => {
      expect(perS({ ...still, sponge: true, scrub: 1 })).toBeCloseTo(SOAK_RATE + SCRUB_RATE)
    })
    and('空手搓只有菜瓜布的 HAND_RUB', () => {
      expect(perS({ ...still, scrub: 1 })).toBeCloseTo(SOAK_RATE + SCRUB_RATE * HAND_RUB)
      expect(HAND_RUB).toBeLessThan(0.5)
    })
    and('一個很髒的盤子用菜瓜布用力刷，一秒半內乾淨', () => {
      let d = 1, t = 0
      while (d > CLEAN_AT && t < 10) { d = handClean(d, 0.05, 'water', { ...still, sponge: true, scrub: 1 }); t += 0.05 }
      expect(t).toBeLessThan(1.5)
    })
  })
  scenario('擠了洗碗精，刷的那部分加成 SOAP_X', ({ then }) => {
    then('同樣用力刷，刷的那份變成 SOAP_X 倍', () => {
      const plain = perS({ ...still, sponge: true, scrub: 1 }), soapy = perS({ sponge: true, soap: true, scrub: 1 })
      expect(soapy - SOAK_RATE).toBeCloseTo((plain - SOAK_RATE) * SOAP_X)
    })
  })
  scenario('拿著盤子、泡著、刷著，各說下一步', ({ then, and }) => {
    then('拿著盤子：說拖到水裡，也能放進洗碗機', () => {
      const s = handSays(null, 0.6, { sponge: false, soap: false, basketFull: false, held: true })
      expect(s).toContain('水')
      expect(s).toContain('洗碗機')
    })
    and('泡著、沒拿菜瓜布：說拿菜瓜布來刷', () => { expect(handSays('water', 0.6, { sponge: false, soap: false, basketFull: false })).toContain('菜瓜布') })
    and('拿著菜瓜布、沒擠洗碗精：說擠洗碗精的加成', () => {
      const s = handSays('water', 0.6, { sponge: true, soap: false, basketFull: false })
      expect(s).toContain('洗碗精')
      expect(s).toContain(`×${SOAP_X}`)
    })
  })
})
