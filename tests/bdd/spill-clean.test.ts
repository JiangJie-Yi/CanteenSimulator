import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { nextClean } from '@/game/spills'

feature('打破的飲料要好好打掃（店主要的，第 116 項）', () => {
  scenario('先掃碎玻璃，再用抹布擦乾', ({ given, then, and }) => {
    given('地上有碎玻璃，也有灑出來的飲料', () => {})
    then('玻璃還在，先掃', () => { expect(nextClean(1, 1)).toBe('sweep'); expect(nextClean(0.2, 1)).toBe('sweep') })
    and('玻璃掃完了，地上還濕，拿抹布擦', () => { expect(nextClean(0, 1)).toBe('wipe'); expect(nextClean(0, 0.3)).toBe('wipe') })
    and('擦乾了，才算打掃完', () => { expect(nextClean(0, 0)).toBe('done') })
  })
})
