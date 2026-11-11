import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CARRY, LOW_FULL, LOW_LOW, lowGoes, lowToBring, plateSource, platesToBring } from '@/game/plates'

feature('矮碗盤架：灶台旁存一疊乾淨盤子，裝盤處先從這裡補', () => {
  scenario('裝盤處的盤子先從矮架拿，矮架空了才去碗盤櫃', ({ then, and }) => {
    then('矮架有盤子：從矮架拿', () => { expect(plateSource(3)).toBe('low') })
    and('矮架空了：去碗盤櫃', () => { expect(plateSource(0)).toBe('rack') })
    and('從矮架拿也不會拿超過它有的', () => { expect(platesToBring(0, 1)).toBe(1) })
  })
  scenario(`矮架少於 ${LOW_LOW} 個，閒下來就去碗盤櫃搬一趟補上`, ({ then, but, and }) => {
    then('快空了、碗盤櫃還有：去補', () => { expect(lowGoes(LOW_LOW - 1, 0, 50)).toBe(true) })
    but('已經有人在搬過來的路上，算進去夠了就不再去', () => { expect(lowGoes(LOW_LOW - 3, CARRY, 50)).toBe(false) })
    and('碗盤櫃空了：不去', () => { expect(lowGoes(0, 0, 0)).toBe(false) })
    and(`一趟最多 ${CARRY} 個，補到 ${LOW_FULL} 為止，碗盤櫃有多少拿多少`, () => {
      expect(lowToBring(0, 200)).toBe(CARRY)
      expect(lowToBring(LOW_FULL - 2, 200)).toBe(2)
      expect(lowToBring(0, 3)).toBe(3)
    })
  })
})
