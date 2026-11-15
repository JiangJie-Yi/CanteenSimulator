import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PILE_START, bossCleans, pileLeft, staffSink } from '@/game/sinkPile'
import { SOAP_PUMP, WASH_WATER, handStep, pumpSoap, scrubbed, soapWith, type HandSink } from '@/game/handWash'

feature('流理台那疊髒盤（店主要的，第 103 項）', () => {
  scenario('員工不碰那疊，只洗營業中收回來的', ({ given, then, and }) => {
    given('水槽裡有那疊 6 個，加上營業收回來的 4 個', (w) => { w.dirty = PILE_START + 4; w.pile = PILE_START })
    then('員工要洗的只有 4 個', (w) => { expect(staffSink(w.dirty, w.pile)).toBe(4) })
    and('洗完那 4 個，那疊還在', (w) => { expect(pileLeft(w.pile, PILE_START)).toBe(PILE_START) })
  })
  scenario('玩家自己洗掉幾個，那疊就少幾個', ({ given, when, then }) => {
    given('水槽裡只有那疊 6 個', (w) => { w.dirty = 6; w.pile = 6 })
    when('玩家洗了 2 個', (w) => { w.dirty -= 2; w.pile = pileLeft(w.pile, w.dirty) })
    then('那疊剩 4 個', (w) => { expect(w.pile).toBe(4) })
  })
  scenario('第一、二天老闆不去洗，第三天還在才去', ({ then, and, but }) => {
    then('第一天不洗', () => { expect(bossCleans(1, 6)).toBe(false) })
    and('第二天也不洗', () => { expect(bossCleans(2, 6)).toBe(false) })
    and('第三天還在，老闆去洗', () => { expect(bossCleans(3, 6)).toBe(true) })
    but('玩家已經洗完了，第三天也不用去', () => { expect(bossCleans(3, 0)).toBe(false) })
  })
})

feature('手洗碗盤的步驟（店主要的，第 103 項）', () => {
  const base: HandSink = { dirty: 3, drain: { n: 0, left: null }, plug: false, water: 0, soap: 0, sponge: false }
  scenario('照順序：塞子、放水、洗碗精、菜瓜布、刷', ({ given, then }) => {
    given('有髒盤，什麼都還沒做', () => {})
    then('一步一步提示下一步', () => {
      expect(handStep(base)).toBe('plug')
      expect(handStep({ ...base, plug: true })).toBe('water')
      expect(handStep({ ...base, plug: true, water: WASH_WATER })).toBe('soap')
      expect(handStep({ ...base, plug: true, water: WASH_WATER, soap: SOAP_PUMP })).toBe('sponge')
      expect(handStep({ ...base, plug: true, water: WASH_WATER, soap: SOAP_PUMP, sponge: true })).toBe('scrub')
    })
  })
  // (item 196: a squeeze washed three, and the owner was sent back to the bottle every three plates, the boss walking back to his fire
  // between; a squeeze into a basin of water does a sink-load)
  scenario('擠一次洗碗精洗一整批（十個），洗完要再擠', ({ given, when, then, and }) => {
    given('擠了一次', (w) => { w.soap = pumpSoap(0) })
    when('刷了九個', (w) => { for (let i = 0; i < 9; i++) w.soap = scrubbed(w.soap) })
    then('還能再刷', (w) => { expect(handStep({ ...base, dirty: 20, plug: true, water: 0.5, soap: w.soap, sponge: true })).toBe('scrub') })
    when('刷了第十個', (w) => { w.soap = scrubbed(w.soap) })
    then('又要擠洗碗精', (w) => { expect(SOAP_PUMP).toBe(10); expect(handStep({ ...base, dirty: 20, plug: true, water: 0.5, soap: w.soap, sponge: true })).toBe('soap') })
    and('多擠幾次，水裡最多存三十個的量', () => { expect(pumpSoap(pumpSoap(pumpSoap(pumpSoap(0))))).toBe(30) })
  })
  scenario('水放掉，洗碗精也跟著沒了', ({ then }) => {
    then('水是空的，洗碗精歸零', () => { expect(soapWith(6, 0)).toBe(0); expect(soapWith(6, 0.4)).toBe(6) })
  })
  scenario('瀝水籃滿了先收', ({ then }) => {
    then('提示收瀝水籃', () => { expect(handStep({ ...base, drain: { n: 30, left: 0 } })).toBe('basketFull') })
  })
})
