import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { comesAt, CROWD_PARTS, crowdPart, drinksAlcohol, familyShare, KINDS, kindOf, pastHour, type GuestKind } from '@/data/guests'

const at = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
/** who'd come in at this minute, over a long run of numbers: how many of each kind */
const crowd = (minute: number) => {
  const n: Partial<Record<GuestKind, number>> = {}
  for (let id = 1; id <= 20000; id++) if (comesAt(id, minute)) n[kindOf(id).kind] = (n[kindOf(id).kind] ?? 0) + 1
  return n
}
const total = (n: Partial<Record<GuestKind, number>>) => Object.values(n).reduce((a, b) => a + (b ?? 0), 0)
const share = (n: Partial<Record<GuestKind, number>>, k: GuestKind[]) => k.reduce((a, x) => a + (n[x] ?? 0), 0) / total(n)
const top = (n: Partial<Record<GuestKind, number>>, k = 3) => Object.entries(n).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, k).map(([x]) => x as GuestKind)
/** a minute in the middle of each part of the night */
const MIDDLES = { afterSchool: at('17:30'), dinner: at('19:45'), evening: at('22:15'), midnight: at('00:30'), deep: at('02:30'), dawn: at('04:00') }

feature('晝夜的客群明顯不同（第 377 項：「晝夜變換時也得很明顯是不同客群(EX:小孩不會出現在深夜)」）', () => {
  scenario('一整晚分成六段：放學後、晚餐、晚上、午夜、深夜、清晨', ({ then }) => {
    then('每一段的時間對得上', () => {
      expect(crowdPart(at('16:30'))).toBe('afterSchool')
      expect(crowdPart(at('18:29'))).toBe('afterSchool')
      expect(crowdPart(at('18:30'))).toBe('dinner')
      expect(crowdPart(at('21:00'))).toBe('evening')
      expect(crowdPart(at('23:30'))).toBe('midnight')
      expect(crowdPart(at('01:29'))).toBe('midnight')
      expect(crowdPart(at('01:30'))).toBe('deep')
      expect(crowdPart(at('03:30'))).toBe('dawn')
      expect(CROWD_PARTS.map((p) => p.part)).toEqual(['afterSchool', 'dinner', 'evening', 'midnight', 'deep', 'dawn'])
    })
  })

  scenario('小孩、高中生、老人家過了自己的時間就不來', ({ then, and }) => {
    then('小學生七點半以後不進來（待一兩個鐘頭，九點前都回家了）', () => { for (const t of ['19:30', '20:00', '21:30', '23:00', '02:00', '04:00']) expect(crowd(at(t)).kid ?? 0).toBe(0) })
    and('七點半以前會來', () => { expect(crowd(at('17:00')).kid ?? 0).toBeGreaterThan(0); expect(crowd(at('19:15')).kid ?? 0).toBeGreaterThan(0) })
    and('高中生十點以後不來', () => {
      for (const t of ['22:00', '23:30', '01:00', '03:00']) { const n = crowd(at(t)); expect((n.schoolboy ?? 0) + (n.schoolgirl ?? 0)).toBe(0) }
    })
    and('在長凳上等位的小學生，過了七點半就回家，不入座', () => {
      let kid = 1
      while (kindOf(kid).kind !== 'kid') kid++
      expect(pastHour(kid, at('19:20'))).toBe(false)
      expect(pastHour(kid, at('19:35'))).toBe(true)
      expect(pastHour(kid, at('02:00'))).toBe(true)
    })
    and('老爺爺、老奶奶、主婦九點半以後不來', () => {
      for (const t of ['21:30', '23:00', '02:00', '04:00']) { const n = crowd(at(t)); expect((n.grandpa ?? 0) + (n.grandma ?? 0) + (n.housewife ?? 0)).toBe(0) }
    })
  })

  scenario('每一段最多的人都不一樣', ({ when, then, and }) => {
    when('看每一段中間的時候誰會進來', (w) => { w.parts = Object.fromEntries(Object.entries(MIDDLES).map(([p, m]) => [p, crowd(m)])) })
    then('放學後最多的是學生、小孩、主婦、老人家', (w) => {
      for (const k of top(w.parts.afterSchool)) expect(['kid', 'schoolboy', 'schoolgirl', 'housewife', 'grandpa', 'grandma']).toContain(k)
    })
    and('午夜最多的是下班的、收工的、樂團與夜裡的常客，沒有學生與老人家', (w) => {
      for (const k of top(w.parts.midnight)) expect(['salaryman', 'collegeStudent', 'gyaru', 'delinquent', 'bosozoku', 'bandman', 'offShiftChef', 'uncle']).toContain(k)
    })
    and('深夜最多的是計程車司機、暴走族、不良少年、護理師、工地夜班', (w) => {
      for (const k of top(w.parts.deep)) expect(['taxiDriver', 'bosozoku', 'delinquent', 'nurse', 'constructionWorker']).toContain(k)
    })
    and('清晨最多的是魚市場的人，其次計程車司機', (w) => {
      expect(top(w.parts.dawn, 2)).toEqual(['marketWorker', 'taxiDriver'])
    })
    and('任兩段最多的前三種都不完全一樣', (w) => {
      const tops = Object.values(w.parts).map((n) => top(n as Partial<Record<GuestKind, number>>).sort().join(','))
      expect(new Set(tops).size).toBe(tops.length)
    })
    and('夜裡的常客（不良少年、暴走族）深夜的比例至少是放學後的十倍', (w) => {
      expect(share(w.parts.deep, ['delinquent', 'bosozoku'])).toBeGreaterThan(10 * share(w.parts.afterSchool, ['delinquent', 'bosozoku']))
    })
  })

  scenario('每一種客人一晚之中都至少有一段會來', ({ then }) => {
    then('二十三種都會出現', () => {
      const seen = new Set<GuestKind>()
      for (const m of Object.values(MIDDLES)) for (const k of Object.keys(crowd(m))) seen.add(k as GuestKind)
      expect(KINDS.length).toBe(23)
      for (const k of KINDS) expect(seen.has(k.kind)).toBe(true)
    })
  })

  scenario('傍晚兩人同行多半是大人帶小孩，晚上才是情侶', ({ then, and }) => {
    then('放學後六成、晚餐四成是帶小孩的', () => { expect(familyShare(at('17:00'))).toBe(0.6); expect(familyShare(at('19:00'))).toBe(0.4) })
    and('九點以後一對一對的都是情侶', () => { for (const t of ['21:00', '23:45', '02:00']) expect(familyShare(at(t))).toBe(0) })
  })

  scenario('開車的計程車司機和未成年一樣，不賣酒', ({ then }) => {
    then('計程車司機、小學生、高中生不能點酒，其他大人可以', () => {
      const one = (k: GuestKind) => { for (let id = 1; id < 5000; id++) if (kindOf(id).kind === k) return id; throw new Error(k) }
      for (const k of ['taxiDriver', 'kid', 'schoolboy', 'schoolgirl'] as GuestKind[]) expect(drinksAlcohol(one(k))).toBe(false)
      for (const k of ['salaryman', 'nurse', 'marketWorker', 'offShiftChef'] as GuestKind[]) expect(drinksAlcohol(one(k))).toBe(true)
    })
  })
})
