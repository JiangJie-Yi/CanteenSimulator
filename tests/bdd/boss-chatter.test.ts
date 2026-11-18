import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { BOSS_LINES, nextBossLine, type BossSituation } from '@/data/bossLines'
import { OPEN_DORM, OPEN_HOME } from '@/data/commuteLines'
import { CREW_BUSY, CREW_SELF, CREW_SELF_TIME } from '@/data/crewLines'
import { bossSituation, talkPart } from '@/game/talkTime'

const at = (h: number, m = 0) => h * 60 + m

feature('老闆一直碎碎念，說的話跟著時間', () => {
  scenario('開店時照營業的時段念：開店、晚餐尖峰、晚上、深夜、最後點餐', ({ then, and }) => {
    then('17:00 開店、19:00 尖峰、22:30 晚上、01:00 深夜、04:10 最後點餐', () => {
      expect([at(17), at(19), at(22, 30), at(1), at(4, 10)].map((m) => bossSituation(m, true))).toEqual(['openEarly', 'openPeak', 'openNight', 'openLate', 'openLast'])
    })
    and('分界：16:30 開店、18:30 尖峰、21:30 晚上、00:00 深夜、04:00 最後點餐', () => {
      expect([at(16, 30), at(18, 29), at(18, 30), at(21, 29), at(21, 30), at(23, 59), at(0), at(3, 59), at(4)].map((m) => bossSituation(m, true)))
        .toEqual(['openEarly', 'openEarly', 'openPeak', 'openPeak', 'openNight', 'openNight', 'openLate', 'openLate', 'openLast'])
    })
  })

  scenario('沒開店時照一天的時段念：收店後、上午、下午備料、該開沒開、太晚了', ({ then }) => {
    then('05:00 收店後、09:00 上午、15:00 備料、19:00 還沒開、01:00 太晚了', () => {
      expect([at(5), at(9), at(15), at(19), at(1)].map((m) => bossSituation(m, false))).toEqual(['closedDawn', 'closedMorning', 'closedPrep', 'closedEvening', 'closedLate'])
    })
  })

  scenario('時段跟台詞對得上（店主說的：「老闆的話要能對得上時間」）', ({ then, and }) => {
    const zh = (s: BossSituation) => BOSS_LINES[s].map((l) => l.zh).join('')
    const en = (s: BossSituation) => BOSS_LINES[s].map((l) => l.en).join(' ')
    then('營業中（16:30 起）沒有午餐、早安、早上', () => {
      for (const s of ['openEarly', 'openPeak', 'openNight', 'openLate', 'openLast'] as const) {
        expect(zh(s)).not.toMatch(/午餐|早安|早上|中午/)
        expect(en(s)).not.toMatch(/lunch|morning/i)
      }
    })
    and('最後一條魚、快打烊只在最後點餐；夜深只在深夜', () => {
      for (const s of Object.keys(BOSS_LINES) as BossSituation[]) {
        if (s !== 'openLast') expect(zh(s)).not.toMatch(/最後一條魚|就打烊了/)
        if (s !== 'openLate') expect(zh(s)).not.toContain('夜深了')
      }
    })
    and('自言自語裡不喊歡迎光臨、謝謝光臨（那是客人進出時店裡一起喊的）', () => {
      for (const ls of Object.values(BOSS_LINES)) for (const l of ls) expect(l.zh).not.toMatch(/歡迎光臨|歡迎～|裡面請|謝謝光臨/)
    })
    and('開店時的招呼（16:30 以後）不說早安', () => {
      for (const p of [OPEN_DORM, OPEN_HOME]) { expect(p.zh.join('')).not.toMatch(/早安|老闆早/); expect(p.en.join(' ')).not.toMatch(/morning/i) }
    })
  })

  scenario('十個時段各不相同，每個都有夠多的話可以念', ({ then, and }) => {
    then('彼此沒有重複的句子', () => {
      const flat = Object.values(BOSS_LINES).flat().map((l) => l.zh)
      expect(Object.keys(BOSS_LINES).length).toBe(10)
      expect(new Set(flat).size).toBe(flat.length)
    })
    and('每種至少 8 句，中日英都有', () => {
      for (const ls of Object.values(BOSS_LINES)) {
        expect(ls.length).toBeGreaterThanOrEqual(8)
        for (const l of ls) { expect(l.zh).toBeTruthy(); expect(l.ja).toBeTruthy(); expect(l.en).toBeTruthy() }
      }
    })
  })

  scenario('不會連續講同一句', ({ given, when, then }) => {
    given('收店後，剛講完第 3 句', (w) => { w.s = bossSituation(at(5), false); w.last = 3 })
    when('隨機挑下一句很多次', (w) => { w.next = Array.from({ length: 200 }, (_, i) => nextBossLine(w.s, w.last, i / 200)) })
    then('從來不是第 3 句，而且其他每一句都有機會', (w) => {
      expect(w.next).not.toContain(3)
      expect(new Set(w.next).size).toBe(BOSS_LINES[w.s as BossSituation].length - 1)
    })
  })
})

feature('員工也會說話（店主說的：「員工都沒說話很怪」）', () => {
  scenario('忙的時候互相喊話、平常各說各的工作、跟著時段說', ({ then, and }) => {
    then('忙的時候三種喊話（外場問廚房、廚房叫外場、廚師之間）都有一問一答', () => {
      for (const k of ['ask', 'call', 'kitchen'] as const) for (const lang of ['zh', 'ja', 'en'] as const) {
        expect(CREW_BUSY[k][lang].length).toBeGreaterThanOrEqual(4)
        for (const [a, b] of CREW_BUSY[k][lang]) { expect(a).toBeTruthy(); expect(b).toBeTruthy() }
      }
    })
    and('五種職位各有自己的話，中日英句數一樣', () => {
      for (const r of ['chef', 'sous', 'server', 'cashier', 'stock'] as const) {
        expect(CREW_SELF[r].zh.length).toBeGreaterThanOrEqual(3)
        expect(CREW_SELF[r].ja.length).toBe(CREW_SELF[r].zh.length)
        expect(CREW_SELF[r].en.length).toBe(CREW_SELF[r].zh.length)
      }
    })
    and('時段的話照營業時段挑：19:00 是尖峰、01:00 是深夜，深夜的話說睏不說尖峰', () => {
      expect(talkPart(at(19))).toBe('peak')
      expect(talkPart(at(1))).toBe('late')
      expect(CREW_SELF_TIME.late.zh.join('')).not.toContain('尖峰')
      expect(CREW_SELF_TIME.peak.zh.join('')).not.toMatch(/睏|深夜/)
    })
  })
})
