import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { DRY_STORE, parOf, unitsShown } from '@/game/pantry'
import { NORI, NORI_PAR, SEASON_PAR, SEASON_START, startingSupplies } from '@/game/supplies'
import { storageOf } from '@/data/storage'

feature('櫃子裡看到的東西跟庫存一致（調料、海苔、冷藏的食材）', () => {
  scenario('新開的店：調料是滿的，櫃子裡每樣的包裝都擺滿', ({ given, then, and }) => {
    const w = { stock: startingSupplies() }
    given('新店的庫存', () => { expect(w.stock['season:salt']).toBe(SEASON_START) })
    then('鹽的三包都在', () => { expect(unitsShown(w.stock['season:salt'], 3, parOf('season:salt'))).toBe(3) })
    and('海苔的三包也都在', () => { expect(unitsShown(w.stock[NORI], 3, parOf(NORI))).toBe(3) })
  })

  scenario('用掉一些：拆開的那包還在，最後一點也看得到，用完才空', ({ then, and, but }) => {
    then('還剩 21 份：兩包整的加一包拆開的，三包', () => { expect(unitsShown(21, 3, SEASON_PAR)).toBe(3) })
    and('剩 20 份：兩包', () => { expect(unitsShown(20, 3, SEASON_PAR)).toBe(2) })
    and('剩 1 份：還有一包', () => { expect(unitsShown(1, 3, SEASON_PAR)).toBe(1) })
    but('0 份：一包都沒有', () => { expect(unitsShown(0, 3, SEASON_PAR)).toBe(0) })
  })

  scenario('買得比平常多：櫃子放不下的不擺出來，最多擺滿', ({ then }) => {
    then('90 份也只擺三包', () => { expect(unitsShown(90, 3, SEASON_PAR)).toBe(3) })
  })

  scenario('沒有開店在跑（不知道庫存）：照擺滿的樣子', ({ then }) => {
    then('不知道就全擺', () => { expect(unitsShown(-1, 4, 20)).toBe(4) })
  })

  scenario('料理台的乾貨櫃只放常溫保存的：米、鹽、七味、花生粉、海苔', ({ then, and }) => {
    then('每一樣都是常溫或乾貨', () => {
      for (const d of DRY_STORE) expect(d.id === NORI || storageOf(d.id) === 'ambient').toBe(true)
    })
    and('海苔的平常庫存是它自己的', () => { expect(parOf(NORI)).toBe(NORI_PAR) })
  })
})
