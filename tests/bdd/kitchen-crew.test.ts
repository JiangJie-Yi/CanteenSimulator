import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { platerFree, platerOf } from '@/game/kitchenCrew'

const HOUSE = { id: 'house-chef', role: 'chef' }
feature('內場分工：老闆掌爐、二廚取料穿串、三廚擺盤顧火', () => {
  scenario('有三廚時由三廚擺盤、顧火', ({ given, then }) => {
    given('雇了二廚與三廚', (w) => { w.crew = [{ id: 'a', role: 'chef' }, { id: 'b', role: 'sous' }] })
    then('擺盤的是三廚', (w) => { expect(platerOf(w.crew, HOUSE).id).toBe('b') })
  })
  scenario('沒有三廚時由二廚兼著做', ({ given, then, and }) => {
    given('只雇了二廚', (w) => { w.crew = [{ id: 'a', role: 'chef' }, { id: 'c', role: 'server' }] })
    then('擺盤的是二廚', (w) => { expect(platerOf(w.crew, HOUSE).id).toBe('a') })
    and('一個廚師都沒雇時是店裡自己的二廚', () => { expect(platerOf([{ id: 'c', role: 'server' }], HOUSE).id).toBe('house-chef') })
  })
  scenario('二廚正在取料或穿串時，不會被叫去拿盤子或炭', ({ then, and, but }) => {
    then('取料途中不走', () => { expect(platerFree(true, true)).toBe(false) })
    and('手上沒事時才去', () => { expect(platerFree(true, false)).toBe(true) })
    but('三廚不受二廚影響', () => { expect(platerFree(false, true)).toBe(true) })
  })
})
