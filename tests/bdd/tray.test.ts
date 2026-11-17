import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { besideFire, plateGoes, TONG_S, TONG_TAKE_S, tongTimes, TRAY_PLACES, trayPlace } from '@/game/tray'
import { pickUpDirty, putBackClean, skewerTotal, SKEWER_POOL, startSkewers, takeSkewer, usedSkewer } from '@/game/skewers'

feature('營業時的方形鐵盤與夾子（出餐）', () => {
  scenario('開店時試吃碗收起來、換上方形鐵盤；閉店時鐵盤收起、試吃碗放回', ({ then, and }) => {
    then('營業中老闆旁邊是鐵盤', () => { expect(besideFire(true)).toBe('tray') })
    and('沒營業時是試吃碗', () => { expect(besideFire(false)).toBe('bowl') })
  })

  scenario('烤好的串放上鐵盤，鐵串在鐵盤上抽出來，收去洗、再用', ({ given, when, then, and }) => {
    const w: { s: ReturnType<typeof startSkewers>; inUse: number } = { s: startSkewers(), inUse: 0 }
    given('一支乾淨的鐵串穿上料理、放上火', () => { w.s = takeSkewer(w.s)!; w.inUse = 1 })
    when('烤好放上鐵盤、抽出鐵串', () => { w.s = usedSkewer(w.s); w.inUse = 0 })
    then('它進了用過的鐵串盤', () => { expect(w.s.dirty).toBe(1) })
    and('鐵串總數不變，沒有多出或不見', () => { expect(skewerTotal(w.s, w.inUse)).toBe(SKEWER_POOL) })
    and('拿去洗好放回架上，又是乾淨的', () => { w.s = putBackClean(pickUpDirty(w.s)); expect(w.s.clean).toBe(SKEWER_POOL); expect(w.s.dirty).toBe(0) })
  })

  scenario('鐵盤一排四個位置，每件一個位置、不疊在一起', ({ then, and }) => {
    then(`有 ${TRAY_PLACES} 個位置`, () => { expect(TRAY_PLACES).toBe(4) })
    and('空的鐵盤從第一格放起', () => { expect(trayPlace([])).toEqual({ place: 0, eat: null }) })
    and('有人佔著的格子跳過', () => { expect(trayPlace([0, 1, 3]).place).toBe(2) })
  })

  scenario('鐵盤放滿時，下一串留在火邊等；夾走一件就空出位置', ({ given, then, when }) => {
    const w = { taken: [0, 1, 2, 3] }
    given('四格都是客人的料理', () => { expect(w.taken.length).toBe(TRAY_PLACES) })
    then('沒有保溫的可以讓：留在火邊等', () => { expect(trayPlace(w.taken).place).toBe(-1) })
    when('外場夾走第二格那件', () => { w.taken = [0, 2, 3] })
    then('剛烤好的放進第二格', () => { expect(trayPlace(w.taken).place).toBe(1) })
  })

  scenario('鐵盤滿了，其中有保溫的：最舊的保溫那份給員工吃，讓位置給客人的', ({ then, and }) => {
    const r = trayPlace([0, 1, 2, 3], 2)
    then('放進那份保溫原本的格子', () => { expect(r.place).toBe(2) })
    and('那份保溫的被吃掉', () => { expect(r.eat).toBe(2) })
  })

  scenario('外場用夾子把料理一件一件夾進盤子，全部夾完才端走', ({ then, and, but }) => {
    then('先拿起夾子，再一件接一件', () => {
      expect(tongTimes(3)).toEqual([TONG_TAKE_S, TONG_TAKE_S + TONG_S, TONG_TAKE_S + 2 * TONG_S])
    })
    and('每件之間隔一樣久，看得出是一件一件夾', () => { const t = tongTimes(4); for (let k = 1; k < t.length; k++) expect(t[k] - t[k - 1]).toBeCloseTo(TONG_S) })
    but('鐵盤上還有這盤的料理，就不端', () => { expect(plateGoes(1, 0)).toBe(false) })
    and('還有一件正夾在半空，也不端', () => { expect(plateGoes(0, 1)).toBe(false) })
    and('都在盤子上了才端走', () => { expect(plateGoes(0, 0)).toBe(true) })
  })
})
