import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { POUR_BEATS, POUR_S, POUR_TOTAL, pourBeat, pouredBy, streaming, STREAM_FROM, STREAM_TO } from '@/game/sakePour'

feature('客人點的清酒在備餐檯用手倒（第 177 項）', () => {
  scenario('倒一壺的步驟照順序：先擺德利、握瓶、提起、倒、放回、擺酒杯', ({ given, when, then, and }) => {
    given('倒酒剛開始', (w) => { w.seen = [] as string[] })
    when('從頭到尾每 0.05 秒看一次在哪一步', (w) => {
      for (let t = 0; t < POUR_TOTAL; t += 0.05) {
        const b = pourBeat(t)!.beat
        const seen = w.seen as string[]
        if (seen[seen.length - 1] !== b) seen.push(b)
      }
    })
    then('步驟依序出現、每一步只出現一次', (w) => { expect(w.seen).toEqual([...POUR_BEATS]) })
    and('整壺倒完大約 3.7 秒，不會拖太久', () => { expect(POUR_TOTAL).toBeGreaterThan(3); expect(POUR_TOTAL).toBeLessThan(4.5) })
  })

  scenario('酒只在倒的那一步流進德利', ({ given, then, and }) => {
    given('倒酒那一步的開始與結束', (w) => {
      w.pourFrom = POUR_S.jug + POUR_S.grip + POUR_S.lift
      w.pourTo = (w.pourFrom as number) + POUR_S.pour
    })
    then('提起之前沒有酒流出來', () => { expect(streaming(0.5)).toBe(false); expect(pouredBy(0.5)).toBe(0) })
    and('酒流的時間落在倒的那一步裡面', (w) => {
      expect(STREAM_FROM).toBeGreaterThan(w.pourFrom as number)
      expect(STREAM_TO).toBeLessThan(w.pourTo as number)
    })
    and('倒完之後德利是滿的，而且滿的程度只增不減', () => {
      let last = 0
      for (let t = 0; t < POUR_TOTAL; t += 0.05) { const p = pouredBy(t); expect(p).toBeGreaterThanOrEqual(last); last = p }
      expect(pouredBy(POUR_TOTAL)).toBe(1)
    })
  })

  scenario('還沒開始或倒完之後就不在任何一步', ({ then }) => {
    then('負的時間與倒完以後都沒有步驟', () => {
      expect(pourBeat(-0.1)).toBeNull()
      expect(pourBeat(POUR_TOTAL)).toBeNull()
      expect(pourBeat(Number.NaN)).toBeNull()
    })
  })
})
