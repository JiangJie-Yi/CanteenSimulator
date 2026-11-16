import { expect } from 'vitest'
import { CARD_FEE, MIN_WAGE, MIN_WAGE_YEN, PLATFORM_CUT, RENT_PER_DAY, RENT_YEN_MONTH, YEN, yen } from '@/data/osaka'
import { cardFee, platformCut, rentDue } from '@/game/costs'
import { cashInHand, CAPITAL, costOf } from '@/game/economy'
import { daySummary } from '@/game/daySummary'
import { feature, scenario } from './bdd'

const none = { revenue: 0, food: 0, fuel: 0, wage: 0 }

feature('店在大阪：開銷照大阪的算（店主 2026-11-16：「店當然在大阪，故事都有」）', () => {
  scenario('日圓照一個匯率換成帳上的台幣', ({ then, and }) => {
    then('¥1,000 是 NT$210', () => { expect(yen(1000)).toBeCloseTo(1000 * YEN, 6); expect(YEN).toBe(0.21) })
    and(`最低工資 ¥${MIN_WAGE_YEN.toLocaleString('en-US')}（大阪府，2026-10-01 起）換成台幣`, () => { expect(MIN_WAGE).toBe(Math.round(MIN_WAGE_YEN * YEN)); expect(MIN_WAGE).toBe(259) })
  })

  scenario('房租一天一天付：每天開店時付到今天為止', ({ given, when, then, and }) => {
    given(`天滿的小店一個月 ¥${RENT_YEN_MONTH.toLocaleString('en-US')}`, () => { expect(RENT_PER_DAY).toBe(Math.round((RENT_YEN_MONTH * YEN) / 30)) })
    when('第 1 天第一次開店', (w) => { w.due = rentDue(0, 1) })
    then('付 1 天', (w) => { expect(w.due).toEqual({ days: 1, amount: RENT_PER_DAY }) })
    and('同一天再開一次不用再付', () => { expect(rentDue(1, 1).amount).toBe(0) })
    and('休了 2 天，第 4 天開店時把沒開的那 2 天一起付（房租不管有沒有開門都要付）', () => { expect(rentDue(1, 4)).toEqual({ days: 3, amount: 3 * RENT_PER_DAY }) })
  })

  scenario('刷卡結帳：發卡公司扣 3.24% 手續費', ({ when, then }) => {
    when('一張 NT$1,000 的帳單刷卡', (w) => { w.fee = cardFee(1000) })
    then('扣 NT$32.4', (w) => { expect(w.fee).toBeCloseTo(32.4, 6); expect(CARD_FEE).toBe(0.0324) })
  })

  scenario('外送平台的單：平台抽 35%（含外送員）', ({ when, then }) => {
    when('外送員取一份 NT$400 的單', (w) => { w.cut = platformCut(400) })
    then('平台抽 NT$140', (w) => { expect(w.cut).toBeCloseTo(140, 6); expect(PLATFORM_CUT).toBe(0.35) })
  })

  scenario('房租、外送抽成、刷卡手續費都從手上的現金扣，也算進當天的利潤', ({ given, when, then, and }) => {
    given('一天的帳：營業額 NT$20,000，食材 NT$6,000，人事 NT$5,000，房租、抽成、手續費各一筆', (w) => {
      w.to = { revenue: 20000, food: 6000, fuel: 0, wage: 5000, utility: 300, rent: RENT_PER_DAY, platform: 700, cardFee: 200, night: 600, overtime: 300 }
    })
    when('打烊結算', (w) => { w.s = daySummary(none, w.to as typeof none, [], {}) })
    then('利潤扣掉房租、抽成、手續費', (w) => {
      const s = w.s as ReturnType<typeof daySummary>
      expect(s.profit).toBeCloseTo(20000 - 6000 - 5000 - 300 - RENT_PER_DAY - 700 - 200, 6)
      expect(s.rent).toBe(RENT_PER_DAY); expect(s.platform).toBe(700); expect(s.cardFee).toBe(200)
    })
    and('人事費率是人事除以營業額（25%）；加班與深夜加給另外列出（已含在人事裡）', (w) => {
      const s = w.s as ReturnType<typeof daySummary>
      expect(s.labour).toBeCloseTo(0.25, 6); expect(s.night).toBe(600); expect(s.overtime).toBe(300)
    })
    and('手上的現金也扣掉它們', (w) => {
      const b = w.to as Record<string, number>
      expect(cashInHand({ revenue: b.revenue, bought: 0, fuel: 0, wage: b.wage, utility: b.utility, rent: b.rent, platform: b.platform, cardFee: b.cardFee }))
        .toBeCloseTo(CAPITAL + 20000 - 5000 - 300 - RENT_PER_DAY - 700 - 200, 6)
    })
  })

  scenario('食材成本照大阪居酒屋的原價率：魚約三成多，蔬菜約兩成，飯和味噌湯最便宜', ({ then, and }) => {
    then('一尾 NT$200 的秋刀魚進貨 NT$70', () => { expect(costOf({ id: 'Saury', price: 200 })).toBe(70) })
    and('一串 NT$60 的香菇 NT$14，一份 NT$100 的味噌湯 NT$15', () => {
      expect(costOf({ id: 'GrilledShiitake', price: 60 })).toBe(14)
      expect(costOf({ id: 'MisoSoup', price: 100 })).toBe(15)
    })
  })
})
