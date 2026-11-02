import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { GRILL_COUNTERS, GRILL_SEATS, lampsAlong, passOf, seatAlong, seatLabel } from '@/shops/grill/bar'

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

  scenario('長吧台留下的 4 個座位在原來的地方：拿掉的是最靠轉角的那個', ({ given, then }) => {
    given('長吧台', (w) => { w.c = GRILL_COUNTERS[0] })
    then('離轉角最遠的座位（1 號）跟以前一樣，在吧台中間往門口 1.775', (w) => { expect(seatAlong(w.c, w.c.seats - 1)).toBeCloseTo(1.775, 6) })
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

  scenario('出餐口在側吧台離轉角最遠的兩個座位正中間（廚房那側站得到人）', ({ given, then }) => {
    given('出餐口', (w) => { w.p = passOf(GRILL_COUNTERS); w.c = GRILL_COUNTERS[1] })
    then('在側吧台、兩個座位中間', (w) => {
      expect(w.p.counter).toBe(1)
      const mid = (seatAlong(w.c, 0) + seatAlong(w.c, 1)) / 2
      expect(w.p.at.clone().sub(w.c.at).dot(w.p.dir)).toBeCloseTo(mid, 6)
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
