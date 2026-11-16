import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BUSY_AT, BUSY_LOW, BUSY_WAIT_S, COAL_WAIT_S, FIRE_LOW, fireCall, fireLow, HOT_S, roastRate } from '@/game/fireTend'

feature('三廚顧火', () => {
  scenario('火弱時叫三廚拿炭，等他倒進爐裡', ({ given, when, then }) => {
    given('營業中、三廚在、火剩 0.3', (w) => { w.s = { fire: 0.3, tender: true, want: null, hotFor: 0, askedFor: 0 } })
    then('叫他拿炭', (w) => { expect(fireCall(w.s)).toBe('ask-coal') })
    when('已經叫了', (w) => { w.s.want = 'coal'; w.s.askedFor = 5 })
    then('灶台不自己加，等他', (w) => { expect(fireCall(w.s)).toBe('wait') })
  })
  scenario('火快熄了，三廚還在忙別的太久，主廚自己加', ({ given, then }) => {
    given(`叫了炭 ${COAL_WAIT_S + 1} 秒還沒來，火剩 0.1`, (w) => { w.s = { fire: 0.1, tender: true, want: 'coal', hotFor: 0, askedFor: COAL_WAIT_S + 1 } })
    then('主廚自己丟一把', (w) => { expect(fireCall(w.s)).toBe('drop-coal') })
  })
  scenario('火太旺一陣子，叫三廚灑水退火', ({ given, then, but }) => {
    given(`火很旺已經 ${HOT_S + 1} 秒`, (w) => { w.s = { fire: 0.95, tender: true, want: null, hotFor: HOT_S + 1, askedFor: 0 } })
    then('叫他舀水', (w) => { expect(fireCall(w.s)).toBe('ask-water') })
    but('剛旺起來還不用', (w) => { expect(fireCall({ ...w.s, hotFor: 2 })).toBe('none') })
  })
  // (item 207, the owner's: 「大火侯的炭火可以烤得快…你要負責制定一套流暢的流程」: the fire was let fall to 0.35 before any charcoal went on,
  // and ran at half its strength all evening, so everything took twice as long)
  scenario('廚房忙的時候火顧得比較旺', ({ given, then, and }) => {
    given(`火上與等著上火的串有 ${BUSY_AT} 串以上`, (w) => { w.busy = BUSY_AT })
    then(`火掉到 ${BUSY_LOW} 以下就加炭（閒的時候是 ${FIRE_LOW}）`, (w) => {
      expect(fireLow(w.busy)).toBe(BUSY_LOW)
      expect(fireLow(1)).toBe(FIRE_LOW)
      expect(BUSY_LOW).toBeGreaterThan(FIRE_LOW)
    })
    and(`忙的時候三廚 ${BUSY_WAIT_S} 秒還沒拿炭來，主廚自己丟一把（不等到火快熄）`, () => {
      expect(fireCall({ fire: 0.5, tender: true, want: 'coal', hotFor: 0, askedFor: BUSY_WAIT_S + 1, low: fireLow(BUSY_AT) })).toBe('drop-coal')
      expect(fireCall({ fire: 0.5, tender: true, want: 'coal', hotFor: 0, askedFor: BUSY_WAIT_S - 1, low: fireLow(BUSY_AT) })).toBe('wait')
    })
    and('火剩 0.5、廚房忙：叫三廚拿炭', () => {
      expect(fireCall({ fire: 0.5, tender: true, want: null, hotFor: 0, askedFor: 0, low: fireLow(BUSY_AT) })).toBe('ask-coal')
      expect(fireCall({ fire: 0.5, tender: true, want: null, hotFor: 0, askedFor: 0, low: fireLow(0) })).toBe('none')
    })
  })
  scenario('大火烤得快', ({ then, and }) => {
    then('火力 0.7 烤的速度是 0.4 的 1.6 倍以上', () => { expect(roastRate(0.7) / roastRate(0.4)).toBeGreaterThan(1.6) })
    and('滿火是兩倍半以上的快（跟火力 0.5 比）', () => { expect(roastRate(1) / roastRate(0.5)).toBeGreaterThan(2.5) })
    and('快熄的炭還是會慢慢烤', () => { expect(roastRate(0)).toBeGreaterThan(0) })
  })
  scenario('沒有人可以叫（閉店或沒有三廚）：火弱就自己加炭，火旺不管', ({ given, then, and }) => {
    given('沒有三廚', (w) => { w.s = { fire: 0.3, tender: false, want: null, hotFor: 0, askedFor: 0 } })
    then('火弱時自己加', (w) => { expect(fireCall(w.s)).toBe('drop-coal') })
    and('火旺時不灑水', (w) => { expect(fireCall({ ...w.s, fire: 0.98, hotFor: 30 })).toBe('none') })
  })
})
