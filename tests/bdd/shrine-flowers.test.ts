import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { flowerBuffs, nextFlower } from '@/game/shrineFlowers'

feature('神龕供花各有不同的加持', () => {
  scenario('供榊與小菊，客人更有耐心', ({ given, when, then, and, but }) => {
    given('左邊花瓶是榊與小菊，右邊是白金菊', (w) => { w.vases = [0, 1] })
    when('看加持', (w) => { w.b = flowerBuffs(w.vases) })
    then('客人等得比較久', (w) => { expect(w.b.patience).toBeGreaterThan(1) })
    and('右邊的白金菊讓客人更常拿飲料', (w) => { expect(w.b.drinks).toBeGreaterThan(1) })
    but('沒有紅粉花，情侶不會變多', (w) => { expect(w.b.pairs).toBe(1) })
  })

  scenario('兩瓶都供同一種花，加持加倍', ({ given, when, then }) => {
    given('兩邊都是紅粉花', (w) => { w.one = flowerBuffs([2, 0]); w.two = flowerBuffs([2, 2]) })
    when('比較一瓶和兩瓶', () => {})
    then('兩瓶增加的情侶比例是一瓶的兩倍', (w) => { expect(w.two.pairs - 1).toBeCloseTo(2 * (w.one.pairs - 1), 6) })
  })

  scenario('沒有供那種花，就沒有那種加持', ({ given, when, then }) => {
    given('兩邊都是榊與小菊', (w) => { w.vases = [0, 0] })
    when('看加持', (w) => { w.b = flowerBuffs(w.vases) })
    then('飲料與情侶都不變', (w) => { expect(w.b.drinks).toBe(1); expect(w.b.pairs).toBe(1) })
  })

  scenario('點花瓶依序換花，換完一輪回到第一組', ({ given, when, then }) => {
    given('花瓶是榊與小菊', (w) => { w.f = 0 })
    when('點三下', (w) => { w.seen = [nextFlower(w.f), nextFlower(nextFlower(w.f)), nextFlower(nextFlower(nextFlower(w.f)))] })
    then('依序是白金菊、紅粉花、榊與小菊', (w) => { expect(w.seen).toEqual([1, 2, 0]) })
  })
})
