import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CARRY, DRYER_CAP, DRY_S, STACK_CAP, STACK_LOW, RACK_FULL, WASH_AT, dryerStarts, dryerTick, dutyOf, nextChore, platerGoes, platesToBring,
  putBack, unload, washNow, washOne, type Dryer, canOpen, dryerPhase, playerLoad, shutStarts, DRAIN_CAP, DRAIN_S, drainTick, handNow, handOne,
  unbasket, washerBusy } from '@/game/plates'
import { kitchenPath, standClear, type Rect } from '@/game/kitchenPath'

const idle: Dryer = { n: 0, left: null }

feature('廚房擺盤：三廚從碗盤櫃把盤子拿到主廚身旁的裝盤處，主廚就地裝盤，外場進廚房端走', () => {
  scenario(`裝盤處的乾淨盤子少於 ${STACK_LOW} 個就去碗盤櫃拿`, ({ then, and, but }) => {
    then('裝盤處剩 1 個、碗盤櫃有：去拿', () => { expect(platerGoes(1, 0, 30)).toBe(true) })
    and(`還有 ${STACK_LOW} 個就不去`, () => { expect(platerGoes(STACK_LOW, 0, 30)).toBe(false) })
    and('已經有人在拿的路上：不重複去', () => { expect(platerGoes(0, 3, 30)).toBe(false) })
    but('碗盤櫃空了就不去（等洗好烘乾的搬回來）', () => { expect(platerGoes(0, 0, 0)).toBe(false) })
  })
  scenario(`一趟補到 ${STACK_CAP} 個為止，最多拿 ${CARRY} 個、不超過碗盤櫃剩的`, ({ then, and }) => {
    then(`裝盤處剩 1 個：拿 ${STACK_CAP - 1} 個`, () => { expect(platesToBring(1, 30)).toBe(STACK_CAP - 1) })
    and('碗盤櫃只剩 2 個：拿 2 個', () => { expect(platesToBring(0, 2)).toBe(2) })
    and('裝盤處是滿的：不拿', () => { expect(platesToBring(STACK_CAP, 30)).toBe(0) })
  })
  scenario('搬回碗盤櫃的盤子最多放到滿', ({ then, and }) => {
    then('碗盤櫃 40 個，搬回 5 個：變 45 個', () => { expect(putBack(40, 5)).toBe(45) })
    and(`全店 ${RACK_FULL} 個盤子：碗盤櫃 ${RACK_FULL - 2} 個，搬回 5 個：最多 ${RACK_FULL} 個`, () => { expect(putBack(RACK_FULL - 2, 5)).toBe(RACK_FULL) })
    and('全店的盤子是 200 個（店主要的）', () => { expect(RACK_FULL).toBe(200) })
  })
})

feature('外場分工：一個端菜收盤，另一個洗碗、烘碗、搬回碗盤架', () => {
  const base = { serve: false, dirty: 0, sink: 0, rack: 30, dryer: idle }
  scenario('兩個外場：第一個管外場，第二個管洗碗；只有一個人時全部自己做', ({ then, and }) => {
    then('一個人：什麼都做', () => { expect(dutyOf(0, 1)).toBe('all') })
    and('兩個人：第一個外場、第二個洗碗', () => { expect(dutyOf(0, 2)).toBe('floor'); expect(dutyOf(1, 2)).toBe('dish') })
  })
  scenario('裝盤處有裝好的菜：誰有空誰先端', ({ then, and }) => {
    then('管外場的去端', () => { expect(nextChore({ ...base, duty: 'floor', serve: true, dirty: 3 })).toBe('serve') })
    and('管洗碗的有空也幫忙端', () => { expect(nextChore({ ...base, duty: 'dish', serve: true, sink: WASH_AT })).toBe('serve') })
  })
  scenario('座位上的髒盤子由管外場的收', ({ then, but }) => {
    then('管外場的去收', () => { expect(nextChore({ ...base, duty: 'floor', dirty: 2 })).toBe('clear') })
    but('管洗碗的不收', () => { expect(nextChore({ ...base, duty: 'dish', dirty: 2 })).toBeNull() })
  })
  scenario('流理台的髒盤子由管洗碗的洗', ({ then, but }) => {
    then(`流理台有 ${WASH_AT} 個：管洗碗的去洗`, () => { expect(nextChore({ ...base, duty: 'dish', sink: WASH_AT })).toBe('wash') })
    but('管外場的不洗', () => { expect(nextChore({ ...base, duty: 'floor', sink: WASH_AT })).toBeNull() })
  })
  scenario('烘好的盤子由管洗碗的搬回碗盤架；碗盤架空了最優先', ({ then, and }) => {
    then('烘好了：去搬', () => { expect(nextChore({ ...base, duty: 'dish', dryer: { n: 6, left: 0 } })).toBe('unload') })
    and('碗盤架空了、流理台也有要洗的：先搬烘好的', () => {
      expect(nextChore({ ...base, duty: 'dish', rack: 0, sink: 3, dryer: { n: 6, left: 0 } })).toBe('unload')
    })
  })
  scenario('用過的鐵籤桶滿了：由閒著的外場拿去洗，廚師不洗', ({ then, but, and }) => {
    then('管外場的沒事：去洗鐵籤', () => { expect(nextChore({ ...base, duty: 'floor', skewers: true })).toBe('skewers') })
    and('一個人時也是他', () => { expect(nextChore({ ...base, duty: 'all', skewers: true })).toBe('skewers') })
    but('有菜要端、有盤子要收：先端、先收', () => {
      expect(nextChore({ ...base, duty: 'floor', skewers: true, serve: true })).toBe('serve')
      expect(nextChore({ ...base, duty: 'floor', skewers: true, dirty: 1 })).toBe('clear')
    })
    // (item 47: only the floor's server took them, and on a busy evening they're never without plates to carry or clear: none washed in
    // 200 s, the clean ones down from 47 to 6, and late at night the cooks stood without for an hour and a half)
    and('管洗碗的閒著也去洗（在水槽洗東西本來就是他的事）', () => { expect(nextChore({ ...base, duty: 'dish', skewers: true })).toBe('skewers') })
    but('管洗碗的有碗要洗：先洗碗', () => { expect(nextChore({ ...base, duty: 'dish', skewers: true, sink: WASH_AT })).toBe('wash') })
  })
  scenario('筒裡的乾淨鐵籤快沒了（廚師要穿不了串）：除了端菜，先去洗鐵籤', ({ then, and, but }) => {
    then('管外場的有盤子要收：先洗鐵籤', () => { expect(nextChore({ ...base, duty: 'floor', skewers: 'urgent', dirty: 3 })).toBe('skewers') })
    and('管洗碗的有碗要洗：也先洗鐵籤', () => { expect(nextChore({ ...base, duty: 'dish', skewers: 'urgent', sink: WASH_AT })).toBe('skewers') })
    but('有菜要端：先端', () => { expect(nextChore({ ...base, duty: 'floor', skewers: 'urgent', serve: true })).toBe('serve') })
    and('碗盤架空了、烘好的等著搬：先搬（沒盤子也出不了菜）', () => {
      expect(nextChore({ ...base, duty: 'dish', skewers: 'urgent', rack: 0, dryer: { n: 6, left: 0 } })).toBe('unload')
    })
  })
  scenario('一個人時：端菜、洗碗、收盤、搬盤都做', ({ then, and }) => {
    then('有髒盤子：收', () => { expect(nextChore({ ...base, duty: 'all', dirty: 1 })).toBe('clear') })
    and('流理台夠一批：洗', () => { expect(nextChore({ ...base, duty: 'all', sink: WASH_AT })).toBe('wash') })
    and('烘好了：搬', () => { expect(nextChore({ ...base, duty: 'all', dryer: { n: 3, left: 0 } })).toBe('unload') })
    and('都沒事就休息', () => { expect(nextChore({ ...base, duty: 'all' })).toBeNull() })
  })
})

feature('洗碗、烘碗：洗好的放進烘碗機，烘好才搬回碗盤架', () => {
  scenario('髒盤子在流理台累積到一批才洗；碗盤架空了就馬上洗', ({ then, and, but }) => {
    then(`流理台 ${WASH_AT} 個：洗`, () => { expect(washNow(WASH_AT, 30, idle)).toBe(true) })
    but('只有 2 個、碗盤架還有：先不洗', () => { expect(washNow(2, 30, idle)).toBe(false) })
    and('碗盤架 0 個、流理台 1 個：馬上洗', () => { expect(washNow(1, 0, idle)).toBe(true) })
  })
  scenario('烘碗機在烘、或裡面還有烘好的、或滿了：不能再洗進去', ({ then, and }) => {
    then('正在烘', () => { expect(washNow(WASH_AT, 30, { n: 4, left: 12 })).toBe(false) })
    and('烘好了還沒拿出來', () => { expect(washNow(WASH_AT, 30, { n: 4, left: 0 })).toBe(false) })
    and('滿了', () => { expect(washNow(WASH_AT, 30, { n: DRYER_CAP, left: null })).toBe(false) })
  })
  scenario('洗好一個：流理台少一個、烘碗機多一個', ({ then, and }) => {
    then('流理台 3 個、烘碗機空的', () => { expect(washOne(3, idle)).toEqual({ dirty: 2, dryer: { n: 1, left: null } }) })
    and('烘碗機滿了就不洗', () => { expect(washOne(3, { n: DRYER_CAP, left: null })).toEqual({ dirty: 3, dryer: { n: DRYER_CAP, left: null } }) })
  })
  scenario('流理台洗空了、或烘碗機放滿了，就關門開始烘', ({ then, and, but }) => {
    then('洗空了', () => { expect(dryerStarts(0, { n: 4, left: null })).toBe(true) })
    and('放滿了', () => { expect(dryerStarts(3, { n: DRYER_CAP, left: null })).toBe(true) })
    but('還在洗、還沒滿：先不烘', () => { expect(dryerStarts(3, { n: 4, left: null })).toBe(false) })
    and('空的不烘', () => { expect(dryerStarts(0, idle)).toBe(false) })
  })
  scenario(`烘 ${DRY_S} 秒後烘好`, ({ given, when, then, and }) => {
    given('剛開始烘', (w) => { w.d = { n: 6, left: DRY_S } })
    when(`過了 ${DRY_S / 2} 秒`, (w) => { w.d = dryerTick(w.d, DRY_S / 2) })
    then('還在烘', (w) => { expect(w.d.left).toBeCloseTo(DRY_S / 2) })
    when(`再過 ${DRY_S} 秒`, (w) => { w.d = dryerTick(w.d, DRY_S) })
    and('烘好了（不會變成負的）', (w) => { expect(w.d.left).toBe(0) })
  })
  scenario(`烘好的一趟搬 ${CARRY} 個，搬空了烘碗機才能再用`, ({ given, when, then, and }) => {
    given('烘好 7 個', (w) => { w.d = { n: 7, left: 0 } })
    when('搬一趟', (w) => { w.r = unload(w.d) })
    then(`拿 ${CARRY} 個，剩 ${7 - CARRY} 個還是烘好的`, (w) => { expect(w.r.take).toBe(CARRY); expect(w.r.dryer).toEqual({ n: 7 - CARRY, left: 0 }) })
    when('再搬一趟', (w) => { w.r = unload(w.r.dryer) })
    and('拿完了，烘碗機空出來', (w) => { expect(w.r.take).toBe(7 - CARRY); expect(w.r.dryer).toEqual(idle) })
    and('還在烘的拿不出來', () => { expect(unload({ n: 5, left: 9 }).take).toBe(0) })
  })
})

feature('洗碗機優先；洗碗機在洗或滿了，就在水槽手洗、放進瀝水籃瀝乾，乾了搬回碗盤架', () => {
  const base = { serve: false, dirty: 0, sink: 0, rack: 30, dryer: idle }
  scenario('洗碗機空著：髒盤子放進洗碗機（不手洗）', ({ then, and }) => {
    then('去洗碗機', () => { expect(nextChore({ ...base, duty: 'dish', sink: WASH_AT })).toBe('wash') })
    and('不手洗', () => { expect(handNow(WASH_AT, 30, idle, { n: 0, left: null })).toBe(false) })
  })
  scenario('洗碗機正在洗：手洗、放進瀝水籃', ({ then, and, but }) => {
    then('手洗', () => { expect(nextChore({ ...base, duty: 'dish', sink: WASH_AT, dryer: { n: DRYER_CAP, left: 5 } })).toBe('handwash') })
    and('洗碗機在洗算忙', () => { expect(washerBusy({ n: 3, left: 5 })).toBe(true) })
    but('洗好的還在裡面：先拿出來（不算忙），不手洗', () => {
      expect(washerBusy({ n: 6, left: 0 })).toBe(false)
      expect(nextChore({ ...base, duty: 'dish', sink: WASH_AT, dryer: { n: 6, left: 0 } })).toBe('unload')
    })
    and(`瀝水籃滿了（${DRAIN_CAP} 個）就不手洗`, () => { expect(handNow(WASH_AT, 30, { n: 4, left: 5 }, { n: DRAIN_CAP, left: DRAIN_S })).toBe(false) })
  })
  scenario('手洗一個：水槽少一個、瀝水籃多一個，從這時開始瀝乾', ({ then, and }) => {
    then('水槽 3、瀝水籃 1', () => { expect(handOne(4, { n: 0, left: null })).toEqual({ dirty: 3, drain: { n: 1, left: DRAIN_S } }) })
    and('再放一個，全部重新算瀝乾的時間', () => { expect(handOne(3, { n: 1, left: 4 })).toEqual({ dirty: 2, drain: { n: 2, left: DRAIN_S } }) })
  })
  scenario(`瀝 ${DRAIN_S} 秒乾了才搬回碗盤架，一趟最多 ${CARRY} 個`, ({ given, when, then, and }) => {
    given(`瀝水籃 ${DRAIN_CAP} 個，剛放好`, (w) => { w.d = { n: DRAIN_CAP, left: DRAIN_S } })
    then('還濕的搬不走', (w) => { expect(unbasket(w.d).take).toBe(0) })
    when(`過了 ${DRAIN_S} 秒`, (w) => { w.d = drainTick(w.d, DRAIN_S) })
    then('乾了：管洗碗的去搬', (w) => { expect(nextChore({ ...base, duty: 'dish', drain: w.d })).toBe('unbasket') })
    and(`一趟拿 ${CARRY} 個，剩 ${DRAIN_CAP - CARRY} 個`, (w) => { const r = unbasket(w.d); expect(r.take).toBe(CARRY); expect(r.drain.n).toBe(DRAIN_CAP - CARRY) })
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

  scenario('待命的位置落在擺設上（例如飯桶旁的味噌湯鍋），就站到旁邊最近的空處', ({ given, when, then, and }) => {
    given('一個湯鍋（含旁邊留的走道寬度）', (w) => { w.pot = { x0: 3, z0: 1, x1: 3.6, z1: 1.6 } })
    when('外場的待命點在湯鍋靠右的地方', (w) => { w.at = standClear([3.5, 1.3], [w.pot]) })
    then('移到湯鍋外面', (w) => { expect(w.at[0] >= w.pot.x1 || w.at[0] <= w.pot.x0 || w.at[1] >= w.pot.z1 || w.at[1] <= w.pot.z0).toBe(true) })
    and('往最近的那一邊（右邊）移，只移一點點', (w) => { expect(w.at[0]).toBeGreaterThan(3.6); expect(w.at[0]).toBeLessThan(3.7); expect(w.at[1]).toBe(1.3) })
    when('待命點本來就在空處', (w) => { w.at = standClear([1, 1], [w.pot]) })
    then('不動', (w) => { expect(w.at).toEqual([1, 1]) })
  })

  scenario('完全被擋住時沒有路', ({ when, then }) => {
    when('一道牆從房間這頭擋到那頭', (w) => { w.p = kitchenPath([0.5, 2], [5.5, 2], room, [{ x0: 2.8, z0: -1, x1: 3.2, z1: 5 }]) })
    then('沒有路', (w) => { expect(w.p).toBeNull() })
  })
})

feature('洗碗機：玩家自己操作', () => {
  scenario('開門把流理台的髒盤子放進去，最多放得下 8 個', ({ given, when, then, and }) => {
    given('流理台有 12 個髒盤子，洗碗機空的', (w) => { w.d = { n: 0, left: null } as Dryer })
    when('門打開、點洗碗籃', (w) => { w.k = playerLoad(12, w.d) })
    then('放進去 8 個', (w) => { expect(w.k).toBe(DRYER_CAP); expect(DRYER_CAP).toBe(8) })
    and('已經有 5 個時只放得下 3 個', () => { expect(playerLoad(12, { n: 5, left: null })).toBe(3) })
  })

  scenario('洗碗中不能開門、不能放；裡面是洗好的也不能放', ({ then, and }) => {
    then('洗碗中', () => { expect(dryerPhase({ n: 6, left: 3 })).toBe('washing'); expect(canOpen({ n: 6, left: 3 })).toBe(false); expect(playerLoad(4, { n: 6, left: 3 })).toBe(0) })
    and('洗好了：可以開門，但要先拿出來才放新的', () => { expect(dryerPhase({ n: 6, left: 0 })).toBe('clean'); expect(canOpen({ n: 6, left: 0 })).toBe(true); expect(playerLoad(4, { n: 6, left: 0 })).toBe(0) })
  })

  scenario('關上門就開始洗，約 8 秒洗好', ({ given, when, then, and }) => {
    given('放了 6 個、還沒開始', (w) => { w.d = { n: 6, left: null } as Dryer })
    when('關門', (w) => { if (shutStarts(w.d)) w.d = { ...w.d, left: DRY_S } })
    then('開始洗', (w) => { expect(dryerPhase(w.d)).toBe('washing') })
    when(`過了 ${DRY_S} 秒`, (w) => { w.d = dryerTick(w.d, DRY_S) })
    then('洗好了', (w) => { expect(dryerPhase(w.d)).toBe('clean') })
    and('空的關門不會開始', () => { expect(shutStarts({ n: 0, left: null })).toBe(false) })
  })
})
