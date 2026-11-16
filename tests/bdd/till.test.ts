import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { afterRefund, BUSY_QUEUE, breakDown, DENOMS, deposit, dishLines, drawerFrom, drawerOpens, drawerTotal, openingFloat, owedAtTill, paysAtTill, paysByCard,
  refundFor, refundOf, tabletActive, tabTotal, takeOut, type Tab } from '@/game/till'
import { cashInHand, SHOP_COST, type CashBooks } from '@/game/economy'

feature('收銀櫃的平板與付款方式', () => {
  scenario('平時平板不啟用', ({ given, then }) => {
    given('只有一組客人排隊結帳、付現金', (w) => { w.on = tabletActive(1, false) })
    then('平板不啟用', (w) => { expect(w.on).toBe(false) })
  })

  scenario('排隊結帳到 3 組以上時平板啟用', ({ when, then, but }) => {
    when('排隊的客人有 3 組', (w) => { w.on = tabletActive(BUSY_QUEUE, false) })
    then('平板啟用，當第二台收銀', (w) => { expect(BUSY_QUEUE).toBe(3); expect(w.on).toBe(true) })
    but('只有 2 組時不啟用', () => { expect(tabletActive(2, false)).toBe(false) })
  })

  scenario('客人刷卡時平板啟用，錢櫃不打開', ({ given, then, and }) => {
    given('一位刷卡的客人', (w) => { w.card = true })
    then('平板啟用', (w) => { expect(tabletActive(0, w.card)).toBe(true) })
    and('收銀機的錢櫃不彈出', (w) => { expect(drawerOpens(w.card)).toBe(false); expect(drawerOpens(false)).toBe(true) })
  })

  scenario('大約四成客人刷卡，同一位客人每次都一樣', ({ when, then }) => {
    when('看 1000 位客人', (w) => { w.cards = Array.from({ length: 1000 }, (_, i) => paysByCard(i + 1)).filter(Boolean).length })
    then('刷卡的在三到五成之間，且結果固定', (w) => {
      expect(w.cards).toBeGreaterThan(300)
      expect(w.cards).toBeLessThan(500)
      expect(paysByCard(7)).toBe(paysByCard(7))
    })
  })
})

feature('老闆從收銀機抽屜拿錢', () => {
  scenario('開店時抽屜裡有零錢，沒有萬元鈔', ({ given, then }) => {
    given('一天開始的抽屜', (w) => { w.d = openingFloat() })
    then('有一些零錢，萬元鈔是 0 張', (w) => { expect(drawerTotal(w.d)).toBeGreaterThan(0); expect(w.d[10000]).toBe(0) })
  })

  scenario('付現的客人結帳後，帳單金額進抽屜', ({ given, when, then }) => {
    given('一天開始的抽屜', (w) => { w.d = openingFloat(); w.before = drawerTotal(w.d) })
    when('客人付了 1,140 元的帳', (w) => { w.d = deposit(w.d, 1140) })
    then('抽屜多了 1,140 元，用最少的鈔票和硬幣', (w) => {
      expect(drawerTotal(w.d) - w.before).toBe(1140)
      expect(breakDown(1140)).toMatchObject({ 1000: 1, 100: 1, 10: 4 })
    })
  })

  scenario('老闆點一格，整格的錢拿走，加到總金額', ({ given, when, then, and }) => {
    given('抽屜裡有 8 張千元鈔', (w) => { w.d = openingFloat() })
    when('老闆點千元鈔那格', (w) => { const r = takeOut(w.d, 1000); w.d2 = r.drawer; w.amount = r.amount })
    then('拿到 8,000 元', (w) => { expect(w.amount).toBe(8000) })
    and('那格空了，其他格不變', (w) => {
      expect(w.d2[1000]).toBe(0)
      expect(w.d2[500]).toBe(w.d[500])
      expect(drawerTotal(w.d) - drawerTotal(w.d2)).toBe(8000)
    })
  })

  scenario('空的格子拿不到錢', ({ when, then }) => {
    when('老闆點空的萬元鈔那格', (w) => { w.r = takeOut(openingFloat(), 10000) })
    then('拿到 0 元', (w) => { expect(w.r.amount).toBe(0) })
  })
})

// (item 195, the owner's: the drawer's money was counted twice, as the customer ordered and again as it was taken out; and "面額是日元才對":
// the drawer keeps its yen, the books their NT$, a figure for a figure)
feature('現金只算抽屜外的錢，抽屜裡的錢拿出來才加進現金（第 195 項）', () => {
  const start = (): CashBooks => ({ revenue: 0, bought: 0, fuel: 0, wage: 0, setup: SHOP_COST, till: 0, tillIn: 0 })
  const sat = (): Tab => ({ paid: 0, parts: 0, atTill: true })

  scenario('付現的客人：點菜時現金不變，付錢時錢進抽屜，老闆拿出來現金才增加，客人的錢只算一次', ({ given, when, then, and }) => {
    given('開店時現金 NT$200,000，抽屜裡是零用金', (w) => {
      w.books = start(); w.drawer = openingFloat(); w.tab = sat()
      expect(cashInHand(w.books)).toBe(200000)
    })
    when('客人點了 480 元的菜，又從冰箱拿了 40 元的飲料', (w) => {
      w.books.revenue += 480; w.tab.paid += 480; w.tab.parts += 1
      w.books.revenue += 40; w.tab.drink = 40
    })
    then('還沒付錢，現金不變', (w) => { expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000) })
    when('客人在收銀台付了現金', (w) => {
      const bill = tabTotal(w.tab)
      w.drawer = deposit(w.drawer, bill); w.books.tillIn += bill; w.tab.settled = true
    })
    then('520 元進了抽屜，現金還是不變', (w) => {
      expect(drawerTotal(w.drawer) - drawerTotal(openingFloat())).toBe(520)
      expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000)
    })
    when('老闆把抽屜每一格都拿出來', (w) => {
      for (const k of DENOMS) { const r = takeOut(w.drawer, k); w.drawer = r.drawer; w.books.till += r.amount }
    })
    then('抽屜空了，現金多了客人的 520 元和零用金', (w) => {
      expect(drawerTotal(w.drawer)).toBe(0)
      expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000 + 520 + drawerTotal(openingFloat()))
    })
    and('營收只記了一次 520 元', (w) => { expect(w.books.revenue).toBe(520) })
  })

  scenario('刷卡的客人：付款那一刻現金增加，抽屜不變', ({ given, when, then }) => {
    given('一位刷卡的客人點了 760 元的菜', (w) => {
      w.books = start(); w.drawer = openingFloat(); w.tab = sat()
      w.books.revenue += 760; w.tab.paid += 760; w.tab.parts += 2
      expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000)
    })
    when('客人在收銀台刷卡', (w) => { w.tab.settled = true })
    then('現金多了 760 元，抽屜裡還是零用金', (w) => {
      expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200760)
      expect(drawerTotal(w.drawer)).toBe(drawerTotal(openingFloat()))
    })
  })

  // (item 204, the owner's: 「棒金可以不用」: no coin rolls in the drawer any more)
  scenario('零用金拿出來加進現金，但不算營收', ({ given, when, then, and }) => {
    given('開店時的抽屜', (w) => { w.books = start(); w.drawer = openingFloat() })
    when('老闆拿走千元鈔那格', (w) => {
      const a = takeOut(w.drawer, 1000)
      w.drawer = a.drawer; w.books.till += a.amount
    })
    then('現金多了 8,000 元', (w) => { expect(cashInHand(w.books)).toBe(208000) })
    and('營收還是 0', (w) => { expect(w.books.revenue).toBe(0) })
  })

  scenario('等太久生氣走掉、什麼都沒吃的客人：全部退款，不用到收銀台付錢', ({ given, when, then, and }) => {
    given('客人點了兩樣、共 760 元', (w) => {
      w.books = start(); w.tab = sat()
      w.books.revenue += 760; w.tab.paid = 760; w.tab.parts = 2
    })
    when('兩樣都沒吃到就走了', (w) => {
      w.refund = refundOf(w.tab, 2); w.books.revenue -= w.refund; w.tab = afterRefund(w.tab, 2)
    })
    then('退了 760 元，帳單是 0，經過收銀台不付錢', (w) => {
      expect(w.refund).toBe(760)
      expect(tabTotal(w.tab)).toBe(0)
      expect(paysAtTill(w.tab)).toBe(false)
    })
    and('現金跟開店時一樣', (w) => { expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000) })
  })

  scenario('吃了一部分就走的客人：收銀台只收吃到的那份', ({ given, when, then }) => {
    given('客人點了三樣、共 900 元', (w) => { w.tab = { ...sat(), paid: 900, parts: 3 } })
    when('有一樣等不到就走了', (w) => { w.tab = afterRefund(w.tab, 1) })
    then('收銀台打的兩道加起來是 600 元', (w) => {
      expect(paysAtTill(w.tab)).toBe(true)
      expect(dishLines(w.tab.paid, w.tab.parts).reduce((a: number, b: number) => a + b, 0)).toBe(600)
      expect(owedAtTill([w.tab])).toBe(600)
    })
  })

  // (item 203: the side miso soup and sake were booked straight into the takings and never put on the bill: never paid at the till, and
  // one whose sake never came was refunded the fish they'd eaten)
  scenario('加點的味噌湯、清酒寫進帳單，收銀台照收', ({ given, when, then, and }) => {
    given('客人點了兩樣、共 760 元', (w) => { w.books = start(); w.books.revenue += 760; w.tab = { ...sat(), paid: 760, parts: 2 } })
    when('又加點一碗 50 元的味噌湯、一壺 280 元的清酒', (w) => {
      w.books.revenue += 50 + 280
      w.tab.side = [{ id: 'MisoSoup', price: 50 }, { id: 'Sake', price: 280 }]
    })
    then('帳單是 1,090 元', (w) => { expect(tabTotal(w.tab)).toBe(1090) })
    and('還沒付以前，現金跟開店時一樣', (w) => { expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200000) })
  })

  scenario('加點的清酒沒來就走：退清酒的錢，吃到的菜照收', ({ given, when, then, and }) => {
    given('客人點了兩樣共 760 元，加點一壺 280 元的清酒', (w) => {
      w.tab = { ...sat(), paid: 760, parts: 2, side: [{ id: 'Sake', price: 280 }] }
    })
    when('兩樣菜都吃到了，清酒沒來就走了', (w) => { w.r = refundFor(w.tab, ['Sake']) })
    then('退 280 元', (w) => { expect(w.r.back).toBe(280) })
    and('收銀台收 760 元，兩道菜照打', (w) => {
      expect(tabTotal(w.r.tab)).toBe(760)
      expect(w.r.tab.parts).toBe(2)
    })
  })

  scenario('菜沒來、加點的味噌湯喝了：退那道菜的錢，味噌湯照收', ({ given, when, then, and }) => {
    given('客人點了兩樣共 760 元，加點一碗 50 元的味噌湯', (w) => {
      w.tab = { ...sat(), paid: 760, parts: 2, side: [{ id: 'MisoSoup', price: 50 }] }
    })
    when('有一樣菜等不到就走了', (w) => { w.r = refundFor(w.tab, ['Saury']) })
    then('退 380 元', (w) => { expect(w.r.back).toBe(380) })
    and('收銀台收 430 元', (w) => { expect(tabTotal(w.r.tab)).toBe(430) })
  })

  scenario('外帶的客人不在收銀台付：點單時現金就增加', ({ given, when, then }) => {
    given('一張外帶單', (w) => { w.books = start(); w.tab = { paid: 0, parts: 0, atTill: false } })
    when('點了 350 元', (w) => { w.books.revenue += 350; w.tab.paid += 350; w.tab.parts += 1 })
    then('現金多了 350 元', (w) => { expect(cashInHand(w.books, owedAtTill([w.tab]))).toBe(200350) })
  })

  scenario('結帳時一道一道打進收銀機，加起來等於帳單', ({ then, and }) => {
    then('1,001 元分三道是 333、333、335', () => { expect(dishLines(1001, 3)).toEqual([333, 333, 335]) })
    and('什麼都沒有就沒有菜的那幾道', () => { expect(dishLines(0, 2)).toEqual([]) })
  })

  scenario('畫面掉了接著玩：抽屜照存下來的樣子，不對的就不用', ({ then, and }) => {
    then('存下來的抽屜照樣讀回來', () => {
      const d = deposit(openingFloat(), 1140)
      expect(drawerFrom(JSON.parse(JSON.stringify(d)))).toEqual(d)
    })
    and('少一格、負數或不是數字的不用', () => {
      expect(drawerFrom({ ...openingFloat(), 500: -1 })).toBeNull()
      expect(drawerFrom({ 10000: 1 })).toBeNull()
      expect(drawerFrom(null)).toBeNull()
    })
  })
})
