import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ALL_DISHES } from '@/data/menu'
import { idealSteps, recipeSteps, timingTips, trialIdeas } from '@/game/research'
import { timingLoss } from '@/game/taste'

feature('研發與試做', () => {
  scenario('每間店都有東西可以試做，口味分數在 0 到 100 之間', ({ given, when, then }) => {
    given('四間店', (w) => { w.dishes = ALL_DISHES })
    when('列出每間店可試做的菜', (w) => { w.ideas = ALL_DISHES.map((d) => [d.id, trialIdeas(d)]) })
    then('每間店至少一道，分數都落在 0 到 100', (w) => {
      for (const [, ideas] of w.ideas as [string, ReturnType<typeof trialIdeas>][]) {
        expect(ideas.length).toBeGreaterThan(0)
        for (const i of ideas) { expect(i.taste).toBeGreaterThanOrEqual(0); expect(i.taste).toBeLessThanOrEqual(100) }
      }
    })
  })

  scenario('烤魚店的魚配對的調味越合，口味分數越高', ({ given, when, then }) => {
    given('日式烤魚店的試做清單', (w) => { w.ideas = trialIdeas(ALL_DISHES.find((d) => d.id === 'grilledfish')!) })
    when('比較同一種魚的原味與加了調味的版本', (w) => {
      const id = (w.ideas as ReturnType<typeof trialIdeas>)[0].id
      w.plain = w.ideas.find((i: { id: string; dabs: string[] }) => i.id === id && i.dabs.length === 0)
      w.seasoned = (w.ideas as ReturnType<typeof trialIdeas>).filter((i) => i.id === id && i.dabs.length > 0)
    })
    then('每個合適的調味版本都比原味好', (w) => { for (const s of w.seasoned) expect(s.taste).toBeGreaterThan(w.plain.taste) })
  })

  scenario('照最佳時機放調味，就不會被提醒', ({ given, when, then }) => {
    given('鹽與檸檬都照最佳時機放', (w) => { w.steps = idealSteps(['salt', 'lemon']) })
    when('看有沒有時機上的提醒', (w) => { w.tips = timingTips(w.steps, 'zh') })
    then('沒有任何提醒，也沒有扣分', (w) => { expect(w.tips).toEqual([]); for (const s of w.steps) expect(timingLoss(s.k, s.at)).toBe(0) })
  })

  scenario('放錯時機會得到一句建議', ({ given, when, then }) => {
    given('醬油在上火前就刷（最佳是起鍋前）', (w) => { w.steps = [{ k: 'soy', at: 'before' }] })
    when('看提醒', (w) => { w.zh = timingTips(w.steps, 'zh'); w.ja = timingTips(w.steps, 'ja') })
    then('中日文各有一句提醒', (w) => { expect(w.zh).toHaveLength(1); expect(w.ja).toHaveLength(1) })
  })

  scenario('食譜依步驟順序寫出來：上火前、烤、起鍋前、起鍋後', ({ given, when, then }) => {
    given('一道四個時機都用到調味的菜', (w) => {
      w.steps = [{ k: 'lemon', at: 'after' }, { k: 'soy', at: 'late' }, { k: 'salt', at: 'before' }]
    })
    when('寫成中文食譜', (w) => { w.r = recipeSteps(w.steps, 90, '剛好', 'zh') })
    then('先撒鹽，再烤，再刷醬油，最後擠檸檬', (w) => {
      const r = w.r as string[]
      expect(r).toHaveLength(4)
      expect(r[0]).toContain('撒鹽'); expect(r[1]).toContain('90'); expect(r[2]).toContain('醬油'); expect(r[3]).toContain('檸檬')
    })
  })
})
