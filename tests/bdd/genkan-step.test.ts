import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { newStepTurn, stepFrame, waitsForStep, type StepTurn } from '@/game/genkanStep'

// (item 414: found by the crowd audit, two customers stood at the genkan's step in each other changing their shoes)
// (a customer's way: the step 1.0 along it, their stop there 1.2 long (in the walk's units), a body's length 0.6)
const AT = 1.0, HOLD = 1.2, GAP = 0.6
/** one frame of two customers walking up to the step together: who waits */
function frame(t: StepTurn, ds: Record<number, number>) {
  stepFrame(t)
  const out: Record<number, boolean> = {}
  for (const [id, d] of Object.entries(ds)) out[+id] = waitsForStep(t, +id, d, AT, AT + HOLD, GAP)
  return out
}

feature('玄關台階一次站一位客人', () => {
  scenario('兩位一起進門，第一位在台階脫鞋時，第二位在後面一個身位等', ({ given, when, then, and }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('兩位客人一起進門，第一位先走到離台階一個身位內', () => { frame(w.t, { 1: AT - 0.5, 2: AT - 0.7 }) })
    when('第二位也走到離台階一個身位的地方，第一位已經站在台階上脫鞋', () => { w.now = frame(w.t, { 1: AT + 0.3, 2: AT - GAP }) })
    then('第一位不用等', () => expect(w.now[1]).toBe(false))
    and('第二位停下來等', () => expect(w.now[2]).toBe(true))
  })

  scenario('前一位脫好鞋走上去以後，後面的人才走到台階', ({ given, when, then, and }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('第一位在台階上脫鞋，第二位在後面等', () => { frame(w.t, { 1: AT, 2: AT - GAP }) })
    when('第一位脫好鞋、走過台階', () => { w.now = frame(w.t, { 1: AT + HOLD, 2: AT - GAP }) })
    then('第二位不用再等，換他走到台階', () => expect(w.now[2]).toBe(false))
    and('台階現在是第二位的', () => expect(w.t.by).toBe(2))
  })

  scenario('兩位一起離開，一位穿鞋時，另一位在後面等', ({ given, when, then }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('兩位一起結完帳往門口走，第一位先到台階穿鞋', () => { frame(w.t, { 7: AT + 0.1, 8: AT - 0.8 }) })
    when('第二位走到離台階一個身位內', () => { w.now = frame(w.t, { 7: AT + 0.4, 8: AT - 0.4 }) })
    then('第二位停下來等第一位穿好', () => expect(w.now[8]).toBe(true))
  })

  scenario('還沒走到台階附近的人不用等', ({ given, when, then }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('一位客人在台階上脫鞋', () => { frame(w.t, { 1: AT + 0.2 }) })
    when('另一位剛從門口進來，離台階還有一個身位以上', () => { w.now = frame(w.t, { 1: AT + 0.4, 2: AT - GAP - 0.2 }) })
    then('他照常往前走', () => expect(w.now[2]).toBe(false))
  })

  scenario('三位陸續走到台階：一位脫鞋，第二位在後面一個身位，第三位在後面兩個身位，不疊在一起', ({ given, when, then, and }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('第一位在台階上脫鞋，第二位在後面一個身位等', () => { frame(w.t, { 1: AT - 0.5 }); frame(w.t, { 1: AT + 0.1, 2: AT - GAP }) })
    when('第三位走到離台階兩個身位的地方', () => { w.now = frame(w.t, { 1: AT + 0.3, 2: AT - GAP, 3: AT - 2 * GAP }) })
    then('第二位還在等', () => expect(w.now[2]).toBe(true))
    and('第三位在那裡停下來等，不再往前擠到第二位身上', () => expect(w.now[3]).toBe(true))
    and('還沒走到兩個身位的人照常往前走', () => {
      const t = newStepTurn()
      frame(t, { 1: AT - 0.5 }); frame(t, { 1: AT + 0.1, 2: AT - GAP })
      expect(frame(t, { 1: AT + 0.3, 2: AT - GAP, 3: AT - 2 * GAP - 0.05 })[3]).toBe(false)
    })
  })

  scenario('前一位脫好鞋走上去，排隊的人依序往前補一個身位', ({ given, when, then, and }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('一位在台階上，兩位在後面排隊', () => {
      frame(w.t, { 1: AT - 0.5 }); frame(w.t, { 1: AT + 0.1, 2: AT - GAP }); frame(w.t, { 1: AT + 0.3, 2: AT - GAP, 3: AT - 2 * GAP })
    })
    when('第一位脫好鞋走過台階', () => { w.now = frame(w.t, { 1: AT + HOLD, 2: AT - GAP, 3: AT - 2 * GAP }) })
    then('第二位走到台階上', () => { expect(w.now[2]).toBe(false); expect(w.t.by).toBe(2) })
    and('第三位往前走，補到離台階一個身位的地方再停', () => {
      expect(w.now[3]).toBe(false)
      expect(frame(w.t, { 2: AT + 0.2, 3: AT - GAP })[3]).toBe(true)
    })
  })

  scenario('站在台階上的人不見了（被請走、關店），下一格台階就空出來，不會讓後面的人一直等', ({ given, when, then }) => {
    const w: { t: StepTurn; now: Record<number, boolean> } = { t: newStepTurn(), now: {} }
    given('一位客人站在台階上，另一位在後面等', () => { frame(w.t, { 1: AT + 0.2, 2: AT - GAP }) })
    when('站在台階上的那一位這一格不在了', () => { frame(w.t, { 2: AT - GAP }); w.now = frame(w.t, { 2: AT - GAP }) })
    then('等的那一位不用再等', () => expect(w.now[2]).toBe(false))
  })
})
