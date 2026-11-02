import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { GRILL_COUNTERS, GRILL_SEATS, PASS_ALONG, seatAlong, seatLabel } from '@/shops/grill/bar'

feature('吧台的座位：長吧台五個平均分開，每個座位有號碼', () => {
  scenario('長吧台少一個座位、平均分（店主覺得六個太擠）', ({ given, then, and }) => {
    given('長吧台', (w) => { w.c = GRILL_COUNTERS[0] })
    then('有 5 個座位', (w) => { expect(w.c.seats).toBe(5) })
    and('相鄰兩個座位的間距都一樣', (w) => {
      const gaps = Array.from({ length: w.c.seats - 1 }, (_, n) => seatAlong(w.c, n + 1) - seatAlong(w.c, n))
      for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 6)
    })
    and('比側吧台的座位間距寬', (w) => {
      const side = GRILL_COUNTERS[1]
      expect(seatAlong(w.c, 1) - seatAlong(w.c, 0)).toBeGreaterThan(seatAlong(side, 1) - seatAlong(side, 0))
    })
    and('出餐口在第一、二個座位正中間', (w) => {
      const mid = (seatAlong(w.c, 0) + seatAlong(w.c, 1)) / 2
      expect(-w.c.length / 2 + PASS_ALONG).toBeCloseTo(mid, 6)
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
