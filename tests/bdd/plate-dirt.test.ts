import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CLEAN_AT, HAND_EACH, handTime, plateDirt, SOAK_S, soakStep, TAP_FASTER } from '@/game/plates'

feature('餐盤的髒污', () => {
  scenario('吃完的餐盤是髒的，吃得越多越髒', ({ given, when, then, and }) => {
    given('一個客人吃了一份、另一個吃了四份', (w) => { w.one = plateDirt(1); w.four = plateDirt(4) })
    then('兩個盤子都髒', (w) => { expect(w.one).toBeGreaterThan(CLEAN_AT); expect(w.four).toBeGreaterThan(CLEAN_AT) })
    and('吃四份的比較髒，但不會超過 1', (w) => { expect(w.four).toBeGreaterThan(w.one); expect(plateDirt(30)).toBeLessThanOrEqual(1) })
    and('沒吃東西的盤子是乾淨的', () => { expect(plateDirt(0)).toBe(0) })
  })
  scenario('泡在水槽的水裡，盤子會慢慢變乾淨', ({ given, when, then, and }) => {
    given('一個最髒的盤子', (w) => { w.dirt = 1 })
    when('泡在水裡，每 0.2 秒看一次，看一半的時間', (w) => { for (let k = 0; k < SOAK_S / 2 / 0.2; k++) w.dirt = soakStep(w.dirt, 0.2, true) })
    then('髒污少了一半左右', (w) => { expect(w.dirt).toBeCloseTo(0.5, 2) })
    and('再泡夠久就乾淨了，不會變成負的', (w) => { for (let k = 0; k < SOAK_S / 0.2; k++) w.dirt = soakStep(w.dirt, 0.2, true); expect(w.dirt).toBe(0) })
  })
  scenario('水龍頭開著沖，乾淨得更快；沒有水就不會自己變乾淨', ({ when, then, and }) => {
    when('同樣泡 10 秒，一個在水龍頭下、一個只泡著、一個在沒水的水槽裡', (w) => { w.tap = soakStep(1, 10, true, true); w.soak = soakStep(1, 10, true); w.dry = soakStep(1, 10, false) })
    then('水龍頭下的去掉的髒污是只泡著的 TAP_FASTER 倍', (w) => { expect(1 - w.tap).toBeCloseTo((1 - w.soak) * TAP_FASTER, 6) })
    and('沒有水的一點都沒變', (w) => { expect(w.dry).toBe(1) })
  })
  scenario('手洗泡過的盤子比較快', ({ when, then, and }) => {
    when('手洗一個最髒的、和一個泡到幾乎乾淨的', (w) => { w.dirty = handTime(1); w.soaked = handTime(0.02) })
    then('最髒的要整整 HAND_EACH 秒', (w) => { expect(w.dirty).toBeCloseTo(HAND_EACH, 6) })
    and('泡過的不到一半的時間', (w) => { expect(w.soaked).toBeLessThan(HAND_EACH / 2) })
  })
})
