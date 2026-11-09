import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { partEn, partName } from '@/data/recipes'

feature('菜名', () => {
  scenario('英文菜名不會說兩次「烤」', ({ given, then, and }) => {
    given('一樣英文名稱本身就帶 Grilled 的食材（年糕：Grilled Mochi）', (w) => { w.item = { name: '年糕', ja: '餅', en: 'Grilled Mochi' } })
    then('菜單上的英文副標只有一個 Grilled', (w) => {
      const s = partEn((w.item as { en: string }).en, ['soy', 'milk'])!
      expect(s).toBe('Soy Grilled Mochi with Condensed Milk')
    })
    and('廚房說的英文菜名也只有一個 grilled', (w) => {
      const s = partName(w.item as { name: string; en: string }, '年糕', 'NetMochi', ['soy', 'milk'], 'en')
      expect(s.match(/grilled/gi)?.length).toBe(1)
    })
  })

  scenario('日文菜名照調味排在前面', ({ when, then }) => {
    when('醬油與檸檬烤的秋刀魚', (w) => { w.name = partName({ name: '秋刀魚', ja: '秋刀魚' }, '秋刀魚', 'Saury', ['soy', 'lemon'], 'ja') })
    then('是「…焼き秋刀魚」', (w) => { expect(w.name).toMatch(/焼き秋刀魚$/) })
  })
})
