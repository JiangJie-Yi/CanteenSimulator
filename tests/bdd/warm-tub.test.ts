import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { WARM_TUB_HOLDS, keptWarm, type TakeoutOrder } from '@/game/takeout'

const order = (id: number, ready: boolean, handed: boolean): TakeoutOrder =>
  ({ id, rider: false, items: 2, packed: ready ? 2 : 1, ready, taken: false, handed, gone: false })

feature('保溫桶裡放的是外帶，不是白飯', () => {
  scenario('打包好、還沒交給客人的外帶放在保溫桶裡', ({ then, and }) => {
    then('還在打包的不算，交出去的也不算', () => {
      expect(keptWarm([order(1, false, false), order(2, true, false), order(3, true, true)])).toBe(1)
    })
    and(`最多放 ${WARM_TUB_HOLDS} 份`, () => {
      expect(keptWarm(Array.from({ length: 10 }, (_, i) => order(i, true, false)))).toBe(WARM_TUB_HOLDS)
    })
    and('沒有外帶時是空的', () => { expect(keptWarm([])).toBe(0) })
  })
})
