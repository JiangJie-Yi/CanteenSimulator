import { expect } from 'vitest'
import { flowOf, rateShop, remarkOf, satisfaction, starsOf, visitStars, WEIGHTS, type Visit } from '@/game/reputation'
import { BOX_LOW, BOX_SHEETS, refillBoxes, sheetsFor, takeSheets, tissueOrder, TISSUE_PACK } from '@/game/tissues'
import { feature, scenario } from './bdd'

const visit = (o: Partial<Visit> = {}): Visit => ({ id: 1, taste: 80, waited: 30, walkedOut: false, gripes: [], ...o })

feature('店家評價：綜合每位客人的滿意度（點招牌看）', () => {
  scenario('好吃又沒等太久的客人很滿意', ({ when, then }) => {
    when('美味 80、等了 30 秒、沒有不滿', (w) => { w.s = satisfaction(visit()) })
    then('滿意度就是 80（四星多）', (w) => { expect(w.s).toBe(80); expect(starsOf(w.s as number)).toBeCloseTo(4.2, 5) })
  })
  scenario('座位沒有衛生紙的客人會扣分', ({ when, then }) => {
    when('同樣好吃，但抽屜裡的衛生紙用完了', (w) => { w.s = satisfaction(visit({ gripes: ['tissue'] })) })
    then('滿意度少 8 分', (w) => { expect(w.s).toBe(72) })
  })
  scenario('等太久的客人：超過 90 秒每 6 秒扣 1 分，最多 20 分', ({ then, and }) => {
    then('等 150 秒扣 10 分', () => { expect(satisfaction(visit({ waited: 150 }))).toBe(70) })
    and('等 10 分鐘最多扣 20 分', () => { expect(satisfaction(visit({ waited: 600 }))).toBe(60) })
  })
  scenario('等不到就走的客人最多只給 25 分', ({ when, then }) => {
    when('什麼都沒吃就走了', (w) => { w.s = satisfaction(visit({ taste: null, walkedOut: true, waited: 400 })) })
    then('不超過 25', (w) => { expect(w.s as number).toBeLessThanOrEqual(25) })
  })
  scenario('店家評價是最近的客人平均，越近的越重', ({ given, when, then }) => {
    given('先來了 20 位不滿意的，後來 20 位很滿意', (w) => {
      w.vs = [...Array.from({ length: 20 }, (_, i) => visit({ id: i, taste: 30 })), ...Array.from({ length: 20 }, (_, i) => visit({ id: 100 + i, taste: 90 }))]
    })
    when('算店家評價', (w) => { w.r = rateShop(w.vs as Visit[]) })
    then('比兩者的平均（3.4 星）高', (w) => { expect((w.r as ReturnType<typeof rateShop>).stars!).toBeGreaterThan(3.4) })
  })
  scenario('總分就是三項照權重算出來的（料理 45%、服務 35%、環境 20%）', ({ given, when, then }) => {
    given('各種客人：好吃的、等很久的、沒衛生紙的、沒吃就走的', (w) => {
      w.vs = [visit({ id: 1, taste: 90 }), visit({ id: 2, taste: 70, waited: 300 }), visit({ id: 3, taste: 60, gripes: ['tissue'] }), visit({ id: 4, taste: null, walkedOut: true, waited: 500 })]
    })
    when('算店家評價', (w) => { w.r = rateShop(w.vs as Visit[]) })
    then('總分等於三項的加權平均（差不到 0.01）', (w) => {
      const r = w.r as ReturnType<typeof rateShop>
      expect(r.stars!).toBeCloseTo(r.food! * WEIGHTS.food + r.service! * WEIGHTS.service + r.place! * WEIGHTS.place, 1)
      const lo = Math.min(r.food!, r.service!, r.place!), hi = Math.max(r.food!, r.service!, r.place!)
      expect(r.stars!).toBeGreaterThanOrEqual(lo - 0.01)
      expect(r.stars!).toBeLessThanOrEqual(hi + 0.01)
    })
  })
  scenario('沒吃就生氣走掉的客人給 1 星，服務分跟著掉', ({ when, then, and }) => {
    when('一位沒吃就走、一位很滿意', (w) => { w.r = rateShop([visit({ id: 1, taste: 90 }), visit({ id: 2, taste: null, walkedOut: true })]) })
    then('走掉的那位自己是 1 星', () => { expect(visitStars(visit({ taste: null, walkedOut: true }))).toBe(1) })
    and('服務分低於 3.1（一位 5 星、一位 1 星）', (w) => { expect((w.r as ReturnType<typeof rateShop>).service!).toBeLessThan(3.1) })
  })
  scenario('評價影響來客：名店客人多五成、口碑崩盤只剩三成', ({ then, and }) => {
    then('4.7 星：來客 1.5 倍、耐心多一成', () => { expect(flowOf(4.7)).toEqual({ more: 1.5, patience: 1.1 }) })
    and('4.2 星：1.2 倍', () => { expect(flowOf(4.2).more).toBe(1.2) })
    and('3.7 星：照常', () => { expect(flowOf(3.7)).toEqual({ more: 1, patience: 1 }) })
    and('3.0 星：少了近四成、耐心少 15%', () => { expect(flowOf(3.0)).toEqual({ more: 0.62, patience: 0.85 }) })
    and('2.0 星：只剩三成', () => { expect(flowOf(2.0).more).toBe(0.32) })
    and('還沒有評價：照常', () => { expect(flowOf(null)).toEqual({ more: 1, patience: 1 }) })
  })
  scenario('沒有客人時沒有評價', ({ then }) => {
    then('星數是空的', () => { expect(rateShop([]).stars).toBeNull() })
  })
  scenario('客人的評語：最嚴重的不滿，或對食物的感想', ({ then, and }) => {
    then('拉肚子比沒衛生紙嚴重', () => { expect(remarkOf(visit({ gripes: ['tissue', 'sick'] }))).toBe('sick') })
    and('沒有不滿時看美味', () => { expect(remarkOf(visit({ taste: 85 }))).toBe('great') })
  })
})

feature('衛生紙：每個座位一盒 200 抽，是耗材', () => {
  scenario('客人吃完抽幾張，盒子裡的變少', ({ when, then }) => {
    when('一盒滿的，客人抽了他要的', (w) => { w.r = takeSheets(BOX_SHEETS, sheetsFor(7)) })
    then('少了 2 到 7 張，夠用', (w) => {
      const r = w.r as ReturnType<typeof takeSheets>
      expect(BOX_SHEETS - r.box).toBeGreaterThanOrEqual(2)
      expect(BOX_SHEETS - r.box).toBeLessThanOrEqual(7)
      expect(r.short).toBe(false)
    })
  })
  scenario('盒子空了，客人抽不到就會不滿', ({ when, then }) => {
    when('盒子只剩 1 張，客人要 5 張', (w) => { w.r = takeSheets(1, 5) })
    then('不夠用，盒子空了', (w) => { const r = w.r as ReturnType<typeof takeSheets>; expect(r.short).toBe(true); expect(r.box).toBe(0) })
  })
  scenario('開店前把空的（或快空的）換成新盒，用庫存的備品', ({ when, then, and }) => {
    when(`三個座位剩 0、${BOX_LOW - 1}、150 張，備品只有 1 盒`, (w) => { w.r = refillBoxes([0, BOX_LOW - 1, 150], 1) })
    then('第一個換新，第二個沒有備品了', (w) => { expect((w.r as ReturnType<typeof refillBoxes>).boxes).toEqual([BOX_SHEETS, BOX_LOW - 1, 150]) })
    and('備品用完', (w) => { expect((w.r as ReturnType<typeof refillBoxes>).spares).toBe(0) })
  })
  scenario('衛生紙一組 5 盒', ({ then }) => {
    then('買 2 組是 10 盒', () => { expect(tissueOrder(2)).toEqual({ boxes: 2 * TISSUE_PACK.boxes, cost: 2 * TISSUE_PACK.cost }) })
  })
})
