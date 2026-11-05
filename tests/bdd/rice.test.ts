import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { COOK_S, RICE_LOW, TUB_FULL, emptyKama, kamaTick, riceGoes, scoopIn, setOn, takeRice } from '@/game/rice'

feature('炊飯：飯桶的飯快沒了，就洗米、放進羽釜煮，煮好盛進飯桶', () => {
  scenario(`飯桶剩 ${RICE_LOW} 份以下、羽釜空著才去煮`, ({ then, and, but }) => {
    then(`剩 ${RICE_LOW} 份：去煮`, () => { expect(riceGoes(RICE_LOW, emptyKama())).toBe(true) })
    and('還多：不煮', () => { expect(riceGoes(RICE_LOW + 1, emptyKama())).toBe(false) })
    but('羽釜正在煮或煮好還沒盛：不再煮一鍋', () => {
      expect(riceGoes(0, setOn())).toBe(false)
      expect(riceGoes(0, { state: 'done', left: 0 })).toBe(false)
    })
  })
  scenario(`羽釜煮 ${COOK_S} 秒才好，好的那一刻說一次`, ({ given, when, then, and }) => {
    let k = emptyKama(), cooked = 0
    given('洗好的米放進羽釜', () => { k = setOn() })
    when(`過了 ${COOK_S - 1} 秒`, () => { for (let i = 0; i < COOK_S - 1; i++) { const r = kamaTick(k, 1); k = r.kama; cooked += +r.cooked } })
    then('還在煮', () => { expect(k.state).toBe('cooking'); expect(cooked).toBe(0) })
    and('再一秒就煮好了，只說一次', () => {
      for (let i = 0; i < 3; i++) { const r = kamaTick(k, 1); k = r.kama; cooked += +r.cooked }
      expect(k.state).toBe('done')
      expect(cooked).toBe(1)
    })
  })
  scenario('煮好的飯盛進飯桶：飯桶滿了、羽釜空了；每個飯糰用一份', ({ then, and }) => {
    then(`盛完飯桶有 ${TUB_FULL} 份`, () => { const r = scoopIn(2); expect(r.tub).toBe(TUB_FULL); expect(r.kama.state).toBe('empty') })
    and('做一個飯糰少一份，沒有了也不會變負的', () => { expect(takeRice(5)).toBe(4); expect(takeRice(0)).toBe(0) })
  })
})
