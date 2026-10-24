import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { bestStage, moodOf, stageOf, starsOf, starText, timingLoss } from '@/game/taste'

feature('調味與口味評分', () => {
  scenario('烤的進度決定現在是哪個階段', ({ given, when, then }) => {
    given('一塊剛放上火的魚、一塊烤到一半的、一塊烤過頭的、一塊已經離火的', (w) => { w.at = { fresh: 0.05, half: 0.4, done: 0.9, over: 1.4, off: null } })
    when('各自看它的階段', (w) => { w.s = Object.fromEntries(Object.entries(w.at).map(([k, r]) => [k, stageOf(r as number | null)])) })
    then('依序是 before、early、late、after、after', (w) => {
      expect(w.s).toEqual({ fresh: 'before', half: 'early', done: 'late', over: 'after', off: 'after' })
    })
  })

  scenario('在最佳時機放調味不扣分，放錯時機才扣', ({ given, when, then, and }) => {
    given('鹽的最佳時機', (w) => { w.best = bestStage('salt') })
    when('正好在那個時機放鹽', (w) => { w.loss = timingLoss('salt', w.best) })
    then('不扣分', (w) => { expect(w.loss).toBe(0) })
    and('在別的時機放鹽會扣分', (w) => {
      const others = (['before', 'early', 'late', 'after'] as const).filter((s) => s !== w.best)
      expect(others.some((s) => timingLoss('salt', s) > 0)).toBe(true)
    })
  })

  scenario('美味分數換成 1 到 5 顆星，不會出界', ({ when, then }) => {
    when('把 0、50、100 以及超出範圍的分數換成星星', (w) => { w.stars = [-20, 0, 50, 100, 140].map(starsOf) })
    then('至少 1 顆、至多 5 顆，而且分數越高星越多', (w) => {
      const s = w.stars as number[]
      expect(Math.min(...s)).toBe(1)
      expect(Math.max(...s)).toBe(5)
      expect([...s].sort((a, b) => a - b)).toEqual(s)
    })
    then('星星文字永遠是五個字', () => { for (const t of [0, 33, 77, 100]) expect([...starText(t)]).toHaveLength(5) })
  })

  scenario('客人的表情依評分而變', ({ when, then }) => {
    when('依序給 90、70、50、30、10 分，以及還在等', (w) => { w.m = [90, 70, 50, 30, 10, null].map((r) => moodOf(r)) })
    then('表情由愛、開心、普通、不滿到難過，等待時是 wait', (w) => { expect(w.m).toEqual(['love', 'happy', 'ok', 'meh', 'sad', 'wait']) })
  })
})
