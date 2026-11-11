import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { wcDarkness } from '@/game/roomLights'

feature('廁所關燈後的暗度跟著天色：白天有窗戶的光，不會黑成晚上', () => {
  scenario('開著燈：不暗', ({ then }) => {
    then('白天、晚上都一樣亮', () => { expect(wcDarkness(true, 'day')).toBe(0); expect(wcDarkness(true, 'night')).toBe(0) })
  })
  scenario('關燈：白天只暗一點，傍晚與清晨一半，晚上才暗', ({ then, and }) => {
    then('白天比晚上淺很多', () => { expect(wcDarkness(false, 'day')).toBeLessThan(wcDarkness(false, 'night') / 2) })
    and('傍晚、清晨介於中間', () => {
      for (const s of ['dusk', 'dawn'] as const) {
        expect(wcDarkness(false, s)).toBeGreaterThan(wcDarkness(false, 'day'))
        expect(wcDarkness(false, s)).toBeLessThan(wcDarkness(false, 'night'))
      }
    })
  })
})
