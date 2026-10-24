import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { stepScale, SCALE_STEP } from '@/shops/grill/edit'

feature('編輯模式的 + / − 縮放', () => {
  scenario('選了一個軸，+ 只放大那一軸', ({ given, when, then }) => {
    given('一個大小 1、1、1 的擺設，選了 X 軸', (w) => { w.size = [1, 1, 1]; w.axis = 0 })
    when('按一次 +', (w) => { w.next = stepScale(w.size, 1, w.axis) })
    then('只有 X 變大一格，Y、Z 不變', (w) => { expect(w.next).toEqual([Math.round(SCALE_STEP * 100) / 100, 1, 1]) })
  })

  scenario('沒選軸時，+ 與 − 三軸一起縮放', ({ given, when, then }) => {
    given('一個大小 2、1、0.5 的擺設，沒有選軸', (w) => { w.size = [2, 1, 0.5]; w.axis = null })
    when('按 + 再按 −', (w) => { w.up = stepScale(w.size, 1, w.axis); w.back = stepScale(w.up, -1, w.axis) })
    then('三軸都變大', (w) => { for (let k = 0; k < 3; k++) expect(w.up[k]).toBeGreaterThan(w.size[k]) })
    then('再縮小後回到接近原來的大小', (w) => { for (let k = 0; k < 3; k++) expect(Math.abs(w.back[k] - w.size[k])).toBeLessThan(0.02) })
  })

  scenario('縮放有上下限，不會縮到看不見或大到爆', ({ given, when, then }) => {
    given('一個已經最小的擺設和一個已經最大的擺設', (w) => { w.tiny = [0.05, 0.05, 0.05]; w.huge = [20, 20, 20] })
    when('一個再按 −，一個再按 +', (w) => { w.a = stepScale(w.tiny, -1, null); w.b = stepScale(w.huge, 1, null) })
    then('各自停在 0.05 和 20', (w) => { expect(w.a).toEqual([0.05, 0.05, 0.05]); expect(w.b).toEqual([20, 20, 20]) })
  })
})
