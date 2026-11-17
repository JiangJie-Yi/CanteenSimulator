import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { bagGoes, bagOut, binOf, binToEmpty, EMPTY_AT, emptyBins, OVER, TAKES, toss, wantsEmptying } from '@/game/bins'
import { stockerChore } from '@/game/stocker'

// (item 208, the owner's, 2026-11-16: 「垃圾桶及資源回收桶不好看，然後它們也得運作」: the bins by the sink took only the sticks, never
// filled, and nobody ever emptied them; the recycling one took nothing at all)
feature('垃圾桶與資源回收桶（第 208 項）', () => {
  scenario('收下來的東西分類丟', ({ then, and }) => {
    then('竹籤、魚骨、衛生紙丟一般垃圾', () => {
      expect(binOf('stick')).toBe('rubbish')
      expect(binOf('bone')).toBe('rubbish')
      expect(binOf('tissue')).toBe('rubbish')
    })
    and('空瓶、空罐丟資源回收', () => {
      expect(binOf('can')).toBe('recycle')
      expect(binOf('bottle')).toBe('recycle')
    })
  })
  scenario('丟進去就會滿', ({ given, when, then, and }) => {
    given('兩個桶都是空的', (w) => { w.b = emptyBins() })
    when('丟進 3 根竹籤、一副魚骨、一個空罐、一個空瓶', (w) => {
      w.b = toss(toss(toss(toss(w.b, 'stick', 3), 'bone'), 'can'), 'bottle')
    })
    then('一般垃圾多了竹籤與魚骨的量', (w) => { expect(w.b.rubbish).toBeCloseTo(TAKES.stick * 3 + TAKES.bone) })
    and('資源回收多了一罐一瓶，也記得是幾罐幾瓶', (w) => {
      expect(w.b.recycle).toBeCloseTo(TAKES.can + TAKES.bottle)
      expect(w.b.cans).toBe(1)
      expect(w.b.bottles).toBe(1)
    })
    and('一個空瓶佔的位置比空罐大', () => { expect(TAKES.bottle).toBeGreaterThan(TAKES.can) })
  })
  scenario('滿了還是丟得進去，但壓到最滿就不再多', ({ given, when, then }) => {
    given('一般垃圾已經到最滿', (w) => { w.b = { ...emptyBins(), rubbish: OVER } })
    when('再丟一副魚骨', (w) => { w.b = toss(w.b, 'bone') })
    then(`還是 ${OVER}`, (w) => { expect(w.b.rubbish).toBe(OVER) })
  })
  scenario('快滿了就要倒，倒完換新袋', ({ given, then, and }) => {
    given(`一般垃圾 ${EMPTY_AT} 滿、資源回收快滿`, (w) => { w.b = { rubbish: EMPTY_AT, recycle: EMPTY_AT + 0.1, cans: 10, bottles: 6 } })
    then('兩個都要倒，先倒比較滿的資源回收', (w) => {
      expect(wantsEmptying(w.b, 'rubbish')).toBe(true)
      expect(binToEmpty(w.b)).toBe('recycle')
    })
    and('倒掉資源回收：空了、瓶罐數歸零，一般垃圾不動', (w) => {
      const b = bagOut(w.b, 'recycle')
      expect(b.recycle).toBe(0)
      expect(b.cans + b.bottles).toBe(0)
      expect(b.rubbish).toBe(EMPTY_AT)
    })
    and('都還沒到就不用倒', () => { expect(binToEmpty({ ...emptyBins(), rubbish: EMPTY_AT - 0.01 })).toBeNull() })
  })
  scenario('倉儲看到桶子快滿就去倒', ({ then, and }) => {
    const base = { rolls: { m: 1, f: 1 }, wcBusy: { m: false, f: false }, fridgeShort: [0, 0], boxes: [100], seatTaken: () => false, spares: 1 }
    then('一般垃圾快滿：去倒一般垃圾', () => {
      expect(stockerChore({ ...base, bin: 'rubbish' })).toEqual({ kind: 'bin', which: 'rubbish' })
    })
    and('廁所沒紙了先換紙，再倒垃圾', () => {
      expect(stockerChore({ ...base, rolls: { m: 0.1, f: 1 }, bin: 'rubbish' })).toEqual({ kind: 'roll', who: 'm' })
    })
    and('沒有要倒的就照舊', () => { expect(stockerChore({ ...base, bin: null })).toBeNull() })
  })
})

// (item 318, the owner's, 2026-11-18: 「我發現營業時，有人跑去開員工專用門」)
feature('營業中不從員工門倒垃圾（第 318 項）', () => {
  scenario('還有客人時，滿的垃圾袋綁好收進水槽下', ({ given, then }) => {
    given('店裡還有客人', (w) => { w.about = true })
    then('袋子收進水槽下，不從員工門拿出去', (w) => { expect(bagGoes(w.about)).toBe('underSink') })
  })
  scenario('客人都走了才從員工門拿出去', ({ given, then }) => {
    given('客人都走了', (w) => { w.about = false })
    then('從員工門拿出去', (w) => { expect(bagGoes(w.about)).toBe('out') })
  })
})
