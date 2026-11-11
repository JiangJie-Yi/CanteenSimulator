import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { EMPTY_S, FILL_S, basinSays, waterTick } from '@/game/sinkWater'

feature('流理台的塞子：塞上能蓄水，拔開就排掉，水不會溢出來', () => {
  scenario('塞著塞子開水，水位慢慢升高', ({ given, when, then }) => {
    let lv = 0
    given('水槽是空的，塞子塞著', () => { lv = 0 })
    when(`開水 ${FILL_S / 2} 秒`, () => { lv = waterTick(lv, true, true, FILL_S / 2) })
    then('水到一半', () => { expect(lv).toBeCloseTo(0.5, 5) })
  })
  scenario('水滿到溢水口就不再升高', ({ when, then }) => {
    let lv = 0
    when(`塞著塞子一直開水 ${FILL_S * 3} 秒`, () => { for (let i = 0; i < FILL_S * 3; i++) lv = waterTick(lv, true, true, 1) })
    then('水位停在溢水口（1），不會溢出', () => { expect(lv).toBe(1) })
  })
  scenario('拔開塞子，水會排掉；開著水也積不起來', ({ given, when, then, and }) => {
    let lv = 1
    given('水槽是滿的', () => { lv = 1 })
    when(`拔開塞子 ${EMPTY_S} 秒`, () => { for (let i = 0; i < EMPTY_S; i++) lv = waterTick(lv, false, false, 1) })
    then('水排光了', () => { expect(lv).toBeCloseTo(0, 9) })
    and('塞子拔開時開水，水直接流掉，不會積', () => { expect(waterTick(0, true, false, 5)).toBe(0) })
  })
  scenario('關著水、塞著塞子，水位不變', ({ then }) => {
    then('水留在槽裡', () => { expect(waterTick(0.4, false, true, 30)).toBeCloseTo(0.4, 5) })
  })
  scenario('指著水槽，說水位和塞子', ({ then }) => {
    then('空的、塞子拔開', () => { expect(basinSays(0, false)).toBe('沒有水｜塞子拔開') })
    then('一半、塞著', () => { expect(basinSays(0.5, true)).toBe('水 50%｜塞子塞著') })
    then('滿了', () => { expect(basinSays(1, true)).toBe('水滿到溢水口｜塞子塞著') })
  })
})
