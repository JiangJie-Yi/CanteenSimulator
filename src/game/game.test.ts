// The rules of the game, checked on their own (npm test). Each block guards one module in src/game or src/data.
import { describe, expect, it } from 'vitest'
import { DISHES } from '@/data/menu'
import { findItem, MENU_MAX, MENU_MIN, partName, recipeKey, signature, suggestPrice, type Entry } from '@/data/recipes'
import { ROLES } from '@/data/staff'
import { buyAllCost, canServe, costOf, entryCost, goodsOf, needOf, PAR, partCost, partsOf, portionsLeft, REORDER_AT, restockOrder, supplierDiscount, takeStock, topUpOrder } from '@/game/economy'
import { trialIdeas } from '@/game/research'
import { makeCandidates, pickHires, seeded, valueOf } from '@/game/hiring'
import { bestDabs, expectedTaste, understand } from '@/game/chefChat'
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
      expect(roles.map((r) => `${r.role}x${r.max}`).sort(), d.id).toEqual(['cashierx1', 'chefx1', 'serverx2', 'sousx1', 'stockx1'])
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
    expect(taken.size).toBe(DISHES.length * 16)
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

describe('chef chat: understanding what the owner asks', () => {
  const g = shop('grilledfish'), b = shop('bakery'), n = shop('beefnoodle')
  it('picks out the food and its seasonings, however it is put', () => {
    expect(understand('幫我做鹽烤玉米', g)).toEqual({ kind: 'make', id: 'GrilledCorn', dabs: ['salt'] })
    expect(understand('鮭魚刷醬油烤一下', g)).toEqual({ kind: 'make', id: 'Salmon', dabs: ['soy'] })
    expect(understand('來一串原味的香菇', g)).toMatchObject({ kind: 'make', dabs: [] })
    expect(understand('烤個年糕，加煉乳和花生', g)).toEqual({ kind: 'make', id: 'NetMochi', dabs: ['milk', 'peanut'] })
    expect(understand('做紅喉', g)).toEqual({ kind: 'make', id: 'Nodoguro', dabs: null })
    expect(understand('火腿起司可頌一個', b)).toEqual({ kind: 'make', id: 'CroissantDough', dabs: ['cheese', 'ham'] })
    expect(understand('煮一碗紅燒牛肉麵', n)).toMatchObject({ kind: 'make', id: 'braised' })
  })
  it('tells a question from an order', () => {
    expect(understand('玉米配什麼好？', g)).toEqual({ kind: 'advise', id: 'GrilledCorn' })
    expect(understand('有什麼推薦的嗎', g)).toEqual({ kind: 'advise' })
    expect(understand('隨便幫我試三道', g)).toEqual({ kind: 'batch', n: 3 })
    expect(understand('庫存還夠嗎', g)).toEqual({ kind: 'stock' })
    expect(understand('好啊', g)).toEqual({ kind: 'yes' })
    expect(understand('辛苦了', g)).toEqual({ kind: 'thanks' })
    expect(understand('幫我做個東西', g)).toEqual({ kind: 'makeWhat' })
    expect(understand('今天天氣真好', g)).toEqual({ kind: 'chat', topic: 'weather' })
    expect(understand('嗚啦啦', g)).toEqual({ kind: 'unknown' })
  })
  it('knows what suits a food', () => {
    expect(bestDabs(g, 'GrilledCorn')[0]).toBe('soy')
    expect(bestDabs(g, 'Aji')).not.toContain('milk')
    expect(expectedTaste(g, 'Aji', ['milk'])).toBeLessThan(expectedTaste(g, 'Aji', ['salt']))
  })
})

describe('game/economy: the stock keeper', () => {
  const grill = shop('grilledfish')
  const menu = [entry('grilledfish', ['Saury']), entry('grilledfish', ['GrilledCorn'])]
  it('tops up only what the menu uses and is running low, back to PAR', () => {
    const { buy, cost } = restockOrder(grill, menu, { Saury: 2, GrilledCorn: REORDER_AT + 1, Salmon: 0 }, 1e6, 60)
    expect(buy).toEqual({ Saury: PAR - 2 })
    expect(cost).toBe(costOf(grill.items.find((x) => x.id === 'Saury')!) * (PAR - 2))
  })
  it('orders nothing it can’t pay for, and nothing without a menu', () => {
    expect(restockOrder(grill, menu, {}, 0, 60).cost).toBe(0)
    expect(restockOrder(grill, [], {}, 1e6, 60).cost).toBe(0)
  })
  it('gets a better price the more skilled, at most 5% off', () => {
    expect(supplierDiscount(50)).toBe(0)
    expect(supplierDiscount(100)).toBe(0.05)
    const cheap = restockOrder(grill, menu, {}, 1e6, 100).cost
    expect(cheap).toBeLessThan(restockOrder(grill, menu, {}, 1e6, 60).cost)
  })
})

describe('game/chefChat: by kind, left to him, small talk', () => {
  const grill = shop('grilledfish')
  it('understands a kind of food, asked about or wanted', () => {
    const fish = understand('魚類', grill)
    expect(fish.kind).toBe('byKind')
    if (fish.kind === 'byKind') {
      expect(fish.ids).toContain('Saury')
      expect(fish.ask).toBe(false)
    }
    const veg = understand('有什麼蔬菜推薦？', grill)
    expect(veg.kind === 'byKind' && veg.ask).toBe(true)
    // (a food named outright still wins over its kind)
    expect(understand('鮭魚配什麼好？', grill)).toEqual({ kind: 'advise', id: 'Salmon' })
  })
  it('leaves it to him', () => {
    expect(understand('你幫我客製化就好', grill)).toEqual({ kind: 'batch', n: 1 })
    expect(understand('你決定', grill)).toEqual({ kind: 'batch', n: 1 })
    expect(understand('都來一點', grill).kind).not.toBe('unknown')
  })
  it('makes small talk', () => {
    expect(understand('今天天氣好熱', grill)).toEqual({ kind: 'chat', topic: 'weather' })
    expect(understand('@@?', grill)).toEqual({ kind: 'chat', topic: 'confused' })
    expect(understand('你是誰', grill)).toEqual({ kind: 'chat', topic: 'who' })
    expect(understand('講個笑話', grill)).toEqual({ kind: 'chat', topic: 'joke' })
  })
})

describe('game/economy: 一鍵補貨', () => {
  const grill = shop('grilledfish')
  it('tops everything up to PAR, leaving what has more alone', () => {
    const { buy, cost } = topUpOrder(grill, { Saury: 4, Salmon: 15 })
    expect(buy.Saury).toBe(PAR - 4)
    expect(buy.Salmon).toBeUndefined()
    expect(buy.GrilledCorn).toBe(PAR)
    expect(cost).toBe(Object.entries(buy).reduce((n, [id, q]) => n + costOf(goodsOf(grill).find((g) => g.id === id)!) * q, 0))
    expect(topUpOrder(grill, Object.fromEntries(goodsOf(grill).map((g) => [g.id, PAR]))).cost).toBe(0)
  })
})

describe('hiring: who they are, and 一鍵徵人', () => {
  const people = makeCandidates('grilledfish', seeded(7))
  it('gives everyone an age that fits their age group, and a few words of their own', () => {
    for (const w of people) {
      const [lo, hi] = { young: [19, 29], middle: [30, 49], old: [50, 68] }[w.look.age]
      expect(w.years).toBeGreaterThanOrEqual(lo)
      expect(w.years).toBeLessThanOrEqual(hi)
      expect(w.intro.length).toBeGreaterThan(8)
    }
  })
  it('fills every open job with its best-value applicant, and nothing already filled', () => {
    const roles = ROLES.grilledfish
    const all = pickHires(people, roles, {})
    expect(all.length).toBe(roles.reduce((n, r) => n + r.max, 0))
    for (const r of roles) {
      const picks = all.filter((w) => w.role === r.role)
      expect(picks.length).toBe(r.max)
      for (const w of people.filter((x) => x.role === r.role && !picks.includes(x))) for (const p of picks) expect(valueOf(p)).toBeGreaterThanOrEqual(valueOf(w))
    }
    const chef = all.find((w) => w.role === 'chef')!
    expect(pickHires(people, roles, { [chef.id]: true }).some((w) => w.role === 'chef')).toBe(false)
  })
})
