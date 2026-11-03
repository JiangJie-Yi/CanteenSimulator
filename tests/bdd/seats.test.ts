import * as THREE from 'three'
import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ALONG, BAR_GATES, COOK_NOTCH, GRILL_COUNTERS, GRILL_SEATS, LAY, gateOf, lampsAlong, platingOf, seatAlong, seatLabel, toGrillScene, type Counter } from '@/shops/grill/bar'

feature('吧台的座位：全店 8 個，兩座吧台各 4 個，每個座位有號碼，每兩位客人之間一盞吊燈', () => {
  scenario('全店 8 個座位，兩座吧台各 4 個（店主要的：長吧台靠轉角的那個移到側吧台，兩邊才均衡）', ({ given, then, and }) => {
    given('烤魚店的兩座吧台', (w) => { w.cs = GRILL_COUNTERS })
    then('全店 8 個座位', () => { expect(GRILL_SEATS.length).toBe(8) })
    and('長吧台 4 個、側吧台 4 個', (w) => { expect(w.cs.map((c: { seats: number }) => c.seats)).toEqual([4, 4]) })
    and('每座吧台相鄰兩個座位的間距都一樣', (w) => {
      for (const c of w.cs as typeof GRILL_COUNTERS) {
        const gaps = Array.from({ length: c.seats - 1 }, (_, n) => seatAlong(c, n + 1) - seatAlong(c, n))
        for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 6)
      }
    })
  })

  scenario('每座吧台的座位平均排滿整座吧台（店主要的：轉角那頭不留空、1 號不要太靠玄關）', ({ given, then, and }) => {
    given('兩座吧台與它們的閘門', (w) => { w.cs = GRILL_COUNTERS })
    then('同一座吧台相鄰座位的間距都一樣', (w) => {
      for (const c of w.cs as Counter[]) {
        const at = Array.from({ length: c.seats }, (_, n) => seatAlong(c, n))
        for (let n = 2; n < at.length; n++) expect(at[n] - at[n - 1]).toBeCloseTo(at[1] - at[0], 6)
      }
    })
    and('每個座位都在桌面上', (w) => {
      for (const c of w.cs as Counter[]) for (let n = 0; n < c.seats; n++) expect(Math.abs(seatAlong(c, n))).toBeLessThan((c.length + 0.3) / 2 - 0.3)
    })
    and('閘門旁的座位離閘門至少 0.4（長吧台的 1 號不擠在玄關旁）', (w) => {
      ;(w.cs as Counter[]).forEach((c, i) => {
        const g = gateOf(c, BAR_GATES[i])
        const near = BAR_GATES[i].end > 0 ? seatAlong(c, c.seats - 1) : seatAlong(c, 0)
        expect(Math.abs(g.hinge - near)).toBeGreaterThanOrEqual(0.4)
      })
    })
  })

  scenario('吊燈掛在每兩位客人中間（店主要的）', ({ given, then, and }) => {
    given('每座吧台的吊燈', (w) => { w.lamps = GRILL_COUNTERS.map((c) => lampsAlong(c)) })
    then('每座吧台的吊燈比座位少一盞', (w) => {
      GRILL_COUNTERS.forEach((c, i) => expect(w.lamps[i].length).toBe(c.seats - 1))
    })
    and('每一盞都在相鄰兩個座位的正中間', (w) => {
      GRILL_COUNTERS.forEach((c, i) => (w.lamps[i] as number[]).forEach((z, n) => expect(z).toBeCloseTo((seatAlong(c, n) + seatAlong(c, n + 1)) / 2, 6)))
    })
  })

  scenario('沒有吧台上的出餐口：主廚在灶台桌上、自己身旁裝盤，外場走進廚房到他旁邊端', ({ given, then, and }) => {
    given('主廚的裝盤處', (w) => { w.p = platingOf(); w.scene = (v: THREE.Vector3) => toGrillScene(v) })
    then('裝好的盤子放在灶台桌面上（桌面高度），在主廚的缺口旁邊、桌子的範圍內', (w) => {
      const at = w.scene(w.p.at)
      expect(at.y).toBeCloseTo(0, 6)
      const along = at.dot(ALONG), lay = at.dot(LAY)
      expect(along).toBeGreaterThan(COOK_NOTCH.along[1])
      expect(along - COOK_NOTCH.along[1]).toBeLessThan(2)
      expect(lay).toBeLessThan(2.1)
      expect(lay).toBeGreaterThan(COOK_NOTCH.lay[0])
    })
    and('外場取餐站的地方在廚房地上、桌子前緣外面，就在盤子前面', (w) => {
      const out = w.scene(w.p.out), at = w.scene(w.p.at)
      expect(out.dot(LAY)).toBeGreaterThan(2.1)
      expect(Math.hypot(out.x - at.x, out.z - at.z)).toBeLessThan(1)
    })
    and('不在任何一座吧台上', (w) => {
      for (const c of GRILL_COUNTERS) {
        const d = w.p.at.clone().sub(c.at)
        const inside = Math.abs(d.dot(c.along.clone().normalize())) < c.length / 2 && Math.abs(d.dot(c.lay.clone().normalize())) < 0.4
        expect(inside).toBe(false)
      }
    })
  })

  scenario('號碼從門口往裡排，每個座位一個、不重複', ({ given, then, and }) => {
    given('全店的座位', (w) => { w.labels = GRILL_SEATS.map((_, k) => seatLabel(k)) })
    then('號碼是 1 到座位數，每個只出現一次', (w) => {
      expect([...w.labels].sort((a: number, b: number) => a - b)).toEqual(Array.from({ length: GRILL_SEATS.length }, (_, k) => k + 1))
    })
    and('1 號是長吧台最靠門口的那個（離轉角最遠）', () => {
      const c0 = GRILL_COUNTERS[0]
      expect(seatLabel(c0.seats - 1)).toBe(1)
    })
    and('長吧台排完，接著是側吧台最靠轉角的那個', () => {
      const [c0, c1] = GRILL_COUNTERS
      expect(seatLabel(c0.seats + c1.seats - 1)).toBe(c0.seats + 1)
    })
  })
})
