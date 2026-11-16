import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BANKRUPT_AT, CAPITAL, SHOP_COST, bankrupt, savingsOf, warningsDue } from '@/game/economy'

feature('存款跌到 -10 萬就收店（店主 2026-11-17：「存款-10w就直接收店」）', () => {
  scenario('還沒到 -10 萬照常營業', ({ then, and }) => {
    then('存款 -99,999：還開著', () => { expect(bankrupt(-99_999)).toBe(false) })
    and('開店後手上的 20 萬：離收店還很遠', () => { expect(bankrupt(CAPITAL - SHOP_COST)).toBe(false); expect(CAPITAL - SHOP_COST - BANKRUPT_AT).toBe(300_000) })
  })
  scenario('到 -10 萬就收店', ({ then, and }) => {
    then('存款 -100,000：收店', () => { expect(BANKRUPT_AT).toBe(-100_000); expect(bankrupt(-100_000)).toBe(true) })
    and('更低也是', () => { expect(bankrupt(-180_000)).toBe(true) })
  })
  scenario('收銀機抽屜裡還沒拿出來的錢也算存款', ({ given, then }) => {
    given('手上 -110,000、抽屜裡收了 30,000 還沒拿出來', (w) => { w.s = savingsOf(-110_000, { tillIn: 30_000, till: 0 }) })
    then('存款 -80,000，還沒收店', (w) => { expect(w.s).toBe(-80_000); expect(bankrupt(w.s)).toBe(false) })
  })
  scenario('一路往下時先提醒：跌破 0、跌破 -5 萬各一次', ({ then, and }) => {
    then('剛跌破 0：提醒「存款見底」', () => { expect(warningsDue(-10, [])).toEqual([0]) })
    and('跌破 -5 萬：只提醒還沒說過的那次', () => { expect(warningsDue(-60_000, [0])).toEqual([-50_000]) })
    and('都說過了：不再提醒', () => { expect(warningsDue(-60_000, [0, -50_000])).toEqual([]) })
    and('存款回到正的：不提醒', () => { expect(warningsDue(5_000, [])).toEqual([]) })
  })
})
