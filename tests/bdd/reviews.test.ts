import { expect } from 'vitest'
import { agoOf, boughtVisits, rateShop, REVIEW_PACKS, sortReviews, starCounts, visitSides, visitStars, type Visit } from '@/game/reputation'
import { feature, scenario } from './bdd'

const visit = (id: number, taste: number | null, o: Partial<Visit> = {}): Visit => ({ id, taste, waited: 40, walkedOut: false, gripes: [], ...o })

feature('店家評價像 Google 地圖：新店從 0 顆星開始，每則有各項星數，可以排序，也能花錢買評價', () => {
  scenario('新開的店沒有任何評價', ({ then }) => {
    then('沒有星數、0 則', () => { const r = rateShop([]); expect(r.stars).toBeNull(); expect(r.n).toBe(0) })
  })
  scenario('一則評價照餐廳評論的樣子分成料理、服務、環境各幾顆星', ({ then, and }) => {
    then('吃得好、沒等太久、沒有不滿：三項都 5 顆', () => { expect(visitSides(visit(1, 92))).toEqual({ food: 5, service: 5, place: 5 }) })
    and('廁所髒：環境少一些', () => { expect(visitSides(visit(2, 92, { gripes: ['toilet'] })).place).toBeLessThan(5) })
    and('沒吃就走：沒有料理的星數，服務 1 顆', () => { const s = visitSides(visit(3, null, { walkedOut: true })); expect(s.food).toBeNull(); expect(s.service).toBe(1) })
  })
  scenario('分數旁邊是 5 到 1 星各幾則', ({ given, then }) => {
    given('兩則五星、一則沒吃就走', (w) => { w.c = starCounts([visit(1, 95), visit(2, 98), visit(3, null, { walkedOut: true })]) })
    then('5 星 2 則、1 星 1 則', (w) => { expect(w.c).toEqual([2, 0, 0, 0, 1]) })
  })
  scenario('排序：最新、最高分、最低分；最相關時買來的排在後面', ({ given, then, and }) => {
    given('一則普通、一則很好、一則買來的、一則最新的難吃', (w) => {
      w.vs = [visit(1, 55), visit(2, 95), ...boughtVisits(1, -1, 1), visit(3, 20)]
    })
    then('最新：最後來的在最上面', (w) => { expect(sortReviews(w.vs as Visit[], 'newest')[0].id).toBe(3) })
    and('最高分：星數最多的在最上面', (w) => {
      const s = sortReviews(w.vs as Visit[], 'highest')
      expect(visitStars(s[0])).toBeGreaterThanOrEqual(visitStars(s[1]))
    })
    and('最低分：難吃的在最上面', (w) => { expect(sortReviews(w.vs as Visit[], 'lowest')[0].id).toBe(3) })
    and('最相關：買來的排在最後', (w) => { const s = sortReviews(w.vs as Visit[], 'relevant'); expect(s[s.length - 1].bought).toBe(true) })
  })
  scenario('每則評價標出是多久以前', ({ then, and }) => {
    then('同一天：今天', () => { expect(agoOf(5, 5)).toEqual({ n: 0, unit: 'today' }) })
    and('三天前', () => { expect(agoOf(2, 5)).toEqual({ n: 3, unit: 'day' }) })
    and('兩週前', () => { expect(agoOf(1, 15)).toEqual({ n: 2, unit: 'week' }) })
    and('兩個月前', () => { expect(agoOf(1, 62)).toEqual({ n: 2, unit: 'month' }) })
  })
  scenario('花錢買評價：買一包就多那麼多則四到五星的評價，店的星數往上', ({ given, when, then, and }) => {
    given('十則普通的評價', (w) => { w.vs = Array.from({ length: 10 }, (_, i) => visit(i + 1, 45)); w.before = rateShop(w.vs as Visit[]).stars })
    when(`買最小的一包（${REVIEW_PACKS[0].n} 則，NT$${REVIEW_PACKS[0].cost}）`, (w) => {
      w.bought = boughtVisits(REVIEW_PACKS[0].n, -1, 3)
      w.vs = [...(w.vs as Visit[]), ...(w.bought as Visit[])]
    })
    then(`多了 ${REVIEW_PACKS[0].n} 則，每則四到五星，標成買來的`, (w) => {
      const b = w.bought as Visit[]
      expect(b).toHaveLength(REVIEW_PACKS[0].n)
      for (const v of b) { expect(visitStars(v)).toBeGreaterThanOrEqual(4); expect(v.bought).toBe(true); expect(v.id).toBeLessThan(0) }
    })
    and('店的星數往上', (w) => { expect(rateShop(w.vs as Visit[]).stars!).toBeGreaterThan(w.before as number) })
    and('越大包越划算', () => {
      const per = REVIEW_PACKS.map((p) => p.cost / p.n)
      for (let i = 1; i < per.length; i++) expect(per[i]).toBeLessThan(per[i - 1])
    })
  })
})
