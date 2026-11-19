import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { ALARM_MS, crewMood, loadOf, newCrewMood, PRESS_HOLD, SPELL_MS, URGE_MS, type CrewMoodIn } from '@/game/crewMood'

/** one of the staff as the shop stands: an ordinary bond, an ordinary shop, nothing going on */
const calm = (now: number, more: Partial<CrewMoodIn> = {}): CrewMoodIn => ({ now, tired: false, load: 0, bond: 50, atmos: 50, rushAt: -1e9, ...more })
/** how they are over a stretch, a frame every `step` ms from `from` to `to`: what showed at each */
const run = (s: ReturnType<typeof newCrewMood>, from: number, to: number, at: (t: number) => Partial<CrewMoodIn>, step = 100) => {
  const seen: string[] = []
  for (let t = from; t <= to; t += step) seen.push(crewMood(s, calm(t, at(t)), 3).emote)
  return seen
}

feature('員工有自己的情緒，頭上看得出來（第 381 項：「員工也得有情緒」）', () => {
  scenario('客人等太久、店裡忙不過來時，員工會冒汗、趕起來', ({ given, when, then, and }) => {
    const w = { s: newCrewMood(0, 3), seen: [] as string[] }
    given('客人的耐心快用完，店裡的忙碌程度很高', () => { expect(loadOf([0.85, 0.6, 0.4, 0.3])).toBeGreaterThan(0.75) })
    when('忙了一陣子', () => { w.seen = run(w.s, 0, PRESS_HOLD + 500, () => ({ load: 0.75 })) })
    then('一開始還沒冒汗（忙一下子不算）', () => { expect(w.seen[0]).toBe('none') })
    and('忙超過一秒半就冒汗，身體前傾趕工', () => {
      expect(w.seen.at(-1)).toBe('sweat')
      expect(crewMood(w.s, calm(PRESS_HOLD + 600, { load: 0.75 }), 3).hurry).toBe(1)
    })
    and('忙碌程度稍微降一點不會馬上停（不會一閃一閃）', () => { expect(crewMood(w.s, calm(PRESS_HOLD + 700, { load: 0.5 }), 3).emote).toBe('sweat') })
    and('降到夠低才鬆一口氣', () => { expect(crewMood(w.s, calm(PRESS_HOLD + 800, { load: 0.3 }), 3).emote).toBe('none') })
  })

  scenario('沒有客人在等時，店裡不忙', ({ then }) => {
    then('忙碌程度是 0', () => { expect(loadOf([])).toBe(0); expect(loadOf([0, 0])).toBe(0) })
  })

  scenario('烤魚店總有幾位在等菜：人多但都還有耐心，不算忙', ({ then, and }) => {
    then('六位在等、最久的才等了兩成耐心：不到冒汗的程度', () => { expect(loadOf([0.2, 0.15, 0.1, 0.1, 0.05, 0.05])).toBeLessThan(0.4) })
    and('最久的那位用掉四成五的耐心（快要開始生氣了）：員工開始趕', () => { expect(loadOf([0.45, 0.3, 0.2, 0.1, 0.1, 0.05])).toBeGreaterThanOrEqual(0.55) })
  })

  scenario('累壞的員工垂頭喪氣', ({ then }) => {
    then('頭上有烏雲線，垮著肩', () => {
      const o = crewMood(newCrewMood(0, 3), calm(0, { tired: true }), 3)
      expect(o.emote).toBe('gloom')
      expect(o.slump).toBe(1)
    })
  })

  scenario('被稱讚會害羞，加薪或吃員工餐會開心，被減薪會生氣，一陣子後恢復', ({ then, and }) => {
    then('被稱讚：害羞（臉紅的線），腳步輕快一點', () => {
      const o = crewMood(newCrewMood(0, 3), calm(1000, { feel: { face: 'shy', until: 4000 } }), 3)
      expect(o.emote).toBe('shy')
      expect(o.bounce).toBeGreaterThan(0)
    })
    and('加薪、員工餐：閃亮，走路有彈跳', () => {
      const o = crewMood(newCrewMood(0, 3), calm(1000, { feel: { face: 'happy', until: 4000 } }), 3)
      expect(o.emote).toBe('sparkle')
      expect(o.bounce).toBe(1)
    })
    and('減薪：怒氣符號', () => { expect(crewMood(newCrewMood(0, 3), calm(1000, { feel: { face: 'mad', until: 4000 } }), 3).emote).toBe('anger') })
    and('時間到了就恢復平常', () => { expect(crewMood(newCrewMood(0, 3), calm(5000, { feel: { face: 'happy', until: 4000 } }), 3).emote).toBe('none') })
  })

  scenario('客人抱怨等太久時，員工嚇一跳', ({ then, and }) => {
    then('抱怨的當下頭上跳出驚嘆號', () => { expect(crewMood(newCrewMood(0, 3), calm(10000, { rushAt: 9500 }), 3).emote).toBe('alarm') })
    and('過一下就消失', () => { expect(crewMood(newCrewMood(0, 3), calm(10000 + ALARM_MS, { rushAt: 10000 }), 3).emote).not.toBe('alarm') })
    and('嚇一跳比其他情緒優先（累的時候也一樣）', () => { expect(crewMood(newCrewMood(0, 3), calm(10000, { rushAt: 9900, tired: true }), 3).emote).toBe('alarm') })
  })

  scenario('被老闆催促後，趕一陣子', ({ then, and }) => {
    then('剛被催：冒汗、趕工', () => {
      const o = crewMood(newCrewMood(0, 3), calm(1000, { urgedAt: 500 }), 3)
      expect(o.emote).toBe('sweat')
      expect(o.hurry).toBe(1)
    })
    and('幾秒後恢復', () => { expect(crewMood(newCrewMood(0, 3), calm(500 + URGE_MS + 10, { urgedAt: 500 }), 3).emote).toBe('none') })
  })

  scenario('跟老闆關係好、店裡氣氛好又不忙時，偶爾哼歌', ({ when, then, and }) => {
    const w = { seen: [] as string[] }
    when('一段時間都不忙', () => { w.seen = run(newCrewMood(0, 3), 0, 60000, () => ({ bond: 85, atmos: 70 })) })
    then('有時候頭上冒出音符', () => { expect(w.seen.filter((e) => e === 'note').length).toBeGreaterThan(0) })
    and('不是一直哼（大部分時候什麼都沒有）', () => { expect(w.seen.filter((e) => e === 'none').length).toBeGreaterThan(w.seen.length * 0.6) })
    and('每次哼兩秒多', () => {
      let longest = 0, n = 0
      for (const e of w.seen) { n = e === 'note' ? n + 1 : 0; longest = Math.max(longest, n) }
      expect(longest * 100).toBeLessThanOrEqual(SPELL_MS + 100)
      expect(longest * 100).toBeGreaterThanOrEqual(SPELL_MS - 200)
    })
  })

  scenario('跟老闆關係冷淡的員工', ({ then, and }) => {
    then('不忙時偶爾嘆氣（烏雲線一下）', () => {
      const seen = run(newCrewMood(0, 3), 0, 60000, () => ({ bond: 15 }))
      expect(seen.filter((e) => e === 'gloom').length).toBeGreaterThan(0)
      expect(seen.filter((e) => e === 'note').length).toBe(0)
    })
    and('店裡很忙時會不耐煩（怒氣符號）', () => {
      const s = newCrewMood(0, 3)
      run(s, 0, PRESS_HOLD + 200, () => ({ bond: 15, load: 0.9 }))
      expect(crewMood(s, calm(PRESS_HOLD + 300, { bond: 15, load: 0.9 }), 3).emote).toBe('anger')
    })
  })

  scenario('一般的員工，店裡平常的時候', ({ then }) => {
    then('頭上什麼都沒有（不會整天冒圖示）', () => { expect(run(newCrewMood(0, 3), 0, 60000, () => ({}))).toEqual(Array(601).fill('none')) })
  })
})
