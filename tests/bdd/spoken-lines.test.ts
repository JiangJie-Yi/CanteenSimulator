import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { LINES } from '@/data/lines'

// (item 180, the owner's, 2026-11-16: "the owner's and the customers' words don't sound natural; the staff have nothing to say?")
feature('店裡說出口的話像真的店', () => {
  scenario('點兩份同樣的菜，說成兩份，不把菜名說兩次', ({ given, when, then, and }) => {
    given('一位客人點了兩份味噌烤茄子和一杯清酒', (w) => { w.names = ['味噌烤茄子', '味噌烤茄子', '清酒'] })
    when('他開口點菜', (w) => { w.zh = LINES.zh.order(3, w.names); w.ja = LINES.ja.order(3, ['焼きなす', '焼きなす']); w.en = LINES.en.order(3, ['Grilled eggplant', 'Grilled eggplant']) })
    then('中文說「兩份」，菜名只出現一次', (w) => {
      expect(w.zh).toContain('味噌烤茄子兩份')
      expect(w.zh.split('味噌烤茄子').length - 1).toBe(1)
      expect(w.zh).toContain('清酒')
    })
    and('日文說「2つ」、英文說「2」', (w) => {
      expect(w.ja).toContain('焼きなす2つ')
      expect(w.en).toContain('2 Grilled eggplant')
    })
  })
  scenario('只點一份就只說菜名', ({ then }) => {
    then('不加份數', () => {
      const line = LINES.zh.order(1, ['鹽烤鮭魚'])
      expect(line).toContain('鹽烤鮭魚')
      expect(line).not.toContain('份鹽烤')
      expect(line).not.toMatch(/鹽烤鮭魚[一兩三]份/)
    })
  })
  scenario('老闆把菜烤好會喊出來', ({ then }) => {
    then('喊的是菜名加「好了」，短短一句', () => {
      expect(LINES.zh.callDone('鹽烤鮭魚')).toBe('鹽烤鮭魚好了！')
      expect(LINES.ja.callDone('塩焼き鮭')).toContain('あがり')
      expect(LINES.en.callDone('Salmon')).toContain('up')
    })
  })
  scenario('客人的評語不管點什麼都說得通', ({ then }) => {
    then('五顆星的評語不會說成「烤魚」', () => {
      for (let id = 0; id < 4; id++) expect(LINES.zh.verdict(id, '醬烤年糕', 5)).not.toContain('烤魚')
    })
  })
})
