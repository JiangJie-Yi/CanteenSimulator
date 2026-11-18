import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOND_STAGES, CUT_BOND, LOW_BOND, PRAISE_AFTER_H, RAISE_STEP, canPraise, payBond, raiseBond, stageOf } from '@/game/affinity'
import { ASK_AGAIN, DORM_CAP, MOVE_OUT_BOND, asksToday, hasRoom, lodgeDayBond, movesOut, takesOffer, wantsLodging } from '@/game/lodging'

// (two ids found by their own hash: one who wants to live in, one who doesn't)
const ids = Array.from({ length: 200 }, (_, k) => `grilledfish-w${k}`)
const wanter = ids.find((id) => wantsLodging(id))!
const homebody = ids.find((id) => !wantsLodging(id))!

feature('好感度看得懂、加薪、稱讚的條件（第 359、370 項）', () => {
  scenario('好感分四段，每段有名字、作用，與到下一段還差多少', ({ then, and }) => {
    then('0 是冷淡、15 普通、50 友好、80 親密', () => {
      expect(stageOf(0).stage.zh).toBe('冷淡'); expect(stageOf(LOW_BOND).stage.zh).toBe('普通')
      expect(stageOf(50).stage.zh).toBe('友好'); expect(stageOf(80).stage.zh).toBe('親密')
    })
    and('62：友好，再 18 到親密', () => { const s = stageOf(62); expect(s.stage.zh).toBe('友好'); expect(s.next?.zh).toBe('親密'); expect(s.toNext).toBe(18) })
    and('最高那段沒有下一段', () => { expect(stageOf(95).next).toBeNull() })
    and('每段都寫了作用（中日英）', () => { for (const st of BOND_STAGES) for (const l of ['zh', 'ja', 'en'] as const) expect(st.does[l].length).toBeGreaterThan(0) })
  })

  scenario('加薪好感會上升，第一次最多，越加越少；減薪大降', ({ then, and }) => {
    then('第一次加薪 +5、加過 10 元 +4、加過 40 元以上 +1', () => { expect(raiseBond(0)).toBe(5); expect(raiseBond(RAISE_STEP)).toBe(4); expect(raiseBond(40)).toBe(1); expect(raiseBond(80)).toBe(1) })
    and('減薪 -8', () => { expect(CUT_BOND).toBe(-8) })
  })

  scenario('每天比較薪水與行情：高一成以上慢慢變好，低一成以上慢慢變差', ({ then, and }) => {
    then('高於行情一成：+1', () => { expect(payBond(1210, 1100)).toBe(1) })
    and('差不多：0', () => { expect(payBond(1100, 1100)).toBe(0) })
    and('低於行情一成：-1', () => { expect(payBond(980, 1100)).toBe(-1) })
  })

  scenario('稱讚要有理由：今天上班滿 4 小時才能稱讚，一天一次', ({ then, and }) => {
    then('剛上班：不能', () => { expect(canPraise(1, false)).toBe(false) })
    and('滿 4 小時：可以', () => { expect(canPraise(PRAISE_AFTER_H, false)).toBe(true) })
    and('今天已經稱讚過：不能', () => { expect(canPraise(8, true)).toBe(false) })
  })
})

feature('住宿：員工申請、老闆邀請，最多 3 人（第 361 項）', () => {
  scenario('想住的人好感夠了會申請；被拒絕一星期內不再提', ({ then, and }) => {
    then('想住、好感 50、沒住、沒申請過：會申請', () => { expect(asksToday(wanter, { bond: 50 }, 10)).toBe(true) })
    and('不想住的人：不會申請', () => { expect(asksToday(homebody, { bond: 90 }, 10)).toBe(false) })
    and('好感不到 40：還不好意思開口', () => { expect(asksToday(wanter, { bond: 30 }, 10)).toBe(false) })
    and('已經住了、或申請還沒回覆：不會再申請', () => { expect(asksToday(wanter, { bond: 60, lives: true }, 10)).toBe(false); expect(asksToday(wanter, { bond: 60, lodgeAsk: 9 }, 10)).toBe(false) })
    and('被拒絕 7 天內不再提，7 天後會再提', () => {
      expect(asksToday(wanter, { bond: 60, lodgeNo: 10 }, 10 + ASK_AGAIN - 1)).toBe(false)
      expect(asksToday(wanter, { bond: 60, lodgeNo: 10 }, 10 + ASK_AGAIN)).toBe(true)
    })
  })

  scenario('老闆邀請：想住的一定答應；不想住的看好感，越喜歡越可能', ({ then, and }) => {
    then('想住的：答應', () => { expect(takesOffer(wanter, 20, 0.99)).toBe(true) })
    and('不想住、好感 60 以下：不答應', () => { expect(takesOffer(homebody, 60, 0)).toBe(false) })
  })

  scenario('最多住 3 人；住進去的（想住的）每天好感 +1；被請搬出、或好感太低會搬走', ({ then, and }) => {
    then('住了 2 人還有位子，3 人滿了', () => { expect(hasRoom(DORM_CAP - 1)).toBe(true); expect(hasRoom(DORM_CAP)).toBe(false) })
    and('想住的人住著：每天 +1；不想住的人住著：0', () => { expect(lodgeDayBond(wanter, true)).toBe(1); expect(lodgeDayBond(homebody, true)).toBe(0) })
    and('被請搬出（原本想住）好感 -6', () => { expect(MOVE_OUT_BOND).toBe(-6) })
    and('住著、好感低於 20：自己搬走', () => { expect(movesOut({ lives: true, bond: 15 })).toBe(true); expect(movesOut({ lives: true, bond: 40 })).toBe(false) })
  })
})
