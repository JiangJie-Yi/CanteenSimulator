import { expect } from 'vitest'
import { feature, scenario } from './bdd'
import { pickOrders } from '@/game/orderPick'

/** a dice that rolls the given numbers in turn (0..1), the last one ever after */
const rolls = (...r: number[]) => { let i = 0; return () => r[Math.min(i++, r.length - 1)] }

// (item 203: a customer took two picks off the menu at random, and two sold out went out with "nothing to be had", 1 star, though the menu
// still had dishes to be had)
feature('客人只點菜單上還點得到的（第 203 項）', () => {
  scenario('挑到賣完的那道，就從其他還有的裡面再挑', ({ given, when, then, and }) => {
    given('菜單上三道菜，秋刀魚賣完了', (w) => { w.menu = ['秋刀魚', '鯖魚', '香魚']; w.out = new Set(['秋刀魚']); w.tried = [] })
    when('客人想點兩道，骰子每次都先落在第一道', (w) => {
      w.got = pickOrders(w.menu, 2, (d: string) => { w.tried.push(d); return !w.out.has(d) }, rolls(0))
    })
    then('點到兩道，都是還有的', (w) => { expect(w.got).toEqual(['鯖魚', '鯖魚']) })
    and('賣完的那道只問過一次', (w) => { expect(w.tried.filter((d: string) => d === '秋刀魚')).toHaveLength(1) })
  })
  scenario('只有全部都點不到，才什麼都沒點', ({ given, when, then }) => {
    given('菜單上兩道菜都賣完了', (w) => { w.menu = ['秋刀魚', '鯖魚'] })
    when('客人想點兩道', (w) => { w.got = pickOrders(w.menu, 2, () => false, rolls(0.5)) })
    then('什麼都沒點到', (w) => { expect(w.got).toEqual([]) })
  })
  scenario('還有的菜照樣隨機挑，同一道可以點兩份', ({ given, when, then }) => {
    given('菜單上兩道菜都還有', (w) => { w.menu = ['秋刀魚', '鯖魚'] })
    when('骰子落在後一道、前一道', (w) => { w.got = pickOrders(w.menu, 2, () => true, rolls(0.9, 0.1)) })
    then('點到的就是骰子落的那兩道', (w) => { expect(w.got).toEqual(['鯖魚', '秋刀魚']) })
  })
})
