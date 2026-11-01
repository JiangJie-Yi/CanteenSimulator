import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { RACK_FULL, WASH_AT, putBack, takePlate, washNow } from '@/game/plates'
import { kitchenPath, type Rect } from '@/game/kitchenPath'

feature('碗盤統一放在碗盤櫃：上菜從碗盤櫃拿，吃完在流理台洗好放回去', () => {
  scenario('上菜前從碗盤櫃拿一個盤子', ({ given, when, then, and }) => {
    given('碗盤櫃是滿的', (w) => { w.rack = RACK_FULL })
    when('拿一個盤子', (w) => { w.r = takePlate(w.rack) })
    then('拿到了', (w) => { expect(w.r.got).toBe(true) })
    and('碗盤櫃少一個', (w) => { expect(w.r.rack).toBe(RACK_FULL - 1) })
  })

  scenario('碗盤櫃空了就拿不到，客人要等盤子洗好', ({ when, then }) => {
    when('碗盤櫃是空的時候拿盤子', (w) => { w.r = takePlate(0) })
    then('拿不到，碗盤櫃還是 0 個', (w) => { expect(w.r.got).toBe(false); expect(w.r.rack).toBe(0) })
  })

  scenario('髒盤子在流理台累積到一批才洗', ({ then, but }) => {
    then(`流理台有 ${WASH_AT} 個髒盤子就開始洗`, () => { expect(washNow(WASH_AT, 30, false)).toBe(true) })
    but('只有 2 個、碗盤櫃還有盤子時先不洗', () => { expect(washNow(2, 30, false)).toBe(false) })
  })

  scenario('碗盤櫃空了，流理台有髒盤子就馬上洗', ({ then, and }) => {
    then('碗盤櫃 0 個、流理台 1 個髒盤子：開始洗', () => { expect(washNow(1, 0, false)).toBe(true) })
    and('正在洗的時候不重複開始', () => { expect(washNow(WASH_AT + 3, 0, true)).toBe(false) })
  })

  scenario('洗好的盤子放回碗盤櫃，最多放到滿', ({ then, and }) => {
    then('碗盤櫃 40 個，洗好 6 個：變 46 個', () => { expect(putBack(40, 6)).toBe(46) })
    and(`碗盤櫃 48 個，洗好 6 個：最多 ${RACK_FULL} 個`, () => { expect(putBack(48, 6)).toBe(RACK_FULL) })
  })
})

feature('服務生在廚房裡走去碗盤櫃，繞開擺設', () => {
  const room: Rect = { x0: 0, z0: 0, x1: 6, z1: 4 }
  const crosses = (path: [number, number][], r: Rect) => path.some(([x, z], i) => {
    if (i === 0) return false
    const [px, pz] = path[i - 1]
    for (let k = 0; k <= 20; k++) {
      const t = k / 20, qx = px + (x - px) * t, qz = pz + (z - pz) * t
      if (qx > r.x0 && qx < r.x1 && qz > r.z0 && qz < r.z1) return true
    }
    return false
  })

  scenario('中間沒有東西擋著就直直走過去', ({ when, then }) => {
    when('從左邊走到右邊', (w) => { w.p = kitchenPath([0.5, 2], [5.5, 2], room, []) })
    then('只有起點和終點', (w) => { expect(w.p).toEqual([[0.5, 2], [5.5, 2]]) })
  })

  scenario('灶台擋在中間就繞過去，不穿過灶台', ({ given, when, then, and }) => {
    given('房間中間有一張灶台', (w) => { w.table = { x0: 2, z0: 0.6, x1: 4, z1: 3.4 } })
    when('從灶台一邊走到另一邊', (w) => { w.p = kitchenPath([0.5, 2], [5.5, 2], room, [w.table]) })
    then('找得到路', (w) => { expect(w.p).not.toBeNull() })
    and('每一段都不穿過灶台', (w) => { expect(crosses(w.p, w.table)).toBe(false) })
    and('起點和終點不變', (w) => { expect(w.p[0]).toEqual([0.5, 2]); expect(w.p[w.p.length - 1]).toEqual([5.5, 2]) })
  })

  scenario('起點就在擺設旁留給人走的範圍裡：先走出來，再繞過去', ({ given, when, then, and }) => {
    given('灶台（含旁邊留的走道寬度）', (w) => { w.table = { x0: 2, z0: 0.6, x1: 4, z1: 3.4 } })
    when('從灶台左緣裡面一點的地方出發，走到另一邊', (w) => { w.p = kitchenPath([2.05, 2], [5.5, 2], room, [w.table]) })
    then('找得到路，起點不變', (w) => { expect(w.p).not.toBeNull(); expect(w.p[0]).toEqual([2.05, 2]) })
    and('第一步往最近的邊走出去（往左）', (w) => { expect(w.p[1][0]).toBeLessThan(2) })
    and('走出來之後，每一段都不穿過灶台', (w) => { expect(crosses(w.p.slice(1), w.table)).toBe(false) })
  })

  scenario('完全被擋住時沒有路', ({ when, then }) => {
    when('一道牆從房間這頭擋到那頭', (w) => { w.p = kitchenPath([0.5, 2], [5.5, 2], room, [{ x0: 2.8, z0: -1, x1: 3.2, z1: 5 }]) })
    then('沒有路', (w) => { expect(w.p).toBeNull() })
  })
})
