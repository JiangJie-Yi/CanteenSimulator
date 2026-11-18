import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { CALM, CALM_FROM, calmedSince, calmLeft, canCalm } from '@/game/calm'

feature('安撫等太久的客人（第 348 項：互動，跟第 347 項的生氣一起）', () => {
  scenario('招呼、道歉、送小菜：各讓客人多等一段', ({ given, then, and }) => {
    given('客人的耐心是 100 秒，已經等了 80 秒', (w) => { w.now = 1000; w.limit = 100; w.since = 920 })
    then('招呼：等待的起點往後退 15 秒（他還能多等 15 秒）', (w) => { expect(calmedSince(w.since, w.now, w.limit, 'greet')).toBe(935) })
    and('道歉：退 25 秒', (w) => { expect(calmedSince(w.since, w.now, w.limit, 'sorry')).toBe(945) })
    and('送小菜：退 50 秒，要花 NT$30', (w) => { expect(calmedSince(w.since, w.now, w.limit, 'side')).toBe(970); expect(CALM.side.cost).toBe(30) })
  })

  scenario('不會退到比現在還晚（剛坐下的客人送小菜也不會變成「還沒來」）', ({ then }) => {
    then('等了 10 秒的客人送小菜，起點就是現在', () => { expect(calmedSince(990, 1000, 100, 'side')).toBe(1000) })
  })

  scenario('每一種只能用一次', ({ then, and }) => {
    then('用過招呼，剩道歉和送小菜', () => { expect(calmLeft(['greet'])).toEqual(['sorry', 'side']) })
    and('三種都用過，就沒有了', () => { expect(calmLeft(['greet', 'sorry', 'side'])).toEqual([]) })
  })

  scenario('客人開始不耐煩才出現安撫的按鈕', ({ then, and }) => {
    then(`耐心用掉不到 ${CALM_FROM * 100}%：不出現`, () => { expect(canCalm(0.2, [])).toBe(false) })
    and('用掉一半：出現', () => { expect(canCalm(0.5, [])).toBe(true) })
    and('三種都用過：不再出現', () => { expect(canCalm(0.9, ['greet', 'sorry', 'side'])).toBe(false) })
  })
})
