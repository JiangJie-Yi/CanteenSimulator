import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { orderSaid, saidAgain, TOGETHER_MS, withOrder, type OrderSaid } from '@/game/orderTally'
import { tallyNames } from '@/data/lines'

const said = (guest: number, dish: string, at: number, line: number): OrderSaid => ({ ...orderSaid([], guest, dish, at), line })

feature('日誌裡的點單：同一位客人一次點兩份同一道菜，寫成一行加份數', () => {
  scenario('同一位客人同時點了兩份味噌烤香菇：一行「點了 味噌烤香菇×2」', ({ given, when, then, and }) => {
    given('女高中生（3 號）剛點了一份味噌烤香菇，寫在日誌第 41 行', (w) => { w.recent = [said(3, 'miso-shiitake', 1000, 41)] })
    when('同一刻她又點了一份', (w) => { w.now = orderSaid(w.recent, 3, 'miso-shiitake', 1000) })
    then('不另寫一行，改第 41 行', (w) => { expect(w.now.again).toBe(true); expect(w.now.line).toBe(41) })
    and('份數是 2，寫成「味噌烤香菇×2」', (w) => {
      expect(w.now.n).toBe(2)
      expect(tallyNames(Array(w.now.n).fill('味噌烤香菇'))).toEqual(['味噌烤香菇×2'])
    })
  })

  scenario('同一刻點了「香菇、秋刀魚、香菇」：香菇併成一行 ×2，秋刀魚一行', ({ given, when, then, and }) => {
    given('3 號同一刻先點了香菇（第 41 行）、再點秋刀魚（第 42 行）', (w) => { w.recent = withOrder([said(3, 'miso-shiitake', 1000, 41)], said(3, 'salt-saury', 1000, 42)) })
    when('接著又點了一份香菇', (w) => { w.now = orderSaid(w.recent, 3, 'miso-shiitake', 1000) })
    then('改回第 41 行，份數 2', (w) => { expect(w.now.again).toBe(true); expect(w.now.line).toBe(41); expect(w.now.n).toBe(2) })
    and('記著的還是這兩道各一筆', (w) => { expect(withOrder(w.recent, w.now).map((r) => `${r.dish}×${r.n}@${r.line}`).sort()).toEqual(['miso-shiitake×2@41', 'salt-saury×1@42']) })
  })

  scenario('隔了一陣子再點同一道：另寫一行', ({ given, when, then }) => {
    given('她剛點了一份味噌烤香菇', (w) => { w.recent = [said(3, 'miso-shiitake', 1000, 41)] })
    when(`過了 ${TOGETHER_MS} 毫秒以上才又點一份`, (w) => { w.now = orderSaid(w.recent, 3, 'miso-shiitake', 1000 + TOGETHER_MS + 1) })
    then('新的一行，份數 1', (w) => { expect(w.now.again).toBe(false); expect(w.now.n).toBe(1) })
  })

  scenario('兩位客人同時各點一份同一道：各寫一行', ({ given, when, then }) => {
    given('3 號剛點了一份味噌烤香菇', (w) => { w.recent = [said(3, 'miso-shiitake', 1000, 41)] })
    when('同一刻 4 號也點了一份', (w) => { w.now = orderSaid(w.recent, 4, 'miso-shiitake', 1000) })
    then('4 號另寫一行', (w) => { expect(w.now.again).toBe(false); expect(w.now.guest).toBe(4) })
  })

  scenario('同一位客人同時點了兩道不同的菜：各寫一行', ({ given, when, then }) => {
    given('3 號剛點了一份味噌烤香菇', (w) => { w.recent = [said(3, 'miso-shiitake', 1000, 41)] })
    when('同一刻她又點了一份鹽烤秋刀魚', (w) => { w.now = orderSaid(w.recent, 3, 'salt-saury', 1000) })
    then('另寫一行', (w) => { expect(w.now.again).toBe(false) })
  })

  scenario('記著的點單只留這一刻的', ({ given, when, then }) => {
    given('3 號在 1 秒時點了香菇', (w) => { w.recent = [said(3, 'miso-shiitake', 1000, 41)] })
    when(`過了 ${TOGETHER_MS} 毫秒以上，4 號點了秋刀魚`, (w) => { w.next = withOrder(w.recent, said(4, 'salt-saury', 1000 + TOGETHER_MS + 1, 50)) })
    then('只記著 4 號那一筆', (w) => { expect(w.next.map((r: OrderSaid) => r.guest)).toEqual([4]) })
  })
})

feature('日誌裡同一刻同一句話不寫兩次', () => {
  const line = '醬烤年糕淋煉乳下爐！油脂滴下去的香氣太誘人了！'
  scenario('大廚同一刻把兩份同一道放上火：「下爐」只寫一次', ({ given, when, then, but }) => {
    given('大廚剛說了一句「醬烤年糕淋煉乳下爐！」', (w) => { w.last = { text: line, at: 1000 } })
    when('同一刻又放上第二份，同一句再說一次', (w) => { w.again = saidAgain(w.last, line, 1000) })
    then('不再寫一行', (w) => { expect(w.again).toBe(true) })
    but(`過了 ${TOGETHER_MS} 毫秒以上再說，照寫`, (w) => { expect(saidAgain(w.last, line, 1000 + TOGETHER_MS + 1)).toBe(false) })
  })

  scenario('同一刻說的是別的話：照寫', ({ given, then }) => {
    given('大廚剛說了一句「醬烤年糕淋煉乳下爐！」', (w) => { w.last = { text: line, at: 1000 } })
    then('同一刻說「鹽烤秋刀魚下爐！」照寫', (w) => { expect(saidAgain(w.last, '鹽烤秋刀魚下爐！油脂滴下去的香氣太誘人了！', 1000)).toBe(false) })
  })
})
