import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DELIVERY_MIN, arrivals, comingOf, orderCase } from '@/game/drinkStock'

feature('飲料箱叫了要等酒屋送來（第 243 項：以前一買就到）', () => {
  scenario('叫一箱啤酒：先在路上，時間到才送到', ({ given, then, and }) => {
    given('下午 5 點叫一箱啤酒', (w) => { w.c = orderCase([], 'beer', 17 * 60) })
    then('在路上一箱', (w) => { expect(comingOf(w.c, 'beer')).toBe(1) })
    and(`${DELIVERY_MIN - 1} 分鐘後還沒到`, (w) => { expect(arrivals(w.c, 17 * 60 + DELIVERY_MIN - 1).arrived).toEqual([]) })
    and(`${DELIVERY_MIN} 分鐘後送到，路上沒了`, (w) => { const r = arrivals(w.c, 17 * 60 + DELIVERY_MIN); expect(r.arrived.map((d) => d.id)).toEqual(['beer']); expect(r.still).toEqual([]) })
  })
  scenario('先叫的先到', ({ given, then }) => {
    given('5 點叫啤酒、5 點 20 叫可樂', (w) => { w.c = orderCase(orderCase([], 'beer', 17 * 60), 'cola', 17 * 60 + 20) })
    then('啤酒到的時候可樂還在路上', (w) => { const r = arrivals(w.c, 17 * 60 + DELIVERY_MIN); expect(r.arrived.map((d) => d.id)).toEqual(['beer']); expect(comingOf(r.still, 'cola')).toBe(1) })
  })
})
