import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { FLOW_KINDS, FLOWS, flowOf, wantOf } from '@/game/flow'

feature('自動營運的營業套路', () => {
  scenario('每次開店抽一種套路，連續兩次不重複，一週內每種都會出現', ({ when, then, and }) => {
    when('連開 14 次店', (w) => { w.days = Array.from({ length: 14 }, (_, n) => flowOf(n)) })
    then('相鄰兩次不同', (w) => { for (let i = 1; i < w.days.length; i++) expect(w.days[i]).not.toBe(w.days[i - 1]) })
    and('前 7 次就涵蓋全部套路', (w) => { expect(new Set(w.days.slice(0, 7)).size).toBe(FLOW_KINDS.length) })
  })

  scenario('午餐尖峰一開店就忙，雨天整天冷清', ({ then, and }) => {
    then('午餐尖峰開店不久來客間隔明顯變短', () => { expect(FLOWS.lunchRush.gap(0.2)).toBeLessThan(0.6) })
    and('雨天的間隔一直比平常長', () => { for (const k of [0, 0.5, 1]) expect(FLOWS.rainy.gap(k)).toBeGreaterThan(1.5) })
  })

  scenario('晚餐尖峰越晚越忙；觀光團中段一次湧入', ({ then, and }) => {
    then('晚餐尖峰後段比開頭忙', () => { expect(FLOWS.eveningRush.gap(1)).toBeLessThan(FLOWS.eveningRush.gap(0)) })
    and('觀光團在中段最密集', () => { expect(FLOWS.tourBus.gap(0.45)).toBeLessThan(FLOWS.tourBus.gap(0.1)) })
  })

  scenario('熟客日點得比較多', ({ then }) => {
    then('同樣的骰子，熟客日點的數量不少於平常', () => {
      for (const r of [0, 0.4, 0.9]) for (const r2 of [0.1, 0.5]) expect(wantOf('regulars', r, r2)).toBeGreaterThanOrEqual(wantOf('steady', r, r2))
    })
  })

  scenario('來客間隔永遠是正數', ({ then }) => {
    then('每種套路每個時段都大於 0', () => { for (const k of FLOW_KINDS) for (let i = 0; i <= 20; i++) expect(FLOWS[k].gap(i / 10)).toBeGreaterThan(0.2) })
  })
})
