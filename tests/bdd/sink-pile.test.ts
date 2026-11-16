import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { PILE_START, bossCleans, pileLeft, staffSink } from '@/game/sinkPile'
import { SOAP_PUMP, WASH_WET, handStep, pumpSoap, scrubbed, soapWith, washTips, type HandSink } from '@/game/handWash'

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
  // (item 217, the owner's 「這洗碗的流程定的太死也不好玩，誰說一定要裝滿25%才能洗?」: the plug, a quarter of a basin, the liquid and the sponge
  // were each a gate, in a fixed order)
  scenario('有水就能洗：開水龍頭沖著洗，不用塞子、不用等水滿（第 217 項）', ({ given, then, and }) => {
    given('有髒盤，什麼都還沒做', () => {})
    then('只提示開水', () => { expect(handStep(base)).toBe('water') })
    and('水龍頭一開就能洗，塞子沒塞、水槽是空的也行', () => { expect(handStep({ ...base, tap: true })).toBe('scrub') })
    and('水龍頭關著，水槽裡有一點水也能洗', () => { expect(handStep({ ...base, plug: true, water: WASH_WET })).toBe('scrub') })
    and('沒有洗碗精、沒拿菜瓜布也能洗', () => { expect(handStep({ ...base, tap: true, soap: 0, sponge: false })).toBe('scrub') })
  })
  scenario('洗碗精與塞子是建議，不擋人（第 217 項）', ({ then, and }) => {
    then('沒擠洗碗精，提示擠一點刷得快', () => { expect(washTips({ ...base, tap: true }).join()).toContain('刷得快') })
    and('開著水、沒塞住，提示比較費水', () => { expect(washTips({ ...base, tap: true, plug: false }).join()).toContain('費水') })
    and('擠了洗碗精、塞住了，就沒有建議', () => { expect(washTips({ ...base, tap: true, plug: true, soap: SOAP_PUMP })).toEqual([]) })
  })
  // (item 196: a squeeze washed three, and the owner was sent back to the bottle every three plates, the boss walking back to his fire
  // between; a squeeze into a basin of water does a sink-load)
  scenario('擠一次洗碗精洗一整批（十個），洗完要再擠', ({ given, when, then, and }) => {
    given('擠了一次', (w) => { w.soap = pumpSoap(0) })
    when('刷了九個', (w) => { for (let i = 0; i < 9; i++) w.soap = scrubbed(w.soap) })
    then('還剩一個的量', (w) => { expect(w.soap).toBe(1) })
    when('刷了第十個', (w) => { w.soap = scrubbed(w.soap) })
    then('洗碗精用完了，照樣能洗，只是建議再擠一點', (w) => {
      expect(SOAP_PUMP).toBe(10)
      expect(handStep({ ...base, dirty: 20, plug: true, water: 0.5, soap: w.soap })).toBe('scrub')
      expect(washTips({ ...base, dirty: 20, plug: true, water: 0.5, soap: w.soap }).join()).toContain('刷得快')
    })
    and('多擠幾次，水裡最多存三十個的量', () => { expect(pumpSoap(pumpSoap(pumpSoap(pumpSoap(0))))).toBe(30) })
  })
  scenario('水放掉，洗碗精也跟著沒了；擠在菜瓜布上的留著', ({ then, and }) => {
    then('水槽的水放光，洗碗精歸零', () => { expect(soapWith(6, 0.4, 0)).toBe(0); expect(soapWith(6, 0.4, 0.4)).toBe(6) })
    and('沒存水時擠的（在菜瓜布上，沖著洗），水槽本來就是空的，留著', () => { expect(soapWith(6, 0, 0)).toBe(6) })
  })
  scenario('瀝水籃滿了先收', ({ then }) => {
    then('提示收瀝水籃', () => { expect(handStep({ ...base, drain: { n: 30, left: 0 } })).toBe('basketFull') })
  })
})
