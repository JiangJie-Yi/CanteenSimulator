import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { isMinor, kindOf } from '@/data/guests'

// (item 203: a pupil or a high-schooler was poured a tokkuri of sake like anyone)
feature('未成年不賣酒（第 203 項）', () => {
  scenario('小學生、男女高中生是未成年，上班族、大學生不是', ({ given, then, and }) => {
    given('前 500 位客人', (w) => { w.ids = Array.from({ length: 500 }, (_, i) => i + 1) })
    then('小學生與高中生都算未成年', (w) => {
      for (const id of w.ids) if (['kid', 'schoolboy', 'schoolgirl'].includes(kindOf(id).kind)) expect(isMinor(id)).toBe(true)
    })
    and('其他客人都不算', (w) => {
      for (const id of w.ids) if (!['kid', 'schoolboy', 'schoolgirl'].includes(kindOf(id).kind)) expect(isMinor(id)).toBe(false)
    })
    and('而且真的有未成年的客人', (w) => { expect(w.ids.some(isMinor)).toBe(true) })
  })
})
