import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOSS_LINES, bossSituation, nextBossLine } from '@/data/bossLines'

feature('老闆一直碎碎念', () => {
  scenario('白天、晚上、營業、休業講的話都不一樣', ({ given, when, then }) => {
    given('四種情況', (w) => { w.all = [bossSituation(false, false), bossSituation(true, false), bossSituation(false, true), bossSituation(true, true)] })
    when('看各自的台詞', (w) => { w.lines = w.all.map((s: keyof typeof BOSS_LINES) => BOSS_LINES[s].map((l) => l.zh)) })
    then('四種情況各不相同，且彼此沒有重複的句子', (w) => {
      expect(new Set(w.all).size).toBe(4)
      const flat = w.lines.flat()
      expect(new Set(flat).size).toBe(flat.length)
    })
  })

  scenario('每種情況都有夠多的話可以念', ({ then }) => {
    then('每種至少 8 句，中日英都有', () => {
      for (const ls of Object.values(BOSS_LINES)) {
        expect(ls.length).toBeGreaterThanOrEqual(8)
        for (const l of ls) { expect(l.zh).toBeTruthy(); expect(l.ja).toBeTruthy(); expect(l.en).toBeTruthy() }
      }
    })
  })

  scenario('不會連續講同一句', ({ given, when, then }) => {
    given('晚上休業，剛講完第 3 句', (w) => { w.s = bossSituation(true, false); w.last = 3 })
    when('隨機挑下一句很多次', (w) => { w.next = Array.from({ length: 200 }, (_, i) => nextBossLine(w.s, w.last, i / 200)) })
    then('從來不是第 3 句，而且其他每一句都有機會', (w) => {
      expect(w.next).not.toContain(3)
      expect(new Set(w.next).size).toBe(BOSS_LINES[w.s as 'nightClosed'].length - 1)
    })
  })
})
