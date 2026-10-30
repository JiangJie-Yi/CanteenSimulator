import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { fireSound, murmur } from '@/game/fireSound'

feature('炭火的聲音', () => {
  scenario('沒有火就沒有聲音', ({ given, when, then }) => {
    given('火已熄，火上還有三串', (w) => { w.fire = 0; w.on = 3 })
    when('聽', (w) => { w.s = fireSound(w.fire, w.on) })
    then('沒有劈啪聲也沒有滋滋聲', (w) => { expect(w.s.crackle).toBe(0); expect(w.s.sizzle).toBe(0) })
  })

  scenario('火越旺，炭的劈啪聲越大', ({ given, when, then }) => {
    given('小火與大火', (w) => { w.lo = fireSound(0.3, 0); w.hi = fireSound(0.9, 0) })
    when('比較', () => {})
    then('大火的劈啪聲比小火大', (w) => { expect(w.hi.crackle).toBeGreaterThan(w.lo.crackle) })
  })

  scenario('火上沒有食物就沒有滋滋聲，有食物才有', ({ given, when, then, and }) => {
    given('同樣的火', (w) => { w.none = fireSound(0.8, 0); w.one = fireSound(0.8, 1) })
    when('比較', () => {})
    then('空火沒有滋滋聲', (w) => { expect(w.none.sizzle).toBe(0) })
    and('放一串就有', (w) => { expect(w.one.sizzle).toBeGreaterThan(0) })
  })

  scenario('食物越多滋滋聲越大，但不會無限大', ({ given, when, then, and }) => {
    given('一串、四串、十六串', (w) => { w.s = [1, 4, 16].map((n) => fireSound(0.8, n).sizzle) })
    when('比較', () => {})
    then('越多越大', (w) => { expect(w.s[1]).toBeGreaterThan(w.s[0]); expect(w.s[2]).toBeGreaterThan(w.s[1]) })
    and('最多到 1', (w) => { expect(w.s[2]).toBeLessThanOrEqual(1) })
  })
})

feature('店裡的人聲', () => {
  scenario('沒有客人就安靜，客人越多越熱鬧，但不會吵翻', ({ given, when, then, and }) => {
    given('零、二、八、二十位客人在座', (w) => { w.m = [0, 2, 8, 20].map((n) => murmur(n)) })
    when('聽', () => {})
    then('沒人時沒有人聲', (w) => { expect(w.m[0]).toBe(0) })
    and('人越多越大聲', (w) => { expect(w.m[2]).toBeGreaterThan(w.m[1]); expect(w.m[3]).toBeGreaterThan(w.m[2]) })
    and('最多到 1', (w) => { expect(w.m[3]).toBeLessThanOrEqual(1) })
  })
})
