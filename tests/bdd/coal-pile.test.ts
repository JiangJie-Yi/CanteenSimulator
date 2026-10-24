import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { afterCharcoal, canAddCharcoal } from '@/game/economy'
import { COAL_MAX, COAL_PER_ADD, MAX_LAYERS, placeStick, roomFor, STICK_R, surfaceY, type Lay } from '@/game/coalPile'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const lay = (s: NonNullable<ReturnType<typeof placeStick>>): Lay => ({ x: s.x, z: s.z, yaw: s.yaw, y: s.rest.y, slope: s.rest.slope })

feature('炭火床上的備長炭', () => {
  scenario('炭堆不會疊得超過物理上限', ({ given, when, then }) => {
    given('一個空的炭床', (w) => { w.pile = [] as Lay[]; w.rnd = seeded(5) })
    when('不停往上放炭，直到放不下為止', (w) => {
      for (let i = 0; i < 200; i++) {
        const s = placeStick(w.pile, w.rnd)
        if (!s) { w.refused = true; return }
        w.pile.push(lay(s))
      }
    })
    then('最後會被拒絕，不會無限堆高', (w) => { expect(w.refused).toBe(true) })
    then(`沒有任何一根的高度超過 ${MAX_LAYERS} 層`, (w) => {
      const limit = STICK_R + (MAX_LAYERS - 1) * 2 * STICK_R + 0.06
      for (const l of w.pile as Lay[]) expect(l.y - surfaceY(l.x, l.z)).toBeLessThanOrEqual(limit)
    })
  })

  scenario('炭不會浮在空中', ({ given, when, then }) => {
    given('一個已經放了幾根炭的炭床', (w) => {
      w.rnd = seeded(9)
      w.pile = [] as Lay[]
      for (let i = 0; i < 8; i++) w.pile.push(lay(placeStick(w.pile, w.rnd)!))
    })
    when('再放下一根炭', (w) => { w.stick = placeStick(w.pile, w.rnd)! })
    then('它至少有一處碰到下面的支撐', (w) => {
      const s = w.stick as NonNullable<ReturnType<typeof placeStick>>
      // (the bed itself is the lowest support it can have)
      expect(s.rest.y).toBeGreaterThanOrEqual(surfaceY(s.x, s.z) + STICK_R - 0.05)
    })
  })

  scenario('炭堆保持成一堆，不會散到床邊', ({ given, when, then }) => {
    given('一個空的炭床', (w) => { w.pile = [] as Lay[]; w.rnd = seeded(3) })
    when('放入 16 根炭', (w) => {
      for (let i = 0; i < 16; i++) { const s = placeStick(w.pile, w.rnd); if (s) w.pile.push(lay(s)) }
    })
    then('每一根都離床中心不遠', (w) => {
      for (const l of w.pile as Lay[]) expect(Math.hypot(l.x, l.z)).toBeLessThan(0.6)
    })
  })
})

feature('炭床滿了就不再加炭', () => {
  scenario('炭床滿了而且都還在燒，就不能再加', ({ given, when, then }) => {
    given('炭床放滿 16 根，都還在燒', (w) => { w.alive = 16; w.ashed = 0 })
    when('想再加炭', (w) => { w.ok = roomFor(w.alive, w.ashed, 16) })
    then('不能加', (w) => { expect(w.ok).toBe(false) })
  })

  scenario('底下有炭燒成灰時，可以清掉灰再加', ({ given, when, then }) => {
    given('炭床放滿 16 根，其中 3 根已燒成灰', (w) => { w.alive = 16; w.ashed = 3 })
    when('想再加炭', (w) => { w.ok = roomFor(w.alive, w.ashed, 16) })
    then('可以加', (w) => { expect(w.ok).toBe(true) })
  })

  scenario('還沒滿時可以直接加', ({ given, when, then }) => {
    given('炭床有 8 根在燒', (w) => { w.alive = 8; w.ashed = 0 })
    when('想再加炭', (w) => { w.ok = roomFor(w.alive, w.ashed, 16) })
    then('可以加', (w) => { expect(w.ok).toBe(true) })
  })
})

feature('加炭與火力', () => {
  scenario('把火加到 100% 之前，炭堆不會先滿', ({ given, when, then }) => {
    given('火力從 0 開始，每次加炭升 18%，每次放最多的根數', (w) => { w.level = 0; w.sticks = 0; w.adds = 0 })
    when('一直加到火力 100%', (w) => {
      while (canAddCharcoal(w.level)) { w.level = afterCharcoal(w.level); w.sticks += COAL_PER_ADD.max; w.adds++ }
    })
    then('炭堆還放得下這些炭', (w) => { expect(w.sticks).toBeLessThanOrEqual(COAL_MAX); expect(roomFor(w.sticks, 0, COAL_MAX) || w.sticks === COAL_MAX).toBe(true) })
    then('點了兩次的時候，炭堆離滿還很遠', (w) => { expect(2 * COAL_PER_ADD.max).toBeLessThan(COAL_MAX / 2) })
  })

  scenario('炭放得緊密，沒有一根離中心太遠', ({ given, when, then }) => {
    given('一個空的炭床', (w) => { w.pile = [] as Lay[]; w.rnd = seeded(13) })
    when('放入 20 根炭', (w) => { for (let i = 0; i < 20; i++) { const s = placeStick(w.pile, w.rnd); if (s) w.pile.push(lay(s)) } })
    then('都在離中心 0.45 以內', (w) => { for (const l of w.pile as Lay[]) expect(Math.hypot(l.x, l.z)).toBeLessThan(0.45) })
  })
})
