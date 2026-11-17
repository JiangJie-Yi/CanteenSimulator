import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { kitchenPath, outOfPieces, type Rect } from '@/game/kitchenPath'

// (item 333, the owner's, 2026-11-18: 「外場路線有問題，可否設置碰撞點?」)
const MARGIN = 0.13
const piece = { x0: 1, z0: 1, x1: 2, z1: 2 }
const grown: Rect = { x0: piece.x0 - MARGIN, z0: piece.z0 - MARGIN, x1: piece.x1 + MARGIN, z1: piece.z1 + MARGIN }
const room: Rect = { x0: -1, z0: -1, x1: 4, z1: 4 }
const inPiece = (p: [number, number]) => p[0] > piece.x0 && p[0] < piece.x1 && p[1] > piece.z0 && p[1] < piece.z1

feature('廚房裡的路不穿過擺設（第 333 項）', () => {
  scenario('要去的地方設在擺設裡面時，停在擺設邊上', ({ given, when, then, and }) => {
    given('一件擺設，要去的地方在它裡面、靠近它的一邊', (w) => { w.to = [1.5, 1.9] })
    when('把要去的地方移出擺設', (w) => { w.at = outOfPieces(w.to, [grown], MARGIN) })
    then('站到最近的那一邊外面', (w) => { expect(w.at[0]).toBeCloseTo(1.5, 6); expect(w.at[1]).toBeGreaterThan(piece.z1) })
    and('走過去的每一段都不經過擺設本身', (w) => {
      const way = kitchenPath([0, 0], w.at, room, [grown])!
      for (let i = 1; i < way.length; i++) for (let t = 0; t <= 1; t += 0.02) {
        const p: [number, number] = [way[i - 1][0] + (way[i][0] - way[i - 1][0]) * t, way[i - 1][1] + (way[i][1] - way[i - 1][1]) * t]
        expect(inPiece(p)).toBe(false)
      }
    })
  })
  scenario('站在擺設旁邊留給人走的空間裡的不動', ({ given, then }) => {
    given('要去的地方在擺設外、留給人走的空間裡', (w) => { w.to = [1.5, 2.05] })
    then('位置不變', (w) => { expect(outOfPieces(w.to, [grown], MARGIN)).toBe(w.to) })
  })
})
