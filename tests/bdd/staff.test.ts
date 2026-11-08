import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ROLES, TIRED_AT, effective, fair, paceOf, restPerHour, tirePerHour, type Worker } from '@/data/staff'
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

  scenario('疲勞值到了，能力就減半', ({ given, when, then, and }) => {
    given('一位技能 80 的員工', (w) => { w.w = { skill: 80 } as Worker })
    when(`看他精神飽滿、快累了（${TIRED_AT - 1}）與疲勞（${TIRED_AT}）的表現`, (w) => { w.fresh = effective(w.w, 0); w.almost = effective(w.w, TIRED_AT - 1); w.tired = effective(w.w, TIRED_AT) })
    then('還沒到疲勞照常', (w) => { expect(w.almost).toBe(w.fresh) })
    and('疲勞了只剩一半', (w) => { expect(w.tired).toBeCloseTo(w.fresh / 2, 6) })
    and('走路、做事的速度也是一半', () => { expect(paceOf(TIRED_AT - 1)).toBe(1); expect(paceOf(TIRED_AT)).toBe(0.5) })
  })

  scenario('體力低的人累得比較快', ({ given, when, then, and }) => {
    given('體力 90 和體力 30 的兩個人', (w) => { w.a = { stamina: 90 } as Worker; w.b = { stamina: 30 } as Worker })
    when('比較每營業一小時增加的疲勞', (w) => { w.ta = tirePerHour(w.a); w.tb = tirePerHour(w.b) })
    then('體力低的累得比較快', (w) => { expect(w.tb).toBeGreaterThan(w.ta) })
    and('營業九小時：體力 30 的會累到疲勞，體力 90 的不會', (w) => { expect(9 * w.tb).toBeGreaterThanOrEqual(TIRED_AT); expect(9 * w.ta).toBeLessThan(TIRED_AT) })
    and('閉店十五小時一定恢復到精神飽滿', () => { expect(15 * restPerHour).toBeGreaterThanOrEqual(100) })
  })

  scenario('應徵的人夠多可以挑：每個職位至少是名額的 4 倍，掌爐的師傅（二廚）至少 8 位', ({ given, then, and }) => {
    given('新開一局，日式烤魚店來應徵的人', (w) => { w.people = makeCandidates('grilledfish', seeded(11)); w.roles = ROLES.grilledfish })
    then('每個職位的應徵者至少是名額的 4 倍', (w) => {
      for (const r of w.roles as { role: string; max: number }[]) expect((w.people as Worker[]).filter((p) => p.role === r.role).length, r.role).toBeGreaterThanOrEqual(r.max * 4)
    })
    and('二廚（掌爐的師傅）至少 8 位，老中青都有', (w) => {
      const chefs = (w.people as Worker[]).filter((p) => p.role === 'chef')
      expect(chefs.length).toBeGreaterThanOrEqual(8)
      expect(new Set(chefs.map((c) => c.look.age)).size).toBe(3)
    })
    and('名字都不一樣，大部分人的經歷也不一樣', (w) => {
      const people = w.people as Worker[]
      expect(new Set(people.map((p) => p.zh)).size).toBe(people.length)
      const lines = people.map((p) => p.note.split('，')[0])
      expect(new Set(lines).size).toBeGreaterThanOrEqual(people.length * 0.6)
    })
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
