import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CARTON_H, CLEAN_H, cornerStack } from '@/game/cornerStock'
import { TISSUE_PACK } from '@/game/tissues'

// (item 199, the owner's, 2026-11-16: 「庫存的東西沒對上」: the corner's stack of spares was always full, whatever was in stock)
feature('牆角的備品跟著庫存（第 199 項）', () => {
  scenario('衛生紙一箱 5 盒：0 盒沒有箱子、5 盒以下一箱、更多兩箱', ({ then, and }) => {
    then('0 盒：兩箱都不在', () => { expect(cornerStack({ tissue: 0, clean: 1, rolls: 1 }).tissue).toEqual([false, false]) })
    and(`${TISSUE_PACK.boxes} 盒：下面那箱`, () => { expect(cornerStack({ tissue: TISSUE_PACK.boxes, clean: 1, rolls: 1 }).tissue).toEqual([true, false]) })
    and(`${TISSUE_PACK.boxes + 1} 盒：兩箱`, () => { expect(cornerStack({ tissue: TISSUE_PACK.boxes + 1, clean: 1, rolls: 1 }).tissue).toEqual([true, true]) })
  })
  scenario('上面的東西落到下面剩下的東西上，不浮空', ({ then, and }) => {
    then('只剩一箱衛生紙：清潔用品箱落下一箱的高度', () => { expect(cornerStack({ tissue: 3, clean: 1, rolls: 12 }).dropClean).toBeCloseTo(CARTON_H[1]) })
    and('衛生紙都沒了、清潔用品也沒了：捲筒衛生紙落到地上', () => {
      expect(cornerStack({ tissue: 0, clean: 0, rolls: 12 }).dropRolls).toBeCloseTo(CARTON_H[0] + CARTON_H[1] + CLEAN_H)
    })
    and('都有：都不動', () => { const s = cornerStack({ tissue: 10, clean: 2, rolls: 12 }); expect(s.dropClean).toBe(0); expect(s.dropRolls).toBe(0) })
  })
  scenario('捲筒衛生紙一層 6 捲，用掉上面那層再用下面那層', ({ then, and }) => {
    then('7 捲以上：兩層', () => { expect(cornerStack({ tissue: 1, clean: 1, rolls: 7 }).rolls).toEqual([true, true]) })
    and('6 捲：只剩下面那層', () => { expect(cornerStack({ tissue: 1, clean: 1, rolls: 6 }).rolls).toEqual([true, false]) })
    and('0 捲：沒有', () => { expect(cornerStack({ tissue: 1, clean: 1, rolls: 0 }).rolls).toEqual([false, false]) })
  })
  scenario('清潔用品沒有備品就沒有那箱', ({ then }) => {
    then('洗碗精與廁所清潔劑都 0：箱子不在', () => { expect(cornerStack({ tissue: 1, clean: 0, rolls: 1 }).clean).toBe(false) })
  })
})
