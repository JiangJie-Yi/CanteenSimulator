import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { comesLate, kindOf, type GuestKind } from '@/data/guests'

/** who'd come in, over a long run of numbers: by day all of them, in the deep night those let in */
const crowd = (late: boolean) => {
  const n: Partial<Record<GuestKind, number>> = {}
  for (let id = 1; id <= 6000; id++) if (!late || comesLate(id)) n[kindOf(id).kind] = (n[kindOf(id).kind] ?? 0) + 1
  return n
}
const share = (n: Partial<Record<GuestKind, number>>, k: GuestKind[]) => k.reduce((a, x) => a + (n[x] ?? 0), 0) / Object.values(n).reduce((a, b) => a + (b ?? 0), 0)

feature('深夜模式來店的客人不同', () => {
  scenario('午夜後沒有小孩、學生與老人家', ({ when, then }) => {
    when('看深夜會進來的人', (w) => { w.late = crowd(true) })
    then('小學生、高中生、老爺爺、老奶奶都不會來', (w) => { for (const k of ['kid', 'schoolboy', 'schoolgirl', 'grandpa', 'grandma'] as GuestKind[]) expect(w.late[k] ?? 0).toBe(0) })
  })
  scenario('夜間常客、辣妹、加班的上班族比例變高', ({ when, then }) => {
    when('比較白天與深夜', (w) => { w.day = crowd(false); w.late = crowd(true) })
    then('不良少年與暴走族的比例至少是白天的兩倍', (w) => {
      expect(share(w.late, ['delinquent', 'bosozoku'])).toBeGreaterThan(2 * share(w.day, ['delinquent', 'bosozoku']))
      expect(share(w.late, ['salaryman', 'gyaru'])).toBeGreaterThan(share(w.day, ['salaryman', 'gyaru']))
    })
  })
})
