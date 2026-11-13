import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { LINES, tallyNames } from '@/data/lines'

// (item 52: a takeaway of the same dish twice was called out as 「味噌烤白蘿蔔、味噌烤白蘿蔔」)
feature('外帶、外送單的台詞', () => {
  scenario('同一道點兩份以上：說一次，後面加份數', ({ given, when, then, and }) => {
    given('外帶點了兩份味噌烤白蘿蔔、一份醬烤年糕', (w) => { w.items = ['味噌烤白蘿蔔', '醬烤年糕', '味噌烤白蘿蔔'] })
    when('大廚喊單', (w) => { w.zh = LINES.zh.takeoutOrder(w.items, false); w.en = LINES.en.takeoutOrder(['Miso Daikon', 'Miso Daikon'], true) })
    then('味噌烤白蘿蔔只說一次，加 ×2，照第一次出現的順序', (w) => {
      expect(w.zh).toBe('外帶一份：味噌烤白蘿蔔×2、醬烤年糕，客人在收銀台等！')
    })
    and('英文的外送也一樣', (w) => { expect(w.en).toBe("Delivery order: Miso Daikon ×2. The rider's waiting at the till!") })
  })
  scenario('每道都只點一份：照舊一個一個列', ({ then }) => {
    then('不加份數', () => { expect(tallyNames(['鹽烤紅喉', '味噌湯'])).toEqual(['鹽烤紅喉', '味噌湯']) })
  })
})
