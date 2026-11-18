import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CLIMB_S, SETTLE_S, WALK_MPS, downBeat, downLength, dormDoing, upBeat, upstairs } from '@/game/dormLife'

feature('住二樓的員工：上樓、在房裡、下樓', () => {
  scenario('收店後上樓：先從樓梯爬上來，再走到自己的位子，坐定', ({ given, then, and }) => {
    given('樓梯口到位子 1.2 公尺', (w) => { w.walk = 1.2 })
    then('剛上樓梯的時候在爬', (w) => { expect(upBeat(0.5, w.walk).phase).toBe('climb') })
    and('爬完之後走向位子', (w) => { expect(upBeat(CLIMB_S + 0.5, w.walk).phase).toBe('walk') })
    and('走到之後坐下，最後在位子上', (w) => {
      expect(upBeat(CLIMB_S + w.walk / WALK_MPS + SETTLE_S / 2, w.walk).phase).toBe('settle')
      expect(upBeat(60, w.walk)).toEqual({ phase: 'there', k: 1 })
    })
  })

  scenario('凌晨四點到上午十一點在睡，其他時間在休息', ({ then, and }) => {
    then('收店後的清晨與上午在睡', () => { for (const m of [4 * 60, 5 * 60, 10 * 60 + 59]) expect(dormDoing(m)).toBe('sleep') })
    and('中午以後、半夜在休息', () => { for (const m of [11 * 60, 15 * 60, 23 * 60, 3 * 60 + 59]) expect(dormDoing(m)).toBe('rest') })
  })

  scenario('開店前下樓：起身、走到樓梯口、往下走，走完就不在二樓', ({ given, then, and }) => {
    given('位子到樓梯口 1 公尺', (w) => { w.walk = 1 })
    then('先起身，再走，再下樓', (w) => {
      expect(downBeat(0.2, w.walk).phase).toBe('rise')
      expect(downBeat(SETTLE_S + 0.5, w.walk).phase).toBe('walk')
      expect(downBeat(SETTLE_S + w.walk / WALK_MPS + 0.5, w.walk).phase).toBe('climb')
    })
    and('下完了就不見了', (w) => { expect(downBeat(downLength(w.walk) + 0.1, w.walk).phase).toBe('gone') })
  })

  scenario('誰在二樓：收店時還在店裡往員工門走的不算；開店後只有還在下樓的', ({ then, and }) => {
    then('收店、已經上樓的在二樓；還在店裡走的不在', () => { expect(upstairs(false, false, null, 4)).toBe(true); expect(upstairs(false, true, null, 4)).toBe(false) })
    and('走進員工門上了樓的，店還沒完全關（其他人還在走）也已經在二樓', () => { expect(upstairs(true, false, null, 4, true)).toBe(true) })
    and('開店：正在下樓的還在，下完、或本來就在店裡上班的不在', () => {
      expect(upstairs(true, false, 1, 4)).toBe(true)
      expect(upstairs(true, false, 5, 4)).toBe(false)
      expect(upstairs(true, false, null, 4)).toBe(false)
    })
  })
})
