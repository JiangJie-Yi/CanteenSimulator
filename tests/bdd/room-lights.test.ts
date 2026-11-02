import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { comesIn, LIGHTS_DEFAULT, lampGlow, patienceIn, readLights, roomDim, roomMood, keyLightFrom, shadowDepth, shadowSoft, studioLight, switchLights, unlitShade, writeLights } from '@/game/roomLights'

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

  scenario('關燈時吊燈不發光，開燈就亮', ({ given, then, and }) => {
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

  scenario('白天的影子柔和：邊緣是糊的、也不會黑到底', ({ given, then, and }) => {
    given('白天與晚上、開燈與關燈', (w) => { w.d = [shadowDepth(true, false), shadowDepth(false, false), shadowDepth(true, true), shadowDepth(false, true)] })
    then('白天開燈的影子淡淡的，透得出底下的東西', (w) => { expect(w.d[0]).toBeLessThan(0.6) })
    and('白天關燈少了燈光補，影子深一點，但還是不全黑', (w) => { expect(w.d[1]).toBeGreaterThan(w.d[0]); expect(w.d[1]).toBeLessThan(0.8) })
    and('晚上開著燈，影子幾乎被燈補亮；關燈後月光的影子才明顯', (w) => { expect(w.d[2]).toBeLessThan(w.d[0]); expect(w.d[3]).toBeGreaterThan(w.d[2]) })
    and('影子的邊緣糊開幾格，不是一刀切的硬邊；白天糊得更開', () => { expect(shadowSoft(true)).toBeGreaterThan(2); expect(shadowSoft(false)).toBeGreaterThan(shadowSoft(true)) })
  })

  scenario('白天是日正當中：光從正上方照下來，影子落在東西正下方', ({ given, then, and }) => {
    given('圓窗朝外的方向', (w) => { w.window = [0.6, -0.8] as [number, number] })
    then('白天的光從正上方來（90 度），不管窗在哪', (w) => { expect(keyLightFrom('day', w.window)).toEqual([0, 1, 0]); expect(keyLightFrom('day', null)).toEqual([0, 1, 0]) })
    and('晚上的月光從圓窗外的高處斜斜照進來', (w) => {
      const [x, y, z] = keyLightFrom('night', w.window)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect(y).toBeGreaterThan(0.8)
      expect(x * w.window[0] + z * w.window[1]).toBeGreaterThan(0.1)
    })
  })

  scenario('黃昏的夕陽從圓窗外低低地斜照進來，比月光低', ({ given, then, and }) => {
    given('圓窗朝外的方向', (w) => { w.window = [0.6, -0.8] as [number, number] })
    then('從窗的那一側照進來', (w) => {
      const [x, y, z] = keyLightFrom('dusk', w.window)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect(x * w.window[0] + z * w.window[1]).toBeGreaterThan(0.6)
    })
    and('比月光低，但不是貼地的（店裡還照得到）', (w) => {
      const y = keyLightFrom('dusk', w.window)[1]
      expect(y).toBeLessThan(keyLightFrom('night', w.window)[1] - 0.2)
      expect(y).toBeGreaterThan(0.35)
    })
  })

  scenario('清晨的光從圓窗的另一邊斜斜照進來', ({ given, then, and }) => {
    given('圓窗朝外的方向', (w) => { w.window = [0.6, -0.8] as [number, number] })
    then('從窗的對面來', (w) => {
      const [x, y, z] = keyLightFrom('dawn', w.window)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5)
      expect(x * w.window[0] + z * w.window[1]).toBeLessThan(-0.4)
    })
    and('比正午低、比夕陽高一點', (w) => {
      const y = keyLightFrom('dawn', w.window)[1]
      expect(y).toBeLessThan(0.9)
      expect(y).toBeGreaterThan(keyLightFrom('dusk', w.window)[1])
    })
    and('找不到窗時，清晨與黃昏也是從正上方', () => {
      expect(keyLightFrom('dawn', null)).toEqual([0, 1, 0])
      expect(keyLightFrom('dusk', null)).toEqual([0, 1, 0])
    })
  })

  scenario('關了的燈是灰白的紙與玻璃，不再是點亮時的黃', ({ given, then, and }) => {
    given('白天與晚上熄了燈的燈罩', (w) => { w.day = rgbOf(unlitShade(false)); w.night = rgbOf(unlitShade(true)) })
    then('紅綠藍幾乎一樣：灰白，不偏黃', (w) => {
      for (const c of [w.day, w.night]) { expect(Math.max(...c) - Math.min(...c)).toBeLessThan(0.05); expect(c[0] - c[2]).toBeLessThan(0.03) }
    })
    and('白天看得出是白紙，晚上暗下來，但還看得到', (w) => { expect(w.day[0]).toBeGreaterThan(0.7); expect(w.night[0]).toBeLessThan(w.day[0]); expect(w.night[0]).toBeGreaterThan(0.15) })
  })
})

/** a colour's red, green and blue, 0 to 1 */
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
