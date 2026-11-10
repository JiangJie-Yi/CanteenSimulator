import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { COOK_S, RICE_FULL, emptyKama, kamaTick, riceGoes, setOn, takeRice, warmKama } from '@/game/rice'

feature('炊飯：白飯直接從電鍋取，電鍋空了才洗米再煮一鍋', () => {
  scenario('電鍋空著才去洗米煮飯', ({ then, but }) => {
    then('空了：去煮', () => { expect(riceGoes(emptyKama())).toBe(true) })
    but('正在煮、或煮好保溫中：不再煮一鍋', () => {
      expect(riceGoes(setOn())).toBe(false)
      expect(riceGoes(warmKama())).toBe(false)
    })
  })
  scenario(`電鍋煮 ${COOK_S} 秒才好，好的那一刻說一次，之後保溫`, ({ given, when, then, and }) => {
    let k = emptyKama(), cooked = 0
    given('洗好的米放進電鍋', () => { k = setOn() })
    when(`過了 ${COOK_S - 1} 秒`, () => { for (let i = 0; i < COOK_S - 1; i++) { const r = kamaTick(k, 1); k = r.kama; cooked += +r.cooked } })
    then('還在煮', () => { expect(k.state).toBe('cooking'); expect(cooked).toBe(0) })
    and('再一秒就煮好了，只說一次，接著保溫', () => {
      for (let i = 0; i < 3; i++) { const r = kamaTick(k, 1); k = r.kama; cooked += +r.cooked }
      expect(k.state).toBe('done')
      expect(cooked).toBe(1)
    })
  })
  scenario(`一鍋 ${RICE_FULL} 份，每個飯糰從電鍋取一份，取完電鍋就空了`, ({ then, and }) => {
    then('做一個飯糰少一份，電鍋還在保溫', () => {
      const r = takeRice(5, warmKama())
      expect(r.rice).toBe(4)
      expect(r.kama.state).toBe('done')
    })
    and('最後一份取走，電鍋空了；沒有了也不會變負的', () => {
      const r = takeRice(1, warmKama())
      expect(r.rice).toBe(0)
      expect(r.kama.state).toBe('empty')
      expect(takeRice(0, emptyKama()).rice).toBe(0)
    })
    and('正在煮的時候取（拿鍋底剩的），不會打斷煮飯', () => {
      expect(takeRice(0, setOn()).kama.state).toBe('cooking')
    })
  })
})
