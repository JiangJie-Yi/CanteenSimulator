import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { SAKE_MAKES, SAKE_NOTES, TASTE_BONUS, canTaste, readTasted, sideChance, taste, tastedSakes } from '@/game/sakeTasting'
import { SAKE_BOTTLE_ML, SAKE_SIDE } from '@/game/sakeStand'

feature('酒台的試飲（第 363 項）', () => {
  scenario('只有閉店時老闆能在酒台倒酒試飲；營業中客人的酒由三廚在出餐口倒', ({ then, and }) => {
    then('閉店：可以', () => { expect(canTaste(false)).toBe(true) })
    and('營業中：不行', () => { expect(canTaste(true)).toBe(false) })
  })

  scenario('每支酒第一次喝才算試飲，記下風味；同一支再喝不重複', ({ given, when, then, and }) => {
    let list: number[] = []
    given('還沒試飲過任何一支', () => { list = [] })
    when('喝了第 2 支（鶴汀 純米大吟釀）', () => { const r = taste(list, 2); expect(r.first).toBe(true); list = r.list })
    then('記下了', () => { expect(list).toEqual([2]) })
    and('再喝一次同一支：不是第一次，清單不變', () => { const r = taste(list, 2); expect(r.first).toBe(false); expect(r.list).toEqual([2]) })
    and('不是酒台上的瓶子：不算', () => { expect(taste(list, 99).first).toBe(false); expect(taste(list, -1).first).toBe(false) })
  })

  scenario('試飲過的酒外場會推薦：每支清酒讓加點清酒的客人多 1%，燒酒不算', ({ then, and }) => {
    then('一支都沒試：照原本的 12%', () => { expect(sideChance(SAKE_SIDE, [])).toBeCloseTo(SAKE_SIDE, 9) })
    and('試了三支清酒：多 3%', () => { expect(sideChance(SAKE_SIDE, [0, 5, 9])).toBeCloseTo(SAKE_SIDE + 3 * TASTE_BONUS, 9) })
    and('燒酒（最後一支）不算進去', () => { expect(tastedSakes([SAKE_MAKES])).toBe(0) })
    and('十二支全試過：24%', () => { expect(sideChance(SAKE_SIDE, Array.from({ length: SAKE_MAKES }, (_, k) => k))).toBeCloseTo(0.24, 9) })
  })

  scenario('每一支都有自己的風味與搭配（中日英），跟酒台的瓶數對得上', ({ then, and }) => {
    then('清酒的筆記跟酒台上的清酒一樣多，再加燒酒一支', () => { expect(SAKE_NOTES.length).toBe(SAKE_BOTTLE_ML.length + 1); expect(SAKE_MAKES).toBe(SAKE_BOTTLE_ML.length) })
    and('每一支的名字、等級、風味、搭配三種語言都有寫', () => {
      for (const n of SAKE_NOTES) for (const f of [n.name, n.grade, n.taste, n.with]) for (const s of f) expect(s.length).toBeGreaterThan(0)
    })
  })

  scenario('存檔讀回來：只留酒台上有的瓶子，各一次；壞掉的存檔當作沒試過', ({ then, and }) => {
    then('正常的', () => { expect(readTasted('[0,3,3,12]')).toEqual([0, 3, 12]) })
    and('有不認得的', () => { expect(readTasted('[1,"x",40,-2,2.5]')).toEqual([1]) })
    and('沒有或壞掉', () => { expect(readTasted(null)).toEqual([]); expect(readTasted('{oops')).toEqual([]) })
  })
})
