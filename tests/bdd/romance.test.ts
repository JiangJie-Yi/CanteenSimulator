import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BREAKUP_AT, CONFESS_AT, DATE_BOND, FAIL_BOND, RETRY_DAYS, canConfess, canDate, confess, dayRomance, goOnDate, yesChance } from '@/game/romance'

const her = { look: { female: true }, years: 26 }

feature('和員工談戀愛（第 340 項）', () => {
  scenario('只有成年的女員工、好感度到 80 才能告白，一次只跟一位交往', ({ then, and }) => {
    then('成年女員工好感 80：可以', () => { expect(canConfess(her, { bond: CONFESS_AT }, 10, false)).toBe(true) })
    and('好感不到 80：不行', () => { expect(canConfess(her, { bond: CONFESS_AT - 1 }, 10, false)).toBe(false) })
    and('男員工、未滿二十歲：不行', () => {
      expect(canConfess({ look: { female: false }, years: 30 }, { bond: 95 }, 10, false)).toBe(false)
      expect(canConfess({ look: { female: true }, years: 19 }, { bond: 95 }, 10, false)).toBe(false)
    })
    and('已經在跟別人交往：不行', () => { expect(canConfess(her, { bond: 95 }, 10, true)).toBe(false) })
  })

  scenario('告白：越喜歡越容易答應；被拒絕好感降一點，七天內不能再告白', ({ then, and }) => {
    then('好感 80 一半、100 幾乎一定', () => { expect(yesChance(80)).toBeCloseTo(0.5, 5); expect(yesChance(100)).toBeCloseTo(0.95, 5) })
    and('答應了：從今天開始交往', () => { const o = confess({ bond: 90 }, 12, 0.1); expect(o.yes).toBe(true); expect(o.r.dating).toBe(12) })
    and('拒絕了：好感降、記下日子', () => { const o = confess({ bond: 82 }, 12, 0.99); expect(o.yes).toBe(false); expect(o.r.bond).toBe(82 + FAIL_BOND); expect(o.r.askedOn).toBe(12) })
    and('七天內不能再告白，七天後可以（好感夠的話）', () => {
      expect(canConfess(her, { bond: 85, askedOn: 12 }, 12 + RETRY_DAYS - 1, false)).toBe(false)
      expect(canConfess(her, { bond: 85, askedOn: 12 }, 12 + RETRY_DAYS, false)).toBe(true)
    })
  })

  scenario('交往中：休店的日子可以約會（一天一次），好感上升；每天也慢慢升', ({ then, and }) => {
    then('營業中不能約會，休店可以，同一天只一次', () => {
      expect(canDate({ dating: 3 }, 9, true)).toBe(false)
      expect(canDate({ dating: 3 }, 9, false)).toBe(true)
      expect(canDate({ dating: 3, datedOn: 9 }, 9, false)).toBe(false)
    })
    and('約會好感上升', () => { expect(goOnDate({ bond: 70, dating: 3 }, 9).bond).toBe(70 + DATE_BOND) })
    and('每天結束好感 +1', () => { expect(dayRomance({ bond: 70, dating: 3 }).r.bond).toBe(71) })
  })

  scenario('好感掉到 45 以下就分手', ({ then, and }) => {
    then('好感 44：分手', () => { const o = dayRomance({ bond: BREAKUP_AT - 1, dating: 3 }); expect(o.brokeUp).toBe(true); expect(o.r.dating).toBeUndefined() })
    and('沒在交往：什麼都不變', () => { const o = dayRomance({ bond: 20 }); expect(o.brokeUp).toBe(false); expect(o.r.bond).toBe(20) })
  })
})
