import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { munchLineText, tasteVerdict, verdictLineText } from '@/data/bossLines'

feature('老闆試吃：邊嚼邊說，吃完給評語', () => {
  scenario('嚼的時候說的是嚼東西的聲音，不是評語', ({ given, then, and }) => {
    given('中文、日文、英文各一句', (w) => { w.zh = munchLineText(0.2, 'zh'); w.ja = munchLineText(0.7, 'ja'); w.en = munchLineText(0.4, 'en') })
    then('都有內容', (w) => { expect(w.zh.length).toBeGreaterThan(0); expect(w.ja.length).toBeGreaterThan(0); expect(w.en.length).toBeGreaterThan(0) })
    and('中文那句帶著嚼的聲音', (w) => { expect(w.zh).toMatch(/嚼|嗯|唔|咔/) })
  })

  scenario('吃完依好吃的程度給不同的評語', ({ given, then, and }) => {
    given('四種分數', (w) => { w.v = [tasteVerdict(92), tasteVerdict(70), tasteVerdict(48), tasteVerdict(15)] })
    then('越好吃評價越高', (w) => { expect(w.v).toEqual(['great', 'good', 'meh', 'bad']) })
    and('邊界：80 以上是很好吃，60 以上是好吃，35 以上是普通', () => {
      expect(tasteVerdict(80)).toBe('great'); expect(tasteVerdict(79.9)).toBe('good')
      expect(tasteVerdict(60)).toBe('good'); expect(tasteVerdict(35)).toBe('meh'); expect(tasteVerdict(34)).toBe('bad')
    })
  })

  scenario('評語跟著語系，好吃與難吃說的話不一樣', ({ given, then, and }) => {
    given('同一個隨機數，很好吃與很難吃', (w) => { w.great = verdictLineText('great', 0.3, 'zh'); w.bad = verdictLineText('bad', 0.3, 'zh') })
    then('兩句不同', (w) => { expect(w.great).not.toBe(w.bad) })
    and('日文、英文也有', () => { expect(verdictLineText('good', 0.5, 'ja').length).toBeGreaterThan(0); expect(verdictLineText('meh', 0.5, 'en').length).toBeGreaterThan(0) })
  })
})
