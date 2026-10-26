import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ROLES, effective, fair, restPerMin, tirePerMin, type Worker } from '@/data/staff'
import { canDismiss, canHire, makeCandidates, pickHires, seeded, valueOf } from '@/game/hiring'

feature('員工與徵人', () => {
  scenario('營業中不能解雇員工，閉店後才可以', ({ given, when, then, and }) => {
    given('店正在營業', (w) => { w.open = true })
    when('老闆想解雇一位員工', (w) => { w.ok = canDismiss(w.open) })
    then('不能解雇（客人還在，人手不能說走就走）', (w) => { expect(w.ok).toBe(false) })
    and('閉店後就可以解雇', () => { expect(canDismiss(false)).toBe(true) })
  })

  scenario('營業中仍可臨時加派人手', ({ then }) => {
    then('開店或閉店都能雇人', () => { expect(canHire(true)).toBe(true); expect(canHire(false)).toBe(true) })
  })

  scenario('越累的人做事越差，最多掉到 55%', ({ given, when, then }) => {
    given('一位技能 80 的員工', (w) => { w.w = { skill: 80 } as Worker })
    when('看他精神飽滿和累到 100 的表現', (w) => { w.fresh = effective(w.w, 0); w.tired = effective(w.w, 100) })
    then('累的人只剩 55% 的功力', (w) => { expect(w.tired).toBeCloseTo(w.fresh * 0.55, 6); expect(w.tired).toBeLessThan(w.fresh) })
  })

  scenario('體力低的人累得比較快', ({ given, when, then }) => {
    given('體力 90 和體力 30 的兩個人', (w) => { w.a = { stamina: 90 } as Worker; w.b = { stamina: 30 } as Worker })
    when('比較每分鐘增加的疲勞', (w) => { w.ta = tirePerMin(w.a); w.tb = tirePerMin(w.b) })
    then('體力低的累得比較快，而休息一分鐘恢復的比任何人累積的都多', (w) => { expect(w.tb).toBeGreaterThan(w.ta); expect(restPerMin).toBeGreaterThan(w.tb) })
  })

  scenario('合理薪資不低於基本工資，技能越高越貴', ({ when, then }) => {
    when('求各職位技能 0 與 100 的合理時薪', (w) => {
      w.rows = (['chef', 'sous', 'server', 'stock', 'cashier'] as const).map((r) => [fair(r, 0), fair(r, 100)])
    })
    then('技能 0 時接近基本工資 196，技能 100 時更高', (w) => {
      for (const [lo, hi] of w.rows as [number, number][]) { expect(lo).toBeGreaterThanOrEqual(195); expect(hi).toBeGreaterThan(lo) }
    })
  })

  scenario('一鍵徵人只挑 CP 值最高的，而且不超過職位名額', ({ given, when, then }) => {
    given('日式烤魚店的一批應徵者，沒有人被雇用', (w) => {
      w.people = makeCandidates('grilledfish', seeded(42))
      w.roles = ROLES.grilledfish
    })
    when('一鍵徵人', (w) => { w.hires = pickHires(w.people, w.roles, {}) as Worker[] })
    then('每個職位被選的人數不超過名額', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) expect((w.hires as Worker[]).filter((h) => h.role === r.role).length).toBeLessThanOrEqual(r.max)
    })
    then('每個職位選到的是該職位 CP 值最高的人', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) {
        const pool = (w.people as Worker[]).filter((p) => p.role === r.role).sort((a, b) => valueOf(b) - valueOf(a))
        const got = (w.hires as Worker[]).filter((h) => h.role === r.role)
        expect(got.map((g) => g.id)).toEqual(pool.slice(0, got.length).map((g) => g.id))
      }
    })
  })

  scenario('名額已經滿了的職位不再徵人', ({ given, when, then }) => {
    given('每個職位都已經雇滿', (w) => {
      w.people = makeCandidates('grilledfish', seeded(7)); w.roles = ROLES.grilledfish
      w.hired = {} as Record<string, boolean>
      for (const r of w.roles as { role: string; max: number }[]) (w.people as Worker[]).filter((p) => p.role === r.role).slice(0, r.max).forEach((p) => { w.hired[p.id] = true })
    })
    when('再一鍵徵人', (w) => { w.more = pickHires(w.people, w.roles, w.hired) })
    then('沒有人被加進來', (w) => { expect(w.more).toEqual([]) })
  })
})
