import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { arrange, crewOf, onShift, openDay, recoverShare, shutDay, type Rota } from '@/game/shifts'

feature('排班：兩批員工交替輪班', () => {
  scenario('A、B 兩班一天一天輪流', ({ then, and }) => {
    then('第 1 天 A 班、第 2 天 B 班、第 3 天又是 A 班', () => { expect([1, 2, 3, 4].map(crewOf)).toEqual(['A', 'B', 'A', 'B']) })
    and('A 班的人只上單數天，全勤的天天上', () => {
      expect([1, 2, 3].map((d) => onShift('A', d))).toEqual([true, false, true])
      expect([1, 2, 3].map((d) => onShift('both', d))).toEqual([true, true, true])
    })
  })
  scenario('連續上班，休息只能恢復一部分，最少恢復一半', ({ then }) => {
    then('第 1 天全部恢復，連上第 2 天恢復 4/5、第 3 天 3/4、第 4 天 2/3，之後一律 1/2', () => {
      expect([1, 2, 3, 4, 5, 9].map(recoverShare)).toEqual([1, 4 / 5, 3 / 4, 2 / 3, 1 / 2, 1 / 2])
    })
  })
  scenario('全勤的人連上兩天，第二天晚上的休息留下五分之一的疲勞', ({ given, when, then, and }) => {
    given('一位全勤的人', (w) => { w.r = { fatigue: 0, shift: 'both' } as Rota })
    when('第 1 天上班、累到 60、打烊', (w) => { w.r = shutDay({ ...openDay(w.r, 1), fatigue: 60 }, 1) })
    then('第一天：休息可以全部恢復', (w) => { expect(w.r.floor).toBe(0); expect(w.r.streak).toBe(1) })
    when('第 2 天又上班、累到 70、打烊', (w) => { w.r = shutDay({ ...openDay(w.r, 2), fatigue: 70 }, 2) })
    then('連上第 2 天：休息後最少還有 70 的 1/5', (w) => { expect(w.r.streak).toBe(2); expect(w.r.floor).toBeCloseTo(14, 6) })
    and('休一天就重新算', (w) => { const off = openDay({ ...w.r, shift: 'B' }, 3); expect(off.streak).toBe(0); expect(off.floor).toBe(0) })
  })
  scenario('自動模式自動排班', ({ then, and }) => {
    then('兩個人：一個 A 班、一個 B 班', () => { expect(arrange([{ id: 'x' }, { id: 'y' }], 1)).toEqual({ x: 'A', y: 'B' }) })
    and('只有一個人：全勤', () => { expect(arrange([{ id: 'x' }], 1)).toEqual({ x: 'both' }) })
    and('外場兩個名額、只有三個人：A 兩位、B 一位，A 最好的那位也上 B', () => {
      expect(arrange([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2)).toEqual({ a: 'both', b: 'A', c: 'B' })
    })
  })
})
