import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { URGE_COOLDOWN_S, URGE_PACE, URGE_S, urgeOk, urgePace, urgeWait } from '@/game/urge'

feature('催促員工（第 348 項：點員工可以催促）', () => {
  scenario('催促後一陣子做事比較快，時間到就恢復', ({ given, then, and }) => {
    given('第 0 秒催促', (w) => { w.at = 0 })
    then(`${URGE_S} 秒內快 ${Math.round((URGE_PACE - 1) * 100)}%`, (w) => { expect(urgePace(w.at, 1000)).toBe(URGE_PACE); expect(urgePace(w.at, URGE_S * 1000 - 1)).toBe(URGE_PACE) })
    and('時間到恢復原速', (w) => { expect(urgePace(w.at, URGE_S * 1000)).toBe(1) })
    and('沒催促過的人照原速', () => { expect(urgePace(undefined, 5000)).toBe(1) })
  })

  scenario('不能一直催：要隔一段時間', ({ given, then, and }) => {
    given('第 0 秒催促過', (w) => { w.at = 0 })
    then(`${URGE_COOLDOWN_S} 秒內不能再催，告訴玩家還要等幾秒`, (w) => { expect(urgeOk(w.at, 60_000)).toBe(false); expect(urgeWait(w.at, 60_000)).toBe(URGE_COOLDOWN_S - 60) })
    and('時間到就可以', (w) => { expect(urgeOk(w.at, URGE_COOLDOWN_S * 1000)).toBe(true); expect(urgeWait(w.at, URGE_COOLDOWN_S * 1000)).toBe(0) })
    and('沒催促過的人隨時可以', () => { expect(urgeOk(undefined, 0)).toBe(true) })
  })
})
