import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { atmosphere, BOND_START, bondAfter, bondOf, bondPace, dayBond, dayPairs, givesNotice, LOW_BOND, moodPace, pairKey, QUIT_AFTER } from '@/game/affinity'

// (item 323, the owner's, 2026-11-18: 「新增與員工的好感度」「人事旁放一個關係圖」「關係之間會影響工作氣氛」)
feature('員工對老闆的好感度', () => {
  scenario('新來的、或舊存檔沒有好感度的人從中間開始', ({ then }) => {
    then('是 50', () => { expect(bondOf(undefined)).toBe(BOND_START); expect(BOND_START).toBe(50) })
  })
  scenario('稱讚、員工餐讓好感度上升', ({ given, then, and }) => {
    given('好感度 50', (w) => { w.b = 50 })
    then('稱讚一次 +3', (w) => { expect(bondAfter(w.b, 'praise')).toBe(53) })
    and('一頓員工餐 +4', (w) => { expect(bondAfter(w.b, 'meal')).toBe(54) })
  })
  scenario('工作超過十小時、累壞了回家、店裡付不出錢都會讓好感度下降', ({ given, when, then }) => {
    given('好感度 50', (w) => { w.b = 50 })
    when('做了 13 小時、疲勞 80、店的現金是負的', (w) => { w.r = dayBond(w.b, { hours: 13, fatigue: 80, unpaid: true }) })
    then('一天掉 13（加班 −2、累壞 −3、沒錢 −8）', (w) => { expect(w.r.bond).toBe(37) })
  })
  scenario('有休息、正常下班的日子慢慢變好', ({ given, when, then }) => {
    given('好感度 50', (w) => { w.b = 50 })
    when('做了 8 小時、疲勞 20', (w) => { w.r = dayBond(w.b, { hours: 8, fatigue: 20 }) })
    then('+1', (w) => { expect(w.r.bond).toBe(51) })
  })
  scenario('好感度太低連續三天就遞辭呈', ({ given, when, then, but }) => {
    given('好感度已經很低', (w) => { w.b = LOW_BOND - 3; w.low = 0 })
    when('連著三天都還是那麼低', (w) => {
      for (let d = 0; d < QUIT_AFTER; d++) { const r = dayBond(w.b, { hours: 9, fatigue: 50 }, w.low); w.b = r.bond; w.low = r.low }
    })
    then('想辭職', (w) => { expect(givesNotice(w.low)).toBe(true) })
    but('只低兩天不會', () => { expect(givesNotice(QUIT_AFTER - 1)).toBe(false) })
  })
  scenario('好感度影響做事的速度', ({ then, and }) => {
    then('0 慢一成', () => { expect(bondPace(0)).toBeCloseTo(0.9, 6) })
    and('50 照常、100 快 8%', () => { expect(bondPace(50)).toBe(1); expect(bondPace(100)).toBeCloseTo(1.08, 6) })
  })
})

feature('員工彼此的關係與工作氣氛', () => {
  scenario('一起上班越來越熟，同住二樓更熟', ({ given, when, then, and }) => {
    given('三個人一起做了一天，其中兩位都住樓上', (w) => {
      w.crew = [{ id: 'a', dorm: true, worn: false }, { id: 'b', dorm: true, worn: false }, { id: 'c', dorm: false, worn: false }]
    })
    when('過了這一天', (w) => { w.p = dayPairs({}, w.crew) })
    then('一起做的 +2', (w) => { expect(w.p[pairKey('a', 'c')]).toBe(52) })
    and('同住的再 +1', (w) => { expect(w.p[pairKey('a', 'b')]).toBe(53) })
  })
  scenario('一個累壞了另一個撐著，關係會磨損', ({ given, when, then }) => {
    given('一位累壞、一位沒有', (w) => { w.crew = [{ id: 'a', dorm: false, worn: true }, { id: 'b', dorm: false, worn: false }] })
    when('過了這一天', (w) => { w.p = dayPairs({ [pairKey('a', 'b')]: 50 }, w.crew) })
    then('一起做 +2、撐著 −2，不增不減', (w) => { expect(w.p[pairKey('a', 'b')]).toBe(50) })
  })
  scenario('氣氛是大家對老闆與彼此的好感度一起算', ({ then, and }) => {
    then('都 50 就是照常', () => { expect(atmosphere([50, 50], [50])).toBe(50) })
    and('氣氛好做事快一點、差就慢一點', () => { expect(moodPace(100)).toBeCloseTo(1.05, 6); expect(moodPace(0)).toBeCloseTo(0.95, 6) })
  })
})
