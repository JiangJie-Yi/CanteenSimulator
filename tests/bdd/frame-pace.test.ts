import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PACE, holdPace, newPace, paceFrame, type Pace } from '@/game/framePace'

/** `seconds` of frames at `fps` (every `hitchEvery` frames one of `hitch` seconds instead); what it did along the way */
function run(p: Pace, seconds: number, fps: number, hitch?: { every: number; s: number }) {
  const acts: string[] = []
  let t = 0
  for (let i = 0; t < seconds; i++) {
    const dt = hitch && i % hitch.every === hitch.every - 1 ? hitch.s : 1 / fps
    t += dt
    const act = paceFrame(p, dt)
    if (act) acts.push(act)
  }
  return acts
}
/** frames at `fps` until `until` holds (or `max` seconds): how long it took */
function runTill(p: Pace, fps: number, max: number, until: (p: Pace) => boolean) {
  let t = 0
  while (t < max && !until(p)) { paceFrame(p, 1 / fps); t += 1 / fps }
  return t
}
/** past the first while after the page opens */
const warmed = () => { const p = newPace(); run(p, PACE.WARMUP_S + 0.5, 60); return p }

feature('畫面變慢時自動降畫質，偶爾的卡頓不算，恢復了就回去', () => {
  scenario('偶爾一格卡頓不會降畫質', ({ given, when, then }) => {
    given('開了一陣子、一直很順', (w) => { w.p = warmed() })
    when('二十秒裡每兩秒卡一下（0.3 秒），中間還有幾格 0.1 秒的', (w) => {
      run(w.p, 10, 60, { every: 120, s: 0.3 })
      run(w.p, 10, 60, { every: 60, s: 0.1 })
    })
    then('畫質不變', (w) => { expect(w.p.level).toBe(0) })
  })

  scenario('剛打開頁面時的慢（模型、著色器還在載入）不算', ({ given, when, then }) => {
    given('頁面剛打開', (w) => { w.p = newPace() })
    when(`前 ${PACE.WARMUP_S - 1} 秒只有每秒 15 格`, (w) => { run(w.p, PACE.WARMUP_S - 1, 15) })
    then('畫質不變', (w) => { expect(w.p.level).toBe(0) })
  })

  scenario('只慢一小段不降；連續兩段都慢才降一階（解析度）', ({ given, when, then, and }) => {
    given('開了一陣子', (w) => { w.p = warmed() })
    when('慢了一段（每秒 25 格），之後又順了', (w) => { run(w.p, PACE.WINDOW_S + 0.1, 25); run(w.p, 10, 60) })
    then('畫質不變', (w) => { expect(w.p.level).toBe(0) })
    when('連續兩段都是每秒 25 格', (w) => { w.acts = run(w.p, PACE.WINDOW_S * 2 + 0.2, 25) })
    then('降一階：一個螢幕像素畫一個點', (w) => { expect(w.p.level).toBe(1) })
    and('只降這一次', (w) => { expect(w.acts).toEqual(['down']) })
  })

  scenario('開店、切倍速、進出開發者模式之後先不判斷', ({ given, when, then }) => {
    given('開了一陣子', (w) => { w.p = warmed() })
    when(`剛開店（先不判斷 ${PACE.HOLD_S} 秒），這段時間每秒只有 20 格`, (w) => { holdPace(w.p); run(w.p, PACE.HOLD_S - 0.2, 20) })
    then('畫質不變', (w) => { expect(w.p.level).toBe(0) })
    when('之後還是一直慢', (w) => { run(w.p, PACE.WINDOW_S * 2 + 0.5, 20) })
    then('才降一階', (w) => { expect(w.p.level).toBe(1) })
  })

  scenario('降了解析度還是慢，就固定每秒 30 格', ({ given, when, then }) => {
    given('已經降了一階', (w) => { w.p = warmed(); run(w.p, PACE.WINDOW_S * 2 + 0.2, 25) })
    when('還是一直每秒 25 格', (w) => { w.acts = run(w.p, PACE.WINDOW_S * 2 + 0.2, 25) })
    then('再降一階：固定每秒 30 格', (w) => { expect(w.p.level).toBe(2); expect(w.acts).toEqual(['down']) })
  })

  scenario('降了解析度之後一直很順，就回到原本的解析度', ({ given, when, then, and }) => {
    given('因為一陣卡頓降了一階', (w) => { w.p = warmed(); run(w.p, PACE.WINDOW_S * 2 + 0.2, 25) })
    when(`之後 ${PACE.WINDOW_S * PACE.FAST_WINDOWS} 秒都是每秒 60 格`, (w) => { w.acts = run(w.p, PACE.WINDOW_S * PACE.FAST_WINDOWS + 0.3, 60) })
    then('回到原本的解析度', (w) => { expect(w.p.level).toBe(0); expect(w.acts).toEqual(['up']) })
    when('又慢下來、又降一階', (w) => { runTill(w.p, 25, 30, (p) => p.level === 1); expect(w.p.level).toBe(1) })
    and(`這次順了 ${PACE.WINDOW_S * PACE.FAST_WINDOWS} 秒`, (w) => { run(w.p, PACE.WINDOW_S * PACE.FAST_WINDOWS + 0.3, 60) })
    then('還不回去：回去一次之後要順兩倍久（不會一下降一下升）', (w) => { expect(w.p.level).toBe(1) })
    and('再順同樣久才回去', (w) => { run(w.p, PACE.WINDOW_S * PACE.FAST_WINDOWS + 0.3, 60); expect(w.p.level).toBe(0) })
  })

  scenario('固定每秒 30 格之後，過一陣子試著放開；夠快就不再固定', ({ given, when, then, and }) => {
    given('已經固定每秒 30 格', (w) => { w.p = warmed(); run(w.p, PACE.WINDOW_S * 4 + 0.5, 25); expect(w.p.level).toBe(2) })
    when('固定時量到的都是 30 格，等到它試著放開', (w) => { w.t = runTill(w.p, 30, 300, (p) => p.level === 1) })
    then(`大約 ${PACE.TRY_S} 秒後試著放開`, (w) => {
      expect(w.p.level).toBe(1)
      expect(w.t).toBeGreaterThan(PACE.TRY_S - PACE.WINDOW_S)
      expect(w.t).toBeLessThan(PACE.TRY_S + PACE.WINDOW_S * 2)
    })
    when('放開的這一段每秒 60 格', (w) => { w.acts = run(w.p, PACE.WINDOW_S + 0.3, 60) })
    then('不再固定', (w) => { expect(w.p.level).toBe(1); expect(w.acts).toEqual([]) })
    and('之後一直順也不會又固定', (w) => { run(w.p, 20, 60); expect(w.p.level).toBeLessThan(2) })
  })

  scenario('試著放開時還是慢，就固定回去，下次等更久再試', ({ given, when, then, and }) => {
    given('已經固定每秒 30 格', (w) => { w.p = warmed(); run(w.p, PACE.WINDOW_S * 4 + 0.5, 25) })
    when('等到試著放開', (w) => { runTill(w.p, 30, 300, (p) => p.level === 1) })
    and('放開的這一段每秒只有 25 格', (w) => { w.acts = run(w.p, PACE.WINDOW_S + 0.3, 25) })
    then('固定回去', (w) => { expect(w.p.level).toBe(2); expect(w.acts).toEqual(['down']) })
    when('再等到下一次試著放開', (w) => { w.t = runTill(w.p, 30, 600, (p) => p.level === 1) })
    then('等了兩倍久：每試失敗一次，下次等兩倍久', (w) => { expect(w.t).toBeGreaterThan(PACE.TRY_S * 2 - PACE.WINDOW_S) })
  })
})
