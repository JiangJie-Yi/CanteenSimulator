import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { afterPhase, CARRY_MAX, nextTrip, storeOf, tendOf } from '@/game/chefFlow'

feature('主廚取料、備料、上火', () => {
  scenario('每樣食材都到它存放的地方拿', ({ then, and }) => {
    then('魚與海鮮到冷凍櫃', () => { for (const id of ['Mackerel', 'Nodoguro', 'Aji', 'Gindara', 'Iwashi', 'Buri', 'ShrimpSkewer', 'Scallop']) expect(storeOf(id)).toBe('freezer') })
    and('飯糰到飯桶', () => { expect(storeOf('Onigiri')).toBe('ricetub') })
    and('馬鈴薯、地瓜到地上的麻袋', () => { expect(storeOf('Potato')).toBe('sacks'); expect(storeOf('SweetPotato')).toBe('sacks') })
    and('其他冷藏的到灶台下的冷藏櫃', () => { expect(storeOf('GrilledCorn')).toBe('cubby') })
  })

  scenario('先點的先拿；同一處的順路一起拿，最多三份', ({ given, when, then, and, but }) => {
    given('冷凍的鯖魚最先點，接著冷藏的玉米、冷凍的竹筴魚、紅喉、銀鱈、沙丁魚', (w) => {
      w.q = [{ key: 'b', id: 'GrilledCorn', at: 2 }, { key: 'a', id: 'Mackerel', at: 1 }, { key: 'c', id: 'Aji', at: 3 },
        { key: 'd', id: 'Nodoguro', at: 4 }, { key: 'e', id: 'Gindara', at: 5 }, { key: 'f', id: 'Iwashi', at: 6 }]
    })
    when('主廚決定下一趟', (w) => { w.trip = nextTrip(w.q) })
    then('去冷凍櫃', (w) => { expect(w.trip.store).toBe('freezer') })
    and('照點的順序拿鯖魚、竹筴魚、紅喉，不超過三份', (w) => { expect(w.trip.keys).toEqual(['a', 'c', 'd']); expect(w.trip.keys.length).toBeLessThanOrEqual(CARRY_MAX) })
    but('玉米在別處，下一趟才拿', (w) => { expect(w.trip.keys).not.toContain('b') })
  })

  scenario('沒有點單就不走', ({ then }) => {
    then('沒有下一趟', () => { expect(nextTrip([])).toBeNull() })
  })

  scenario('一趟的順序：走過去、拿出來、端回砧板、備料，然後才上火', ({ then }) => {
    then('一步接一步', () => {
      expect(afterPhase('toStore')).toBe('taking')
      expect(afterPhase('taking')).toBe('toBoard')
      expect(afterPhase('toBoard')).toBe('prepping')
      expect(afterPhase('prepping')).toBe('idle')
    })
  })

  scenario('烤到一半：鹽烤的搧火，醬烤的刷醬', ({ then, and }) => {
    then('只撒鹽的搧火', () => { expect(tendOf(['salt'])).toBe('fan') })
    and('什麼都不加的也搧火', () => { expect(tendOf([])).toBe('fan') })
    and('醬油、味噌的刷醬', () => { expect(tendOf(['soy'])).toBe('brush'); expect(tendOf(['miso', 'shichimi'])).toBe('brush') })
  })
})
