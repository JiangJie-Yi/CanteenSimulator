import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { basinStep, draining, emptyBasin, DRAIN_S, FILL_S, FILM, type Basin } from '@/game/basin'

/** the level after `secs` of the tap `running`, stepped a frame at a time */
const after = (b: Basin, running: boolean, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) b.level = basinStep(b, running, 1 / 60)
  return b.level
}

feature('洗手盆蓄水與排水', () => {
  scenario('塞住排水口、開著水，三秒半蓄滿，之後不再升高（溢水孔把多的帶走）', ({ given, when, then, and }) => {
    const w = { b: emptyBasin() }
    given('空的洗手盆，塞子壓下去塞住', () => { w.b.plugged = true; expect(w.b.level).toBe(0) })
    when('開水一秒半', () => { after(w.b, true, 1.5) })
    then('水位不到一半', () => { expect(w.b.level).toBeGreaterThan(0.3); expect(w.b.level).toBeLessThan(0.5) })
    and(`再開到 ${FILL_S} 秒就滿了`, () => { after(w.b, true, FILL_S - 1.5 + 0.05); expect(w.b.level).toBe(1) })
    and('一直開著也不會超過滿水位', () => { after(w.b, true, 5); expect(w.b.level).toBe(1) })
  })

  scenario('關了水、塞子塞著，水就一直留在盆裡', ({ given, when, then }) => {
    const w = { b: { level: 0.7, plugged: true } as Basin }
    given('盆裡有七分滿的水，塞子塞著', () => { expect(w.b.level).toBe(0.7) })
    when('水龍頭關著過了十秒', () => { after(w.b, false, 10) })
    then('水位不變', () => { expect(w.b.level).toBe(0.7) })
  })

  scenario('拔起塞子，滿盆的水放完，放的時候排水口有漩渦', ({ given, when, then, and }) => {
    const w = { b: { level: 1, plugged: true } as Basin }
    given('滿盆的水', () => { expect(w.b.level).toBe(1) })
    when('拔起塞子', () => { w.b.plugged = false })
    then('正在排水', () => { expect(draining(w.b, false)).toBe(true) })
    and(`${DRAIN_S} 秒內放完`, () => { after(w.b, false, DRAIN_S + 0.05); expect(w.b.level).toBe(0) })
    and('放完就不再排水', () => { expect(draining(w.b, false)).toBe(false) })
  })

  scenario('開著水、塞子拔起來，盆底只留一層薄水，水直接流進排水口', ({ given, when, then, and }) => {
    const w = { b: emptyBasin() }
    given('空的洗手盆，塞子拔起來', () => { expect(w.b.plugged).toBe(false) })
    when('開水五秒', () => { after(w.b, true, 5) })
    then('盆底一層薄水，不會積高', () => { expect(w.b.level).toBe(FILM) })
    and('不算在排水（沒有漩渦）', () => { expect(draining(w.b, true)).toBe(false) })
    and('關水後薄水也流光', () => { after(w.b, false, 1); expect(w.b.level).toBe(0) })
  })

  scenario('滿盆的水開著水拔塞子，也會放到只剩薄水', ({ given, when, then }) => {
    const w = { b: { level: 1, plugged: false } as Basin }
    given('滿盆的水、塞子剛拔起、水還開著', () => { expect(w.b.level).toBe(1) })
    when('過了三秒', () => { after(w.b, true, 3) })
    then('只剩薄水', () => { expect(w.b.level).toBe(FILM) })
  })
})
