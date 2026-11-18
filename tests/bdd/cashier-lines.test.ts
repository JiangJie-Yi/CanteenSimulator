import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { LINES, partOfDay } from '@/data/lines'

feature('收銀員的道別跟著時段', () => {
  scenario('早上不說夜深了', ({ given, when, then }) => {
    given('早上八點半', (w) => { w.hour = 8 })
    when('收銀員說謝謝', (w) => { w.line = LINES.zh.cashierThanks('NT$500', w.hour) })
    then('祝今天愉快，不說夜深', (w) => { expect(w.line).toContain('NT$500'); expect(w.line).toContain('今天'); expect(w.line).not.toContain('夜深') })
  })
  scenario('四個時段的分界（第 372 項：傍晚六點就說「晚了，路上小心」）', ({ then }) => {
    then('5～10 點是早上、11～16 點是下午、17～21 點是晚上、22～4 點是深夜', () => {
      expect([4, 5, 10, 11, 16, 17, 21, 22, 0].map(partOfDay)).toEqual(['late', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'late', 'late'])
    })
  })
  scenario('晚上七點不說「晚了」，深夜才說', ({ then, and }) => {
    then('19 點：慢走、歡迎再來', () => { expect(LINES.zh.cashierThanks('NT$1', 19)).toContain('歡迎再來'); expect(LINES.zh.cashierThanks('NT$1', 19)).not.toContain('晚了') })
    and('23 點：晚了，路上小心', () => { expect(LINES.zh.cashierThanks('NT$1', 23)).toContain('晚了，路上小心') })
    and('日文深夜是夜道、晚上是またお越し、早上是良い一日', () => {
      expect(LINES.ja.cashierThanks('¥1', 23)).toContain('夜道')
      expect(LINES.ja.cashierThanks('¥1', 19)).toContain('またお越し')
      expect(LINES.ja.cashierThanks('¥1', 9)).toContain('良い一日')
    })
  })
})
