import { expect } from 'vitest'
import { PRICE_SHY, takesAt } from '@/game/orderPick'
import { hourGap } from '@/game/flow'
import { REVIEW_ODDS, reviewChance, reviewsOf, writesReview, type Visit } from '@/game/reputation'
import { breakDown, changeFrom, drawerTotal, openingFloat, payCash, tenderOf } from '@/game/till'
import { ROLL_USES } from '@/game/restroom'
import { feature, scenario } from './bdd'

const at = (h: number, m = 0) => h * 60 + m
const visit = (taste: number | null, more: Partial<Visit> = {}): Visit => ({ id: 1, taste, waited: 30, walkedOut: false, gripes: [], ...more })

feature('第 210 項：其餘的規則照大阪的小店自己判斷（店主 2026-11-16）', () => {
  scenario('價格比行情貴，客人就比較不點', ({ then, and }) => {
    then('照行情或更便宜：一定點', () => { expect(takesAt(200, 200)).toBe(1); expect(takesAt(150, 200)).toBe(1) })
    and('貴兩成：三成的人不點', () => { expect(takesAt(240, 200)).toBeCloseTo(1 - PRICE_SHY * 0.2, 6); expect(takesAt(240, 200)).toBeCloseTo(0.7, 6) })
    and('貴三分之二：沒有人點', () => { expect(takesAt(334, 200)).toBe(0) })
    and('沒有行情的東西照點', () => { expect(takesAt(999, 0)).toBe(1) })
  })

  scenario('客人照時段來：一開店零星，七點到九點最多，深夜越來越少', ({ then, and }) => {
    then('16:30 比平常少（間隔 1.3 倍）', () => { expect(hourGap(at(16, 30))).toBeCloseTo(1.3, 6) })
    and('20:00 最多（間隔 0.7 倍）', () => { expect(hourGap(at(20))).toBeCloseTo(0.7, 6) })
    and('午夜有第二波（比 23:00 多）', () => { expect(hourGap(at(0))).toBeLessThan(hourGap(at(23))) })
    and('03:00 以後很少', () => { expect(hourGap(at(3))).toBeGreaterThan(1.7) })
    and('兩個時間點之間是漸變的，不會突然跳', () => { expect(hourGap(at(18, 30))).toBeCloseTo(0.85, 6) })
    and('營業時間外是 1', () => { expect(hourGap(at(10))).toBe(1) })
  })

  scenario('不是每位客人都寫評論：不滿的最常寫，很滿意的其次，普通的最少', ({ then, and }) => {
    then('沒吃就走的、吃壞肚子的、吃得很差的', () => {
      expect(reviewChance(visit(null, { walkedOut: true }))).toBe(REVIEW_ODDS.cross)
      expect(reviewChance(visit(70, { gripes: ['sick'] }))).toBe(REVIEW_ODDS.cross)
      expect(reviewChance(visit(30))).toBe(REVIEW_ODDS.cross)
    })
    and('很滿意的', () => { expect(reviewChance(visit(85))).toBe(REVIEW_ODDS.delighted) })
    and('普通的最少', () => { expect(reviewChance(visit(60))).toBe(REVIEW_ODDS.middling); expect(REVIEW_ODDS.middling).toBeLessThan(REVIEW_ODDS.delighted) })
    and('買來的評論一定有', () => { expect(writesReview(visit(90, { bought: true }), 0.999)).toBe(true) })
    and('評論頁與星等只算寫了的；以前存下來沒標的算寫了', () => {
      const vs = [visit(80, { wrote: true }), visit(60, { wrote: false }), visit(50)]
      expect(reviewsOf(vs).length).toBe(2)
    })
  })

  scenario('付現：客人給的鈔票進抽屜，找零從抽屜拿', ({ given, when, then, and }) => {
    given('開店時的零用金', (w) => { w.d = openingFloat() })
    when('一位客人付 NT$2,380 的帳，給了 NT$3,000', (w) => { w.after = payCash(w.d as ReturnType<typeof openingFloat>, 2380, 3000) })
    then('抽屜多的剛好是帳單的錢', (w) => {
      expect(drawerTotal(w.after as ReturnType<typeof openingFloat>) - drawerTotal(w.d as ReturnType<typeof openingFloat>)).toBe(2380)
    })
    and('千元鈔多三張，找的 620：500 一枚、100 一枚、10 兩枚從抽屜出去', (w) => {
      const a = w.after as ReturnType<typeof openingFloat>, d = w.d as ReturnType<typeof openingFloat>
      expect(a[1000] - d[1000]).toBe(3); expect(a[500] - d[500]).toBe(-1); expect(a[100] - d[100]).toBe(-1); expect(a[10] - d[10]).toBe(-2)
    })
    and('抽屜湊不出零錢時，客人照帳單付剛好的錢', () => {
      const empty = breakDown(0)
      expect(changeFrom(empty, 620)).toBeNull()
      expect(payCash(empty, 2380, 3000)).toEqual(breakDown(2380))
    })
    and('客人給的錢：多半是往上湊整千，有時給一張五千或一萬；超過一萬給整萬', () => {
      const ids = Array.from({ length: 200 }, (_, i) => i)
      const t = ids.map((id) => tenderOf(2380, id))
      expect(t.every((x) => x === 3000 || x === 5000)).toBe(true)
      expect(t.filter((x) => x === 5000).length).toBeGreaterThan(20)
      expect(tenderOf(12340, 1)).toBe(20000)
    })
  })

  scenario('一捲衛生紙夠 30 位客人用（以前 5 位就用完）', ({ then }) => {
    then('30 次', () => { expect(ROLL_USES).toBe(30) })
  })
})
