import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { comesIn, LIGHTS_DEFAULT, lampGlow, patienceIn, readLights, roomDim, roomMood, studioLight, switchLights, writeLights } from '@/game/roomLights'

feature('牆上的電燈開關', () => {
  scenario('一開店燈是開著的', ({ given, then }) => {
    given('什麼都還沒按過', (w) => { w.s = readLights(null) })
    then('燈開著', (w) => { expect(w.s.on).toBe(true); expect(LIGHTS_DEFAULT.on).toBe(true) })
  })

  scenario('按一下開關燈就關，再按一下又開', ({ given, when, then, and }) => {
    given('燈開著', (w) => { w.s = { on: true } })
    when('按一下開關', (w) => { w.s = switchLights(w.s) })
    then('燈關了', (w) => { expect(w.s.on).toBe(false) })
    and('再按一下又開', (w) => { expect(switchLights(w.s).on).toBe(true) })
  })

  scenario('關燈時吊燈與燈串不發光，開燈就亮', ({ given, then, and }) => {
    given('開燈與關燈', () => {})
    then('關燈時不發光', () => { expect(lampGlow(false)).toBe(0) })
    and('開燈時照它本來的亮度', () => { expect(lampGlow(true)).toBe(1) })
  })

  scenario('關燈時店裡變暗，晚上關燈比白天關燈暗得多', ({ given, then, and }) => {
    given('四種情形', (w) => { w.dayOn = roomDim(true, false); w.dayOff = roomDim(false, false); w.nightOn = roomDim(true, true); w.nightOff = roomDim(false, true) })
    then('開燈時照原本的亮度', (w) => { expect(w.dayOn).toBe(1); expect(w.nightOn).toBe(1) })
    and('關燈就變暗', (w) => { expect(w.dayOff).toBeLessThan(1); expect(w.nightOff).toBeLessThan(1) })
    and('白天還有窗外的天光，晚上關燈暗得多', (w) => { expect(w.nightOff).toBeLessThan(w.dayOff) })
  })

  scenario('開關的狀態記在瀏覽器裡，下次打開還是一樣', ({ given, when, then, and }) => {
    given('燈關著', (w) => { w.s = { on: false } })
    when('存起來再讀回來', (w) => { w.back = readLights(writeLights(w.s)) })
    then('還是關著', (w) => { expect(w.back.on).toBe(false) })
    and('存的東西壞掉時就當作開著', () => { expect(readLights('{oops').on).toBe(true); expect(readLights('{"on":"yes"}').on).toBe(true) })
  })

  scenario('晚上關燈，店裡一片黑：客人不進來，在座的抱怨後很快就走', ({ given, then, and }) => {
    given('晚上、燈關著', (w) => { w.m = roomMood(false, true) })
    then('店裡是黑的', (w) => { expect(w.m).toBe('dark') })
    and('沒有新客人進來（看起來像打烊了）', (w) => { expect(comesIn(w.m)).toBe(false) })
    and('在座的客人耐心少很多', (w) => { expect(patienceIn(w.m)).toBeLessThan(0.5) })
  })

  scenario('白天關燈只是暗一點：客人照樣進來，耐心少一點', ({ given, then, and }) => {
    given('白天、燈關著', (w) => { w.m = roomMood(false, false) })
    then('店裡有點暗', (w) => { expect(w.m).toBe('dim') })
    and('客人照樣進來', (w) => { expect(comesIn(w.m)).toBe(true) })
    and('耐心少一點，但沒有晚上那麼少', (w) => { expect(patienceIn(w.m)).toBeLessThan(1); expect(patienceIn(w.m)).toBeGreaterThan(patienceIn('dark')) })
  })

  scenario('開著燈一切照舊', ({ given, then, and }) => {
    given('燈開著，白天或晚上', (w) => { w.day = roomMood(true, false); w.night = roomMood(true, true) })
    then('店裡是亮的', (w) => { expect(w.day).toBe('lit'); expect(w.night).toBe('lit') })
    and('客人進來、耐心照常', (w) => { expect(comesIn(w.day)).toBe(true); expect(patienceIn(w.night)).toBe(1) })
  })

  scenario('金屬反射的亮度跟著店裡的光：晚上關燈幾乎不反光', ({ given, then, and }) => {
    given('四種情形', (w) => { w.k = [studioLight(true, false), studioLight(true, true), studioLight(false, false), studioLight(false, true)] })
    then('白天開燈照原本的反光', (w) => { expect(w.k[0]).toBe(1) })
    and('晚上比白天暗，關燈更暗', (w) => { expect(w.k[1]).toBeLessThan(1); expect(w.k[2]).toBeLessThan(1); expect(w.k[3]).toBeLessThan(w.k[1]); expect(w.k[3]).toBeLessThan(w.k[2]) })
    and('晚上關燈只剩一點點', (w) => { expect(w.k[3]).toBeLessThan(0.2) })
  })
})
