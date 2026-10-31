import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { afterCharcoal, canAddCharcoal } from '@/game/economy'
import { CHUNK_R, COAL_MAX, COAL_PER_ADD, crumble, MAX_LAYERS, placeStick, roomFor, standStick, STICK_HALF, STICK_R, surfaceY, throwForce, type Lay } from '@/game/coalPile'

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

feature('一次加炭要夠多、夠密，火才燒得起來', () => {
  scenario('第一次加炭就放上好幾根', ({ then }) => {
    then('一次至少放 6 根', () => { expect(COAL_PER_ADD.min).toBeGreaterThanOrEqual(6) })
  })
  scenario('第一次加的炭聚在一起，彼此靠著', ({ given, when, then }) => {
    given('一個空的炭床', (w) => { w.pile = [] as Lay[]; w.rnd = seeded(21) })
    when('放入一次的量', (w) => { for (let i = 0; i < COAL_PER_ADD.min; i++) { const s = placeStick(w.pile, w.rnd); if (s) w.pile.push(lay(s)) } })
    then('全都放上去了', (w) => { expect((w.pile as Lay[]).length).toBe(COAL_PER_ADD.min) })
    then('每一根的中心都在離床中心 0.3 以內', (w) => { for (const l of w.pile as Lay[]) expect(Math.hypot(l.x, l.z)).toBeLessThan(0.3) })
  })
})

feature('燒到最後的炭會垮掉碎裂', () => {
  scenario('燒透的炭斷成幾塊', ({ given, when, then }) => {
    given('一根橫跨在別根炭上的炭', (w) => {
      w.rnd = seeded(7)
      w.below = [] as Lay[]
      for (let i = 0; i < 6; i++) w.below.push(lay(placeStick(w.below, w.rnd)!))
      w.stick = lay(placeStick(w.below, w.rnd)!)
    })
    when('它燒透了', (w) => { w.chunks = crumble(w.stick, w.below, w.rnd) })
    then('斷成 3 到 5 塊', (w) => { expect(w.chunks.length).toBeGreaterThanOrEqual(3); expect(w.chunks.length).toBeLessThanOrEqual(5) })
    then('碎塊加起來不比原本那根長', (w) => { expect(w.chunks.reduce((a: number, c: { len: number }) => a + c.len, 0)).toBeLessThanOrEqual(2 * STICK_HALF) })
  })
  scenario('碎塊往下掉，落在下面的東西上', ({ given, when, then }) => {
    given('一根架在炭堆上的炭', (w) => {
      w.rnd = seeded(11)
      w.below = [] as Lay[]
      for (let i = 0; i < 8; i++) w.below.push(lay(placeStick(w.below, w.rnd)!))
      w.stick = lay(placeStick(w.below, w.rnd)!)
    })
    when('它燒透碎掉', (w) => { w.chunks = crumble(w.stick, w.below, w.rnd) })
    then('沒有一塊比斷掉前的位置高', (w) => {
      const l = w.stick as Lay
      for (const c of w.chunks) expect(c.y).toBeLessThanOrEqual(l.y + Math.abs(l.slope) * STICK_HALF + 1e-9)
    })
    then('沒有一塊浮在空中或陷進床裡', (w) => {
      for (const c of w.chunks) expect(c.y).toBeGreaterThanOrEqual(surfaceY(c.x, c.z) + CHUNK_R - 1e-9)
    })
    then('碎塊都在原本那根炭的附近', (w) => {
      const l = w.stick as Lay
      for (const c of w.chunks) expect(Math.hypot(c.x - l.x, c.z - l.z)).toBeLessThan(STICK_HALF + 0.03)
    })
  })
})

feature('丟炭的力道', () => {
  scenario('拖得越快，丟得越用力', ({ then, and, but }) => {
    then('慢慢放下是輕放', () => { expect(throwForce(0.3, 10)).toBeLessThan(0.15) })
    and('快速甩出是用力丟，而且不會超過上限', () => {
      expect(throwForce(2, 10)).toBeGreaterThan(throwForce(1, 10))
      expect(throwForce(20, 10)).toBe(1)
    })
    but('甩到一半停住再放手，就不算丟', () => { expect(throwForce(5, 300)).toBe(0) })
  })
})

feature('炭貼著鹽床，不會浮空', () => {
  scenario('鹽床的高度和模型量到的一致（中央沒有多出來的隆起）', ({ given, then }) => {
    // (the salt as the fire pit's mesh has it, measured in the scene: radius → height of its top)
    given('模型實測的鹽床高度', (w) => { w.measured = [[0, 0.208], [0.234, 0.208], [0.468, 0.174], [0.585, 0.163], [0.819, 0.11], [1.053, 0.039]] })
    then('每一處都在 1.5 公分以內', (w) => {
      for (const [r, y] of w.measured as [number, number][]) expect(Math.abs(surfaceY(r, 0) - y)).toBeLessThan(0.015)
    })
  })
})

feature('炭立著圍成一圈靠在一起（像爐端燒的炭火）', () => {
  scenario('一根根放上去的炭都立著，腳貼著炭床，往中間靠，一圈圈由內往外圍', ({ given, when, then, and }) => {
    given('空的炭床', (w) => { w.stood = [] as Lay[] })
    when('立上三十根炭', (w) => {
      let seed = 9
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 30; i++) {
        const s = standStick(w.stood, rnd)
        if (!s) break
        w.stood.push({ x: s.x, z: s.z, yaw: s.yaw, y: s.rest.y, slope: s.rest.slope })
      }
    })
    then('三十根都立得上去', (w) => { expect(w.stood.length).toBe(30) })
    and('每一根都是立著的（離垂直不超過 30°）', (w) => {
      for (const l of w.stood as Lay[]) expect(Math.atan(1 / l.slope)).toBeLessThan((30 * Math.PI) / 180)
    })
    and('每一根的腳都踩在炭床上（不浮空、不陷進去）', (w) => {
      for (const l of w.stood as Lay[]) {
        const k = 1 / Math.hypot(1, l.slope)
        const foot = { x: l.x - Math.cos(l.yaw) * STICK_HALF * k, z: l.z - Math.sin(l.yaw) * STICK_HALF * k, y: l.y - l.slope * STICK_HALF * k }
        expect(Math.abs(foot.y - surfaceY(foot.x, foot.z))).toBeLessThan(0.02)
      }
    })
    and('每一根都往中間靠（頂端比腳更靠近中央）', (w) => {
      for (const l of w.stood as Lay[]) {
        if (Math.hypot(l.x, l.z) < 0.03) continue
        const top = { x: l.x + Math.cos(l.yaw) * 0.1, z: l.z + Math.sin(l.yaw) * 0.1 }
        expect(Math.hypot(top.x, top.z)).toBeLessThan(Math.hypot(l.x, l.z))
      }
    })
    and('圍在火的中央：腳都在火床中間，彼此不重疊', (w) => {
      const ls = w.stood as Lay[]
      for (const l of ls) expect(Math.hypot(l.x, l.z)).toBeLessThan(0.42)
      for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) expect(Math.hypot(ls[i].x - ls[j].x, ls[i].z - ls[j].z)).toBeGreaterThan(STICK_R * 1.8)
    })
  })
})
