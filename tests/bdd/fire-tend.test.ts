import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { COAL_WAIT_S, fireCall, HOT_S } from '@/game/fireTend'

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
  scenario('沒有人可以叫（閉店或沒有三廚）：火弱就自己加炭，火旺不管', ({ given, then, and }) => {
    given('沒有三廚', (w) => { w.s = { fire: 0.3, tender: false, want: null, hotFor: 0, askedFor: 0 } })
    then('火弱時自己加', (w) => { expect(fireCall(w.s)).toBe('drop-coal') })
    and('火旺時不灑水', (w) => { expect(fireCall({ ...w.s, fire: 0.98, hotFor: 30 })).toBe('none') })
  })
})
