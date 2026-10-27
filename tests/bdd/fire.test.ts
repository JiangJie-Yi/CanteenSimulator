import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { afterCharcoal, canAddCharcoal, CHARCOAL_BOOST, STICK_BOOST } from '@/game/economy'

feature('火力與加炭', () => {
  scenario('火力還沒滿時可以加炭，火力會升高', ({ given, when, then }) => {
    given('火力 40%', (w) => { w.level = 0.4 })
    when('加一次炭', (w) => { w.can = canAddCharcoal(w.level); w.next = afterCharcoal(w.level) })
    then('可以加，火力升高一份', (w) => { expect(w.can).toBe(true); expect(w.next).toBeCloseTo(0.4 + CHARCOAL_BOOST, 6) })
  })

  scenario('火力超過 100% 之前最多加到 100%', ({ given, when, then }) => {
    given('火力 95%', (w) => { w.level = 0.95 })
    when('加一次炭', (w) => { w.next = afterCharcoal(w.level) })
    then('火力停在 100%', (w) => { expect(w.next).toBe(1) })
  })

  scenario('火力到 100% 就不能再加炭', ({ given, when, then, and }) => {
    given('火力已經 100%', (w) => { w.level = 1 })
    when('再想加炭', (w) => { w.can = canAddCharcoal(w.level); w.next = afterCharcoal(w.level) })
    then('不能加', (w) => { expect(w.can).toBe(false) })
    and('火力不變', (w) => { expect(w.next).toBe(1) })
  })

  scenario('搧風搧到 100% 以上時，也不能再加炭', ({ given, when, then }) => {
    given('火力被搧到 115%', (w) => { w.level = 1.15 })
    when('想加炭', (w) => { w.can = canAddCharcoal(w.level); w.next = afterCharcoal(w.level) })
    then('不能加，火力維持原樣', (w) => { expect(w.can).toBe(false); expect(w.next).toBe(1.15) })
  })
})

feature('用手一根一根添炭', () => {
  scenario('拖一根炭上火，火力只升一點點', ({ given, when, then }) => {
    given('火力 40%', (w) => { w.level = 0.4 })
    when('拖一根炭放上去', (w) => { w.next = afterCharcoal(w.level, STICK_BOOST) })
    then('火力升高一根的量，比一次一整份少', (w) => { expect(w.next).toBeCloseTo(0.4 + STICK_BOOST, 6); expect(STICK_BOOST).toBeLessThan(CHARCOAL_BOOST) })
  })
  scenario('火滿了也不能再加一根', ({ given, when, then }) => {
    given('火力 100%', (w) => { w.level = 1 })
    when('想再拖一根', (w) => { w.can = canAddCharcoal(w.level) })
    then('不能加', (w) => { expect(w.can).toBe(false) })
  })
})
