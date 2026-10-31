import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { freshRoom, visitRoom, cleanRoom, newRoll, penaltyOf, looksOf, openRoom, DIRTY_AT, ROLL_USES } from '@/game/restroom'

feature('廁所的清潔與衛生紙', () => {
  scenario('剛打掃好的廁所，客人用完沒有怨言，但會變髒一點、衛生紙少一點', ({ given, when, then, and }) => {
    given('乾淨、衛生紙全新的廁所', (w) => { w.r = freshRoom() })
    when('一位客人用了', (w) => { w.u = visitRoom(w.r) })
    then('客人沒有怨言', (w) => { expect(w.u.complaint).toBeNull(); expect(penaltyOf(w.u.complaint)).toBe(0) })
    and('廁所髒了一點', (w) => { expect(w.u.room.clean).toBeLessThan(1) })
    and('衛生紙少了一點', (w) => { expect(w.u.room.paper).toBeLessThan(1) })
  })

  scenario('一直沒打掃，廁所會髒到客人抱怨，抱怨的客人給的評分會變低', ({ given, when, then, and }) => {
    given('乾淨的廁所', (w) => { w.r = freshRoom() })
    when('一直有人用、沒人打掃（每用完一捲就換新）', (w) => {
      w.said = []
      for (let i = 0; i < 12; i++) {
        if (w.r.paper <= 0) w.r = newRoll(w.r)
        const u = visitRoom(w.r)
        w.said.push(u.complaint)
        w.r = u.room
      }
    })
    then('一開始沒人抱怨', (w) => { expect(w.said[0]).toBeNull() })
    and('後來有人抱怨廁所髒', (w) => { expect(w.said).toContain('dirty') })
    and('抱怨髒的客人會扣分', () => { expect(penaltyOf('dirty')).toBeGreaterThan(0) })
  })

  scenario('衛生紙用完沒換，客人會抱怨，而且比髒更生氣', ({ given, when, then, and }) => {
    given('一捲衛生紙', (w) => { w.r = freshRoom() })
    when(`連續 ${ROLL_USES + 1} 位客人用，中間都沒有換`, (w) => {
      w.said = []
      for (let i = 0; i <= ROLL_USES; i++) { const u = visitRoom(cleanRoom(w.r)); w.said.push(u.complaint); w.r = u.room }
    })
    then(`前 ${ROLL_USES} 位都有衛生紙`, (w) => { expect(w.said.slice(0, ROLL_USES).every((c: unknown) => c === null)).toBe(true) })
    and('最後一位沒有衛生紙', (w) => { expect(w.said[ROLL_USES]).toBe('paper') })
    and('沒有衛生紙扣得比髒還多', () => { expect(penaltyOf('paper')).toBeGreaterThan(penaltyOf('dirty')) })
  })

  scenario('老闆打掃、換衛生紙，廁所就恢復', ({ given, when, then, and }) => {
    given('又髒、衛生紙又用完的廁所', (w) => { w.r = { clean: 0.1, paper: 0, uses: 9 } })
    when('打掃並換一捲新的', (w) => { w.r = newRoll(cleanRoom(w.r)) })
    then('變回全乾淨', (w) => { expect(w.r.clean).toBe(1) })
    and('衛生紙是滿的', (w) => { expect(w.r.paper).toBe(1) })
    and('下一位客人沒有怨言', (w) => { expect(visitRoom(w.r).complaint).toBeNull() })
  })

  scenario('看得出廁所的狀態：乾淨、用過、髒、髒到有蒼蠅', ({ given, when, then }) => {
    given('四種清潔度', (w) => { w.k = [1, 0.7, DIRTY_AT - 0.05, 0.1].map((c) => looksOf({ clean: c, paper: 1, uses: 0 })) })
    when('看', () => {})
    then('依序是 乾淨、用過、髒、有蒼蠅', (w) => { expect(w.k).toEqual(['fresh', 'used', 'dirty', 'flies']) })
  })

  scenario('每天開店前店員會打掃，但衛生紙不會自己補', ({ given, when, then, and }) => {
    given('昨天收店時又髒、衛生紙剩一點', (w) => { w.r = { clean: 0.2, paper: 0.2, uses: 8 } })
    when('今天開店', (w) => { w.r = openRoom(w.r) })
    then('廁所是乾淨的', (w) => { expect(w.r.clean).toBe(1) })
    and('衛生紙還是剩一點，要老闆自己換', (w) => { expect(w.r.paper).toBeCloseTo(0.2, 6) })
  })
})
