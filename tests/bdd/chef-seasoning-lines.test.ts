import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { LINES } from '@/data/lines'

// (the owner's item 38: a seasoning going on isn't "done"; item 46: those going on together are said together, the miso of a miso dish
// glazed with soy too not lost behind the soy)
feature('大廚上調味時說的話', () => {
  scenario('同時上兩種醬，一句話裡兩種都說到', ({ given, when, then, and }) => {
    given('味噌烤鰤魚同時要抹味噌、刷醬油', (w) => { w.name = '味噌烤鰤魚'; w.ks = ['miso', 'soy'] })
    when('大廚上醬', (w) => { w.zh = LINES.zh.seasoned(w.name, w.ks); w.ja = LINES.ja.seasoned(w.name, w.ks); w.en = LINES.en.seasoned(w.name, w.ks) })
    then('中文兩種都說，用頓號隔開', (w) => {
      expect(w.zh).toContain('赤味噌')
      expect(w.zh).toContain('醬油')
      expect(w.zh).toContain('、')
    })
    and('日文、英文也是', (w) => {
      expect(w.ja).toContain('味噌')
      expect(w.ja).toContain('醤油')
      expect(w.en).toMatch(/miso and .*soy/)
    })
  })
  scenario('只上一種時照舊一句', ({ then }) => {
    then('鹽烤只說撒鹽，不說完成', () => {
      const line = LINES.zh.seasoned('鹽烤紅喉', 'salt')
      expect(line).toContain('岩鹽')
      expect(line).not.toContain('完成')
      expect(line).not.toContain('、')
    })
  })
})
