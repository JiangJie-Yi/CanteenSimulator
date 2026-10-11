// The rules of the game, checked on their own (npm test). Each block guards one module in src/game or src/data.
import { describe, expect, it } from 'vitest'
import { DISHES } from '@/data/menu'
import { findItem, MENU_MAX, MENU_MIN, partName, recipeKey, signature, suggestPrice, type Entry } from '@/data/recipes'
import { ROLES } from '@/data/staff'
import { buyAllCost, canServe, costOf, entryCost, goodsOf, needOf, partCost, partsOf, portionsLeft, takeStock } from '@/game/economy'
import { trialIdeas } from '@/game/research'
import { makeCandidates, seeded } from '@/game/hiring'
import { breadTaste, moodOf, PAIRING, PAIRING_DEFAULT, starText } from '@/game/taste'

const shop = (id: string) => DISHES.find((d) => d.id === id)!
const entry = (shopId: string, ids: string[], dabs: Entry['parts'][number]['dabs'] = []): Entry =>
  ({ key: ids.join('/'), shop: shopId, name: '', ja: '', price: 100, parts: ids.map((id) => ({ id, dabs, name: '', ja: '' })) })

describe('data: every shop', () => {
  it('has the four shops', () => {
    expect(DISHES.map((d) => d.id).sort()).toEqual(['bakery', 'beefnoodle', 'grilledfish', 'hotpot'])
  })
  it('has unique food ids within a shop, each findable', () => {
    for (const d of DISHES) {
      const ids = [...d.bases.map((b) => b.id), ...d.items.map((x) => x.id)]
      expect(new Set(ids).size, d.id).toBe(ids.length)
      for (const id of ids) expect(findItem(d, id)?.id).toBe(id)
    }
  })
  it('can stock everything a ready-made set takes', () => {
    for (const d of DISHES) {
      const goods = new Set(goodsOf(d).map((g) => g.id))
      for (const b of d.bases) for (const k of Object.keys(b.includes ?? {})) {
        // (a bowl's beef is bought for it; a grill set's parts are the grill's own foods)
        expect(goods.has(k) || d.items.some((x) => x.id === k), `${d.id}:${b.id} -> ${k}`).toBe(true)
      }
    }
  })
  it('opens with at least MENU_MIN dishes, never more than MENU_MAX', () => {
    for (const d of DISHES) expect(MENU_MIN[d.id], d.id).toBeGreaterThan(0)
    expect(MENU_MAX).toBe(40)
    for (const d of DISHES) expect(MENU_MIN[d.id]).toBeLessThanOrEqual(MENU_MAX)
  })
  it('staffs two cooks, a server and a cashier at each shop', () => {
    for (const d of DISHES) {
      const roles = ROLES[d.id]
      expect(roles.map((r) => `${r.role}x${r.max}`).sort(), d.id).toEqual(['cashierx1', 'chefx1', 'serverx1', 'sousx1'])
    }
  })
  it('has the grill pairing for every grill food (or the default)', () => {
    const g = shop('grilledfish')
    for (const it of g.items) for (const k of ['salt', 'soy', 'milk', 'peanut'] as const) {
      expect(typeof (PAIRING[k][it.id] ?? PAIRING_DEFAULT[k])).toBe('number')
    }
  })
})

describe('recipes: names and keys', () => {
  it('puts seasonings in a fixed order', () => {
    expect(signature(['soy', 'salt'])).toEqual(['salt', 'soy'])
    expect(signature({ soy: 1, salt: 0 })).toEqual(['soy'])
    expect(recipeKey('GrilledCorn', [])).toBe('GrilledCorn')
    expect(recipeKey('GrilledCorn', ['salt', 'soy'])).toBe('GrilledCorn|salt+soy')
  })
  it('names grill dishes the way they are known (鹽巴+玉米=鹽烤玉米)', () => {
    const corn = findItem(shop('grilledfish'), 'GrilledCorn')!
    expect(corn.name).toBe('玉米') // bought in raw: no 烤
    expect(partName(corn, '玉米', 'GrilledCorn', ['salt'], 'zh')).toBe('鹽烤玉米')
    expect(partName(corn, '玉米', 'GrilledCorn', ['soy'], 'zh')).toBe('醬刷玉米')
    expect(partName(corn, '玉米', 'GrilledCorn', [], 'zh')).toBe('烤玉米')
    expect(partName({ name: '杏鮑菇' }, '杏鮑菇', 'KingOyster', ['soy', 'peanut'], 'zh')).toBe('醬烤杏鮑菇佐花生粉')
  })
  it('names breads as a bakery would', () => {
    const c = findItem(shop('bakery'), 'CroissantDough')!
    expect(partName(c, '可頌', 'CroissantDough', [], 'zh', 'bake')).toBe('原味可頌')
    expect(partName(c, '可頌', 'CroissantDough', ['cheese', 'ham'], 'zh', 'bake')).toBe('火腿起司可頌')
  })
  it('suggests about three times the cost, in fives, at least NT$10', () => {
    expect(suggestPrice(20)).toBe(60)
    expect(suggestPrice(21) % 5).toBe(0)
    expect(suggestPrice(1)).toBe(10)
  })
})

describe('economy: cost and stock', () => {
  it('costs a share of the price, or the cost given', () => {
    expect(costOf({ id: 'Rice', price: 100 })).toBe(18)
    expect(costOf({ id: 'unknown', price: 100 })).toBe(38)
    expect(costOf({ price: 100, cost: 7 })).toBe(7)
  })
  it('adds the seasonings to a part’s cost', () => {
    const g = shop('grilledfish')
    const plain = partCost(g, { id: 'GrilledCorn', dabs: [], name: '', ja: '' })
    expect(partCost(g, { id: 'GrilledCorn', dabs: ['salt', 'soy'], name: '', ja: '' })).toBe(plain + 1 + 2)
    expect(entryCost(entry('grilledfish', ['GrilledCorn', 'GrilledCorn'], ['salt']))).toBe((plain + 1) * 2)
  })
  it('takes a bowl’s beef, not the bowl, out of stock', () => {
    const e = entry('beefnoodle', ['braised'])
    expect(needOf(e)).toEqual({ BeefShank: 1 })
    expect(partsOf(e)).toEqual({ braised: 1 })
  })
  it('serves only with stock enough, and takes it', () => {
    const e = entry('grilledfish', ['GrilledCorn', 'GrilledCorn'])
    expect(canServe(e, { GrilledCorn: 1 })).toBe(false)
    expect(canServe(e, { GrilledCorn: 2 })).toBe(true)
    expect(portionsLeft(e, { GrilledCorn: 5 })).toBe(2)
    expect(takeStock(e, { GrilledCorn: 5, Rice: 1 })).toEqual({ GrilledCorn: 3, Rice: 1 })
    expect(takeStock(e, { GrilledCorn: 1 })).toBeNull()
  })
  it('prices buying in everything as the sum of its goods', () => {
    const d = shop('bakery')
    expect(buyAllCost(d, 10)).toBe(goodsOf(d).reduce((n, g) => n + costOf(g) * 10, 0))
    expect(goodsOf(shop('beefnoodle')).some((g) => g.id === 'braised')).toBe(false) // (bowls aren't bought)
  })
})

describe('research: what the second chef can try', () => {
  it('has at least MENU_MIN ideas at every shop, so each can open', () => {
    for (const d of DISHES) expect(trialIdeas(d).length, d.id).toBeGreaterThanOrEqual(MENU_MIN[d.id])
  })
  it('only suggests seasonings that suit the food', () => {
    const ideas = trialIdeas(shop('grilledfish'))
    expect(ideas.some((x) => x.id === 'GrilledCorn' && x.dabs.join() === 'soy')).toBe(true)
    expect(ideas.some((x) => x.id === 'Aji' && x.dabs.includes('milk'))).toBe(false) // (condensed milk on fish: no)
  })
})

describe('taste', () => {
  it('bakes best just past done, badly raw or burnt', () => {
    const bake = shop('bakery').bake!
    const at = (r: number) => breadTaste(bake, 'CroissantDough', [], r)
    expect(at(1.1)).toBeGreaterThan(at(0.5))
    expect(at(1.1)).toBeGreaterThan(at(2))
    for (const r of [0, 0.5, 1, 1.5, 3]) expect(at(r)).toBeGreaterThanOrEqual(0)
  })
  it('turns a rating into stars and a face', () => {
    expect(starText(100)).toBe('★★★★★')
    expect(starText(0)).toBe('★☆☆☆☆')
    expect(moodOf(null)).toBe('wait')
    expect(moodOf(90)).toBe('love')
    expect(moodOf(10)).toBe('sad')
  })
})

describe('hiring: a new lot of people each game', () => {
  it('gives every shop applicants for every job, with unique names', () => {
    const taken = new Set<string>()
    for (const d of DISHES) {
      const people = makeCandidates(d.id, seeded(7), taken)
      for (const r of ROLES[d.id]) expect(people.filter((w) => w.role === r.role).length, `${d.id} ${r.role}`).toBeGreaterThanOrEqual(3)
      for (const w of people) {
        expect(w.note.length, w.zh).toBeGreaterThan(1)
        expect(w.wage).toBeGreaterThanOrEqual(130)
        for (const k of [w.skill, w.speed, w.stamina]) expect(k).toBeGreaterThan(0)
      }
    }
    expect(taken.size).toBe(DISHES.length * 13)
  })
  it('is different from one game to the next', () => {
    const a = makeCandidates('hotpot', seeded(1)).map((w) => w.zh).join()
    const b = makeCandidates('hotpot', seeded(2)).map((w) => w.zh).join()
    expect(a).not.toBe(b)
  })
  it('makes Japanese names readable in Japanese', () => {
    const w = makeCandidates('hotpot', seeded(3))
    for (const x of w) expect(x.ja).toMatch(/^\S+ \S+$/)
  })
})
