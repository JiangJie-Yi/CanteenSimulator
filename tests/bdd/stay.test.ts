import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { STAY_MAX, overstayed } from '@/game/stay'

// (item 207, the owner's: 「是否有客人站位置太久，需制定用餐時間」: a customer sat on two hours and more, waiting on a dish that was long in
// coming, and their stool was nobody else's)
feature('用餐時間（第 207 項）', () => {
  scenario('坐滿用餐時間就結帳離開，沒上的退錢', ({ then, and }) => {
    then(`用餐時間是 ${STAY_MAX} 分鐘`, () => { expect(STAY_MAX).toBe(100) })
    and('坐了 99 分鐘還沒到', () => { expect(overstayed(0, 99)).toBe(false) })
    and('坐了 100 分鐘就到了', () => { expect(overstayed(10, 110)).toBe(true) })
  })
})
