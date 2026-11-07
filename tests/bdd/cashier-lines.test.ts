import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { LINES, partOfDay } from '@/data/lines'

feature('收銀員的道別跟著時段', () => {
  scenario('早上不說夜深了', ({ given, when, then }) => {
    given('早上八點半', (w) => { w.hour = 8 })
    when('收銀員說謝謝', (w) => { w.line = LINES.zh.cashierThanks('NT$500', w.hour) })
    then('祝今天愉快，不說夜深', (w) => { expect(w.line).toContain('NT$500'); expect(w.line).toContain('今天'); expect(w.line).not.toContain('夜深') })
  })
  scenario('三個時段的分界', ({ then }) => {
    then('6～13 點是早上、14～17 點是下午、其他是晚上', () => {
      expect([5, 6, 13, 14, 17, 18, 23, 0].map(partOfDay)).toEqual(['night', 'morning', 'morning', 'afternoon', 'afternoon', 'night', 'night', 'night'])
    })
  })
  scenario('晚上才說夜道小心', ({ then }) => {
    then('日文晚上是夜道、早上是良い一日', () => {
      expect(LINES.ja.cashierThanks('¥1', 21)).toContain('夜道')
      expect(LINES.ja.cashierThanks('¥1', 9)).toContain('良い一日')
    })
  })
})
