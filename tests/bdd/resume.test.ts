import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { RESUME_MAX_AGE, RESUME_VERSION, keptForResume, resumeFrom } from '@/game/resume'

feature('3D 畫面中斷後重新載入，接著原本的進度', () => {
  scenario('畫面中斷那一刻存下的進度，重新載入後接回來', ({ given, when, then }) => {
    given('中斷時的錢、庫存、員工', (w) => {
      w.raw = keptForResume({ ledger: { revenue: 1200 }, stock: { saury: 4 }, hired: { grilledfish: { a: { fatigue: 30 } } } }, 1_000_000)
    })
    when('幾秒後重新載入', (w) => { w.back = resumeFrom(w.raw, 1_000_000 + 5_000) })
    then('進度一樣', (w) => {
      expect(w.back.ledger.revenue).toBe(1200)
      expect(w.back.stock.saury).toBe(4)
      expect(w.back.hired.grilledfish.a.fatigue).toBe(30)
    })
  })

  scenario('一般重新整理（沒有中斷）從頭開始', ({ when, then }) => {
    when('沒有存下任何東西', (w) => { w.back = resumeFrom(null, 1_000_000) })
    then('不接任何進度', (w) => { expect(w.back).toBeNull() })
  })

  scenario('太久以前的中斷不再接回', ({ given, when, then }) => {
    given('十分鐘以前存下的進度', (w) => { w.raw = keptForResume({ stock: { saury: 4 } }, 0) })
    when('現在才重新載入', (w) => { w.back = resumeFrom(w.raw, RESUME_MAX_AGE + 1) })
    then('從頭開始', (w) => { expect(w.back).toBeNull() })
  })

  scenario('舊版本存的或壞掉的資料不接', ({ then, and }) => {
    then('版本不同的不接', () => {
      expect(resumeFrom(JSON.stringify({ v: RESUME_VERSION + 1, at: 0, stock: {} }), 1)).toBeNull()
    })
    and('不是 JSON 的不接', () => { expect(resumeFrom('{oops', 1)).toBeNull() })
  })
})
